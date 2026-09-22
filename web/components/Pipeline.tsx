"use client";

import {useReadContract} from "wagmi";
import {BRAND, EDITION, QUARTERS} from "@/lib/brand";
import {ADDRESSES, EDITION_ID} from "@/lib/config";
import {distributorAbi, pipelineAbi} from "@/lib/abis";
import {formatAssetAmount} from "@/lib/format";
import {useProtocolStats, type ProtocolStats} from "@/lib/reads";
import {ReadGate} from "./ReadGate";
import {TxButton} from "./TxButton";
import {SectionHead} from "./SectionHead";

/**
 * Every stage of the reward pipeline, with the control that advances it.
 *
 * All of these are open to anyone on chain, which is only true in practice if something
 * can press them. A protocol whose rewards move only when its team runs a script has an
 * operator whether it admits to one or not, so the buttons live here in public rather
 * than in a private keeper.
 *
 * Each stage shows what is actually waiting at it, read live. A stage with nothing
 * waiting is disabled and says so, because a button that reverts teaches nobody anything.
 */
export function Pipeline() {
  const stats = useProtocolStats();

  return (
    <section>
      <SectionHead eyebrow="Open to anyone" heading="Move the pipeline.">
        Rewards travel from trading fees to your card through the stages below, and nothing
        here can send funds anywhere other than onward. The first two stages and the royalty
        sweep have no owner and no pause: they are open to anyone, always. The two vault
        stages are open to anyone while the vault runs, and to a named processor only while
        conversion is paused. Where a stage is open and has something waiting, you can move
        it yourself and pay only the gas.
      </SectionHead>
      <div className="h-8" />

      <ReadGate
        state={stats}
        loadingLabel="Reading pipeline state…"
        failureLabel="Pipeline state could not be read. Controls stay disabled until it can."
      >
        {(data) => <Stages data={data} />}
      </ReadGate>
    </section>
  );
}

function Stages({data}: {data: ProtocolStats}) {
  return (
    <div className="space-y-4">
      <Stage
        step={1}
        title="Claim and split trading fees"
        body={`Pulls what the venue has credited, then splits it on fixed terms: one third to the treasury, two thirds to rewards.`}
        waiting={data.feeRouterPending}
        address={ADDRESSES.feeRouter}
        functionName="distribute"
        label="Claim and split"
      />

      <Stage
        step={2}
        title="Release matured stream"
        body={`The rewards share is paid out over ${EDITION.streamEpochSeconds} seconds rather than landing in one moment. This pushes on whatever has matured.`}
        waiting={data.streamReleasable}
        alsoWaiting={
          data.streamUnmatured !== undefined && data.streamUnmatured > 0n
            ? `${formatAssetAmount(data.streamUnmatured, 18)} ETH still streaming`
            : undefined
        }
        address={ADDRESSES.streamVault}
        functionName="release"
        label="Release"
      />

      <Stage
        step={3}
        title={`Allocate across ${BRAND.groupTermPlural.toLowerCase()}`}
        body={`Wraps whatever arrived as ether, then divides it between editions by weight and between the four ${BRAND.groupTermPlural.toLowerCase()} on the frozen allocation.`}
        waiting={data.vaultUnallocated}
        address={ADDRESSES.revenueVault}
        functionName="allocate"
        label="Allocate"
        blockedReason={vaultBlockedReason(data)}
      />

      <ConvertStage data={data} />

      <PushStage data={data} />

      <Stage
        step={6}
        title="Forward card royalties"
        body={`The ${EDITION.royaltyBps / 100}% resale royalty on cards, pushed into the same pipeline. Independent of trading volume.`}
        waiting={undefined}
        address={ADDRESSES.royaltyRouter}
        functionName="forward"
        label="Forward"
        readPendingFrom={ADDRESSES.royaltyRouter}
      />
    </div>
  );
}

/**
 * Why the two vault stages may be closed to a passer-by.
 *
 * `allocate` and `processQuarter` are open to everyone while the vault runs, and to the
 * named processor only while it is paused. Without reading that, the interface would
 * offer both to anybody and let the wallet deliver the refusal -- which is the same
 * failure as an enabled mint button on a paused minter, and it is checked for the same
 * reason.
 */
function vaultBlockedReason(data: ProtocolStats): string | undefined {
  if (data.vaultPaused === undefined) {
    return "The vault's pause state could not be read, so this stays disabled.";
  }
  if (data.vaultPaused) {
    return "Conversion is paused onchain. While it is, only the named processor can move this stage.";
  }
  return undefined;
}

/**
 * Paying owners without them asking.
 *
 * The distributor's accounting is pull-based, which is what makes it safe and cheap: it
 * never iterates the collection, so nothing it does grows with the number of cards. This
 * pushes anyway. A quarter's ids are contiguous, so a bounded range of them can be settled
 * and paid in one transaction, and whoever calls it pays the gas to pay other people.
 *
 * In practice this is a scheduled job. It is here because a reward that only arrives when
 * somebody remembers to run a script is a reward with an operator in front of it, and
 * anyone should be able to run it themselves.
 */
function PushStage({data}: {data: ProtocolStats}) {
  return (
    <article className="border-rule border-ink bg-paperCard shadow-card">
      <div className="flex items-center gap-3 border-b-rule border-ink bg-tint-mint px-5 py-3">
        <span className="pip bg-field-sun text-ink">5</span>
        <span className="font-display text-base font-bold text-ink">
          Pay owners without them asking
        </span>
      </div>

      <div className="px-5 py-5">
        <p className="max-w-2xl text-sm leading-relaxed text-inkMuted">
          Settles and pays every card in a {BRAND.groupTerm.toLowerCase()}, so owners are not
          required to do anything to be paid. Bounded per call and resumable, because a full{" "}
          {BRAND.groupTerm.toLowerCase()} is more work than one transaction should carry. An
          owner whose transfer fails is skipped rather than blocking the rest, and their
          credit stays theirs.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {QUARTERS.map((q) => (
            <div key={q.index} className="border-rule border-ink bg-paperCard">
              <div
                aria-hidden
                className="tile-cap"
                style={{backgroundColor: `var(${q.colorVar})`}}
              />
              <div className="p-3">
                <p className="rule-label">{q.label}</p>
                <div className="mt-3">
                  <TxButton
                    address={ADDRESSES.distributor}
                    abi={distributorAbi}
                    functionName="pushQuarter"
                    // From the start of the quarter, forty cards at a time. Enough to be
                    // worth a transaction, few enough to fit comfortably in a block.
                    args={[EDITION_ID, q.index, 0n, 40n]}
                    label="Pay owners"
                    pendingLabel="Paying…"
                    variant="secondary"
                    disabledReason={
                      data.perQuarterMinted[q.index] === undefined
                        ? "This quarter's card count could not be read."
                        : (data.perQuarterMinted[q.index] ?? 0n) === 0n
                          ? "No cards in this quarter yet."
                          : undefined
                    }
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

/** Conversion is per-quarter, so a failed route strands only its own quarter. */
function ConvertStage({data}: {data: ProtocolStats}) {
  return (
    <article className="border-rule border-ink bg-paperCard shadow-card">
      <div className="flex items-center gap-3 border-b-rule border-ink bg-tint-cream px-5 py-3">
        <span className="pip bg-field-sun text-ink">4</span>
        <span className="font-display text-base font-bold text-ink">
          Convert each {BRAND.groupTerm.toLowerCase()} into its reward asset
        </span>
      </div>

      <div className="px-5 py-5">
      <p className="max-w-2xl text-sm leading-relaxed text-inkMuted">
        Each {BRAND.groupTerm.toLowerCase()} converts on its own, so a route that fails strands
        only that one. The route checks its own thirty-minute average before and after the trade
        and refuses a bad fill, which is why this is safe to leave open to anyone.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {QUARTERS.map((q) => {
          const pending = data.vaultPerQuarterPending[q.index];
          const nothingWaiting = pending === undefined || pending === 0n;
          return (
            <div key={q.index} className="border-rule border-ink bg-paperCard">
              <div
                aria-hidden
                className="tile-cap"
                style={{backgroundColor: `var(${q.colorVar})`}}
              />
              <div className="p-3">
              <p className="rule-label">{q.label}</p>
              <p className="mt-1.5 font-mono text-sm text-ink">
                {pending === undefined ? (
                  <span className="text-inkFaint">not read</span>
                ) : (
                  `${formatAssetAmount(pending, 18)} ETH`
                )}
              </p>
              <div className="mt-3">
                <TxButton
                  address={ADDRESSES.revenueVault}
                  abi={pipelineAbi}
                  functionName="processQuarter"
                  // Zero minimums are safe here: the adapter enforces its own floor
                  // underneath whatever a caller passes, and a caller can only tighten it.
                  args={[
                    EDITION_ID,
                    q.index,
                    [0n],
                    BigInt(Math.floor(Date.now() / 1000) + 600),
                  ]}
                  label="Convert"
                  pendingLabel="Converting…"
                  variant="secondary"
                  disabledReason={
                    vaultBlockedReason(data) ??
                    (nothingWaiting
                      ? `Nothing waiting in this ${BRAND.groupTerm.toLowerCase()}.`
                      : undefined)
                  }
                />
              </div>
              </div>
            </div>
          );
        })}
      </div>
      </div>
    </article>
  );
}

function Stage({
  step,
  title,
  body,
  waiting,
  alsoWaiting,
  address,
  functionName,
  label,
  readPendingFrom,
  blockedReason,
}: {
  step: number;
  title: string;
  body: string;
  waiting: bigint | undefined;
  alsoWaiting?: string | undefined;
  address: `0x${string}` | undefined;
  functionName: string;
  label: string;
  readPendingFrom?: `0x${string}` | undefined;
  /** A reason this stage is closed regardless of what is waiting at it. */
  blockedReason?: string | undefined;
}) {
  // The royalty router is the one stage whose balance is not already in the stats read.
  const extra = useReadContract({
    address: readPendingFrom,
    abi: pipelineAbi,
    functionName: "pending",
    query: {enabled: Boolean(readPendingFrom)},
  });

  const amount = readPendingFrom ? (extra.data as bigint | undefined) : waiting;
  const unread = amount === undefined;
  const nothingWaiting = !unread && amount === 0n;

  return (
    <article className="border-rule border-ink bg-paperCard shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-rule border-ink bg-tint-cream px-5 py-3">
        <p className="flex items-center gap-3">
          <span className="pip bg-field-sun text-ink">{step}</span>
          <span className="font-display text-base font-bold text-ink">{title}</span>
        </p>
        <p className="text-right">
          <span className="rule-label block">Waiting</span>
          <span className="mt-0.5 block font-mono text-base tabular-nums text-ink">
            {unread ? (
              <span className="text-inkFaint">not read</span>
            ) : (
              `${formatAssetAmount(amount, 18)} ETH`
            )}
          </span>
          {alsoWaiting && (
            <span className="mt-0.5 block text-xs text-inkMuted">{alsoWaiting}</span>
          )}
        </p>
      </div>

      <div className="px-5 py-5">
        <p className="max-w-2xl text-sm leading-relaxed text-inkMuted">{body}</p>
        <div className="mt-4">
        <TxButton
          address={address}
          abi={pipelineAbi}
          functionName={functionName}
          args={[]}
          label={label}
          pendingLabel="Sending…"
          variant="secondary"
          disabledReason={
            blockedReason ??
            (unread
              ? "This stage's state could not be read, so it stays disabled."
              : nothingWaiting
                ? "Nothing waiting at this stage."
                : undefined)
            }
          />
        </div>
      </div>
    </article>
  );
}
