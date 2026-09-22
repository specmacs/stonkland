import type {ReactNode} from "react";
import {SectionHead} from "./SectionHead";

export type Tone = "paper" | "cream" | "sky" | "sun" | "felt" | "ink" | "night" | "seal";

const TONE: Record<Tone, string> = {
  paper: "",
  cream: "band-cream",
  sky: "band-sky",
  sun: "band-sun",
  felt: "band-felt",
  ink: "band-ink",
  night: "band-night",
  seal: "band-seal",
};

/** Whether a field carries light type. Decides every colour choice inside the section. */
const DARK: Record<Tone, boolean> = {
  paper: false,
  cream: false,
  sky: false,
  sun: false,
  felt: true,
  ink: true,
  night: true,
  seal: true,
};

/**
 * A section of the page, laid on a flat field of colour.
 *
 * The page alternates fields rather than separating sections with whitespace. Whitespace
 * is how a dashboard breaks things up; a printed rulebook changes the colour of the page,
 * and a reader who has scrolled past three sections can still tell them apart.
 *
 * `sub` is set beside the headline rather than beneath it. Running the explanation under
 * the headline forces the headline to shrink to leave room for it; set to the side, the
 * headline can fill the measure.
 */
export function Section({
  eyebrow,
  heading,
  sub,
  children,
  tone = "paper",
  className = "",
  wide = false,
}: {
  eyebrow?: string;
  heading: ReactNode;
  sub?: ReactNode;
  children?: ReactNode;
  tone?: Tone;
  className?: string;
  /** Let the content run to the full measure instead of the 7xl column. */
  wide?: boolean;
}) {
  return (
    <section className={`${TONE[tone]} ${className}`}>
      <div className={`mx-auto px-4 py-20 sm:px-6 lg:py-24 ${wide ? "max-w-[100rem]" : "max-w-7xl"}`}>
        <SectionHead eyebrow={eyebrow} heading={heading} tone={tone}>
          {sub}
        </SectionHead>
        {children && <div className="mt-12">{children}</div>}
      </div>
    </section>
  );
}

export function PageHeader({
  eyebrow,
  heading,
  sub,
  tone = "paper",
}: {
  eyebrow?: string;
  heading: string;
  sub?: ReactNode;
  tone?: Tone;
}) {
  const dark = DARK[tone];
  return (
    <div className={TONE[tone]}>
      <div className="mx-auto max-w-7xl px-4 pb-10 pt-12 sm:px-6 lg:pb-14 lg:pt-16">
        {eyebrow && (
          <p
            className={`font-mono text-[11px] uppercase tracking-[0.16em] ${
              dark ? "text-field-sun" : "text-seal"
            }`}
          >
            {eyebrow}
          </p>
        )}
        <h1
          className={`mt-4 font-display text-display-lg font-bold ${
            dark ? "text-paperCard" : "text-ink"
          }`}
        >
          {heading}
        </h1>
        {sub && (
          <p
            className={`mt-5 max-w-2xl text-body-lg ${dark ? "text-paperCard/80" : "text-inkMuted"}`}
          >
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}

