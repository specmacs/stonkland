import type {ReactNode} from "react";

type Tone = "paper" | "cream" | "sky" | "sun" | "felt" | "ink" | "night" | "seal";

/** Which fields carry light type, and what the eyebrow is struck in on each. */
const ON_FIELD: Record<Tone, {dark: boolean; eyebrow: string}> = {
  paper: {dark: false, eyebrow: "text-seal"},
  cream: {dark: false, eyebrow: "text-seal"},
  sky: {dark: false, eyebrow: "text-seal"},
  /* Seal red on the yellow field is loud without being hard to read; ink would vanish. */
  sun: {dark: false, eyebrow: "text-seal"},
  felt: {dark: true, eyebrow: "text-field-sun"},
  ink: {dark: true, eyebrow: "text-field-sun"},
  night: {dark: true, eyebrow: "text-field-sun"},
  /* Gold on seal red is the only eyebrow colour that holds; yellow goes muddy. */
  seal: {dark: true, eyebrow: "text-field-sun"},
};

/**
 * The header every section uses: a small stamped label, a large two-line headline on the
 * left, and the paragraph that explains it set to the right.
 *
 * Splitting them is what keeps the headline big. A headline with its explanation running
 * underneath has to shrink to leave room; set beside it, it can fill the page.
 */
export function SectionHead({
  eyebrow,
  heading,
  children,
  tone = "paper",
}: {
  eyebrow?: string;
  heading: ReactNode;
  children?: ReactNode;
  tone?: Tone;
}) {
  const {dark, eyebrow: eyebrowClass} = ON_FIELD[tone];
  return (
    <div className="grid gap-x-12 gap-y-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-end">
      <div>
        {eyebrow && (
          <p
            className={`font-mono text-[11px] uppercase tracking-[0.16em] ${eyebrowClass}`}
          >
            {eyebrow}
          </p>
        )}
        <h2
          className={`${eyebrow ? "mt-4" : ""} font-display text-display-md font-bold ${
            dark ? "text-paperCard" : "text-ink"
          }`}
        >
          {heading}
        </h2>
      </div>
      {children && (
        <p className={`text-body-lg ${dark ? "text-paperCard/80" : "text-inkMuted"}`}>
          {children}
        </p>
      )}
    </div>
  );
}

/** Five slots, filled or hollow, which reads faster than a number. */
export function Stars({
  level,
  className = "",
  size = "md",
}: {
  level: number;
  className?: string;
  size?: "sm" | "md";
}) {
  const box = size === "sm" ? "h-3.5 w-3.5" : "h-5 w-5";
  return (
    <span
      className={`inline-flex gap-0.5 ${className}`}
      role="img"
      aria-label={`Level ${level} of 5`}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} viewBox="0 0 20 20" className={box} aria-hidden>
          <path
            d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.5 7.7l5.9-.9L10 1.5z"
            fill={i <= level ? "#e2a615" : "none"}
            stroke="#14110a"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
        </svg>
      ))}
    </span>
  );
}
