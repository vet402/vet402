// db_decide の Server-Timing 細分段（2026-11-29 依頼 AD）。
import { readFileSync } from "node:fs";
import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import type { CheckSellerMissTimingMs } from "@/lib/api/check-seller-miss-timing";
import { formatPresignCheckTiming } from "@/lib/api/check-seller-miss-timing";
import { decide, type DecisionResult } from "@/lib/decision/decide";
import { decisionCache, invalidateDecisionCache } from "@/lib/decision/cache";
import { runDbMissTimingPhase, timedDbExecute } from "@/lib/db/miss-timing";

const OBS = "00000000-0000-4000-8000-000000000099";

function seededDecision(): DecisionResult {
  return {
    evidence_age: null,
    subject: {
      type: "resource",
      id: null,
      endpoint_id: "h",
      observatory_id: OBS,
      canonical_url: "https://example.com/x",
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

afterEach(() => {
  invalidateDecisionCache();
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
  // DATABASE_URL 無しでは isSpendingHalted は fail-closed（halted=1）。キーを合わせる。
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
  assert.equal(miss.db_decide_registry_total, undefined);
  assert.equal(miss.db_decide_registry_wait, undefined);
  assert.equal(miss.db_decide_refunds_wait, undefined);
  assert.equal(miss.db_decide_build, undefined);
  assert.equal(miss.db_decide_registry_q, undefined);
  assert.equal(miss.db_decide_refunds_q, undefined);
});

test("decide miss timing: registry / refunds の副フェーズは q と qn を数える", async () => {
  const miss: CheckSellerMissTimingMs = {};
  const t0 = performance.now();
  await runDbMissTimingPhase("decide_registry", async () => {
    await timedDbExecute(async () => {
      await new Promise((r) => setTimeout(r, 2));
    });
  }).then(({ slice }) => {
    miss.db_decide_registry_q = slice.q;
    miss.db_decide_registry_qn = slice.qn;
    miss.db_decide_registry_total = performance.now() - t0;
  });
  assert.equal(miss.db_decide_registry_qn, 1);
  assert.ok((miss.db_decide_registry_q ?? 0) >= 2);
  await runDbMissTimingPhase("decide_refunds", async () => {
    await timedDbExecute(async () => {
      await new Promise((r) => setTimeout(r, 3));
    });
  }).then(({ slice }) => {
    miss.db_decide_refunds_q = slice.q;
    miss.db_decide_refunds_qn = slice.qn;
  });
  assert.equal(miss.db_decide_refunds_qn, 1);
  assert.ok((miss.db_decide_refunds_q ?? 0) >= 3);
  const timing = formatPresignCheckTiming(1, "fresh", 0, miss);
  assert.match(timing, /db_decide_registry_q/);
  assert.match(timing, /db_decide_refunds_q/);
});

test("decide.ts: finishDecide 経路で missTiming に新しい段を書く", () => {
  const src = readFileSync("src/lib/decision/decide.ts", "utf8");
  for (const field of [
    "db_decide_registry_total",
    "db_decide_registry_wait",
    "db_decide_registry_q",
    "db_decide_registry_qn",
    "db_decide_refunds_wait",
    "db_decide_refunds_q",
    "db_decide_refunds_qn",
    "db_decide_build",
  ] as const) {
    assert.match(src, new RegExp(`missTiming[^\\n]*${field}`), `${field} を decide が書く`);
  }
});