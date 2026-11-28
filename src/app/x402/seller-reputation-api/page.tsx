import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import CodeBlock from "@/components/docs/CodeBlock";
import { TableScroll } from "@/components/site/TableScroll";
import { articleJsonLd, breadcrumbJsonLd, pageMetadata } from "@/lib/seo";
import { safeJsonLd } from "@/lib/util/json-ld";
import {
  SELLER_REPUTATION_API,
  SELLER_REPUTATION_CHECK_FIELDS,
  SELLER_REPUTATION_API_PUBLISHED,
} from "@/lib/x402/seller-reputation-sections";
import { AeoFaqBlock } from "@/components/site/AeoFaqBlock";
import { X402_ECONOMY_SERIES } from "@/lib/site/x402-doc-head";
import { AEO_CHECK_CURL_EXAMPLE_COM, AEO_CHECK_RESPONSE_EXAMPLE } from "@/lib/x402/aeo-check-example";
import { faqPageJsonLd, sellerReputationApiFaq } from "@/lib/x402/aeo-faqs";
import { getObservatoryStatsCached } from "@/lib/observatory/cached-reads";

const PAGE = SELLER_REPUTATION_API;

export const metadata: Metadata = pageMetadata({
  title: PAGE.title,
  description: PAGE.description,
  path: PAGE.path,
  markdown: true,
});

export const revalidate = 300;

export default async function SellerReputationApiPage() {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const stats = await getObservatoryStatsCached().catch(() => null);
  const readAt = stats?.readAt ?? null;
  const faq = sellerReputationApiFaq();
  const article = articleJsonLd({
    headline: PAGE.h1,
    description: PAGE.description,
    path: PAGE.path,
    datePublished: SELLER_REPUTATION_API_PUBLISHED,
  });
  const breadcrumb = breadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "x402", path: "/x402" },
    { name: "Seller reputation API", path: PAGE.path },
  ]);

  return (
    <main className="px-4 pt-8 pb-4 sm:px-6 md:px-8 md:pt-12">
      <article className="sheet">
        <script type="application/ld+json" nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: safeJsonLd(article) }} />
        <script type="application/ld+json" nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumb) }} />
        <script type="application/ld+json" nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: safeJsonLd(faqPageJsonLd(faq)) }} />

        <div className="doc-head doc-head-compact">
          <div className="doc-head-col">
            <span>Independent Measurement</span>
            <span>Before an agent pays</span>
            {readAt ? (
              <span>
                Ledger read <time dateTime={readAt}>{readAt.slice(0, 16).replace("T", " ")} UTC</time>
              </span>
            ) : (
              <span>Ledger unread</span>
            )}
          </div>
          <div className="doc-head-col">
            <span>vet402</span>
            <span>{X402_ECONOMY_SERIES}</span>
            <span>
              Page published <time dateTime={SELLER_REPUTATION_API_PUBLISHED}>{SELLER_REPUTATION_API_PUBLISHED}</time>
            </span>
          </div>
        </div>

        <h1 className="doc-title mt-8">{PAGE.h1}</h1>
        {PAGE.lead.map((sentence) => (
          <p key={sentence} className="doc-p">
            {sentence}
          </p>
        ))}
        <div className="rule-double mx-auto mt-6 w-full max-w-[34ch]" />

        <h2 className="sec-head">
          <span className="sec-no">1.</span>
          <span>{PAGE.sections.curl.title}</span>
        </h2>
        <p className="doc-p">{PAGE.sections.curl.body}</p>
        <CodeBlock label="GET /api/v1/check" code={AEO_CHECK_CURL_EXAMPLE_COM} />
        <p className="doc-p mt-4">Illustrative JSON shape (not a live read):</p>
        <CodeBlock label="check response" code={AEO_CHECK_RESPONSE_EXAMPLE} />

        <h2 className="sec-head">
          <span className="sec-no">2.</span>
          <span>{PAGE.sections.fields.title}</span>
        </h2>
        <p className="doc-p">{PAGE.sections.fields.body}</p>
        <TableScroll label="Check response fields" className="mt-4">
          <table className="fact-table">
            <caption className="sr-only">Fields returned by GET /api/v1/check</caption>
            <thead>
              <tr>
                <th scope="col">Field</th>
                <th scope="col">Meaning</th>
              </tr>
            </thead>
            <tbody>
              {SELLER_REPUTATION_CHECK_FIELDS.map((row) => (
                <tr key={row.field}>
                  <td>
                    <code>{row.field}</code>
                  </td>
                  <td>{row.meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>

        <h2 className="sec-head">
          <span className="sec-no">3.</span>
          <span>{PAGE.sections.decision.title}</span>
        </h2>
        <p className="doc-p">{PAGE.sections.decision.body}</p>

        <h2 className="sec-head">
          <span className="sec-no">4.</span>
          <span>{PAGE.sections.verdicts.title}</span>
        </h2>
        <ul className="doc-p list-disc pl-6 space-y-2">
          <li>
            <strong>ALLOW.</strong> {PAGE.sections.verdicts.allow}
          </li>
          <li>
            <strong>WARN.</strong> {PAGE.sections.verdicts.warn}
          </li>
          <li>
            <strong>BLOCK.</strong> {PAGE.sections.verdicts.block}
          </li>
        </ul>

        <AeoFaqBlock faq={faq} sectionNo={5} />

        <p className="doc-p mt-6">
          Full endpoint list and rate limits:{" "}
          <Link href="/docs/api" className="doc-link">
            Decision API reference
          </Link>
          . Step-by-step buyer guide:{" "}
          <Link href="/x402/check-a-seller" className="doc-link">
            How a seller check works
          </Link>
          . Hosted MCP:{" "}
          <Link href="/docs/mcp" className="doc-link">
            x402 MCP server
          </Link>{" "}
          (tool <code>check_x402_seller</code>).
        </p>
      </article>
    </main>
  );
}