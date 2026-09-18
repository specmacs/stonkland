import type {ReactNode} from "react";

export function Section({
  eyebrow,
  heading,
  sub,
  children,
  className = "",
}: {
  eyebrow?: string;
  heading: string;
  sub?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`mx-auto max-w-7xl px-4 py-16 sm:px-6 ${className}`}>
      {eyebrow && <p className="rule-label mb-3">{eyebrow}</p>}
      <h2 className="text-2xl font-semibold tracking-tight text-ink-100 sm:text-3xl">{heading}</h2>
      {sub && <p className="mt-3 max-w-2xl text-ink-400">{sub}</p>}
      {children && <div className="mt-8">{children}</div>}
    </section>
  );
}

export function PageHeader({
  eyebrow,
  heading,
  sub,
}: {
  eyebrow?: string;
  heading: string;
  sub?: string;
}) {
  return (
    <div className="mx-auto max-w-7xl px-4 pb-8 pt-12 sm:px-6">
      {eyebrow && <p className="rule-label mb-3">{eyebrow}</p>}
      <h1 className="text-3xl font-semibold tracking-tight text-ink-100 sm:text-4xl">{heading}</h1>
      {sub && <p className="mt-3 max-w-2xl text-ink-400">{sub}</p>}
    </div>
  );
}
