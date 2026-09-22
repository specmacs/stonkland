"use client";

import {useEffect, useState, type ReactNode} from "react";
import {useAccount, useSwitchChain, useWaitForTransactionReceipt, useWriteContract} from "wagmi";
import type {Abi, Address} from "viem";
import {CHAIN, CHAIN_NAME} from "@/lib/config";

/**
 * A transaction control that will not fire unless the chain state behind it checked out.
 *
 * `disabledReason` is the whole point: a control that cannot be used says why, in the
 * same place the user is looking, rather than failing silently or failing in the wallet.
 */
export function TxButton({
  address,
  abi,
  functionName,
  args,
  label,
  pendingLabel,
  disabledReason,
  onConfirmed,
  variant = "primary",
  confirm,
}: {
  address: Address | undefined;
  abi: Abi | readonly unknown[];
  functionName: string;
  args: readonly unknown[];
  label: string;
  pendingLabel: string;
  disabledReason?: string | undefined;
  onConfirmed?: () => void;
  variant?: "primary" | "secondary";
  /** Shown and acknowledged before the wallet is opened. */
  confirm?: ReactNode;
}) {
  const {isConnected, chainId} = useAccount();
  const {switchChain} = useSwitchChain();
  const {writeContract, data: hash, isPending, error, reset} = useWriteContract();
  const receipt = useWaitForTransactionReceipt({hash});
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);

  useEffect(() => {
    if (receipt.isSuccess) {
      onConfirmed?.();
      reset();
    }
  }, [receipt.isSuccess, onConfirmed, reset]);

  const wrongNetwork = Boolean(CHAIN && chainId && chainId !== CHAIN.id);

  if (!isConnected) {
    return <Disabled label={label} reason="Connect a wallet to continue." variant={variant} />;
  }

  if (wrongNetwork) {
    return (
      <button
        type="button"
        onClick={() => CHAIN && switchChain({chainId: CHAIN.id})}
        className={variant === "primary" ? "btn-primary" : "btn-secondary"}
      >
        Switch to {CHAIN_NAME} to continue.
      </button>
    );
  }

  if (!address) {
    return (
      <Disabled
        label={label}
        reason="Contract addresses are not configured for this deployment."
        variant={variant}
      />
    );
  }

  if (disabledReason) {
    return <Disabled label={label} reason={disabledReason} variant={variant} />;
  }

  const busy = isPending || receipt.isLoading;

  const fire = () => {
    setAwaitingConfirm(false);
    writeContract({address, abi: abi as Abi, functionName, args, chainId: CHAIN?.id});
  };

  return (
    <div>
      {awaitingConfirm && confirm ? (
        <div className="panel border-seal p-4">
          <div className="text-sm leading-relaxed text-ink">{confirm}</div>
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={fire} className="btn-primary">
              Yes, continue
            </button>
            <button
              type="button"
              onClick={() => setAwaitingConfirm(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => (confirm ? setAwaitingConfirm(true) : fire())}
          className={variant === "primary" ? "btn-primary" : "btn-secondary"}
        >
          {busy ? pendingLabel : label}
        </button>
      )}

      {error && (
        <p className="mt-2 text-xs text-inkMuted" role="alert">
          {describe(error)}
        </p>
      )}
      {receipt.isLoading && (
        <p className="mt-2 text-xs text-inkMuted" role="status">
          Waiting for confirmation…
        </p>
      )}
    </div>
  );
}

function Disabled({
  label,
  reason,
  variant,
}: {
  label: string;
  reason: string;
  variant: "primary" | "secondary";
}) {
  return (
    <div>
      <button
        type="button"
        disabled
        aria-describedby="tx-disabled-reason"
        className={variant === "primary" ? "btn-primary" : "btn-secondary"}
      >
        {label}
      </button>
      <p id="tx-disabled-reason" className="mt-2 text-xs text-inkMuted">
        {reason}
      </p>
    </div>
  );
}

function describe(error: Error): string {
  const message = error.message ?? "";
  if (/User rejected|denied transaction|User denied/i.test(message)) {
    return "Transaction rejected in your wallet.";
  }
  if (/WalletLimitReached/.test(message)) {
    return "You've used all your primary mints. Cards are available from holders.";
  }
  if (/QuarterFull/.test(message)) {
    return "This district is fully claimed. Cards are available from holders.";
  }
  if (/NotCardOwner/.test(message)) {
    return "Only the current owner can build on this card.";
  }
  if (/insufficient|exceeds balance|ERC20InsufficientBalance/i.test(message)) {
    return "Not enough tokens for this action.";
  }
  if (/AlreadyAtMaxLevel/.test(message)) {
    return "This card is already at the top of the ladder.";
  }
  if (/EnforcedPause|paused/i.test(message)) {
    return "This action is paused onchain right now.";
  }
  // Anything unrecognised is shown as-is rather than flattened into a friendly lie.
  return message.split("\n")[0] ?? "The transaction did not go through.";
}
