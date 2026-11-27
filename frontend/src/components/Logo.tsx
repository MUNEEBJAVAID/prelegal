import Link from "next/link";

/** The Prelegal wordmark; `compact` shows only the mark on small screens. */
export function Logo({
  inverted = false,
  compact = false,
  href = "/",
}: {
  inverted?: boolean;
  compact?: boolean;
  href?: string;
}) {
  return (
    <Link href={href} className="relative inline-flex items-center gap-2" aria-label="Prelegal home">
      <span
        aria-hidden
        className="grid size-8 place-items-center rounded-lg bg-brand-yellow text-sm font-bold text-brand-navy"
      >
        P
      </span>
      <span
        className={`text-lg font-semibold tracking-tight ${inverted ? "text-white" : "text-brand-navy"} ${compact ? "hidden sm:inline" : ""}`}
      >
        Pre<span className="text-brand-yellow">legal</span>
      </span>
    </Link>
  );
}
