// Chain seller rosters for /x402/chains/{slug}/sellers (I4 gate, 30-day delivered on that chain).
import { unstable_cache } from "next/cache";
import { getDb } from "@/lib/db/client";
import { PUBLIC_READ_REVALIDATE } from "@/lib/observatory/public-read-revalidate";
import { guideChainBySlug } from "@/components/site/x402-guides";
import { readChainDeliveredStatsOnNetwork, type ChainDeliveredStatsRow } from "./reader";
import { getSellerBoardCached } from "./cached";
import {
  readIndexableHostsOnNetworkInWindow,
  readIndexableSellerHosts,
  SELLER_INDEX_DELIVERY_WINDOW_DAYS,
} from "./seller-index";

type Db = NonNullable<ReturnType<typeof getDb>>;

export type ChainSellerRosterRow = {
  host: string;
  lastDeliveredAt: string;
  deliveredCount: number;
};

export type ChainSellerRoster = {
  fetchedAt: string;
  networkFilter: string;
  rows: ChainSellerRosterRow[];
};

export function chainSellersPath(slug: string): string {
  return `/x402/chains/${slug}/sellers`;
}

export function chainSellersHeadline(publicName: string): string {
  return `x402 sellers on ${publicName}`;
}

/** Latest delivered attempt among roster rows (UTC date for titles and sitemap). */
export function rosterAsOfDay(roster: Pick<ChainSellerRoster, "fetchedAt" | "rows">): string | null {
  let latest: string | null = null;
  for (const row of roster.rows) {
    if (!latest || row.lastDeliveredAt > latest) latest = row.lastDeliveredAt;
  }
  if (latest && /^\d{4}-\d{2}-\d{2}/.test(latest)) return latest.slice(0, 10);
  const fetchedAt = roster.fetchedAt;
  return fetchedAt && /^\d{4}-\d{2}-\d{2}/.test(fetchedAt) ? fetchedAt.slice(0, 10) : null;
}

export function rosterRowsForHosts(stats: readonly ChainDeliveredStatsRow[], hosts: readonly string[]): ChainSellerRosterRow[] {
  const allowed = new Set(hosts);
  return stats
    .filter((r) => allowed.has(r.host))
    .map((r) => ({
      host: r.host,
      lastDeliveredAt: r.lastDeliveredAt,
      deliveredCount: r.deliveredCount,
    }));
}

export async function readChainSellerRoster(db: Db, networkFilter: string, boardHosts: readonly string[]): Promise<ChainSellerRoster> {
  const fetchedAt = new Date().toISOString();
  const days = SELLER_INDEX_DELIVERY_WINDOW_DAYS;
  const [stats, onNetwork, globalIndexable] = await Promise.all([
    readChainDeliveredStatsOnNetwork(db, networkFilter, days),
    readIndexableHostsOnNetworkInWindow(db, networkFilter, days),
    readIndexableSellerHosts(db, boardHosts),
  ]);
  const global = new Set(globalIndexable);
  const hosts = onNetwork.filter((h) => global.has(h));
  const rows = rosterRowsForHosts(stats, hosts);
  return { fetchedAt, networkFilter, rows };
}

async function collectChainSellerRoster(networkFilter: string): Promise<ChainSellerRoster> {
  const db = getDb();
  if (!db) return { fetchedAt: new Date().toISOString(), networkFilter, rows: [] };
  const boardHosts = await getSellerBoardCached()
    .then((b) => b.sellers.map((s) => s.host))
    .catch(() => [] as string[]);
  return readChainSellerRoster(db, networkFilter, boardHosts);
}

export const getChainSellerRosterCached: (networkFilter: string) => Promise<ChainSellerRoster> = unstable_cache(
  async (networkFilter: string) => collectChainSellerRoster(networkFilter),
  ["sellers:chain-roster:v1"],
  { revalidate: PUBLIC_READ_REVALIDATE, tags: ["observatory"] },
);

export async function getChainSellerRosterForSlug(slug: string): Promise<ChainSellerRoster | null> {
  const chain = guideChainBySlug(slug);
  if (!chain) return null;
  return getChainSellerRosterCached(chain.caip2);
}