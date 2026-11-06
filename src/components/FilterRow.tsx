import type { ReactNode } from "react";

export const FILTER_ROW_CLASS = "grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-2";
export const FILTER_LABEL_CLASS = "font-display text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500";

/** Rangée de filtres façon collection : libellé à gauche, pastilles compactes à droite. */
export function FilterRow({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`${FILTER_ROW_CLASS} ${className}`}>
      <span className={FILTER_LABEL_CLASS}>{label}</span>
      {children}
    </div>
  );
}
