import { CHAINS_HUB, measuredChainsSentence } from "@/components/site/x402-answers";
import type { GuideChain } from "@/components/site/x402-guides";
import type { L1ChainStats } from "@/lib/observatory/reader";
import {
  SELLER_REPUTATION_API,
  SELLER_REPUTATION_CHECK_FIELDS,
} from "@/lib/x402/seller-reputation-sections";
import { TRUST_SCORE_PAGE } from "@/lib/x402/trust-score-sections";
import { KEYLESS_READ_STOP, keylessResolvePerMinute } from "@/lib/api/keyless-limits";
const STATISTICS_PAGE_DESCRIPTION =
  "Counts from vet402's real x402 purchases: attempts, on-chain settlement, delivery, and purchase results by chain, from the public observatory state.";

const STATISTICS_FAQ_DEFINITIONS = {
  settled: "l1.settled is the transfer vet402 re-read on-chain.",
  delivered:
    "l1.delivered is a settled attempt whose paid request also answered HTTP 2xx other than 202 Accepted, with a non-empty body.",
} as const;

export type AeoFaqItem = { question: string; answer: string };

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

export function chainsHubFaq(readable: boolean, readAt: string | null): AeoFaqItem[] {
  const items: AeoFaqItem[] = [
    {
      question: "What are x402 settlements by chain?",
      answer: `${CHAINS_HUB.lead[0]} ${CHAINS_HUB.lead[1]}`,
    },
    {
      question: "Which chains does vet402 buy on?",
      answer: `${measuredChainsSentence()} Lane pages list vet402 L1 purchase counts per chain from the public ledger read.`,
    },
    {
      question: "Where do vet402 chain purchase counts come from?",
      answer:
        "Counts on this hub come from l1.byChain in GET /api/v1/observatory/state. vet402 re-reads each settlement on chain before it counts as settled.",
    },
  ];
  if (readable && readAt) {
    items.push({
      question: "When were these chain counts read?",
      answer: `This page read the ledger at ${readAt.slice(0, 16).replace("T", " ")} UTC. Cite retrievedAt from /api/v1/observatory/state with each figure.`,
    });
  }
  return items;
}

export function chainSlugFaq(
  chain: GuideChain,
  row: L1ChainStats | undefined,
  readable: boolean,
  readAt: string | null,
): AeoFaqItem[] {
  const items: AeoFaqItem[] = [
    {
      question: `Does vet402 buy x402 on ${chain.publicName}?`,
      answer: chain.lead[0],
    },
    {
      question: `What asset does vet402 use on ${chain.publicName}?`,
      answer: `${chain.publicName} uses ${chain.asset} on CAIP-2 ${chain.caip2}. ${chain.lead[1]}`,
    },
    {
      question: `How are x402 settlements tied on ${chain.publicName}?`,
      answer: `${chain.tie} ${chain.reread}`,
    },
  ];
  if (readable && row && readAt) {
    items.push({
      question: `How many vet402 purchases on ${chain.publicName} in this read?`,
      answer: `This read shows ${fmt(row.attempts)} paid attempts, ${fmt(row.settled)} settled, and ${fmt(row.delivered)} delivered on ${chain.publicName}, from the ledger at ${readAt.slice(0, 16).replace("T", " ")} UTC.`,
    });
  } else if (readable && !row) {
    items.push({
      question: `How many vet402 purchases on ${chain.publicName} in this read?`,
      answer: `This read has no L1 row for ${chain.publicName} in l1.byChain.`,
    });
  }
  return items;
}

export function statisticsFaq(
  live: boolean,
  readAt: string | null,
  stats: { l1: { attempts: number; settled: number; delivered: number } } | null,
): AeoFaqItem[] {
  const headline =
    live && stats && readAt
      ? `vet402 has attempted ${fmt(stats.l1.attempts)} paid x402 purchases. ${fmt(stats.l1.settled)} settled on-chain and ${fmt(stats.l1.delivered)} came back delivered, as of ${readAt.slice(0, 10)} (UTC).`
      : "Headline counts come from GET /api/v1/observatory/state when the ledger can be read.";
  return [
    {
      question: "What are x402 statistics?",
      answer: STATISTICS_PAGE_DESCRIPTION,
    },
    {
      question: "How many paid x402 purchases has vet402 attempted?",
      answer: headline,
    },
    {
      question: "What does settled mean in vet402 x402 statistics?",
      answer: STATISTICS_FAQ_DEFINITIONS.settled,
    },
    {
      question: "What does delivered mean in vet402 x402 statistics?",
      answer: STATISTICS_FAQ_DEFINITIONS.delivered,
    },
  ];
}

export function trustScoreFaq(): AeoFaqItem[] {
  return [
    {
      question: "What is an x402 trust score?",
      answer:
        "An x402 trust score often means a single number for whether an agent should pay a seller. vet402 deprecated its own 0 to 100 trust score in September 2026 and does not report that number as a measurement.",
    },
    {
      question: "Does vet402 publish a 0 to 100 x402 trust score?",
      answer: TRUST_SCORE_PAGE.sections.discontinued.body,
    },
    {
      question: "What does vet402 publish instead of an x402 trust score?",
      answer: `${TRUST_SCORE_PAGE.lead[1]} ${TRUST_SCORE_PAGE.sections.counts.body}`,
    },
    {
      question: "What does delivered mean for an x402 trust read?",
      answer: TRUST_SCORE_PAGE.sections.delivered.body,
    },
  ];
}

export function sellerReputationApiFaq(): AeoFaqItem[] {
  const fieldNames = SELLER_REPUTATION_CHECK_FIELDS.map((r) => r.field).join(", ");
  return [
    {
      question: "Is there an x402 seller reputation API?",
      answer: `${SELLER_REPUTATION_API.lead[0]} ${SELLER_REPUTATION_API.lead[1]}`,
    },
    {
      question: "What does GET /api/v1/check return for an x402 seller?",
      answer: `GET /api/v1/check returns recommendation (ALLOW, WARN, or BLOCK), delivery counts in a rolling window, reason_codes, verified_terms, verified_pay_to_by_network, rules_version, l1_purchases, and as_of. Documented fields include ${fieldNames}.`,
    },
    {
      question: "Do I need an API key to read x402 seller reputation?",
      answer: `GET /api/v1/check needs no API key. It shares the per-IP limit with POST /api/v1/resolve (${keylessResolvePerMinute()} requests a minute). ${KEYLESS_READ_STOP}`,
    },
    {
      question: "How do ALLOW, WARN, and BLOCK work on the seller reputation API?",
      answer: `ALLOW means ${SELLER_REPUTATION_API.sections.verdicts.allow} WARN means ${SELLER_REPUTATION_API.sections.verdicts.warn} BLOCK means ${SELLER_REPUTATION_API.sections.verdicts.block}`,
    },
  ];
}

export function faqPageJsonLd(faq: readonly AeoFaqItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}