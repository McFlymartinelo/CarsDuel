"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const STORAGE_KEY = "carsduel.compare";

interface CompareContextValue {
  enabled: boolean;
  toggle: () => void;
}

const CompareContext = createContext<CompareContextValue | null>(null);

/**
 * État partagé de l'interrupteur « Comparer à ma configuration ».
 * L'état initial est identique au serveur (activé) : localStorage n'est lu
 * qu'en effet pour éviter tout mismatch d'hydratation.
 */
export function CompareProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === "off") setEnabled(false);
    } catch {
      // Stockage indisponible : on garde la valeur par défaut.
    }
  }, []);

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "on" : "off");
    } catch {
      // Stockage indisponible : la préférence ne survivra pas au rechargement.
    }
  }

  return <CompareContext.Provider value={{ enabled, toggle }}>{children}</CompareContext.Provider>;
}

export function useCompareEnabled(): CompareContextValue {
  const value = useContext(CompareContext);
  if (!value) throw new Error("useCompareEnabled doit être utilisé dans un CompareProvider");
  return value;
}
