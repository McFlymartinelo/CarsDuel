"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/** Popup au-dessus de la barre d'onglets mobile. Portail sur body : un ancêtre en overflow ne la coupe plus. */
export function Modal({
  labelledBy,
  children,
  wide = false,
}: {
  labelledBy: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal
      aria-labelledby={labelledBy}
    >
      <div className={`max-h-[min(88dvh,52rem)] w-full overflow-y-auto overscroll-contain rounded-2xl border border-zinc-700 bg-[#12151c] p-5 shadow-2xl ${wide ? "max-w-3xl" : "max-w-md"}`}>
        {children}
      </div>
    </div>,
    document.body,
  );
}
