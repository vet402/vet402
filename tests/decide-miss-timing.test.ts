// db_decide の Server-Timing 細分段（2026-11-29 依頼 AD）。
import { PgDialect } from "drizzle-orm/pg-core";
import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import type { CheckSellerMissTimingMs } from "@/lib/api/check-seller-miss-timing";
import { formatPresignCheckTiming } from "@/lib/api/check-seller-miss-timing";
import { __setDbForTests } from "@/lib/db/client";
import { decide, type DecisionResult } from "@/lib/decision/decide";
import { decisionCache, invalidateDecisionCache } from "@/lib/decision/cache";
import { runDbMissTimingPhase, timedDbExecute } from "@/lib/db/miss-timing";

const OBS = "00000000-0000-4000-8000-000000000099";
const CANONICAL_URL = "https://miss-timing.example/api";
const PAY_TO = "0x1111111111111111111111111111111111111111";

const NEW_MISS_FIELDS = [
  "db_decide_registry_total",
  "db_decide_registry_wait",
  "db_decide_registry_q",
  "db_decide_registry_qn",
  "db_decide_refunds_wait",
  "db_decide_refunds_q",
  "db_decide_refunds_qn",
  "db_decide_build",
] as const;

const LEGACY_MISS_FIELDS = ["db_decide", "db_decide_conn", "db_decide_q", "db_decide_qn", "db_decide_app"] as const;

function chainProxy(): unknown {
  return new Proxy(function () {}, {
    get(_t, prop) {
      if (prop === "then") return (resolve: (v: unknown[]) => void) => resolve([]);
      return () => chainProxy();
    },
    apply() {
      return chainProxy();
    },
  });
}

type RefundsMode = "none" | "ok" | "fail";

function makeDecideFakeDb(refunds: RefundsMode) {
  const dialect = new PgDialect();
  const endpointRow = {
    id: OBS,
    resource_id: "a".repeat(64),
    endpoint_hash: "b".repeat(64),
    canonical_url: CANONICAL_URL,
    method: "GET",
    pay_to: refunds === "none" ? null : PAY_TO,
    network: "eip155:8453",
    payee_id: null,
    declared_schema: null,
    raw_method: "GET",
    declared_input: null,
    listing_status: "active",
  };
  const refundQuery = (flat: string) =>
    /DISTINCT lower\(pu\.pay_to\)|x402_payer_refund_transfers|sellerHostSql|payer_refund/.test(flat) ||
    (/x402_l1_purchases pu/.test(flat) && /lower\(pu\.pay_to\) IN/.test(flat));

  return {
    execute: async (q: unknown) => {
      const { sql: text } = dialect.sqlToQuery(q as Parameters<typeof dialect.sqlToQuery>[0]);
      const flat = text.replace(/\s+/g, " ").trim();
      if (refunds === "fail" && refundQuery(flat)) throw new Error("refund read failed");
      if (/FROM x402_endpoints WHERE id =/.test(flat)) return { rows: [endpointRow] };
      if (/FROM x402_l0_probes/.test(flat)) {
        return {
          rows: [
            {
              probed_at: "2026-11-28T00:00:00.000Z",
              verdict: "pass",
              dialect: "v2",
              fail_reason: null,
              price_consistent: true,
              metadata_consistent: true,
            },
          ],
        };
      }
      if (/DISTINCT lower\(pu\.pay_to\)/.test(flat)) return { rows: [{ pay_to: PAY_TO }] };
      if (/FROM x402_l1_purchases/.test(flat) || /x402_l1_purchases/.test(flat)) return { rows: [] };
      if (/x402_payer_refund_transfers/.test(flat)) return { rows: [] };
      if (/registry_writes/.test(flat)) return { rows: [] };
      if (/runtime_flags/.test(flat)) return { rows: [] };
      if (/settlements/.test(flat)) return { rows: [{ raw: 0, real: 0, test: 0, measurement: 0, payers: 0 }] };
      if (/decision_lookups/.test(flat)) return { rows: [] };
      return { rows: [] };
    },
    select: () => chainProxy(),
    insert: () => ({
      values: () => ({
        onConflictDoUpdate: () => ({
          then: (r: () => void) => {
            r();
            return Promise.resolve();
          },
        }),
      }),
    }),
  };
}

function baseDecideReq(missTiming?: CheckSellerMissTimingMs) {
  return {
    role: "payer" as const,
    observatoryId: OBS,
    operatorBlacklist: false,
    skipScore: true,
    ...(missTiming ? { missTiming } : {}),
  };
}

/** scoredAt / cacheExpiresAt は呼び出し時刻で 1 ms ずれることがある。判定の比較から外す。 */
function decisionBodyForCompare(r: DecisionResult) {
  const { scoredAt: _s, cacheExpiresAt: _c, ...body } = r;
  return body;
}

function assertNumericMissFields(miss: CheckSellerMissTimingMs, expect: "set" | "unset") {
  for (const field of [...NEW_MISS_FIELDS, ...LEGACY_MISS_FIELDS]) {
    if (expect === "set") {
      assert.equal(typeof miss[field], "number", `${field} は数値`);
      assert.ok(Number.isFinite(miss[field]!), `${field} は有限`);
    } else {
      assert.equal(miss[field], undefined, `${field} はキャッシュヒットで付かない`);
    }
  }
}

afterEach(() => {
  invalidateDecisionCache();
  __setDbForTests(null);
  delete process.env.REGISTRY_WRITES_ENABLED;
});

test("formatPresignCheckTiming: db_decide の新しい細分段は dur のみ", () => {
  const s = formatPresignCheckTiming(5, "fresh", 1, {
    db_decide: 600,
    db_decide_registry_total: 580,
    db_decide_registry_wait: 2,
    db_decide_registry_q: 50,
    db_decide_registry_qn: 1,
    db_decide_refunds_wait: 1,
    db_decide_refunds_q: 120,
    db_decide_refunds_qn: 1,
    db_decide_build: 4,
  });
  assert.match(s, /db_decide_registry_total;dur=580\.0/);
  assert.match(s, /db_decide_registry_wait;dur=2\.0/);
  assert.match(s, /db_decide_registry_q;dur=50\.0/);
  assert.match(s, /db_decide_registry_qn;dur=1\.0/);
  assert.match(s, /db_decide_refunds_wait;dur=1\.0/);
  assert.match(s, /db_decide_refunds_q;dur=120\.0/);
  assert.match(s, /db_decide_refunds_qn;dur=1\.0/);
  assert.match(s, /db_decide_build;dur=4\.0/);
  assert.doesNotMatch(s, /https?:|SELECT|secret/i);
});

test("decide: 判定キャッシュヒットでは db_decide の新しい細分段を付けない", async () => {
  const miss: CheckSellerMissTimingMs = {};
  const result = seededDecision();
  decisionCache.set(`${OBS}|payer|-|0|0|noscore|1`, {
    result,
    expiresAt: Date.now() + 60_000,
  });
  await decide({
    role: "payer",
    observatoryId: OBS,
    operatorBlacklist: false,
    skipScore: true,
    missTiming: miss,
  });
  assertNumericMissFields(miss, "unset");
});

test("decide miss timing: registry / refunds の副フェーズは q と qn を数える", async () => {
  const miss: CheckSellerMissTimingMs = {};
  const t0 = performance.now();
  await runDbMissTimingPhase("decide_registry", async () => {
    await timedDbExecute(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
  }).then(({ slice }) => {
    miss.db_decide_registry_q = slice.q;
    miss.db_decide_registry_qn = slice.qn;
    miss.db_decide_registry_total = performance.now() - t0;
  });
  assert.equal(miss.db_decide_registry_qn, 1);
  assert.ok((miss.db_decide_registry_q ?? 0) >= 5, "registry 副フェーズの q は待ち時間を反映する");
  await runDbMissTimingPhase("decide_refunds", async () => {
    await timedDbExecute(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
  }).then(({ slice }) => {
    miss.db_decide_refunds_q = slice.q;
    miss.db_decide_refunds_qn = slice.qn;
  });
  assert.equal(miss.db_decide_refunds_qn, 1);
  assert.ok((miss.db_decide_refunds_q ?? 0) >= 5, "返金副フェーズの q は待ち時間を反映する");
  const timing = formatPresignCheckTiming(1, "fresh", 0, miss);
  assert.match(timing, /db_decide_registry_q/);
  assert.match(timing, /db_decide_refunds_q/);
});

test("decide cache miss: missTiming で新しい段と既存の db_decide 系が数値で入る", async () => {
  __setDbForTests(makeDecideFakeDb("ok") as never);
  const miss: CheckSellerMissTimingMs = {};
  const d = await decide(baseDecideReq(miss));
  assert.ok(d);
  assertNumericMissFields(miss, "set");
  assert.equal(typeof miss.db_outcomes, "number");
});

test("decide: missTiming の有無で DecisionResult は同じ（返金集計あり）", async () => {
  __setDbForTests(makeDecideFakeDb("ok") as never);
  const plain = await decide(baseDecideReq());
  invalidateDecisionCache();
  const miss: CheckSellerMissTimingMs = {};
  const timed = await decide(baseDecideReq(miss));
  assert.ok(plain);
  assert.ok(timed);
  assert.ok(timed.refunds, "返金集計が載る");
  assert.deepEqual(decisionBodyForCompare(plain), decisionBodyForCompare(timed));
});

test("decide: missTiming の有無で DecisionResult は同じ（返金の読みが失敗）", async () => {
  __setDbForTests(makeDecideFakeDb("fail") as never);
  const plain = await decide(baseDecideReq());
  invalidateDecisionCache();
  const miss: CheckSellerMissTimingMs = {};
  const timed = await decide(baseDecideReq(miss));
  assert.ok(plain);
  assert.ok(timed);
  assert.equal(timed.refunds, null);
  assert.deepEqual(decisionBodyForCompare(plain), decisionBodyForCompare(timed));
});

test("decide: 2 回目はキャッシュヒットで新しい細分段を付けない", async () => {
  __setDbForTests(makeDecideFakeDb("none") as never);
  const missFirst: CheckSellerMissTimingMs = {};
  await decide(baseDecideReq(missFirst));
  assertNumericMissFields(missFirst, "set");
  const missSecond: CheckSellerMissTimingMs = {};
  await decide(baseDecideReq(missSecond));
  assertNumericMissFields(missSecond, "unset");
});

function seededDecision(): DecisionResult {
  return {
    evidence_age: null,
    subject: {
      type: "resource",
      id: null,
      endpoint_id: "h",
      observatory_id: OBS,
      canonical_url: CANONICAL_URL,
      method: "GET",
    },
    role: "payer",
    payer: null,
    recommendation: "ALLOW",
    reason_codes: [],
    reasons: [],
    facts: { l0: { status: "pass" } } as DecisionResult["facts"],
    spending_halted: false,
    not_attempted_reason: null,
    freshness: { l0: null, l1: null, l2: null },
    l1_basis: null,
    verified_terms: null,
    verified_pay_to_by_network: [],
    evidence: [],
    degraded: false,
    policy: "allow_only",
    refunds: null,
    rules_version: "test",
    registry: { status: "off", tx_hash: null },
    scoredAt: "2026-11-28T00:00:00.000Z",
    cacheExpiresAt: "2026-11-28T00:05:00.000Z",
    disclaimer: "test",
  };
}