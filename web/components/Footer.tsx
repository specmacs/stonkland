import Link from "next/link";
import {BRAND, EDITION} from "@/lib/brand";
import {X_URL} from "@/lib/config";
import {GlobalDisclaimer} from "./Disclaimer";
import {Mark} from "./Mark";

const COLUMNS = [
  {
    title: "The game",
    links: [
      {href: "/board", label: "Board"},
      {href: "/mint", label: "Mint"},
      {href: "/cards", label: "My cards"},
      {href: "/rent", label: BRAND.rewardsPageTerm},
    ],
  },
  {
    title: "Read",
    links: [
      {href: "/rulebook", label: "Rulebook"},
      {href: "/stats", label: "Protocol state"},
    ],
  },
  {
    title: "Legal",
    links: [
      {href: "/terms", label: "Terms"},
      {href: "/privacy", label: "Privacy"},
    ],
  },
] as const;

/**
 * The foot of every page, set on the ink field.
 *
 * It closes the page rather than trailing off it: the same heavy rule as everything
 * above, and the disclaimer carried on the field rather than in grey at the bottom where
 * it reads as something the site would rather you skipped.
 */
export function Footer() {
  return (
    <footer className="band-ink mt-0">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div>
            <div className="flex items-center gap-3">
              <Mark className="h-9 w-9 text-field-sun" />
              <span className="font-display text-2xl font-bold text-paperCard">
                {BRAND.projectName}
              </span>
            </div>
            <p className="mt-4 max-w-sm text-body-lg text-paperCard/70">{BRAND.strapline}</p>
            <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.16em] text-field-sun">
              {BRAND.editionName} · {EDITION.cardSupply} cards · fixed supply
            </p>
          </div>

          <nav className="grid grid-cols-2 gap-8 sm:grid-cols-3" aria-label="Footer">
            {COLUMNS.map((col) => (
              <div key={col.title}>
                <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-paperCard/45">
                  {col.title}
                </p>
                <ul className="mt-4 space-y-2.5">
                  {col.links.map((l) => (
                    <li key={l.href}>
                      <Link
                        href={l.href}
                        className="text-sm text-paperCard/80 transition-colors hover:text-field-sun"
                      >
                        {l.label}
                      </Link>
                    </li>
                  ))}
                  {col.title === "Read" && X_URL && (
                    <li>
                      <a
                        href={X_URL}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-sm text-paperCard/80 transition-colors hover:text-field-sun"
                      >
                        X
                      </a>
                    </li>
                  )}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="mt-14 border-t border-paperCard/20 pt-8">
          <GlobalDisclaimer className="max-w-3xl" tone="dark" />
          <p className="mt-4 text-xs text-paperCard/45">
            Nothing on this site is investment advice, and nothing here is a promise.
          </p>
        </div>
      </div>
    </footer>
  );
}
