"use client";

import type {ReactNode} from "react";
import type {ReadState} from "@/lib/reads";

/**
 * The only way a read reaches the screen.
 *
 * Each state says what it is: what is loading, what failed, or which environment
 * variables are absent. There is deliberately no path through this component that renders
 * a number when the read behind it did not succeed.
 */
export function ReadGate<T>({
  state,
  loadingLabel,
  failureLabel,
  children,
}: {
  state: ReadState<T>;
  loadingLabel: string;
  failureLabel: string;
  children: (data: T) => ReactNode;
}) {
  if (state.status === "unconfigured") {
    return <ConfigMissing missing={state.missing} />;
  }
  if (state.status === "loading") {
    return (
      <p className="flex items-center gap-2 py-6 text-sm text-ink-400" role="status" aria-live="polite">
        <span
          aria-hidden
          className="h-1.5 w-1.5 animate-pulse rounded-full bg-brass-500"
        />
        {loadingLabel}
      </p>
    );
  }
  if (state.status === "error") {
    return (
      <div className="panel p-4 text-sm" role="alert">
        <p className="text-ink-200">{failureLabel}</p>
        <p className="mt-1 text-xs text-ink-500">{state.error.message}</p>
      </div>
    );
  }
  return <>{children(state.data)}</>;
}

/** Named so the operator can see exactly which variable to set. */
export function ConfigMissing({missing}: {missing: string[]}) {
  return (
    <div className="panel p-4 text-sm" role="alert">
      <p className="text-ink-200">Contract addresses are not configured for this deployment.</p>
      {missing.length > 0 && (
        <p className="mt-2 font-mono text-xs text-ink-500">{missing.join(" · ")}</p>
      )}
    </div>
  );
}
