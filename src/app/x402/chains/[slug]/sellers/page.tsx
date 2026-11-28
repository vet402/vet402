import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { guideChainBySlug } from "@/components/site/x402-guides";
import { TableScroll } from "@/components/site/TableScroll";
import { articleJsonLd, breadcrumbJsonLd, pageMetadata } from "@/lib/seo";
import { SITE_URL } from "@/lib/site-url";
import { safeJsonLd } from "@/lib/util/json-ld";
import { reputationSellerPath } from "@/lib/sellers/reputation";
import {
  chainSellersHeadline,
  chainSellersPath,
  getChainSellerRosterForSlug,
  rosterAsOfDay,
} from "@/lib/sellers/chain-roster";
import { SELLER_INDEX_DELIVERY_WINDOW_DAYS } from "@/lib/sellers/seller-index";
import { GUIDE_CHAINS } from "@/components/site/x402-guides";

export const dynamicParams = true;
export const revalidate = 300;

type Params = { slug: string };

function fmtDay(iso: string): string {
  return iso.slice(0, 10);
}

function fmtUtc(iso: string): string {
  return iso.replace(/\.\d{3}Z$/, "Z").replace("T", " ").slice(0, 16);
}

export async function generateStaticParams() {
  const { getChainSellerRosterCached } = await import("@/lib/sellers/chain-roster");
  const slugs: { slug: string }[] = [];
  for (const chain of GUIDE_CHAINS) {
    const roster = await getChainSellerRosterCached(chain.caip2).catch(() => null);
    if (roster && roster.rows.length > 0) slugs.push({ slug: chain.slug });
  }
  return slugs;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const chain = guideChainBySlug((await params).slug);
  if (!chain) return {};
  const roster = await getChainSellerRosterForSlug(chain.slug).catch(() => null);
  if (!roster || roster.rows.length === 0) return {};
  const day = rosterAsOfDay(roster);
  const title = day
    ? `${chainSellersHeadline(chain.publicName)} as of ${day}`
    : chainSellersHeadline(chain.publicName);
  return pageMetadata({
    title,
    description: `Hosts where vet402 recorded a delivered x402 purchase on ${chain.publicName} in the last ${SELLER_INDEX_DELIVERY_WINDOW_DAYS} days, with the same index gate as /sellers.`,
    path: chainSellersPath(chain.slug),
  });
}

export default async function ChainSellersPage({ params }: { params: Promise<Params> }) {
  const chain = guideChainBySlug((await params).slug);
  if (!chain) notFound();
  const roster = await getChainSellerRosterForSlug(chain.slug).catch(() => null);
  if (!roster || roster.rows.length === 0) notFound();

  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const path = chainSellersPath(chain.slug);
  const headline = chainSellersHeadline(chain.publicName);
  const asOfDay = rosterAsOfDay(roster);
  const article = articleJsonLd({
    headline,
    description: `Delivered vet402 purchases on ${chain.publicName} in the last ${SELLER_INDEX_DELIVERY_WINDOW_DAYS} days, by host.`,
    path,
    datePublished: asOfDay ?? roster.fetchedAt.slice(0, 10),
    dateModified: asOfDay ?? roster.fetchedAt.slice(0, 10),
  });
  const breadcrumb = breadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "By chain", path: "/x402/chains" },
    { name: chain.publicName, path: `/x402/chains/${chain.slug}` },
    { name: "Sellers", path },
  ]);
  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: headline,
    numberOfItems: roster.rows.length,
    itemListElement: roster.rows.map((row, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${SITE_URL}${reputationSellerPath(row.host)}`,
      name: row.host,
    })),
  };

  return (
    <main className="px-4 pt-8 pb-4 sm:px-6 md:px-8 md:pt-12">
      <article className="sheet">
        <script type="application/ld+json" nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: safeJsonLd(article) }} />
        <script type="application/ld+json" nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumb) }} />
        <script type="application/ld+json" nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: safeJsonLd(itemListJsonLd) }} />

        <div className="doc-head doc-head-compact">
          <div className="doc-head-col">
            <span>Independent Measurement</span>
            <span>{chain.publicName}</span>
            <span>
              Ledger read <time dateTime={roster.fetchedAt}>{fmtUtc(roster.fetchedAt)} UTC</time>
            </span>
          </div>
          <div className="doc-head-col">
            <span>vet402</span>
            <span>
              <Link href={`/x402/chains/${chain.slug}`} className="underline">
                {chain.publicName} purchases
              </Link>
            </span>
            {asOfDay ? <span>Latest delivery {asOfDay}</span> : null}
          </div>
        </div>

        <h1 className="doc-title mt-8">{headline}</h1>
        <p className="doc-p">
          Each row is a host where vet402 recorded at least one delivered x402 purchase on {chain.publicName} in the last{" "}
          {SELLER_INDEX_DELIVERY_WINDOW_DAYS} days and the host passes the same index gate as{" "}
          <Link href="/sellers" className="doc-link">
            /sellers
          </Link>{" "}
          (delivery in the last {SELLER_INDEX_DELIVERY_WINDOW_DAYS} days or a signed payee claim). vet402 does not name hosts
          that failed to deliver or that do not pass that gate.
        </p>
        <p className="doc-p">
          CAIP-2 <code>{chain.caip2}</code>. Counts and dates come from the purchase ledger, not from listing price.
        </p>
        <div className="rule-double mx-auto mt-6 w-full max-w-[34ch]" />

        <TableScroll label={`x402 sellers on ${chain.publicName}`} className="mt-4">
          <table className="fact-table">
            <caption className="sr-only">
              Hosts with a delivered vet402 purchase on {chain.publicName} in the last {SELLER_INDEX_DELIVERY_WINDOW_DAYS} days
            </caption>
            <thead>
              <tr>
                <th scope="col">Host</th>
                <th scope="col">Last delivered</th>
                <th scope="col" className="num">
                  Delivered ({SELLER_INDEX_DELIVERY_WINDOW_DAYS}d)
                </th>
                <th scope="col">Seller page</th>
              </tr>
            </thead>
            <tbody>
              {roster.rows.map((row) => (
                <tr key={row.host}>
                  <td className="font-mono text-sm">{row.host}</td>
                  <td>
                    <time dateTime={row.lastDeliveredAt}>{fmtDay(row.lastDeliveredAt)}</time>
                  </td>
                  <td className="num">{row.deliveredCount.toLocaleString("en-US")}</td>
                  <td>
                    <Link href={reputationSellerPath(row.host)} className="doc-link">
                      Purchase record
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>

        <p className="doc-p mt-8">
          Lane context for {chain.publicName} is on{" "}
          <Link href={`/x402/chains/${chain.slug}`} className="doc-link">
            {chain.headline}
          </Link>
          . How to check a seller before paying is{" "}
          <Link href="/x402/check-a-seller" className="doc-link">
            on its own page
          </Link>
          .
        </p>
      </article>
    </main>
  );
}