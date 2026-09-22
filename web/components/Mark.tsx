/**
 * The mark: a surveyor's corner. Two plot boundaries meeting, with the parcel they
 * bound. Original, legible at 24px, and carries no resemblance to any existing board
 * game's iconography.
 */
export function Mark({className = ""}: {className?: string}) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      role="img"
      aria-hidden="true"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M4 4h10v2H6v8H4V4Z"
        fill="currentColor"
      />
      <path
        d="M28 28H18v-2h8v-8h2v10Z"
        fill="currentColor"
      />
      <rect x="11" y="11" width="10" height="10" rx="1" fill="currentColor" opacity="0.35" />
    </svg>
  );
}
