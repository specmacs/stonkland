import Link from "next/link";
import {
  BRAND,
  BUILD_BURN_RANGE,
  EDITION,
  LEVELS,
  QUARTERS,
  REWARD_ASSET_EXPLAINER,
} from "@/lib/brand";
import {formatBps} from "@/lib/format";
import {Section} from "@/components/Section";
import {LevelCards} from "@/components/LevelCards";
import {PieceArt} from "@/components/PieceArt";
import {WeightComparison} from "@/components/WeightComparison";
import {PhaseNotice} from "@/components/PhaseNotice";
import {Parameters, VenueParameter} from "@/components/Provenance";

/** The four opening beats, tinted across rather than left as five identical panels. */
const BEATS = [
  ["Acquire", `Buy ${BRAND.tokenTicker}.`, "bg-tint-sun"],
  ["Claim", `One of only ${EDITION.cardSupply}.`, "bg-tint-peach"],
  ["Build", "Five levels, one direction.", "bg-tint-sky"],
  ["Collect", "A share of what arrived.", "bg-tint-mint"],
] as const;

export default function LandingPage() {
  const landmark = LEVELS[4];

  return (
    <>
      {/* Hero */}
      <div className="band-cream">
        <div className="mx-auto max-w-7xl px-4 pb-16 pt-12 sm:px-6 lg:pb-20 lg:pt-16">
          <div className="inline-flex flex-wrap items-center gap-x-3 gap-y-1 border-rule border-ink bg-ink px-3 py-1.5 text-paper shadow-cardSm">
            <span className="font-mono text-[11px] uppercase tracking-[0.16em]">
              {BRAND.editionName}
            </span>
            <span aria-hidden className="text-field-sun">·</span>
            <span className="font-mono text-[11px] uppercase tracking-[0.16em]">
              {EDITION.cardSupply} cards
            </span>
            <span aria-hidden className="text-field-sun">·</span>
            <span className="font-mono text-[11px] uppercase tracking-[0.16em]">
              four {BRAND.groupTermPlural.toLowerCase()}
            </span>
          </div>

          <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-seal">
                {BRAND.strapline}
              </p>
              <h1 className="mt-5 font-display text-display-xl font-bold text-ink">
                Build
                <br />
                the block.
              </h1>
              <p className="mt-7 max-w-xl text-body-lg text-inkMuted">
                {EDITION.cardSupply} {BRAND.itemNamePlural.toLowerCase()}, and never more. Burn to
                claim one, burn again to build it, and take a larger share of what your{" "}
                {BRAND.groupTerm.toLowerCase()} actually collects.
              </p>

              <div className="mt-9 flex flex-wrap gap-3">
                <Link href="/board" className="btn-primary">
                  Enter the board
                </Link>
                <Link href="/rulebook" className="btn-secondary">
                  Read the rulebook
                </Link>
              </div>

              <ol className="card-row mt-14 grid grid-cols-2 bg-ink lg:grid-cols-4">
                {BEATS.map(([title, body, tint], i) => (
                  <li
                    key={title}
                    className={`${tint} px-4 py-5 [&:nth-child(-n+2)]:border-b-rule [&:nth-child(-n+2)]:border-ink [&:nth-child(odd)]:border-r-rule [&:nth-child(odd)]:border-ink lg:border-b-0 lg:[&:not(:last-child)]:border-r-rule lg:[&:not(:last-child)]:border-ink`}
                  >
                    <span className="pip bg-paperCard text-ink">{i + 1}</span>
                    <h2 className="mt-3 font-display text-lg font-bold text-ink">{title}</h2>
                    <p className="mt-1 text-sm leading-snug text-ink/70">{body}</p>
                  </li>
                ))}
              </ol>
            </div>

            {/* The top of the ladder, stamped in seal red so the eye lands on it. */}
            <div className="border-rule border-ink bg-seal shadow-cardLg">
              <div className="flex items-center justify-between gap-2 border-b-rule border-ink bg-paperCard px-5 py-3">
                <p className="rule-label">The top of the ladder</p>
                <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-seal">
                  Lv 5
                </span>
              </div>
              <div className="px-6 py-10">
                <PieceArt level={5} priority className="mx-auto h-52 w-52" />
              </div>
              <div className="border-t-rule border-ink bg-paperCard px-5 py-5">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-display text-3xl font-bold text-ink">{landmark?.form}</p>
                  <p className="font-mono text-2xl font-semibold tabular-nums text-seal">
                    {landmark?.weight}
                  </p>
                </div>
                <p className="rule-label mt-1">
                  {landmark?.cumulativeBurn.toLocaleString("en-US")} {BRAND.tokenTicker} destroyed
                  to reach it
                </p>
                <p className="mt-4 border-t border-ink/15 pt-3 text-xs leading-relaxed text-inkMuted">
                  No fixed rate. No guaranteed return.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 pt-14 sm:px-6">
        <PhaseNotice className="max-w-3xl" />
      </div>

      {/* How it works */}
      <Section
        eyebrow="The loop"
        heading={
          <>
            Five moves.
            <br />
            One loop.
          </>
        }
        sub="Each move is a transaction you send yourself. There is no queue, no allowlist, and nobody to apply to. Minting and building can be paused by the owner, and when either is, the interface says so and the control is off — that is the whole of anyone's ability to stand between you and a move."
        tone="ink"
      >
        <ol className="card-row grid bg-ink sm:grid-cols-2 lg:grid-cols-5">
          {[
            ["Acquire tokens", `Buy ${BRAND.tokenTicker} on the launch venue.`, "bg-tint-cream"],
            ["Claim a card", `Mint one of only ${EDITION.cardSupply}.`, "bg-tint-sun"],
            ["Burn to build", "Climb five levels with permanent burns.", "bg-tint-peach"],
            ["Raise your weight", `Every level raises the card's ${BRAND.scoreTerm}.`, "bg-tint-sky"],
            [
              "Collect rent",
              `Claim your share of what the ${BRAND.groupTerm.toLowerCase()} received.`,
              "bg-tint-mint",
            ],
          ].map(([title, body, tint], i) => (
            <li
              key={title}
              className={`${tint} p-5 [&:not(:last-child)]:border-b-rule [&:not(:last-child)]:border-ink lg:[&:not(:last-child)]:border-b-0 lg:[&:not(:last-child)]:border-r-rule`}
            >
              <span className="pip bg-paperCard text-ink">{i + 1}</span>
              <h3 className="mt-3 font-display text-lg font-bold leading-tight text-ink">
                {title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ink/70">{body}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* Levels */}
      <Section
        eyebrow="Levels one to five"
        heading={
          <>
            Five forms.
            <br />
            One direction.
          </>
        }
        sub="Each build permanently changes the card and raises its weight. Nothing reverses, and nothing decays."
        tone="cream"
      >
        <LevelCards />
        <p className="mt-8 max-w-3xl text-sm leading-relaxed text-inkMuted">
          Taking a card from {LEVELS[0]?.form} to {landmark?.form} destroys{" "}
          {landmark?.cumulativeBurn.toLocaleString("en-US")} {BRAND.tokenTicker} in total, the
          mint included. Reaching the top is rare by design: if every card were built to{" "}
          {landmark?.form}, it would take more tokens than exist.
        </p>
        <Parameters className="mt-5" />
      </Section>

      {/* Quarters */}
      <Section
        eyebrow={`${EDITION.quarterCount} ${BRAND.groupTermPlural.toLowerCase()}`}
        heading={
          <>
            Four {BRAND.groupTermPlural.toLowerCase()}.
            <br />
            Four pools.
          </>
        }
        sub={`Every card belongs to one ${BRAND.groupTerm.toLowerCase()} and shares only in that ${BRAND.groupTerm.toLowerCase()}'s rewards. Nothing crosses between them.`}
        tone="felt"
      >
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {QUARTERS.map((q) => (
            <article key={q.index} className="border-rule border-ink bg-paperCard shadow-cardLg">
              <div
                className="border-b-rule border-ink px-5 py-6 text-paperCard"
                style={{backgroundColor: `var(${q.colorVar})`}}
              >
                <p className="font-mono text-[11px] uppercase tracking-[0.16em] opacity-80">
                  {q.label}
                </p>
                <p className="mt-4 font-display text-3xl font-bold leading-none">{q.assetName}</p>
                <p className="mt-2.5 text-sm opacity-85">is what this quarter pays in</p>
              </div>
              <dl className="divide-y divide-ink/10 px-5">
                <div className="flex items-baseline justify-between gap-2 py-3">
                  <dt className="rule-label">Cards</dt>
                  <dd className="font-mono text-lg font-semibold tabular-nums text-ink">
                    {EDITION.quarterCap}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-2 py-3">
                  <dt className="rule-label">Reward share</dt>
                  <dd className="font-mono text-lg font-semibold tabular-nums text-ink">
                    {formatBps(EDITION.quarterAllocationBps)}
                  </dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
        <Parameters className="mt-6" dark />
        <div className="mt-10 max-w-3xl border-l-4 border-field-sun pl-5">
          <p className="text-body-lg text-paperCard/90">{REWARD_ASSET_EXPLAINER}</p>
          <p className="mt-3 text-xs leading-relaxed text-paperCard/60">
            Rewards are not guaranteed in availability or amount. The reward asset grants no
            legal or beneficial ownership of any underlying security. {BRAND.projectName} is not
            affiliated with, endorsed by, or sponsored by any company named here.
          </p>
        </div>
      </Section>

      {/* Weight */}
      <Section
        eyebrow="More levels, more relative weight"
        heading={
          <>
            Your score inside
            <br />
            the {BRAND.groupTerm.toLowerCase()}.
          </>
        }
        sub={`${BRAND.scoreTerm} sets a card's relative share of rewards actually deposited into its ${BRAND.groupTerm.toLowerCase()}. More weight means a larger slice of the same deposit — not a rate, and not a promise.`}
        tone="sun"
      >
        <div className="max-w-4xl">
          <WeightComparison />
        </div>
        <p className="mt-8 max-w-3xl text-sm leading-relaxed text-ink/75">
          Weight only matters against the other cards in the same {BRAND.groupTerm.toLowerCase()}.
          As other owners build, your share of each deposit falls even though your weight has not
          changed. That is the central tension of the game, and it is intentional.
        </p>
      </Section>

      {/* Reward flow */}
      <Section
        eyebrow="From a trade to a claim"
        heading={
          <>
            How rent reaches
            <br />
            your card.
          </>
        }
        sub={`Five hops, each one a public function. Once value enters the first, no permission is needed to move it to the last.`}
        tone="night"
      >
        <Flow />
        <p className="mt-10 max-w-3xl text-sm leading-relaxed text-paperCard/75">
          This launch sets a {EDITION.creatorTaxPercent}% tax on trades. It is fixed at the moment
          the token is created and cannot be changed by anyone afterwards, and it reaches the
          protocol in full. Once it accrues, anyone can trigger the claim — no operator stands
          between you and a deposit. The router splits it on fixed terms, wraps the rewards
          portion, and funds short streams so a single sweep does not land on one moment.
        </p>
        <VenueParameter className="mt-4 max-w-3xl" dark>
          The {EDITION.creatorTaxPercent}% is set on the launch venue when the token is created,
          not in the contracts in this repository. It is checkable against the token itself once
          it exists. Everything downstream of it — the split, the streams, the conversion, the
          claim — is in these contracts and is read live on the protocol page.
        </VenueParameter>
      </Section>

      {/* Rule card */}
      <Section
        eyebrow="Fixed at deployment"
        heading={
          <>
            The rules
            <br />
            that cannot move.
          </>
        }
        sub="No function exists to change any of these. Not by the owner, not by a vote, not by an upgrade."
        tone="sky"
      >
        <div className="border-rule border-ink bg-paperCard shadow-cardSeal">
          <dl className="grid sm:grid-cols-2 lg:grid-cols-5">
            {[
              [
                "Fixed supply",
                EDITION.tokenMaxSupply.toLocaleString("en-US"),
                BRAND.tokenTicker,
              ],
              ["Cards, ever", EDITION.cardSupply.toLocaleString("en-US"), "across four quarters"],
              ["Mint burn", EDITION.mintBurn.toLocaleString("en-US"), `${BRAND.tokenTicker} per card`],
              ["Build burns", BUILD_BURN_RANGE, "per level, rising"],
              ["Primary mints", String(EDITION.mintsPerWallet), "per wallet"],
            ].map(([label, value, unit]) => (
              <div
                key={label}
                className="border-ink/15 p-6 [&:not(:last-child)]:border-b lg:[&:not(:last-child)]:border-b-0 lg:[&:not(:last-child)]:border-r"
              >
                <dt className="rule-label">{label}</dt>
                <dd className="mt-3 font-mono text-2xl font-semibold tabular-nums leading-none text-ink">
                  {value}
                </dd>
                <p className="mt-2 text-xs text-inkMuted">{unit}</p>
              </div>
            ))}
          </dl>
        </div>
        <Parameters className="mt-5" />

        <p className="mt-10 font-display text-display-md font-bold text-ink">
          Every burn is permanent.
          <br />
          Supply can only fall.
        </p>
      </Section>

      {/* Final CTA */}
      <section className="band-seal">
        <div className="mx-auto flex max-w-7xl flex-col items-start gap-8 px-4 py-20 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:py-24">
          <h2 className="font-display text-display-lg font-bold text-paperCard">
            Take a corner
            <br />
            of the board.
          </h2>
          <Link
            href="/mint"
            className="btn shrink-0 border-ink bg-field-sun text-ink shadow-card hover:-translate-x-px hover:-translate-y-px active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
          >
            Claim a card
          </Link>
        </div>
      </section>
    </>
  );
}

/**
 * The reward path as a chain of pips.
 *
 * Numbered rather than arrowed, because the hops are not all the same kind of motion —
 * one is a claim, one is a split, one is a wait — and an arrow between them would imply
 * they happen as one movement.
 */
function Flow() {
  const stages: [string, string][] = [
    ["Trades", `Every trade pays the ${EDITION.creatorTaxPercent}% tax.`],
    ["Fee claim", "Anyone pulls the accrued fees to the router."],
    [
      "Fixed split",
      `${formatBps(EDITION.feeSplitTreasuryBps)} treasury, ${formatBps(EDITION.feeSplitRewardsBps)} rewards.`,
    ],
    [
      `${EDITION.streamEpochSeconds}-second streams`,
      "Released gradually rather than in one sweep.",
    ],
    ["Rent to claims", `Converted, split by ${BRAND.groupTerm.toLowerCase()}, then by weight.`],
  ];

  return (
    <ol className="grid gap-px border-rule border-ink bg-ink sm:grid-cols-2 lg:grid-cols-5">
      {stages.map(([title, body], i) => (
        <li key={title} className="bg-field-night p-5">
          <div className="flex items-center gap-3">
            <span className="pip border-field-sun bg-field-sun text-ink">{i + 1}</span>
            {i < stages.length - 1 && (
              <span aria-hidden className="h-px grow bg-paperCard/25" />
            )}
          </div>
          <h3 className="mt-4 font-display text-base font-bold text-paperCard">{title}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-paperCard/65">{body}</p>
        </li>
      ))}
    </ol>
  );
}
