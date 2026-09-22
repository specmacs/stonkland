/**
 * The icon set, drawn here rather than pulled from a library.
 *
 * Six shapes, all on the same 24-unit grid with the same 2-unit stroke, so a row of them
 * reads as one set rather than six borrowed marks. They carry `currentColor`, which is
 * what lets the same icon sit on a cream tint and on the ink field without a second
 * variant.
 *
 * They are decoration beside a heading that already says the same thing, so every one is
 * `aria-hidden` and none of them takes a label.
 */
type IconProps = {className?: string};

function Frame({className = "", children}: IconProps & {children: React.ReactNode}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

/** Acquiring the token: a coin, struck rather than drawn as a dollar sign. */
export function CoinIcon({className}: IconProps) {
  return (
    <Frame className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v10" />
      <path d="M14.5 9.5a2.5 2.5 0 0 0-2.5-1.3c-1.5 0-2.6.8-2.6 2s1 1.7 2.6 2.1c1.7.4 2.7.9 2.7 2.1s-1.1 2-2.7 2A2.7 2.7 0 0 1 9.2 14.5" />
    </Frame>
  );
}

/** Claiming a card: a card on its side with a plot marked on it. */
export function CardIcon({className}: IconProps) {
  return (
    <Frame className={className}>
      <rect x="3" y="4.5" width="18" height="15" rx="1.5" />
      <path d="M3 9h18" />
      <path d="M7 13h5" />
      <path d="M7 16h8" />
    </Frame>
  );
}

/** Building: a burn. Nothing comes back. */
export function FlameIcon({className}: IconProps) {
  return (
    <Frame className={className}>
      <path d="M12 2c1 3.6 3 5 4.6 6.8A7.6 7.6 0 0 1 19 14a7 7 0 0 1-14 0c0-2.6 1.1-4.3 2.7-6" />
      <path d="M12 21a3.4 3.4 0 0 1-3.4-3.4c0-2 2-2.9 3.4-5.3 1.4 2.4 3.4 3.3 3.4 5.3A3.4 3.4 0 0 1 12 21Z" />
    </Frame>
  );
}

/** Weight: bars of different heights. The idea is proportion, not growth. */
export function BarsIcon({className}: IconProps) {
  return (
    <Frame className={className}>
      <path d="M4 20V13" />
      <path d="M9.3 20V9" />
      <path d="M14.7 20v-6" />
      <path d="M20 20V4" />
    </Frame>
  );
}

/** Getting paid: a stamped seal, the mark on a settled claim. */
export function SealIcon({className}: IconProps) {
  return (
    <Frame className={className}>
      <path d="M12 2.5 14.2 7l5 .7-3.6 3.5.9 4.9-4.5-2.3-4.5 2.3.9-4.9L4.8 7.7l5-.7L12 2.5Z" />
      <path d="M9 16.5V22l3-1.7 3 1.7v-5.5" />
    </Frame>
  );
}

/** A hop landing: value arriving somewhere. */
export function ArrowIcon({className}: IconProps) {
  return (
    <Frame className={className}>
      <path d="M4 12h15" />
      <path d="m13.5 6.5 6 5.5-6 5.5" />
    </Frame>
  );
}

/** A split: one input, two fixed outputs. */
export function SplitIcon({className}: IconProps) {
  return (
    <Frame className={className}>
      <path d="M3 12h5" />
      <path d="M8 12c4 0 3-6 7-6h6" />
      <path d="M8 12c4 0 3 6 7 6h6" />
      <path d="m18 3 3 3-3 3" />
      <path d="m18 15 3 3-3 3" />
    </Frame>
  );
}

/** A stream: released over time rather than in one sweep. */
export function ClockIcon({className}: IconProps) {
  return (
    <Frame className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5.2l3.4 2" />
    </Frame>
  );
}
