"use client";

import { useActionState, useState } from "react";
import { X } from "lucide-react";
import { visitCollectorCollection } from "@/app/(game)/garage/collection/actions";
import { TileBody, tileClass } from "@/components/ActionTile";
import { CardView, type TirePerf } from "@/components/CardView";
import { Modal } from "@/components/Modal";

function VisitCollectionDialog({ onClose, tirePerfs }: { onClose: () => void; tirePerfs: TirePerf[] }) {
  const [state, formAction, pending] = useActionState(visitCollectorCollection, null);
  const visited = state?.ok ? state.data : undefined;
  const error = state && !state.ok ? state.message : null;

  return (
    <Modal labelledBy="visit-collection-title" size="xl" onClose={pending ? undefined : onClose}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-400">Collection d&apos;un pilote</p>
          <h3 id="visit-collection-title" className="mt-1 font-display text-2xl font-bold uppercase">
            Visiter la collection d&apos;un pilote
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="rounded-lg border border-zinc-700 p-2 text-zinc-400 transition hover:border-zinc-500 hover:text-white"
        >
          <X size={18} aria-hidden />
        </button>
      </div>

      {visited ? (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-zinc-300">
            Collection de <span className="font-semibold text-white">{visited.username}</span> ·{" "}
            {visited.cards.length} carte{visited.cards.length > 1 ? "s" : ""}
          </p>
          {visited.cards.length ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {visited.cards.map(({ card_templates, image }) => (
                <CardView key={card_templates.id} template={card_templates} image={image} tirePerfs={tirePerfs} />
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-zinc-800 bg-[#10131a] p-6 text-center text-sm text-zinc-400">
              Ce pilote n&apos;a encore aucune carte.
            </p>
          )}
          <button
            type="button"
            onClick={onClose}
            className="min-h-12 w-full rounded-xl border border-zinc-600 font-display text-base font-bold uppercase text-zinc-200 transition hover:border-zinc-400 hover:bg-zinc-800"
          >
            Fermer
          </button>
        </div>
      ) : (
        <>
          <p className="mt-3 rounded-lg border border-zinc-800 bg-black/20 p-3 text-sm leading-relaxed text-zinc-300">
            Saisissez le pseudo du collectionneur dont vous voulez parcourir la collection.
          </p>
          <form action={formAction} className="mt-5 space-y-5">
            <label className="block text-sm font-medium text-zinc-200">
              Pseudo du collectionneur
              <input
                type="text"
                name="username"
                required
                minLength={3}
                maxLength={24}
                autoComplete="username"
                autoFocus
                className="mt-2 min-h-12 w-full rounded-lg border border-zinc-600 bg-[#0b0d12] px-3 text-base text-white outline-none transition placeholder:text-zinc-600 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/25"
                placeholder="Ex. AlexRacer"
              />
            </label>
            {error && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-950/30 p-3 text-sm text-red-300">{error}</p>}
            <div className="grid grid-cols-2 gap-3 border-t border-zinc-800 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="min-h-12 rounded-xl border border-zinc-600 font-display text-base font-bold uppercase text-zinc-200 transition hover:border-zinc-400 hover:bg-zinc-800"
              >
                Fermer
              </button>
              <button
                disabled={pending}
                className="min-h-12 rounded-xl bg-amber-500 font-display text-base font-bold uppercase text-black transition hover:bg-amber-400 disabled:cursor-wait disabled:opacity-60"
              >
                {pending ? "Recherche…" : "Visiter"}
              </button>
            </div>
          </form>
        </>
      )}
    </Modal>
  );
}

/** Bouton d'accès à la collection publique d'un autre pilote. */
export function VisitCollectorCollection({ tirePerfs = [] }: { tirePerfs?: TirePerf[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="max-w-xl">
      <button type="button" onClick={() => setOpen(true)} className={tileClass()}>
        <TileBody
          title="Visiter la collection d'un pilote"
          text="Parcourez les cartes d'un autre collectionneur."
          image="/garage/visite-collection.webp"
        />
      </button>
      {open && <VisitCollectionDialog onClose={() => setOpen(false)} tirePerfs={tirePerfs} />}
    </div>
  );
}
