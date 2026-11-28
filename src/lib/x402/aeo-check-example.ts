import { HOME_PASTE_EXAMPLE_URL } from "@/lib/site/paste-example-url";
import { SITE_URL } from "@/lib/site-url";

/** Illustrative GET /api/v1/check response shape (not a live read). */
export const AEO_CHECK_RESPONSE_EXAMPLE = `{
  "not_in_catalog": false,
  "recommendation": "ALLOW",
  "reason_codes": ["l0_pass", "l1_delivered", "l2_conform"],
  "delivery": {
    "paid_attempts": 3,
    "delivered": 2,
    "settled_not_delivered": 0,
    "window_days": 30
  },
  "rules_version": "2026-11-13.1",
  "as_of": "2026-11-28T12:00:00.000Z"
}`;

const EXAMPLE_COM = "https://example.com/paid";

export function aeoCheckCurlForUrl(httpsUrl: string): string {
  return `curl -sS "${SITE_URL}/api/v1/check?url=${encodeURIComponent(httpsUrl)}"`;
}

export const AEO_CHECK_CURL_EXAMPLE_COM = aeoCheckCurlForUrl(EXAMPLE_COM);

export const AEO_CHECK_CURL_GEDX402 = aeoCheckCurlForUrl(HOME_PASTE_EXAMPLE_URL);