"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";

const FIELD =
  "h-11 w-full rounded-xl border border-zinc-800 bg-[#10131a] pl-10 pr-10 text-sm text-white placeholder:text-zinc-500 transition-colors focus:border-amber-400/60 focus:outline-none [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden";

function FieldIcon() {
  return <Search size={16} strokeWidth={2} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />;
}

function ClearButton({ onClear }: { onClear: () => void }) {
  return (
    <button
      type="button"
      onClick={onClear}
      aria-label="Effacer la recherche"
      className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-zinc-500 transition hover:bg-zinc-800 hover:text-white"
    >
      <X size={14} strokeWidth={2.25} />
    </button>
  );
}

/** Champ de recherche contrôlé (filtrage local, côté client). */
export function SearchInput({
  value,
  onChange,
  placeholder = "Rechercher…",
  label = "Rechercher",
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <FieldIcon />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className={FIELD}
      />
      {value && <ClearButton onClear={() => onChange("")} />}
    </div>
  );
}

/**
 * Barre de recherche pilotée par l'URL : met à jour `q` après une courte pause,
 * en conservant les autres filtres (`params`).
 */
export function SearchNav({
  path,
  q,
  params,
  placeholder = "Rechercher…",
  label = "Rechercher",
  className = "",
}: {
  path: string;
  q?: string;
  params?: Record<string, string | undefined>;
  placeholder?: string;
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(q ?? "");
  const timer = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // La valeur fait foi côté URL (réinitialisation, retour arrière) — sauf pendant la saisie.
  useEffect(() => {
    if (document.activeElement === inputRef.current) return;
    setValue(q ?? "");
  }, [q]);

  useEffect(() => () => {
    if (timer.current != null) window.clearTimeout(timer.current);
  }, []);

  const navigate = (next: string, immediate = false) => {
    if (timer.current != null) window.clearTimeout(timer.current);
    const commit = () => {
      const search = new URLSearchParams();
      for (const [key, item] of Object.entries(params ?? {})) if (item) search.set(key, item);
      const term = next.trim();
      if (term) search.set("q", term);
      const qs = search.toString();
      router.replace(qs ? `${path}?${qs}` : path, { scroll: false });
    };
    if (immediate) commit();
    else timer.current = window.setTimeout(commit, 300);
  };

  const update = (next: string, immediate = false) => {
    setValue(next);
    navigate(next, immediate);
  };

  return (
    <div className={`relative ${className}`}>
      <FieldIcon />
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(event) => update(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            update(value, true);
          }
        }}
        placeholder={placeholder}
        aria-label={label}
        className={FIELD}
      />
      {value && <ClearButton onClear={() => update("", true)} />}
    </div>
  );
}
