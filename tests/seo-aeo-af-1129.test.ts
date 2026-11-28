// 2026-11-29 依頼 AF: refunds title, Bazaar by-resource on check-a-seller, deprecated 0-100 score copy.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CHECK_SELLER_SECTIONS } from "@/lib/x402/check-a-seller-sections";

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

const REFUNDS_TITLE =
  "x402 refunds: what happens when a payment fails or the seller does not deliver";

test("refunds page title and H1 answer failed payment queries", () => {
  const src = read("src/app/x402/refunds/page.tsx");
  assert.match(src, new RegExp(REFUNDS_TITLE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(src, /getObservatoryStatsCached/);
  assert.doesNotMatch(src, /REFUNDS_SNAPSHOT/);
  assert.doesNotMatch(src, /2026-11-09.*14427/);
});

test("check-a-seller names Bazaar and by-resource curl", () => {
  const page = read("src/app/x402/check-a-seller/page.tsx");
  assert.match(page, /bazaarDelivery/);
  assert.match(CHECK_SELLER_SECTIONS.bazaarDelivery.title, /Check an x402 Bazaar seller before paying/);
  assert.match(CHECK_SELLER_SECTIONS.bazaarDelivery.body, /\/api\/v1\/delivery\/by-resource/);
  assert.match(CHECK_SELLER_SECTIONS.bazaarDelivery.body, /curl -sS/);
});

test("llms.txt lists refunds and check-a-seller with updated blurbs", () => {
  const llms = read("public/llms.txt");
  assert.ok(llms.includes("https://vet402.com/x402/refunds"));
  assert.match(llms, /failed payment and non-delivery/);
  assert.match(llms, /Bazaar delivery by resource/);
});

const PUBLIC_SCORE_PROSE = [
  "src/app/x402/check-a-seller/page.tsx",
  "src/lib/x402/check-a-seller-sections.ts",
  "src/components/docs/ApiDocsRest.tsx",
];

test("public seller-check copy does not pitch 0-100 as the current API", () => {
  for (const file of PUBLIC_SCORE_PROSE) {
    const src = read(file);
    assert.doesNotMatch(src, /\bolder API\b/i, file);
    if (file.includes("check-a-seller")) {
      assert.match(src, /deprecated in September 2026/, file);
    }
  }
  const docs = read("src/components/docs/ApiDocsRest.tsx");
  assert.match(docs, /deprecated in September 2026/);
  assert.match(docs, /SDK: read a deprecated score/);
});

test("blog trust-score post opens with September 2026 deprecation note", () => {
  const blog = read("src/lib/blog.ts");
  assert.match(
    blog,
    /Editor's note \(September 2026\): The 0 to 100 trust score API this post describes was deprecated/,
  );
});