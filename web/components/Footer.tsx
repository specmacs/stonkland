import Link from "next/link";
import {BRAND, EDITION} from "@/lib/brand";
import {POOL_URL, X_URL} from "@/lib/config";
import {GlobalDisclaimer} from "./Disclaimer";
import {Mark} from "./Mark";

/** One row, in reading order, rather than three columns of four. */
const LINKS = [
  {href: "/board", label: "Board"},
  {href: "/mint", label: "Mint"},
  {href: "/cards", label: "My cards"},
  {href: "/rent", label: BRAND.rewardsPageTerm},
  {href: "/rulebook", label: "Rulebook"},
  {href: "/stats", label: "Protocol state"},
  {href: "/terms", label: "Terms"},
  {href: "/privacy", label: "Privacy"},
] as const;

/**
 * The foot of every page, set on the ink field.
 *
 * It closes the page rather than trailing off it: the wordmark at display size so the
 * last thing on the page is the name, the links as one inline row, and the disclaimer
 * carried on the field rather than in grey at the bottom where it reads as something the
 * site would rather you skipped.
 *
 * The two outbound links only render when their URL is configured. An empty state stays
 * empty here as everywhere else -- a dead link to a market that does not exist yet is a
 * worse answer than no link.
 */
export function Footer() {
  return (
    <footer className="band-ink mt-0">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="flex items-center gap-4">
          <Mark className="h-10 w-10 shrink-0 text-field-sun" />
          <p className="font-display text-display-md font-bold leading-none text-paperCard">
            {BRAND.projectName}
          </p>
        </div>

        <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.18em] text-field-sun">
          {BRAND.strapline}
        </p>
        <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.18em] text-paperCard/45">
          {BRAND.editionName} · {EDITION.cardSupply} cards · fixed supply
        </p>

        <nav
          className="mt-10 flex flex-wrap gap-x-6 gap-y-3 border-t border-paperCard/20 pt-8"
          aria-label="Footer"
        >
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="font-mono text-[11px] uppercase tracking-[0.14em] text-paperCard/75 transition-colors hover:text-field-sun"
            >
              {l.label}
            </Link>
          ))}
          {X_URL && (
            <a
              href={X_URL}
              target="_blank"
              rel="noreferrer noopener"
              className="font-mono text-[11px] uppercase tracking-[0.14em] text-paperCard/75 transition-colors hover:text-field-sun"
            >
              X
            </a>
          )}
          {POOL_URL && (
            <a
              href={POOL_URL}
              target="_blank"
              rel="noreferrer noopener"
              className="font-mono text-[11px] uppercase tracking-[0.14em] text-paperCard/75 transition-colors hover:text-field-sun"
            >
              Market
            </a>
          )}
        </nav>

        <div className="mt-10 border-t border-paperCard/20 pt-8">
          <GlobalDisclaimer className="max-w-3xl" tone="dark" />
          <p className="mt-4 text-xs text-paperCard/45">
            Nothing on this site is investment advice, and nothing here is a promise.
          </p>
        </div>
      </div>
    </footer>
  );
}
