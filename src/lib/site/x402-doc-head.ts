/** Series label in the compact doc head on x402 AEO pages. Not a retrieval date. */
export const X402_ECONOMY_SERIES = "x402 Economy";

export function guidePublishedLabel(date: string): string {
  return `Guide published ${date}`;
}

export function pagePublishedLabel(date: string): string {
  return `Page published ${date}`;
}