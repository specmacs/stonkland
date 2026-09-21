import Link from "next/link";
import {BRAND, EDITION, LEVELS, PROTOCOL_SHARE_OF_TRADE_PERCENT, QUARTERS} from "@/lib/brand";
import {formatBps} from "@/lib/format";
import {Section} from "@/components/Section";
import {LevelLadder} from "@/components/LevelLadder";
import {NonAffiliation} from "@/components/Disclaimer";
import {PieceArt} from "@/components/PieceArt";

export default function LandingPage() {
  return (
    <>
      {/* Hero */}
      <div className="mx-auto max-w-7xl px-4 pb-4 pt-16 sm:px-6">
        <p className="rule-label">
          {BRAND.projectName} · {BRAND.editionName.toUpperCase()}
        </p>
        <p className="rule-label mt-1">
          {EDITION.cardSupply} CARDS · FOUR {BRAND.groupTermPlural.toUpperCase()}
        </p>

        <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
          <div>
            <p className="text-sm uppercase tracking-[0.14em] text-brass-400">{BRAND.strapline}</p>
            <h1 className="mt-4 text-5xl font-semibold tracking-tight text-ink-100 sm:text-6xl">
              Build the block.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink-300">
              {EDITION.cardSupply} {BRAND.itemName.toLowerCase()}s, and never more. Burn to claim
              one, burn again to build it, and take a larger share of what your{" "}
              {BRAND.groupTerm.toLowerCase()} actually collects.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/board" className="btn-primary">
                Enter the board
              </Link>
              <Link href="/rulebook" className="btn-secondary">
                Read the rulebook
              </Link>
            </div>

            <div className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-ink-800 bg-ink-800 sm:grid-cols-4">
              {["ACQUIRE", "CLAIM A CARD", "BUILD 1 → 5", "COLLECT RENT"].map((beat, i) => (
                <div key={beat} className="bg-ink-950 px-4 py-4">
                  <span className="font-mono text-[11px] text-ink-600">0{i + 1}</span>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-ink-300">{beat}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="panel p-6">
            <PieceArt level={5} className="mx-auto h-44 w-44" />
            <p className="mt-4 text-center text-sm text-ink-300">
              {LEVELS[4]?.form} · {BRAND.scoreTerm} {LEVELS[4]?.weight}
            </p>
            <p className="mt-3 text-center text-xs text-ink-500">
              No fixed rate. No guaranteed return.
            </p>
          </div>
        </div>
      </div>

      {/* How it works */}
      <Section heading="Five moves. One loop.">
        <ol className="grid gap-px overflow-hidden rounded-lg border border-ink-800 bg-ink-800 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ["Acquire tokens", "Trade through the canonical pool."],
            ["Claim a card", `Mint one of only ${EDITION.cardSupply}.`],
            ["Burn to build", "Climb five levels with permanent burns."],
            ["Raise your weight", `Every level increases the card's ${BRAND.scoreTerm}.`],
            ["Collect rent", `Claim your relative share of what the ${BRAND.groupTerm.toLowerCase()} received.`],
          ].map(([title, body], i) => (
            <li key={title} className="bg-ink-950 p-5">
              <span className="font-mono text-xs text-brass-500">{i + 1}</span>
              <h3 className="mt-2 text-sm font-medium text-ink-100">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-400">{body}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* Levels */}
      <Section
        heading="Five forms. One direction."
        sub="Each build permanently changes the card and raises its weight. Nothing reverses."
      >
        <div className="mb-10 grid grid-cols-5 gap-3">
          {LEVELS.map((l) => (
            <figure key={l.level} className="text-center">
              <PieceArt level={l.level} className="mx-auto h-20 w-20 sm:h-24 sm:w-24" />
              <figcaption className="mt-2">
                <span className="block text-xs text-ink-200">{l.form}</span>
                <span className="block font-mono text-[11px] text-ink-500">{l.weight}</span>
              </figcaption>
            </figure>
          ))}
        </div>
        <div className="panel p-5">
          <LevelLadder />
          <p className="mt-4 text-xs text-ink-500">
            Taking a card from {LEVELS[0]?.form} to {LEVELS[4]?.form} destroys{" "}
            {LEVELS[4]?.cumulativeBurn.toLocaleString("en-US")} {BRAND.tokenTicker} in total,
            the mint included. Reaching the top is rare by design: if every card were built
            to {LEVELS[4]?.form}, it would take more tokens than exist.
          </p>
        </div>
      </Section>

      {/* Quarters */}
      <Section
        heading={`Four ${BRAND.groupTermPlural.toLowerCase()}. Four pools.`}
        sub={`Every card belongs to one ${BRAND.groupTerm.toLowerCase()} and shares only in that ${BRAND.groupTerm.toLowerCase()}'s rewards.`}
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {QUARTERS.map((q) => (
            <div key={q.index} className="panel p-5">
              <span
                aria-hidden
                className="block h-1 w-10 rounded-full"
                style={{backgroundColor: `var(${q.colorVar})`}}
              />
              <h3 className="mt-3 text-sm font-medium text-ink-100">{q.label}</h3>
              <p className="mt-1 font-mono text-xs text-ink-500">
                {EDITION.quarterCap} cards · {EDITION.gridSize}×{EDITION.gridSize}
              </p>
              <p className="mt-3 text-sm text-ink-400">
                {formatBps(EDITION.quarterAllocationBps)} of the edition&apos;s reward share,
                frozen at deployment.
              </p>
            </div>
          ))}
        </div>
        <NonAffiliation className="mt-6 max-w-3xl" />
      </Section>

      {/* Weight */}
      <Section
        eyebrow="MORE LEVELS = MORE RELATIVE WEIGHT"
        heading={`Your score inside the ${BRAND.groupTerm.toLowerCase()}.`}
      >
        <p className="max-w-3xl text-ink-300">
          {BRAND.scoreTerm} sets a card&apos;s relative share of rewards actually deposited into
          its {BRAND.groupTerm.toLowerCase()}. More weight means a larger slice of the same
          deposit — not a rate, and not a promise.
        </p>
        <p className="mt-4 max-w-3xl text-sm text-ink-500">
          Weight only matters against the other cards in the same {BRAND.groupTerm.toLowerCase()}.
          As other owners build, your share of each deposit falls even though your weight has
          not changed. That is the central tension of the game, and it is intentional.
        </p>
      </Section>

      {/* Reward flow */}
      <Section heading="How rent reaches your card.">
        <ol className="grid gap-px overflow-hidden rounded-lg border border-ink-800 bg-ink-800 sm:grid-cols-5">
          {["Trades", "Fee claim", "Fixed split", `${EDITION.streamEpochSeconds}-second streams`, "Rent to claims"].map(
            (stage) => (
              <li key={stage} className="bg-ink-950 px-4 py-5 text-sm text-ink-200">
                {stage}
              </li>
            ),
          )}
        </ol>
        <p className="mt-6 max-w-3xl text-ink-400">
          The venue charges {EDITION.venueTradingFeePercent}% on trades and keeps part of it; this
          protocol receives {PROTOCOL_SHARE_OF_TRADE_PERCENT}% of what trades. Once it accrues,
          anyone can trigger the claim — no operator stands between you and a deposit. The router
          splits it on fixed terms, wraps the rewards portion, and funds short streams so a single
          sweep does not land on one moment.
        </p>
      </Section>

      {/* Rule card */}
      <Section heading="The rules that cannot move.">
        <dl className="grid gap-px overflow-hidden rounded-lg border border-ink-800 bg-ink-800 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ["Fixed supply", "1,000,000,000"],
            ["Cards, ever", EDITION.cardSupply.toLocaleString("en-US")],
            ["Mint burn", EDITION.mintBurn.toLocaleString("en-US")],
            ["Build burns", "500k → 2M"],
            ["Primary mints per wallet", String(EDITION.mintsPerWallet)],
          ].map(([label, value]) => (
            <div key={label} className="bg-ink-950 p-5">
              <dt className="rule-label">{label}</dt>
              <dd className="mt-2 font-mono text-lg text-ink-100">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-5 text-sm text-ink-400">
          Every burn is permanent. Supply can only fall.
        </p>
      </Section>

      {/* Final CTA */}
      <Section heading="Take a corner of the board.">
        <Link href="/mint" className="btn-primary">
          Claim a card
        </Link>
      </Section>
    </>
  );
}
