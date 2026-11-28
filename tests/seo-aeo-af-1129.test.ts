// 2026-11-29 依頼 AF: refunds title, Bazaar by-resource on check-a-seller, deprecated 0-100 score copy.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { publicEnglishFaults } from "@/lib/diagnose/copy";
import { CHECK_SELLER_SECTIONS } from "@/lib/x402/check-a-seller-sections";

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

const REFUNDS_TITLE = "x402 refunds: failed payment and non-delivery";

/** Public prose must not present the deprecated 0–100 score as today's API. Paths are repo-relative. */
const SCORE_COPY_ALLOWLIST: ReadonlyArray<{ rel: string; reason: string }> = [
  { rel: "src/lib/scoring/", reason: "internal score engine implementation" },
  { rel: "src/lib/decision/decide.ts", reason: "transitional include_score response field" },
  { rel: "src/lib/api/score-deprecation.ts", reason: "deprecation headers on score API responses" },
  { rel: "src/lib/chain/registry.ts", reason: "ERC-8004 response mapping comments" },
  { rel: "src/components/docs/ApiDocsRest.tsx", reason: "OpenAPI-style reference for deprecated score endpoints" },
  { rel: "src/app/payee/", reason: "payee score profile pages during migration" },
  { rel: "src/app/agent/", reason: "agent score profile pages during migration" },
  { rel: "src/app/api/", reason: "score API route handlers" },
  { rel: "src/app/playground/", reason: "live demo that calls deprecated score routes" },
  { rel: "src/lib/blog.ts", reason: "historical posts with September 2026 editor's note" },
  { rel: "src/app/globals.css", reason: "unrelated numeric CSS tokens" },
  { rel: "src/components/site/Figures.tsx", reason: "SVG viewBox coordinates" },
  { rel: "src/lib/net/public-address.ts", reason: "IPv6 documentation range check" },
  { rel: "src/lib/e4/form1.ts", reason: "fixture hex strings" },
  { rel: "src/lib/figures/share.ts", reason: "internal chart-scale comments" },
  { rel: "public/data/", reason: "on-chain fixture JSON" },
  { rel: "src/lib/x402/trust-score-sections.ts", reason: "trust-score page copy explaining deprecation" },
  { rel: "src/app/x402/trust-score/", reason: "deprecation explainer page" },
  { rel: "src/app/tokyo/", reason: "Tokyo demo UI unrelated to trust scores" },
  { rel: "src/lib/docs/mcp-page-text.ts", reason: "Wilson basis points 0 to 10000, not trust score" },
  { rel: "src/lib/docs/api-endpoints-data.tsx", reason: "API reference tables" },
];

const FORBIDDEN_SCORE_PHRASES: ReadonlyArray<{ re: RegExp; label: string }> = [
  { re: /returns today/i, label: "returns today" },
  { re: /stays available to API/i, label: "stays available to API" },
  { re: /sold by lookup quota/i, label: "sold by lookup quota" },
  { re: /Scoring \(the 0/i, label: "Scoring (the 0… present tense" },
  { re: /trust score this API returns/i, label: "trust score this API returns" },
];

const SCORE_MENTION = /(?<![0-9])0\s*(?:–|-|to)\s*100\b|(?<![0-9])0–100\b|(?<![0-9])0-100\b/i;
const SCORE_OK =
  /deprecated (in September 2026|its 0|its own 0)|older (signal|API|opinion)|transitional 0|Editor's note \(September 2026\)|were the older|not L0|never an L0|never a L0|separate 0|not these L0|not 0 to 100 scores|shows no 0 to 100|Instead of 0 to 100/i;

function isAllowlisted(rel: string): string | null {
  for (const { rel: prefix, reason } of SCORE_COPY_ALLOWLIST) {
    if (rel === prefix || rel.startsWith(prefix)) return reason;
  }
  return null;
}

function walkPublicFiles(dir: string, base: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    const st = statSync(abs);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === ".next") continue;
      walkPublicFiles(abs, base, out);
    } else if (/\.(tsx?|md|txt)$/.test(name)) {
      out.push(relative(base, abs));
    }
  }
  return out;
}

function extractProse(src: string): string[] {
  const noComments = src
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, " ");
  const literals = [...noComments.matchAll(/`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\])*"/g)].map((m) =>
    m[0].slice(1, -1),
  );
  const jsx = [...noComments.matchAll(/>([^<>{}\n]+)</g)]
    .map((m) => m[1]!.trim())
    .filter((t) => t.length > 0 && !/^\{/.test(t));
  return [...literals, ...jsx];
}

test("refunds page title and H1 answer failed payment queries", () => {
  const src = read("src/app/x402/refunds/page.tsx");
  assert.match(src, new RegExp(REFUNDS_TITLE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(src, /getObservatoryStatsCached/);
  assert.doesNotMatch(src, /REFUNDS_SNAPSHOT/);
  assert.doesNotMatch(src, /2026-11-09.*14427/);
  const withBrand = `${REFUNDS_TITLE} | vet402`;
  assert.ok(withBrand.length <= 62, `title with brand is ${withBrand.length} chars: ${withBrand}`);
  for (const line of extractProse(src)) {
    if (line.length < 40 || /^[a-z]{2}-[A-Z]{2}$/.test(line)) continue;
    assert.deepEqual(publicEnglishFaults(line), [], `refunds prose: ${line.slice(0, 80)}`);
  }
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
  assert.doesNotMatch(llms, /after a run — compare/);
});

test("public surface does not pitch 0–100 as the current API", () => {
  const roots = ["src", "public", "content"].map((d) => join(ROOT, d)).filter((d) => statSync(d).isDirectory());
  const files = roots.flatMap((d) => walkPublicFiles(d, ROOT));
  const hits: Array<{ rel: string; line: string; why: string }> = [];
  const allowedHits: Array<{ rel: string; reason: string }> = [];

  for (const rel of files) {
    const allow = isAllowlisted(rel);
    const src = read(rel);
  const prose = extractProse(src);
    const body = prose.join("\n");
    for (const { re, label } of FORBIDDEN_SCORE_PHRASES) {
      if (re.test(body)) {
        if (allow) {
          allowedHits.push({ rel, reason: `${allow} (${label})` });
        } else {
          hits.push({ rel, line: label, why: "forbidden phrase" });
        }
      }
    }
    for (const chunk of prose) {
      if (!SCORE_MENTION.test(chunk)) continue;
      if (allow) {
        if (!allowedHits.some((h) => h.rel === rel)) allowedHits.push({ rel, reason: allow });
        continue;
      }
      if (FORBIDDEN_SCORE_PHRASES.some(({ re }) => re.test(chunk))) continue;
      if (!SCORE_OK.test(chunk) && !SCORE_OK.test(body)) {
        hits.push({ rel, line: chunk.slice(0, 120), why: "0–100 without deprecation context" });
      }
    }
  }

  assert.deepEqual(
    hits,
    [],
    hits.map((h) => `${h.rel}: ${h.why} — ${h.line}`).join("\n") || "ok",
  );
  assert.ok(allowedHits.length >= 1, "allowlist should cover score implementation paths");
});

test("blog trust-score post opens with September 2026 deprecation note", () => {
  const blog = read("src/lib/blog.ts");
  assert.match(
    blog,
    /Editor's note \(September 2026\): The 0 to 100 trust score API this post describes was deprecated/,
  );
});