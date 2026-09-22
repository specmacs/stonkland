import {GLOBAL_DISCLAIMER, NON_AFFILIATION} from "@/lib/brand";

/** Carried on every page. */
export function GlobalDisclaimer({className = ""}: {className?: string}) {
  return <p className={`text-xs leading-relaxed text-inkMuted ${className}`}>{GLOBAL_DISCLAIMER}</p>;
}

/** Wherever an underlying asset is named. */
export function NonAffiliation({className = ""}: {className?: string}) {
  return <p className={`text-xs leading-relaxed text-inkMuted ${className}`}>{NON_AFFILIATION}</p>;
}
