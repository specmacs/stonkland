"use client";

import Link from "next/link";
import {BRAND, EDITION, LEVELS, QUARTERS, formName, levelInfo} from "@/lib/brand";
import {formatWholeTokens, shortAddress} from "@/lib/format";
import {useCard, type CardState} from "@/lib/reads";
import {PageHeader} from "./Section";
import {SectionHead, Stars} from "./SectionHead";
import {PieceArt} from "./PieceArt";
import {ReadGate} from "./ReadGate";

/** The id a card page was asked for, or undefined if it names nothing in this edition. */
function parseId(raw: string): bigint | undefined {
  if (!/^[0-9]+$/.test(raw)) return undefined;
  const id = BigInt(raw);
  if (id < 1n || id > BigInt(EDITION.cardSupply)) return undefined;
  return id;
}

/** Which quarter an id falls in. Fixed by the id ranges, so it is known before any read. */
function quarterOf(id: bigint): number {
  return Number((id - 1n) / BigInt(EDITION.quarterCap));
}

export function CardPage({id: raw}: {id: string}) {
  const id = parseId(raw);
  const card = useCard(id);

  if (id === undefined) return <OutOfRange raw={raw} />;

  const quarter = QUARTERS[quarterOf(id)];

  return (
    <>
      <PageHeader
        eyebrow={`${quarter?.label ?? BRAND.groupTerm} · ${BRAND.editionName}`}
        heading={`${BRAND.itemName} #${id.toString()}`}
        sub={`One of ${EDITION.cardSupply}. Everything below is read from the collection at load, or it is not shown.`}
        tone="cream"
      />

      <div className="mx-auto max-w-7xl px-4 pb-20 pt-12 sm:px-6">
        <ReadGate
          state={card}
          loadingLabel="Reading this card…"
          failureLabel="This card could not be read, so nothing about it is shown."
        >
          {(data) => (data === null ? <Unminted id={id} /> : <Minted card={data} />)}
        </ReadGate>

        <p className="mt-10">
          <Link href="/board" className="btn-secondary">
            Back to the board
          </Link>
        </p>
      </div>
    </>
  );
}

function Minted({card}: {card: CardState}) {
  const quarter = QUARTERS[card.quarter];
  const next = levelInfo(card.level + 1);
  const info = levelInfo(card.level);

  return (
    <div className="grid gap-8 lg:grid-cols-[24rem_minmax(0,1fr)] lg:items-start">
      <div className="border-rule border-ink bg-paperCard shadow-cardLg">
        <div
          className="flex items-center justify-between gap-2 border-b-rule border-ink px-5 py-3 text-paperCard"
          style={{backgroundColor: `var(${quarter?.colorVar ?? "--quarter-1"})`}}
        >
          <p className="font-mono text-[11px] uppercase tracking-[0.16em]">{quarter?.label}</p>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] opacity-80">
            Lv {card.level}
          </p>
        </div>
        <div className="flex flex-col items-center bg-tint-cream px-6 py-8">
          <PieceArt level={card.level} priority className="h-56 w-56" />
          <Stars level={card.level} className="mt-5" />
        </div>
        <div className="border-t-rule border-ink px-5 py-4">
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-display text-2xl font-bold text-ink">{formName(card.level)}</p>
            <p className="font-mono text-2xl font-semibold tabular-nums text-seal">
              {card.weight}
            </p>
          </div>
          <p className="rule-label mt-1">{BRAND.scoreTerm}</p>
        </div>
      </div>

      <div>
        <dl className="card-row grid bg-ink sm:grid-cols-2">
          <Fact
            cap="bg-tint-sun"
            label="Lifetime burn"
            value={formatWholeTokens(card.burned)}
            unit={BRAND.tokenTicker}
            note="Everything destroyed by this card's mint and every build since."
          />
          <Fact
            cap="bg-tint-sky"
            label="Owner"
            value={shortAddress(card.owner)}
            note="The address that can build this card and claim what accrues on it."
            last
          />
        </dl>

        <div className="mt-8">
          <SectionHead eyebrow="Where it can go" heading="What is left above it.">
            {next
              ? `Building is permanent and one-directional. Only the current owner can do it.`
              : `This card is at the top of the ladder. Nothing above it exists.`}
          </SectionHead>

          <div className="mt-6 card-row grid bg-ink sm:grid-cols-3">
            {LEVELS.map((l, i) => {
              const reached = l.level <= card.level;
              const isNext = l.level === card.level + 1;
              return (
                <div
                  key={l.level}
                  className={`${reached ? "bg-tint-mint" : isNext ? "bg-tint-sun" : "bg-paperCard"} p-4 ${
                    i < LEVELS.length - 1 ? "border-b-rule border-ink sm:border-b-0 sm:border-r-rule" : ""
                  }`}
                >
                  <p className="flex items-center justify-between gap-2">
                    <span className="font-display text-base font-bold text-ink">{l.form}</span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-inkMuted">
                      {reached ? "Reached" : isNext ? "Next" : "Above"}
                    </span>
                  </p>
                  <p className="mt-2 font-mono text-sm tabular-nums text-inkMuted">
                    {BRAND.scoreTerm.toLowerCase()} {l.weight}
                  </p>
                  {!reached && (
                    <p className="mt-1 font-mono text-xs tabular-nums text-inkMuted">
                      burns {l.burnToReach.toLocaleString("en-US")}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <p className="mt-6 max-w-2xl text-sm leading-relaxed text-inkMuted">
            {next ? (
              <>
                Reaching {next.form} burns {next.burnToReach.toLocaleString("en-US")}{" "}
                {BRAND.tokenTicker} and raises {BRAND.scoreTerm.toLowerCase()} from {info?.weight}{" "}
                to {next.weight}. Nothing about the card reverses afterwards.
              </>
            ) : (
              <>
                A {formName(card.level)} cannot be built further, reduced, or reset. Its weight is
                fixed for as long as the card exists.
              </>
            )}
          </p>

          <p className="mt-6">
            <Link href="/cards" className="btn-primary">
              Build a card you hold
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

/** An id inside the edition that no card has been minted for yet. */
function Unminted({id}: {id: bigint}) {
  const quarter = QUARTERS[quarterOf(id)];
  return (
    <div className="border-rule border-ink bg-paperCard shadow-cardLg">
      <div
        aria-hidden
        className="tile-cap"
        style={{backgroundColor: `var(${quarter?.colorVar ?? "--quarter-1"})`}}
      />
      <div className="px-6 py-14 text-center">
        <p className="font-display text-3xl font-bold text-ink">
          No card has been minted here.
        </p>
        <p className="mx-auto mt-4 max-w-xl text-body-lg text-inkMuted">
          Id {id.toString()} is capacity in {quarter?.label}. It carries no level, no weight,
          no burn and no owner, and it will not until somebody claims it.
        </p>
        <p className="mt-8">
          <Link href="/mint" className="btn-primary">
            Claim a card
          </Link>
        </p>
      </div>
    </div>
  );
}

/** An id outside the edition entirely. */
function OutOfRange({raw}: {raw: string}) {
  return (
    <>
      <PageHeader
        eyebrow={BRAND.editionName}
        heading="That id is not in this edition."
        sub={`This edition runs from 1 to ${EDITION.cardSupply}. Nothing outside that range can ever exist in it.`}
        tone="cream"
      />
      <div className="mx-auto max-w-7xl px-4 pb-20 pt-12 sm:px-6">
        <p className="font-mono text-sm text-inkMuted">Asked for: {raw.slice(0, 64)}</p>
        <p className="mt-8">
          <Link href="/board" className="btn-primary">
            Back to the board
          </Link>
        </p>
      </div>
    </>
  );
}

function Fact({
  cap,
  label,
  value,
  unit,
  note,
  last = false,
}: {
  cap: string;
  label: string;
  value: string;
  unit?: string;
  note: string;
  last?: boolean;
}) {
  return (
    <div
      className={`bg-paperCard ${last ? "" : "border-b-rule border-ink sm:border-b-0 sm:border-r-rule"}`}
    >
      <div aria-hidden className={`tile-cap ${cap}`} />
      <div className="p-5">
        <dt className="rule-label">{label}</dt>
        <dd className="figure mt-3">
          {value}
          {unit && <span className="ml-2 font-sans text-sm text-inkMuted">{unit}</span>}
        </dd>
        <p className="mt-3 text-xs leading-relaxed text-inkMuted">{note}</p>
      </div>
    </div>
  );
}
