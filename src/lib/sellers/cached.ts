// ============================================================
// /sellers の頁だけが使う読み取りキャッシュ（Next の Data Cache）。
//
// 公開頁は CSP の nonce で毎回動的に描画される（cached-reads.ts の冒頭）ので、`revalidate` を頁に
// 書いても効かない。代わりに問い合わせの結果をここに載せる。窓は観測所の頁と同じ
// PUBLIC_READ_REVALIDATE 秒（1 つの値）。結果には DB を読んだ時刻（fetchedAt）が入っていて、
// 頁はその時刻を出す——キャッシュから返した値に「今」の時刻を付けない。
//
// API ルートからは使わない（tests/public-page-cache.test.ts）。
// 2026-09-29 第4巡: 返す形が変わった（ShownRow の証拠・SellerDetail の hasConfirmedSeller / sellerView）ので
// 鍵を v2 に上げた。配備の直後に古い形のキャッシュを新しい描画へ渡さない。
// 2026-09-29 第5巡: 行の事実に照合の確定時刻（verifiedAt）が増えたので v3 に。出品の判定 API の resource id を足した。
// 2026-10-21: 出品に otherChain（Base 以外の最新購入）を足したので detail は v4。
// 2026-10-21: otherChain に payloadNonEmpty を足したので detail は v5（空の本文を届いたに数えない）。
// 2026-10-21: 他チェーンは Base の件数に混ぜず、txHash を欄のリンクに使うので detail は v6。
// 2026-11-03: 一覧の totals に sellerRequestListings を足したので board は v4。
// ============================================================
import { unstable_cache } from "next/cache";
import { getDb } from "@/lib/db/client";
import { timedDbExecute } from "@/lib/db/miss-timing";
import { PUBLIC_READ_REVALIDATE } from "@/lib/observatory/public-read-revalidate";
import type { SellerBoard, SellerDetail, SellerOtherChains } from "./board";
import { readHostCalledVsDelivered, type HostCalledVsDelivered } from "./called-vs-delivered";
import { readPurchasedHosts, readSellerBoard, readSellerDetail, readSellerOtherChains } from "./reader";
import { readSellerErc8004Binding, type SellerErc8004Binding } from "./erc8004-binding";
import { readSellerRefundStats } from "./refund-reader";
import type { RefundStats } from "./refunds";
import { logServerErrorSafe } from "@/lib/util/log-safe";

export class SellersUnavailable extends Error {}

export const getSellerBoardCached: () => Promise<SellerBoard> = unstable_cache(
  async () => {
    const db = getDb();
    if (!db) throw new SellersUnavailable("database not configured");
    return readSellerBoard(db);
  },
  ["sellers:board:v4"],
  { revalidate: PUBLIC_READ_REVALIDATE, tags: ["observatory"] },
);

export const getSellerDetailCached: (host: string) => Promise<SellerDetail | null> = unstable_cache(
  async (host: string) => {
    const db = getDb();
    if (!db) throw new SellersUnavailable("database not configured");
    return readSellerDetail(db, host);
  },
  ["sellers:detail:v6"],
  { revalidate: PUBLIC_READ_REVALIDATE, tags: ["observatory"] },
);

/** 購入行のある host の集合（Base の出品が無い売り手の頁の関門・1 本でキャッシュ）。 */
export const getPurchasedHostsCached: () => Promise<string[]> = unstable_cache(
  async () => {
    const db = getDb();
    if (!db) throw new SellersUnavailable("database not configured");
    return readPurchasedHosts(db);
  },
  ["sellers:purchased-hosts:v1"],
  { revalidate: PUBLIC_READ_REVALIDATE, tags: ["observatory"] },
);

export const getSellerCalledVsDeliveredCached: (host: string) => Promise<HostCalledVsDelivered | null> = unstable_cache(
  async (host: string) => {
    const db = getDb();
    if (!db) throw new SellersUnavailable("database not configured");
    return readHostCalledVsDelivered(db, host);
  },
  ["sellers:called-vs-delivered:v1"],
  { revalidate: PUBLIC_READ_REVALIDATE, tags: ["observatory"] },
);

export const getSellerOtherChainsCached: (host: string) => Promise<SellerOtherChains | null> = unstable_cache(
  async (host: string) => {
    const db = getDb();
    if (!db) throw new SellersUnavailable("database not configured");
    return readSellerOtherChains(db, host);
  },
  ["sellers:other-chains:v3"],
  { revalidate: PUBLIC_READ_REVALIDATE, tags: ["observatory"] },
);

export const getSellerRefundStatsCached: (host: string) => Promise<RefundStats | null> = unstable_cache(
  async (host: string) => {
    const db = getDb();
    if (!db) throw new SellersUnavailable("database not configured");
    return timedDbExecute(() => readSellerRefundStats(db, { host })) as Promise<RefundStats | null>;
  },
  ["sellers:refunds:v3"],
  { revalidate: PUBLIC_READ_REVALIDATE, tags: ["observatory"] },
);

class SellerErc8004Unavailable extends Error {
  constructor(readonly binding: SellerErc8004Binding) {
    super("seller erc8004 binding unavailable");
  }
}

const sellerErc8004BindingCached = unstable_cache(
  async (host: string): Promise<SellerErc8004Binding> => {
    const result = await readSellerErc8004Binding(host);
    if (result.status === "unavailable") throw new SellerErc8004Unavailable(result);
    return result;
  },
  ["sellers:erc8004-binding:v1"],
  { revalidate: PUBLIC_READ_REVALIDATE, tags: ["observatory", "erc8004"] },
);

/** Cached per host. Unavailable reads are not stored in the data cache. */
export async function getSellerErc8004BindingCached(host: string): Promise<SellerErc8004Binding> {
  try {
    return await sellerErc8004BindingCached(host);
  } catch (error) {
    if (error instanceof SellerErc8004Unavailable) return error.binding;
    logServerErrorSafe("sellers.erc8004-binding-cache", error);
    const readAt = new Date().toISOString();
    return { status: "unavailable", reason: "query_failed", readAt };
  }
}

