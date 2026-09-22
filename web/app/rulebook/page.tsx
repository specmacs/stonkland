import type {Metadata} from "next";
import {BRAND} from "@/lib/brand";
import {RULEBOOK, RULEBOOK_INTRO, type Block} from "@/lib/rulebook";
import {PageHeader} from "@/components/Section";

export const metadata: Metadata = {
  title: "Rulebook",
  description: `How ${BRAND.projectName} works, in full.`,
};

/**
 * A tint per chapter, cycling.
 *
 * Ten chapters run long enough that a reader loses their place; giving each its own
 * number plate in a different colour means the contents list and the page agree on where
 * you are without a highlight that has to be maintained in script.
 */
const CHAPTER_TINT = [
  "bg-tint-sun",
  "bg-tint-peach",
  "bg-tint-sky",
  "bg-tint-mint",
  "bg-tint-lilac",
] as const;

export default function RulebookPage() {
  return (
    <>
      <PageHeader
        eyebrow="Every rule, in full"
        heading="The Rulebook"
        sub={RULEBOOK_INTRO}
        tone="sky"
      />

      <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] gap-12 px-4 pb-24 pt-14 sm:px-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <nav aria-label="Rulebook contents" className="lg:sticky lg:top-24 lg:self-start">
          <div className="border-rule border-ink bg-paperCard shadow-card">
            <p className="rule-label border-b-rule border-ink bg-tint-cream px-4 py-3">Contents</p>
            <ol className="p-2">
              {RULEBOOK.map((section, i) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className="flex items-start gap-3 px-2 py-2 text-sm text-inkMuted transition-colors hover:bg-tint-cream hover:text-ink"
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center border border-ink font-mono text-[11px] text-ink ${
                        CHAPTER_TINT[i % CHAPTER_TINT.length]
                      }`}
                    >
                      {i + 1}
                    </span>
                    <span className="min-w-0">{section.heading}</span>
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </nav>

        <article className="max-w-3xl">
          {RULEBOOK.map((section, i) => (
            <section
              key={section.id}
              id={section.id}
              className="scroll-mt-24 py-10 first:pt-0"
            >
              <div className="flex items-start gap-4">
                <span
                  className={`mt-1 flex h-10 w-10 shrink-0 items-center justify-center border-rule border-ink font-mono text-sm font-semibold text-ink shadow-cardSm ${
                    CHAPTER_TINT[i % CHAPTER_TINT.length]
                  }`}
                >
                  {i + 1}
                </span>
                <h2 className="font-display text-3xl font-bold leading-tight text-ink sm:text-4xl">
                  {section.heading}
                </h2>
              </div>
              <div className="mt-6 space-y-5">
                {section.blocks.map((block, j) => (
                  <BlockView key={j} block={block} />
                ))}
              </div>
              {i < RULEBOOK.length - 1 && (
                <hr className="mt-10 border-0 border-t-rule border-ink/25" />
              )}
            </section>
          ))}
        </article>
      </div>
    </>
  );
}

function BlockView({block}: {block: Block}) {
  switch (block.kind) {
    case "p":
      return <p className="leading-relaxed text-inkMuted">{block.text}</p>;

    case "callout":
      return (
        <p className="border-rule border-ink bg-tint-sun px-5 py-4 leading-relaxed text-ink shadow-cardSm">
          {block.text}
        </p>
      );

    case "list":
      return (
        <ul className="space-y-2.5">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-3 leading-relaxed text-inkMuted">
              <span aria-hidden className="mt-2.5 h-1.5 w-1.5 shrink-0 bg-seal" />
              {item}
            </li>
          ))}
        </ul>
      );

    case "ol":
      return (
        <ol className="space-y-2.5">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-3 leading-relaxed text-inkMuted">
              <span className="mt-0.5 font-mono text-xs font-semibold text-seal">{i + 1}</span>
              {item}
            </li>
          ))}
        </ol>
      );

    case "table":
      return (
        <div className="overflow-x-auto border-rule border-ink bg-paperCard shadow-cardSm">
          <table className="w-full min-w-[26rem] border-collapse text-sm">
            <thead>
              <tr className="border-b-rule border-ink bg-tint-cream text-left">
                {block.head.map((h, i) => (
                  <th
                    key={h}
                    scope="col"
                    className={`rule-label px-4 py-3 font-normal ${i > 1 ? "text-right" : ""}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row) => (
                <tr key={row[0]} className="border-b border-ink/12 last:border-b-0">
                  {row.map((cell, i) => (
                    <td
                      key={i}
                      className={`px-4 py-3 ${i > 1 ? "text-right font-mono tabular-nums" : ""} ${
                        i === 0 ? "font-mono text-inkMuted" : "text-ink"
                      }`}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}
