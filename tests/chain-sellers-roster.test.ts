// Chain seller roster pages: I4 gate, 30-day window, sitemap, no revenue, data date from ledger rows.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import sitemap from "@/app/sitemap";
import { SITE_URL } from "@/lib/site-url";
import { GUIDE_CHAINS } from "@/components/site/x402-guides";
import {
  chainSellersHeadline,
  chainSellersPath,
  rosterAsOfDay,
  rosterRowsForHosts,
} from "@/lib/sellers/chain-roster";
import {
  readIndexableHostsOnNetworkInWindow,
  selectIndexableSellerHosts,
  sellerIndexGateOf,
  sellerPageIndexable,
  SELLER_INDEX_DELIVERY_WINDOW_DAYS,
} from "@/lib/sellers/seller-index";

const ROOT = join(import.meta.dirname, "..");

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

function publicProse(src: string): string {
  const noComments = src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\{\/\*[\s\S]*?\*\/\}/g, " ");
  const literals = [...noComments.matchAll(/`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\])*"/g)].map((m) => m[0]);
  const jsx = [...noComments.matchAll(/<(?:[A-Za-z][\w.]*)(?:\s[^<>]*?)?>([^<>{}]*)</g)].map((m) => m[1]);
  return [...literals, ...jsx].join("\n");
}

test("chain seller page H1 and metadata path", () => {
  const page = read("src/app/x402/chains/[slug]/sellers/page.tsx");
  assert.match(page, /chainSellersHeadline/);
  assert.match(page, /notFound\(\)/);
  assert.match(page, /rosterAsOfDay/);
  assert.equal(chainSellersHeadline("Solana"), "x402 sellers on Solana");
  assert.equal(chainSellersPath("solana"), "/x402/chains/solana/sellers");
});

test("rosterAsOfDay uses latest delivery, not page build time", () => {
  assert.equal(
    rosterAsOfDay({
      fetchedAt: "2026-11-29T12:00:00.000Z",
      rows: [{ host: "a.example", lastDeliveredAt: "2026-11-16T08:00:00.000Z", deliveredCount: 1 }],
    }),
    "2026-11-16",
  );
  assert.equal(rosterAsOfDay({ fetchedAt: "2026-11-29T12:00:00.000Z", rows: [] }), "2026-11-29");
});

test("rosterRowsForHosts: undelivered-only host stays out even if stats query leaked", () => {
  const stats = [
    { host: "good.example", lastDeliveredAt: "2026-11-20T00:00:00.000Z", deliveredCount: 2 },
    { host: "bad.example", lastDeliveredAt: "2026-11-20T00:00:00.000Z", deliveredCount: 1 },
  ];
  const delivered = new Set(["good.example"]);
  const claimed = new Set<string>();
  const gateHosts = selectIndexableSellerHosts(
    stats.map((s) => s.host),
    delivered,
    claimed,
  );
  assert.deepEqual(gateHosts, ["good.example"]);
  const rows = rosterRowsForHosts(stats, gateHosts);
  assert.deepEqual(
    rows.map((r) => r.host),
    ["good.example"],
  );
  assert.equal(sellerPageIndexable(sellerIndexGateOf("bad.example", delivered, claimed)), false);
});

test("30-day window constant is shared across gate and roster", () => {
  assert.equal(SELLER_INDEX_DELIVERY_WINDOW_DAYS, 30);
  const index = read("src/lib/sellers/chain-roster.ts");
  assert.match(index, /SELLER_INDEX_DELIVERY_WINDOW_DAYS/);
  assert.match(index, /readIndexableHostsOnNetworkInWindow/);
  assert.equal(typeof readIndexableHostsOnNetworkInWindow, "function");
});

test("zero-host chains: page calls notFound and generateStaticParams skips empty rosters", () => {
  const page = read("src/app/x402/chains/[slug]/sellers/page.tsx");
  assert.match(page, /roster\.rows\.length === 0/);
  assert.match(page, /generateStaticParams/);
  assert.doesNotMatch(page, /noindex:\s*true/);
});

test("chain guide links to roster, not an inline host list", () => {
  const guide = read("src/app/x402/chains/[slug]/page.tsx");
  assert.match(guide, /chainSellersPath/);
  assert.doesNotMatch(guide, /\/x402\/sellers\/\$\{/);
});

test("chain sellers page: no revenue fields (C2)", () => {
  const prose = publicProse(read("src/app/x402/chains/[slug]/sellers/page.tsx"));
  assert.doesNotMatch(prose, /\bMRR\b/i);
  assert.doesNotMatch(prose, /\brevenue\b/i);
  assert.doesNotMatch(prose, /price_usd/);
});

test("sitemap only lists chain seller paths for lanes with hosts", async () => {
  const src = read("src/app/sitemap.ts");
  assert.match(src, /chainSellerSitemapEntries/);
  assert.match(src, /getChainSellerRosterCached/);
  assert.match(src, /rosterAsOfDay/);
  const urls = (await sitemap()).map((e) => e.url);
  for (const chain of GUIDE_CHAINS) {
    const url = `${SITE_URL}${chainSellersPath(chain.slug)}`;
    if (urls.includes(url)) {
      const page = read("src/app/x402/chains/[slug]/sellers/page.tsx");
      assert.match(page, /notFound/);
    }
  }
});

test("structured data lists only roster hosts", () => {
  const page = read("src/app/x402/chains/[slug]/sellers/page.tsx");
  assert.match(page, /itemListJsonLd/);
  assert.match(page, /roster\.rows\.map/);
});

test("/sellers date comes from board latest attempt, not a hardcoded snapshot", () => {
  const board = read("src/lib/sellers/board.ts");
  assert.match(board, /boardAsOfDay/);
  const sellersPage = read("src/app/sellers/page.tsx");
  assert.match(sellersPage, /boardAsOfDay\(b\)/);
  assert.doesNotMatch(sellersPage, /2026-11-16/);
});

test("readIndexableHostsOnNetworkInWindow is wired in seller-index", () => {
  const src = read("src/lib/sellers/seller-index.ts");
  assert.match(src, /readHostsWithDeliveredOnNetworkInWindow/);
  assert.match(src, /selectIndexableSellerHosts/);
});