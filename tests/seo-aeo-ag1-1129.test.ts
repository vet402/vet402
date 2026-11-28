// 2026-11-29 依頼 AG1: FAQPage, ledger dates, curl examples on AEO pages.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  chainSlugFaq,
  chainsHubFaq,
  faqPageJsonLd,
  sellerReputationApiFaq,
  statisticsFaq,
  trustScoreFaq,
} from "@/lib/x402/aeo-faqs";
import { guideChainBySlug } from "@/components/site/x402-guides";
import { AEO_CHECK_CURL_EXAMPLE_COM, AEO_CHECK_CURL_GEDX402 } from "@/lib/x402/aeo-check-example";
import { X402_ECONOMY_SERIES } from "@/lib/site/x402-doc-head";

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

const AEO_PAGES = [
  "src/app/x402/chains/page.tsx",
  "src/app/x402/chains/[slug]/page.tsx",
  "src/app/x402/statistics/page.tsx",
  "src/app/x402/trust-score/page.tsx",
  "src/app/x402/seller-reputation-api/page.tsx",
] as const;

test("AEO pages emit FAQPage JSON-LD and body Questions", () => {
  for (const file of AEO_PAGES) {
    const src = read(file);
    assert.match(src, /"@type": "FAQPage"|faqPageJsonLd/, `${file}: missing FAQPage JSON-LD`);
    assert.match(src, /AeoFaqBlock/, `${file}: FAQ not in body`);
  }
});

test("FAQ builders cover search phrases", () => {
  const hub = chainsHubFaq(true, "2026-11-29T00:00:00.000Z");
  assert.ok(hub.some((q) => q.question.includes("x402 settlements by chain")));
  assert.ok(hub.some((q) => q.question.includes("Which chains does vet402 buy")));
  const base = guideChainBySlug("base");
  assert.ok(base);
  const slugFaq = chainSlugFaq(base!, undefined, true, "2026-11-29T00:00:00.000Z");
  assert.ok(slugFaq.some((q) => q.question.includes("Base")));
  const stats = statisticsFaq(
    true,
    "2026-11-29T00:00:00.000Z",
    { l1: { attempts: 1, settled: 1, delivered: 1 } },
  );
  assert.ok(stats.some((q) => q.question.includes("x402 statistics")));
  assert.ok(trustScoreFaq().some((q) => /trust score/i.test(q.question)));
  assert.ok(sellerReputationApiFaq().some((q) => /seller reputation API/i.test(q.question)));
});

test("JSON-LD mainEntity matches FAQ items", () => {
  const faq = trustScoreFaq();
  const json = faqPageJsonLd(faq) as { mainEntity: { name: string; acceptedAnswer: { text: string } }[] };
  assert.equal(json.mainEntity.length, faq.length);
  for (let i = 0; i < faq.length; i++) {
    assert.equal(json.mainEntity[i].name, faq[i].question);
    assert.equal(json.mainEntity[i].acceptedAnswer.text, faq[i].answer);
  }
});

test("doc head labels publication date separately from ledger read", () => {
  for (const file of [
    "src/app/x402/chains/page.tsx",
    "src/app/x402/statistics/page.tsx",
    "src/app/x402/trust-score/page.tsx",
    "src/app/x402/seller-reputation-api/page.tsx",
  ]) {
    const src = read(file);
    assert.match(src, /Guide published|Page published/, file);
    assert.match(src, /X402_ECONOMY_SERIES/, file);
    assert.doesNotMatch(src, /<span>\{GUIDE_UPDATED\}<\/span>/, file);
    assert.doesNotMatch(src, /<span>\{TRUST_SCORE_PUBLISHED\}<\/span>/, file);
  }
  assert.match(read("src/app/x402/statistics/page.tsx"), /stats\.readAt|readAt/);
  assert.match(read("src/app/x402/chains/page.tsx"), /stats\.readAt/);
});

test("trust-score and seller-reputation pages show curl against a real check route", () => {
  assert.ok(existsSync("src/app/api/v1/check/route.ts"));
  const trust = read("src/app/x402/trust-score/page.tsx");
  const rep = read("src/app/x402/seller-reputation-api/page.tsx");
  assert.match(trust, /AEO_CHECK_CURL_GEDX402/);
  assert.match(rep, /AEO_CHECK_CURL_EXAMPLE_COM/);
  assert.match(trust, /AEO_CHECK_RESPONSE_EXAMPLE/);
  assert.match(rep, /AEO_CHECK_RESPONSE_EXAMPLE/);
  assert.match(AEO_CHECK_CURL_GEDX402, /\/api\/v1\/check\?url=/);
  assert.match(AEO_CHECK_CURL_EXAMPLE_COM, /\/api\/v1\/check\?url=/);
});

test("AEO public prose avoids we/our and semicolons in new FAQ copy", () => {
  const prose = [
    ...chainsHubFaq(false, null),
    ...trustScoreFaq(),
    ...sellerReputationApiFaq(),
  ]
    .map((q) => `${q.question} ${q.answer}`)
  .join("\n");
  assert.doesNotMatch(prose, /\b(we|our|us)\b/i);
  assert.doesNotMatch(prose, /;/);
  assert.doesNotMatch(prose, /—/);
});