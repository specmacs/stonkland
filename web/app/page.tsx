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
import {LevelCarousel} from "@/components/LevelCarousel";
import {WeightComparison} from "@/components/WeightComparison";
import {HAS_PHASE_NOTICE, PhaseNotice} from "@/components/PhaseNotice";
import {Parameters, VenueParameter} from "@/components/Provenance";
import {Mark} from "@/components/Mark";
import {
  ArrowIcon,
  BarsIcon,
  CardIcon,
  ClockIcon,
  CoinIcon,
  FlameIcon,
  SealIcon,
  SplitIcon,
} from "@/components/Icons";

export default function LandingPage() {
  const house = LEVELS[0];
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
              {EDITION.quarterCount} {BRAND.groupTermPlural.toLowerCase()}
            </span>
          </div>

          <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-center">
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
                {EDITION.cardSupply} {BRAND.itemNamePlural.toLowerCase()} in the{" "}
                {BRAND.editionName}, a number fixed in the contract and unchangeable. Burn to
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

              <p className="mt-8 max-w-xl font-mono text-[11px] uppercase leading-relaxed tracking-[0.12em] text-inkMuted">
                No fixed rate · No projected return · Every burn permanent
              </p>
            </div>

            {/* The ladder, one card at a time. */}
            <LevelCarousel />
          </div>
        </div>
      </div>

      {HAS_PHASE_NOTICE && (
        <div className="mx-auto max-w-7xl px-4 pt-14 sm:px-6">
          <PhaseNotice className="max-w-3xl" />
        </div>
      )}

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
        <Loop />
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
          Taking a card from {house?.form} to {landmark?.form} destroys{" "}
          {landmark?.cumulativeBurn.toLocaleString("en-US")} {BRAND.tokenTicker} in total, the
          mint included. Reaching the top is rare by design: if every card were built to{" "}
          {landmark?.form}, it would take more tokens than exist.
        </p>
        <Parameters className="mt-5" />
      </Section>

      {/* Districts */}
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
            <article
              key={q.index}
              className="flex flex-col border-rule border-ink bg-paperCard shadow-cardLg"
            >
              <div className="flex items-center justify-between gap-3 border-b-rule border-ink px-5 py-3">
                {/* The disc is the colour this district is drawn in on the board, and it
                    carries its number. A company logo would be somebody else's mark and a
                    two-letter cut of the ticker reads as a typo. */}
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-full border-rule border-ink font-mono text-xs font-semibold text-paperCard"
                  style={{backgroundColor: `var(${q.colorVar})`}}
                  aria-hidden
                >
                  {String(q.index + 1).padStart(2, "0")}
                </span>
                <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-inkMuted">
                  {BRAND.groupTerm} {q.index + 1} of {EDITION.quarterCount}
                </span>
              </div>

              <div className="grow px-5 pb-6 pt-6">
                <p className="font-display text-4xl font-bold leading-[0.95] text-ink">
                  {q.label}
                  <br />
                  <span className="text-2xl text-inkMuted">{BRAND.groupTerm}</span>
                </p>
                <p className="rule-label mt-4">
                  {q.assetName} · {EDITION.quarterCap} card cap
                </p>
                <p className="mt-4 border-t border-ink/10 pt-3 text-sm leading-relaxed text-inkMuted">
                  Takes {formatBps(EDITION.quarterAllocationBps)} of every reward deposit, split
                  by weight among the cards standing in it.
                </p>
              </div>

              <span
                aria-hidden
                className="h-3 w-full border-t-rule border-ink"
                style={{backgroundColor: `var(${q.colorVar})`}}
              />
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
        <div className="max-w-4xl border-rule border-ink bg-paperCard px-6 py-7 shadow-card sm:px-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-seal">The rule</p>
          <p className="mt-3 font-display text-display-md font-bold leading-[1.05] text-ink">
            More levels = more relative weight
          </p>
        </div>

        <div className="mt-10 max-w-4xl">
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
        sub="Five hops, each one a public function. Once value enters the first, no permission is needed to move it to the last."
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
        <RuleCard />
        <Parameters className="mt-5" />
      </Section>

      {/* Final CTA */}
      <FinalCta />
    </>
  );
}

/**
 * The loop, as five rows on a phone and five columns on a desk.
 *
 * Each step carries an icon as well as a number. The number says where you are in the
 * sequence; the icon says what kind of move it is, which is the thing that makes a
 * column of five short headings scannable rather than a list to be read in order.
 */
function Loop() {
  const steps = [
    {
      title: "Acquire tokens",
      body: `Buy ${BRAND.tokenTicker} on the launch venue.`,
      tint: "bg-tint-cream",
      Icon: CoinIcon,
    },
    {
      title: "Claim a card",
      body: `Mint one of this edition's ${EDITION.cardSupply}.`,
      tint: "bg-tint-sun",
      Icon: CardIcon,
    },
    {
      title: "Burn to build",
      body: "Climb five levels with permanent burns.",
      tint: "bg-tint-peach",
      Icon: FlameIcon,
    },
    {
      title: "Raise your weight",
      body: `Every level raises the card's ${BRAND.scoreTerm.toLowerCase()}.`,
      tint: "bg-tint-sky",
      Icon: BarsIcon,
    },
    {
      title: "Get paid",
      body: "Your share is pushed out to you. You can also take it yourself, any time.",
      tint: "bg-tint-mint",
      Icon: SealIcon,
    },
  ];

  return (
    <ol className="card-row grid bg-ink sm:grid-cols-2 lg:grid-cols-5">
      {steps.map(({title, body, tint, Icon}, i) => (
        <li
          key={title}
          className={`${tint} p-5 [&:not(:last-child)]:border-b-rule [&:not(:last-child)]:border-ink sm:[&:nth-child(-n+4)]:border-b-rule sm:[&:nth-child(odd)]:border-r-rule sm:[&:nth-child(odd)]:border-ink lg:[&:not(:last-child)]:border-b-0 lg:[&:nth-child(-n+4)]:border-b-0 lg:[&:not(:last-child)]:border-r-rule`}
        >
          <div className="flex items-start justify-between gap-3">
            <span className="pip bg-paperCard text-ink">
              {String(i + 1).padStart(2, "0")}
            </span>
            <Icon className="h-8 w-8 shrink-0 text-ink/40" />
          </div>
          <h3 className="mt-4 font-display text-lg font-bold leading-tight text-ink">
            {title}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-ink/70">{body}</p>
        </li>
      ))}
    </ol>
  );
}

/**
 * The reward path as a stack of numbered rows.
 *
 * Rows rather than columns because the hops happen in order and at different times, and
 * a row you read downward carries that where five equal columns do not. The last one is
 * struck in green and arrowed: it is the only hop that ends at a wallet.
 */
function Flow() {
  const stages = [
    {title: "Trades", body: `Every trade pays the ${EDITION.creatorTaxPercent}% tax.`, Icon: CoinIcon},
    {title: "Fee claim", body: "Anyone pulls the accrued fees to the router.", Icon: ArrowIcon},
    {
      title: "Fixed split",
      body: `${formatBps(EDITION.feeSplitTreasuryBps)} treasury, ${formatBps(EDITION.feeSplitRewardsBps)} rewards.`,
      Icon: SplitIcon,
    },
    {
      title: `${EDITION.streamEpochSeconds}-second streams`,
      body: "Released gradually rather than in one sweep.",
      Icon: ClockIcon,
    },
    {
      title: "Paid out",
      body: `Converted, split by ${BRAND.groupTerm.toLowerCase()}, then by weight, then sent.`,
      Icon: SealIcon,
    },
  ];

  return (
    <ol className="card-row overflow-hidden border-rule border-ink bg-ink">
      {stages.map(({title, body, Icon}, i) => {
        const last = i === stages.length - 1;
        return (
          <li
            key={title}
            className={`flex items-center gap-4 px-5 py-5 sm:gap-6 sm:px-7 ${
              last ? "bg-felt" : "bg-field-night"
            } ${i > 0 ? "border-t-rule border-paperCard/15" : ""}`}
          >
            <span
              className={`pip shrink-0 ${
                last ? "border-paperCard bg-paperCard text-felt" : "border-field-sun bg-field-sun text-ink"
              }`}
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0 grow sm:flex sm:items-baseline sm:gap-6">
              <h3 className="font-display text-base font-bold text-paperCard sm:w-52 sm:shrink-0">
                {title}
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-paperCard/65 sm:mt-0">{body}</p>
            </div>
            <Icon
              className={`hidden h-7 w-7 shrink-0 sm:block ${
                last ? "text-paperCard" : "text-paperCard/30"
              }`}
            />
          </li>
        );
      })}
    </ol>
  );
}

/**
 * The fixed parameters, set as a card rather than a table.
 *
 * Every line here is compiled into a contract and mirrored in `brand.ts`, and
 * `scripts/check-parameters.mjs` fails the build if any of them drift from the Solidity.
 * None of it is a reading -- it says the same thing before a single card exists, which is
 * exactly why it can be printed on a card instead of gated behind a call.
 */
function RuleCard() {
  const rows: [string, string, string][] = [
    ["Fixed supply", EDITION.tokenMaxSupply.toLocaleString("en-US"), BRAND.tokenTicker],
    [
      "Cards in this edition",
      EDITION.cardSupply.toLocaleString("en-US"),
      `across ${EDITION.quarterCount} ${BRAND.groupTermPlural.toLowerCase()}`,
    ],
    ["Mint burn", EDITION.mintBurn.toLocaleString("en-US"), `${BRAND.tokenTicker} per card`],
    ["Build burns", BUILD_BURN_RANGE, "per level, rising"],
    ["Primary mints", String(EDITION.mintsPerWallet), "per wallet"],
    ["Resale royalty", formatBps(EDITION.royaltyBps), "routed into rewards"],
  ];

  return (
    <div className="max-w-3xl border-rule border-ink bg-paperCard shadow-cardSeal">
      <header className="flex items-center gap-3 border-b-rule border-ink bg-ink px-6 py-4">
        <Mark className="h-8 w-8 shrink-0 text-field-sun" />
        <div className="min-w-0">
          <p className="font-display text-xl font-bold leading-none text-paperCard">
            {BRAND.projectName}
          </p>
          <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-field-sun">
            {BRAND.editionName} · Rule card
          </p>
        </div>
      </header>

      <dl>
        {rows.map(([label, value, unit]) => (
          <div
            key={label}
            className="border-b border-ink/10 px-6 py-4 last:border-b-0 sm:flex sm:items-baseline sm:justify-between sm:gap-4"
          >
            <dt className="rule-label">{label}</dt>
            <dd className="mt-1.5 sm:mt-0 sm:text-right">
              <span className="font-mono text-xl font-semibold tabular-nums leading-none text-ink">
                {value}
              </span>
              <span className="ml-2 text-xs text-inkMuted">{unit}</span>
            </dd>
          </div>
        ))}
      </dl>

      <p className="border-t-rule border-ink bg-tint-cream px-6 py-4 font-display text-lg font-bold leading-snug text-ink">
        Every burn is permanent. Supply can only fall.
      </p>
    </div>
  );
}

/** The last thing on the page: one card, one line, one button. */
function FinalCta() {
  return (
    <section className="band-seal">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:py-24">
        <div className="border-rule border-ink bg-paperCard px-6 py-12 shadow-cardLg sm:px-12 sm:py-16">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-seal">
            {BRAND.editionName} · {EDITION.cardSupply} cards
          </p>
          <h2 className="mt-5 max-w-3xl font-display text-display-lg font-bold text-ink">
            Take a corner
            <br />
            of the board.
          </h2>
          <p className="mt-6 max-w-xl text-body-lg text-inkMuted">
            Burn {EDITION.mintBurn.toLocaleString("en-US")} {BRAND.tokenTicker} to claim a card
            in one of the {EDITION.quarterCount} {BRAND.groupTermPlural.toLowerCase()}. Up to{" "}
            {EDITION.mintsPerWallet} per wallet on the primary mint.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link href="/mint" className="btn-primary">
              Claim a card
            </Link>
            <Link href="/rulebook" className="btn-secondary">
              Read the rulebook
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
