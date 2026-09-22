import Link from "next/link";

/**
 * Says where a block of figures came from.
 *
 * The interface shows two kinds of number and they must never be confused. A *reading* is
 * pulled from a contract when the page loads and is withheld entirely when that call does
 * not succeed -- it is what has happened. A *parameter* is compiled into a contract and
 * mirrored in this repo's config -- it is what the system is set up to do, and it is the
 * same before anything has happened at all.
 *
 * Every parameter block carries one of these. Without it a reader has no way to tell a
 * figure that is tracking the chain from one that was typed into a config file, and a
 * page that leaves them guessing is a page that will eventually be believed about
 * something it does not actually know.
 *
 * `scripts/check-parameters.mjs` fails the build if any mirrored parameter has drifted
 * from the contract it claims to describe.
 */
export function Parameters({className = "", dark = false}: {className?: string; dark?: boolean}) {
  return (
    <p
      className={`font-mono text-[11px] leading-relaxed ${
        dark ? "text-paperCard/55" : "text-inkFaint"
      } ${className}`}
    >
      Set in the contracts at deployment, not read from chain.{" "}
      <Link
        href="/stats"
        className={`underline underline-offset-2 ${
          dark ? "hover:text-field-sun" : "hover:text-ink"
        }`}
      >
        Live state is on the protocol page.
      </Link>
    </p>
  );
}

/** For a figure that is neither: set on the launch venue, outside these contracts. */
export function VenueParameter({
  className = "",
  dark = false,
  children,
}: {
  className?: string;
  dark?: boolean;
  children: React.ReactNode;
}) {
  return (
    <p
      className={`font-mono text-[11px] leading-relaxed ${
        dark ? "text-paperCard/55" : "text-inkFaint"
      } ${className}`}
    >
      {children}
    </p>
  );
}
