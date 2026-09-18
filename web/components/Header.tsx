"use client";

import Link from "next/link";
import {usePathname} from "next/navigation";
import {ConnectButton} from "@rainbow-me/rainbowkit";
import {BRAND} from "@/lib/brand";
import {CHAIN_NAME, CHAIN_CONFIGURED, POOL_URL} from "@/lib/config";
import {Mark} from "./Mark";

const NAV = [
  {href: "/board", label: "Board"},
  {href: "/mint", label: "Mint"},
  {href: "/cards", label: "My cards"},
  {href: "/rent", label: BRAND.rewardsPageTerm},
  {href: "/stats", label: "Stats"},
  {href: "/rulebook", label: "Rulebook"},
] as const;

export function Header() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-ink-800 bg-ink-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5" aria-label={`${BRAND.projectName}, home`}>
          <Mark className="h-7 w-7 text-brass-500" />
          <span className="flex flex-col leading-none">
            <span className="text-sm font-semibold tracking-wide text-ink-100">
              {BRAND.projectName}
            </span>
            <span className="mt-0.5 text-[10px] uppercase tracking-[0.16em] text-ink-500">
              {BRAND.editionName}
            </span>
          </span>
        </Link>

        <nav className="order-3 flex w-full items-center gap-1 overflow-x-auto sm:order-none sm:w-auto">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm transition-colors ${
                  active ? "bg-ink-800 text-ink-100" : "text-ink-400 hover:text-ink-200"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <BuyControl />
          <span
            className="hidden items-center gap-1.5 rounded-md border border-ink-800 px-2.5 py-1.5 text-xs text-ink-400 lg:inline-flex"
            title={CHAIN_CONFIGURED ? undefined : "No chain is configured for this deployment."}
          >
            <span
              aria-hidden
              className={`h-1.5 w-1.5 rounded-full ${CHAIN_CONFIGURED ? "bg-quarter-3" : "bg-ink-600"}`}
            />
            {CHAIN_CONFIGURED ? CHAIN_NAME : "No network configured"}
          </span>
          <ConnectButton showBalance={false} chainStatus="none" accountStatus="address" />
        </div>
      </div>
    </header>
  );
}

/** Disabled until a canonical pool exists. It never guesses at a URL. */
function BuyControl() {
  if (!POOL_URL) {
    return (
      <span
        className="hidden cursor-not-allowed rounded-md border border-ink-800 px-2.5 py-1.5 text-xs text-ink-600 sm:inline-flex"
        title="No canonical pool has been configured for this deployment yet."
        aria-disabled="true"
      >
        Buy {BRAND.tokenTicker}
      </span>
    );
  }
  return (
    <a
      href={POOL_URL}
      target="_blank"
      rel="noreferrer noopener"
      className="hidden rounded-md border border-ink-700 px-2.5 py-1.5 text-xs text-ink-200 hover:border-ink-600 sm:inline-flex"
    >
      Buy {BRAND.tokenTicker}
    </a>
  );
}
