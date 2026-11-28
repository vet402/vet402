import type { AeoFaqItem } from "@/lib/x402/aeo-faqs";

type Props = {
  faq: readonly AeoFaqItem[];
  sectionNo: number;
};

/** FAQ questions rendered in body text for FAQPage parity (Google). */
export function AeoFaqBlock({ faq, sectionNo }: Props) {
  return (
    <>
      <h2 className="sec-head">
        <span className="sec-no">{sectionNo}.</span>
        <span>Questions</span>
      </h2>
      {faq.map((f) => (
        <div key={f.question}>
          <h3 className="doc-p font-semibold">{f.question}</h3>
          <p className="doc-p">{f.answer}</p>
        </div>
      ))}
    </>
  );
}