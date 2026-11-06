import { SortRow } from "@/components/SortRow";

/** Tri par navigation (URL) : boutique, marketplace. */
export function SortLinks({
  label,
  options,
  current,
  hrefFor,
}: {
  label: string;
  options: readonly { key: string; label: string; title: string }[];
  current?: string;
  hrefFor: (key: string | null) => string;
}) {
  return (
    <SortRow
      label={label}
      options={options}
      current={current}
      hrefs={Object.fromEntries(options.map((o) => [o.key, hrefFor(o.key === current ? null : o.key)]))}
    />
  );
}
