import {formatUnits} from "viem";

/**
 * Number formatting.
 *
 * Nothing here produces a rate, a projection, or an annualised figure, and nothing here
 * should ever be asked to. Every number this interface shows is either a count, a weight,
 * or an amount of an asset that was actually deposited.
 */

/** Whole-token amounts with thousands separators: 1,500,000. */
export function formatWholeTokens(value: bigint, decimals = 18): string {
  const whole = value / 10n ** BigInt(decimals);
  return whole.toLocaleString("en-US");
}

/** Compact whole tokens for tight spaces: 1.5M, 100k. */
export function formatCompactTokens(value: bigint, decimals = 18): string {
  const whole = Number(value / 10n ** BigInt(decimals));
  if (whole >= 1_000_000_000) return `${trim(whole / 1_000_000_000)}B`;
  if (whole >= 1_000_000) return `${trim(whole / 1_000_000)}M`;
  if (whole >= 1_000) return `${trim(whole / 1_000)}k`;
  return whole.toLocaleString("en-US");
}

function trim(n: number): string {
  return n.toFixed(n < 10 ? 2 : 1).replace(/\.?0+$/, "");
}

/**
 * An asset amount with enough precision to be honest about small numbers.
 *
 * A reward that rounds to zero at two decimal places is shown as a small number rather
 * than as nothing, because "0.00" reads as "you have none" when the truth is "you have a
 * little". Dust below the displayable floor is marked as such.
 */
export function formatAssetAmount(value: bigint, decimals: number): string {
  if (value === 0n) return "0";
  const asString = formatUnits(value, decimals);
  const asNumber = Number(asString);

  if (asNumber >= 1_000) return asNumber.toLocaleString("en-US", {maximumFractionDigits: 2});
  if (asNumber >= 1) return asNumber.toLocaleString("en-US", {maximumFractionDigits: 4});
  if (asNumber >= 0.000001) {
    return asNumber.toLocaleString("en-US", {maximumFractionDigits: 8});
  }
  return `< 0.000001`;
}

/** 0x1234…abcd */
export function shortAddress(address: string): string {
  if (address.length < 10) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/** A percentage of a whole, for share-of-quarter readouts. Never a rate over time. */
export function formatShare(part: bigint, whole: bigint): string {
  if (whole === 0n) return "—";
  const basisPoints = Number((part * 10_000n) / whole);
  const percent = basisPoints / 100;
  if (percent > 0 && percent < 0.01) return "< 0.01%";
  return `${percent.toLocaleString("en-US", {maximumFractionDigits: 2})}%`;
}

export function formatCount(value: bigint | number): string {
  return Number(value).toLocaleString("en-US");
}

/** basis points as a percentage: 3333 -> "33.33%" */
export function formatBps(bps: number): string {
  return `${(bps / 100).toLocaleString("en-US", {maximumFractionDigits: 2})}%`;
}
