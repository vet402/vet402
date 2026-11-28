/** Shared title and lead copy for /observatory/methodology HTML and .md. */
export const METHODOLOGY_TITLE = "What these measurements mean";

export const METHODOLOGY_BLURB =
  "Methodology for x402 payment measurements: L0 liveness probes, L1 real-money settle-through purchases, L2 conformance checks, and how delisting is detected.";

export const METHODOLOGY_IN_60 =
  "L0 asks whether the payment wall answers. L1 asks whether a real purchase settles and comes back with a non-empty 2xx. L2 asks whether the response matches the seller's declaration. Unverified is not a failure. The 0 to 100 payee, wallet, and agent score APIs were deprecated in September 2026. They are not L0 to L2 results. For integration, use GET /api/v1/check?url= or GET /api/v1/resources/{resourceId}/decision. Every word this page publishes measurements in is defined once, in one line each, in section 10.";

/** H2 titles in display order (must match the methodology page). */
export const METHODOLOGY_H2 = [
  "Where the catalog comes from",
  "What L0 measures",
  "The verdict vocabulary",
  "Publication gate",
  "Delisting detection",
  "What L0 cannot measure",
  "What L1 measures",
  "What L2 measures",
  "Fairness commitments",
  "Reuse and citation",
  "Definitions, one line each",
] as const;