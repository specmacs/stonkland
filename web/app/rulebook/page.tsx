import type {Metadata} from "next";
import {BRAND} from "@/lib/brand";
import {RULEBOOK, RULEBOOK_INTRO, type Block} from "@/lib/rulebook";
import {PageHeader} from "@/components/Section";

export const metadata: Metadata = {
  title: "Rulebook",
  description: `How ${BRAND.projectName} works, in full.`,
};

export default function RulebookPage() {
  return (
    <>
      <PageHeader heading="The Rulebook" sub={RULEBOOK_INTRO} />

      <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <nav aria-label="Rulebook contents" className="lg:sticky lg:top-24 lg:self-start">
          <p className="rule-label mb-3">Contents</p>
          <ol className="space-y-1.5">
            {RULEBOOK.map((section, i) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="flex gap-2 text-sm text-inkMuted hover:text-ink"
                >
                  <span className="font-mono text-xs text-inkFaint">{i + 1}</span>
                  {section.heading}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <article className="max-w-3xl pb-8">
          {RULEBOOK.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-24 border-t-rule border-ink py-8 first:border-t-0 first:pt-0">
              <h2 className="font-display text-2xl font-bold text-ink">
                {section.heading}
              </h2>
              <div className="mt-4 space-y-4">
                {section.blocks.map((block, i) => (
                  <BlockView key={i} block={block} />
                ))}
              </div>
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
        <p className="rounded-md border-l-2 border-seal bg-paperShade py-3 pl-4 pr-4 leading-relaxed text-ink">
          {block.text}
        </p>
      );

    case "list":
      return (
        <ul className="space-y-2">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-3 leading-relaxed text-inkMuted">
              <span aria-hidden className="mt-2.5 h-1 w-1 shrink-0 rounded-full bg-inkFaint" />
              {item}
            </li>
          ))}
        </ul>
      );

    case "ol":
      return (
        <ol className="space-y-2">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-3 leading-relaxed text-inkMuted">
              <span className="mt-0.5 font-mono text-xs text-seal">{i + 1}</span>
              {item}
            </li>
          ))}
        </ol>
      );

    case "table":
      return (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[26rem] border-collapse text-sm">
            <thead>
              <tr className="border-b-rule border-ink text-left">
                {block.head.map((h, i) => (
                  <th
                    key={h}
                    scope="col"
                    className={`rule-label py-3 font-normal ${i > 1 ? "text-right" : ""} ${i < block.head.length - 1 ? "pr-4" : ""}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row) => (
                <tr key={row[0]} className="border-b-rule border-ink/20">
                  {row.map((cell, i) => (
                    <td
                      key={i}
                      className={`py-3 ${i > 1 ? "text-right font-mono" : ""} ${i === 0 ? "font-mono text-inkMuted" : "text-ink"} ${i < row.length - 1 ? "pr-4" : ""}`}
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
