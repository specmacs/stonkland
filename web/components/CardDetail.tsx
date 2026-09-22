"use client";

import {useEffect, useRef} from "react";
import {BRAND, QUARTERS, formName, levelInfo} from "@/lib/brand";
import {formatWholeTokens, shortAddress} from "@/lib/format";
import type {CardState} from "@/lib/reads";
import Link from "next/link";
import {PieceArt} from "./PieceArt";
import {Stars} from "./SectionHead";

/** Detail for one minted card. Everything shown here came from a read of that card. */
export function CardDetail({card, onClose}: {card: CardState; onClose: () => void}) {
  const ref = useRef<HTMLDivElement>(null);
  const quarter = QUARTERS[card.quarter];
  const next = levelInfo(card.level + 1);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    ref.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/70 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={`Card ${card.tokenId}`}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg border-rule border-ink bg-paperCard shadow-cardLg"
      >
        <div
          className="flex items-center justify-between gap-4 border-b-rule border-ink px-5 py-3 text-paperCard"
          style={{backgroundColor: `var(${quarter?.colorVar ?? "--quarter-1"})`}}
        >
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] opacity-85">
              {quarter?.label}
            </p>
            <h2 className="mt-1 font-display text-xl font-bold">
              {BRAND.itemName} #{card.tokenId.toString()}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 border border-paperCard/60 px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.12em] hover:bg-paperCard/15"
          >
            Close
          </button>
        </div>

        <div className="flex gap-5 p-6">
          <div className="shrink-0 text-center">
            <PieceArt level={card.level} className="h-28 w-28 border-rule border-ink" />
            <Stars level={card.level} className="mt-2" size="sm" />
          </div>
          <dl className="grid flex-1 grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <dt className="rule-label">Form</dt>
              <dd className="mt-0.5 text-ink">
                {formName(card.level)} <span className="text-inkMuted">({card.level}★)</span>
              </dd>
            </div>
            <div>
              <dt className="rule-label">{BRAND.scoreTerm}</dt>
              <dd className="mt-0.5 font-mono text-seal">{card.weight}</dd>
            </div>
            <div className="col-span-2">
              <dt className="rule-label">Lifetime burn</dt>
              <dd className="mt-0.5 font-mono text-ink">
                {formatWholeTokens(card.burned)} {BRAND.tokenTicker}
              </dd>
            </div>
            <div className="col-span-2">
              <dt className="rule-label">Owner</dt>
              <dd className="mt-0.5 font-mono text-inkMuted">{shortAddress(card.owner)}</dd>
            </div>
          </dl>
        </div>

        </div>

        <div className="border-t-rule border-ink px-6 py-5">
        <p className="text-xs leading-relaxed text-inkMuted">
          {next
            ? `Next level is ${next.form} at ${BRAND.scoreTerm} ${next.weight}, reached by burning ${next.burnToReach.toLocaleString("en-US")} ${BRAND.tokenTicker}. Only the current owner can build.`
            : `This card is at ${formName(card.level)}, the top of the ladder. It cannot be built further, reduced, or reset.`}
        </p>
        <Link
          href={`/board/${card.tokenId.toString()}`}
          className="btn-secondary mt-4"
          onClick={onClose}
        >
          Open this card
        </Link>
        </div>
    </div>
  );
}
