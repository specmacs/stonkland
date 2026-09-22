import {GLOBAL_DISCLAIMER, NON_AFFILIATION} from "@/lib/brand";

type Tone = "light" | "dark";

/** Legible on either field. Small type, but never faint enough to look like fine print. */
const TEXT: Record<Tone, string> = {
  light: "text-inkMuted",
  dark: "text-paperCard/65",
};

/** Carried on every page. */
export function GlobalDisclaimer({
  className = "",
  tone = "light",
}: {
  className?: string;
  tone?: Tone;
}) {
  return (
    <p className={`text-xs leading-relaxed ${TEXT[tone]} ${className}`}>{GLOBAL_DISCLAIMER}</p>
  );
}

/** Wherever an underlying asset is named. */
export function NonAffiliation({
  className = "",
  tone = "light",
}: {
  className?: string;
  tone?: Tone;
}) {
  return <p className={`text-xs leading-relaxed ${TEXT[tone]} ${className}`}>{NON_AFFILIATION}</p>;
}
