import Link from "next/link";
import {BRAND} from "@/lib/brand";
import {X_URL} from "@/lib/config";
import {GlobalDisclaimer} from "./Disclaimer";
import {Mark} from "./Mark";

const LINKS = [
  {href: "/board", label: "Board"},
  {href: "/rulebook", label: "Rulebook"},
  {href: "/stats", label: "Stats"},
  {href: "/terms", label: "Terms"},
  {href: "/privacy", label: "Privacy"},
] as const;

export function Footer() {
  return (
    <footer className="mt-24 border-t-rule border-ink">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-2.5">
              <Mark className="h-6 w-6 text-seal" />
              <span className="text-sm font-semibold text-ink">{BRAND.projectName}</span>
            </div>
            <p className="mt-2 text-sm text-inkMuted">{BRAND.strapline}</p>
          </div>

          <nav className="flex flex-wrap gap-x-5 gap-y-2">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="text-sm text-inkMuted hover:text-ink">
                {l.label}
              </Link>
            ))}
            {X_URL && (
              <a
                href={X_URL}
                target="_blank"
                rel="noreferrer noopener"
                className="text-sm text-inkMuted hover:text-ink"
              >
                X
              </a>
            )}
          </nav>
        </div>

        <div className="mt-8 border-t-rule border-ink pt-6">
          <GlobalDisclaimer className="max-w-3xl" />
          <p className="mt-4 text-xs text-inkFaint">
            Nothing on this site is investment advice, and nothing here is a promise.
          </p>
        </div>
      </div>
    </footer>
  );
}
