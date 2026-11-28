import { KEYLESS_READ_STOP, keylessDecisionPerMinute } from "@/lib/api/keyless-limits";
import { SITE_URL } from "@/lib/site-url";

/** Body copy for /x402/check-a-seller (HTML and .md share these strings). */
export const CHECK_SELLER_SECTIONS = {
  checkByUrl: {
    title: "Check by URL",
    body: `GET /api/v1/check?url= returns what vet402 recorded when it paid that x402 URL, including recommendation, delivery, verified_terms, and recent purchases. It needs no API key and shares the per-IP limit with /api/v1/resolve. ${KEYLESS_READ_STOP} Shapes are in the API reference at https://vet402.com/docs/api.`,
  },
  bazaarDelivery: {
    title: "Check an x402 Bazaar seller before paying",
    body: `For a CDP Bazaar listing, copy the item resource URL from the catalog. curl -sS "${SITE_URL}/api/v1/delivery/by-resource?url=" plus a percent-encoded https URL returns the delivery field vet402 attaches to that resource, from the same snapshot as GET /api/v1/delivery/sellers.json. It needs no API key. Then read GET /api/v1/check?url= with the same URL for the ALLOW, WARN, or BLOCK decision from vet402 purchases.`,
  },
  readDecision: {
    title: "Read the decision",
    body: `When you already hold a resource_id, GET /api/v1/resources/{resourceId}/decision returns the L0, L1, and L2 facts for that resource, with an ALLOW, WARN, or BLOCK recommendation. While keyless reads are on, the route answers with no API key, at ${keylessDecisionPerMinute()} requests a minute per IP. Reason codes and verified_terms travel in the same document.`,
  },
  purchaseRecord: {
    title: "Read a purchase record",
    body:
      "An observatory endpoint page lists the purchases vet402 made, with the chain, the HTTP status, and the settlement vet402 re-read. Start from the observatory or from State of x402. Sellers on Base can open their own results at /sellers.",
  },
  compareTerms: {
    title: "Compare the terms",
    body:
      "verified_terms carries pay_to, asset, amount, network, and scheme from the last purchase whose delivery vet402 confirmed. Compare those fields with the 402 in hand. A higher amount, or a different recipient, asset, network, or scheme, is a different offer from the one that was delivered. On XRPL, verified_terms is null. The recommendation records past purchases. vet402 does not insure a payment, hold customer funds, or refund one. The 0 to 100 wallet and agent score APIs were deprecated in September 2026; for a seller check, use GET /api/v1/check?url= or GET /api/v1/resources/{resourceId}/decision. A score is a separate signal from an L0 to L2 result, as the FAQ states.",
  },
} as const;