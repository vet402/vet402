import { test } from "node:test";
import assert from "node:assert/strict";
import { sql } from "drizzle-orm";
import { assertTestDatabaseIsNotProduction } from "./helpers/pg-test-guard";

const TEST_DB = process.env.TEST_DATABASE_URL;

if (!TEST_DB) {
  test("chain seller roster (skipped: TEST_DATABASE_URL not set)", { skip: true }, () => {});
} else {
  assertTestDatabaseIsNotProduction(TEST_DB);
  process.env.DATABASE_URL = TEST_DB;

  test("readChainSellerRoster: 30-day window on Solana network at boundary", async () => {
    const { getDb } = await import("@/lib/db/client");
    const { readChainSellerRoster } = await import("@/lib/sellers/chain-roster");
    const { resourceId, endpointHash, payeeId } = await import("@/lib/ids/canonical");
    const db = getDb();
    assert.ok(db);
    const PAYER = "0x1111111111111111111111111111111111111111";
    const SOL = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";
    const rowsOf = (raw: unknown) => (Array.isArray(raw) ? raw : ((raw as { rows?: unknown[] }).rows ?? [])) as { id: string }[];
    const HOSTS = {
      in: "chain-roster-in.example",
      out: "chain-roster-out.example",
      settledOnly: "chain-roster-settled.example",
    };
    const w = {
      in: "So11111111111111111111111111111111111111112",
      out: "So22222222222222222222222222222222222222222",
      settledOnly: "So33333333333333333333333333333333333333333",
    };
    const created: string[] = [];
    async function endpoint(host: string, wallet: string): Promise<string> {
      const url = `https://${host}/v1/roster`;
      const out = rowsOf(
        await db!.execute(sql`
          INSERT INTO x402_endpoints (resource_key, resource_url, method, network, pay_to, price_amount, price_asset,
                                      canonical_url, resource_id, endpoint_hash, payee_id)
          VALUES (${`${host}/v1/roster`}, ${url}, 'GET', 'eip155:8453', ${wallet}, '1000', '0xusdc',
                  ${url}, ${resourceId("GET", url)}, ${endpointHash(url)}, ${payeeId("eip155:8453", wallet)})
          RETURNING id::text AS id`),
      );
      created.push(out[0].id);
      return out[0].id;
    }
    let k = 0;
    async function purchase(endpointId: string, wallet: string, network: string, http: number, minutesAgo: number) {
      k += 1;
      const tx = `0x${k.toString(16).padStart(64, "b")}`;
      await db!.execute(sql`
        INSERT INTO x402_l1_purchases
          (endpoint_id, status, network, asset, pay_to, amount_units, spent_units, payer, tx_hash,
           attempted_at, settlement_verified_at, http_status_paid, payload_non_empty, raw_response_meta)
        VALUES (${endpointId}::uuid, 'settled', ${network}, '0xusdc', ${wallet}, '1000', '1000', ${PAYER}, ${tx},
                now() - make_interval(mins => ${minutesAgo}::int), now() - make_interval(mins => ${minutesAgo}::int),
                ${http}, true, ${JSON.stringify({})}::jsonb)`);
    }
    const DAY = 24 * 60;
    const inEp = await endpoint(HOSTS.in, w.in);
    const outEp = await endpoint(HOSTS.out, w.out);
    const settledEp = await endpoint(HOSTS.settledOnly, w.settledOnly);
    await purchase(inEp, w.in, SOL, 200, 30 * DAY - 1);
    await purchase(outEp, w.out, SOL, 200, 30 * DAY + 1);
    await purchase(settledEp, w.settledOnly, SOL, 500, 5 * DAY);
  const boardHosts = [HOSTS.in, HOSTS.out, HOSTS.settledOnly];
    try {
      const roster = await readChainSellerRoster(db, SOL, boardHosts);
      const hosts = roster.rows.map((r) => r.host);
      assert.equal(hosts.includes(HOSTS.in), true);
      assert.equal(hosts.includes(HOSTS.out), false);
      assert.equal(hosts.includes(HOSTS.settledOnly), false);
    } finally {
      for (const id of created) {
        await db.execute(sql`DELETE FROM x402_l1_purchases WHERE endpoint_id = ${id}::uuid`);
        await db.execute(sql`DELETE FROM x402_endpoints WHERE id = ${id}::uuid`);
      }
    }
  });
}