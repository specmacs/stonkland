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
                  className="flex gap-2 text-sm text-ink-400 hover:text-ink-200"
                >
                  <span className="font-mono text-xs text-ink-600">{i + 1}</span>
                  {section.heading}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <article className="max-w-3xl pb-8">
          {RULEBOOK.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-24 border-t border-ink-800 py-8 first:border-t-0 first:pt-0">
              <h2 className="text-xl font-semibold tracking-tight text-ink-100">
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
      return <p className="leading-relaxed text-ink-300">{block.text}</p>;

    case "callout":
      return (
        <p className="rounded-md border-l-2 border-brass-500 bg-ink-900/60 py-3 pl-4 pr-4 leading-relaxed text-ink-200">
          {block.text}
        </p>
      );

    case "list":
      return (
        <ul className="space-y-2">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-3 leading-relaxed text-ink-300">
              <span aria-hidden className="mt-2.5 h-1 w-1 shrink-0 rounded-full bg-ink-600" />
              {item}
            </li>
          ))}
        </ul>
      );

    case "ol":
      return (
        <ol className="space-y-2">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-3 leading-relaxed text-ink-300">
              <span className="mt-0.5 font-mono text-xs text-brass-500">{i + 1}</span>
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
              <tr className="border-b border-ink-800 text-left">
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
                <tr key={row[0]} className="border-b border-ink-800/60">
                  {row.map((cell, i) => (
                    <td
                      key={i}
                      className={`py-3 ${i > 1 ? "text-right font-mono" : ""} ${i === 0 ? "font-mono text-ink-500" : "text-ink-200"} ${i < row.length - 1 ? "pr-4" : ""}`}
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
