"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import {
  ArrowRightLeft,
  Clock,
  Coins,
  Handshake,
  Inbox,
  Loader2,
  Search,
  Send,
  X,
} from "lucide-react";
import { buttonClass } from "@/components/ui/Button";
import { TradeComposer } from "@/components/marketplace/TradeComposer";
import { TradeIncomingModal } from "@/components/marketplace/TradeIncomingModal";
import { cancelTradeOffer, lookupTradePartner, searchTradePlayers } from "@/app/(game)/marketplace/trade-actions";
import { CATEGORY_LABEL, RARITY_THEME, formatDateTime } from "@/lib/format";
import type { TradeCard, TradeOffer, TradePartner, TradePlayerSuggestion } from "@/lib/types";

type ComposerState =
  | { mode: "create"; partner: TradePartner }
  | {
      mode: "counter";
      partner: TradePartner;
      tradeId: string;
      initialProposed: TradeCard[];
      initialRequested: TradeCard[];
    };

/** Pastilles compactes pour résumer une liste de cartes sans surcharger la page. */
function CardChips({ items }: { items: TradeOffer["items"] }) {
  if (items.length === 0) {
    return <span className="text-xs text-zinc-500">Aucune carte</span>;
  }
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((item) => {
        const t = item.user_cards.card_templates;
        const accent = t.rarity ? RARITY_THEME[t.rarity].label : "text-cyan-300";
        return (
          <li key={item.id} className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-md border border-line-strong bg-[#0b0e13] px-2 py-1 text-xs">
            <span className={`shrink-0 font-display font-semibold uppercase ${accent}`}>{CATEGORY_LABEL[t.category]}</span>
            <span className="truncate text-zinc-200">{t.name}</span>
          </li>
        );
      })}
    </ul>
  );
}

function SectionTitle({ icon, title, count }: { icon: React.ReactNode; title: string; count: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-amber-400">{icon}</span>
      <h2 className="font-display text-xl font-bold uppercase tracking-wide">{title}</h2>
      <span className="rounded-full border border-line-strong bg-panel px-2 py-0.5 text-xs font-semibold tabular-nums text-zinc-400">{count}</span>
    </div>
  );
}

function EmptyList({
  icon,
  children,
  action,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-panel/70 px-4 py-8 text-center">
      <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-line-strong bg-[#0b0e13] text-zinc-500">
        {icon}
      </span>
      <p className="mt-3 text-sm text-zinc-500">{children}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

/** Onglet Échanges : recherche d'un joueur, propositions envoyées et reçues. */
export function TradeCenter({
  me,
  outgoing,
  incoming,
  names,
}: {
  me: { id: string; username: string; coins: number; cards: TradeCard[] };
  outgoing: TradeOffer[];
  incoming: TradeOffer[];
  names: Record<string, string>;
}) {
  const [target, setTarget] = useState("");
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [composer, setComposer] = useState<ComposerState | null>(null);
  // Le pseudo est figé à l'ouverture : la page peut être revalidée (offre retirée)
  // pendant l'animation de contrôle, et le nom ne doit pas devenir « inconnu ».
  const [viewing, setViewing] = useState<{ offer: TradeOffer; senderName: string } | null>(null);
  const [modifyingId, setModifyingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [lookupPending, startLookup] = useTransition();
  const [, startModify] = useTransition();
  const [, startCancel] = useTransition();

  const targetInputId = useId();
  const targetInputRef = useRef<HTMLInputElement>(null);
  const suggestionListId = useId();
  const [suggestions, setSuggestions] = useState<TradePlayerSuggestion[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [suggestionPending, setSuggestionPending] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const skipNextSuggestionSearch = useRef(false);
  const suppressSuggestions = useRef(false);

  const usernameOf = (id: string) => names[id] ?? "Joueur inconnu";

  useEffect(() => {
    const term = target.trim();
    if (!term) return;
    if (skipNextSuggestionSearch.current) {
      skipNextSuggestionSearch.current = false;
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setSuggestionPending(true);
      try {
        const result = await searchTradePlayers(term);
        if (cancelled) return;
        if (!result?.ok) {
          setSuggestions([]);
          setSuggestionsOpen(false);
          return;
        }
        setSuggestions(result.data ?? []);
        setSuggestionsOpen(!suppressSuggestions.current && targetInputRef.current === document.activeElement);
        setActiveSuggestion(-1);
      } catch {
        if (!cancelled) {
          setSuggestions([]);
          setSuggestionsOpen(false);
        }
      } finally {
        if (!cancelled) setSuggestionPending(false);
      }
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [target]);

  function chooseSuggestion(suggestion: TradePlayerSuggestion) {
    skipNextSuggestionSearch.current = true;
    suppressSuggestions.current = false;
    setTarget(suggestion.username);
    setSuggestions([]);
    setSuggestionsOpen(false);
    setActiveSuggestion(-1);
    setLookupError(null);
  }

  function onTargetKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setSuggestionsOpen(false);
      setActiveSuggestion(-1);
      return;
    }
    if (!suggestionsOpen || suggestions.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveSuggestion((index) => (index + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveSuggestion((index) => (index <= 0 ? suggestions.length - 1 : index - 1));
    } else if (event.key === "Enter" && activeSuggestion >= 0) {
      event.preventDefault();
      chooseSuggestion(suggestions[activeSuggestion]);
    }
  }

  function search(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    suppressSuggestions.current = true;
    setSuggestionsOpen(false);
    setActiveSuggestion(-1);
    setLookupError(null);
    setActionError(null);
    const pseudo = target.trim();
    if (!pseudo) {
      setLookupError("Indiquez le pseudo du destinataire.");
      return;
    }
    startLookup(async () => {
      try {
        const result = await lookupTradePartner(pseudo);
        if (!result?.ok) {
          setLookupError(result?.message ?? "Impossible de rechercher ce joueur.");
          return;
        }
        if (!result.data?.user) {
          setLookupError("Ce pseudo est introuvable.");
          return;
        }
        if (result.data.user.id === me.id) {
          setLookupError("Vous ne pouvez pas échanger avec vous-même.");
          return;
        }
        setComposer({ mode: "create", partner: result.data });
      } catch {
        setLookupError("Erreur de connexion. Réessayez.");
      }
    });
  }

  function openCounter(offer: TradeOffer, otherName = usernameOf(offer.proposer_id)) {
    setActionError(null);
    setModifyingId(offer.id);
    startModify(async () => {
      try {
        const result = await lookupTradePartner(otherName);
        if (!result?.ok || !result.data?.user) {
          setActionError(result?.message ?? "Impossible de charger l'inventaire de ce joueur.");
          setModifyingId(null);
          setViewing(null);
          return;
        }
        const initialProposed = offer.items.filter((item) => item.side === "recipient").map((item) => item.user_cards);
        const initialRequested = offer.items.filter((item) => item.side === "proposer").map((item) => item.user_cards);
        setViewing(null);
        setModifyingId(null);
        setComposer({
          mode: "counter",
          partner: result.data,
          tradeId: offer.id,
          initialProposed,
          initialRequested,
        });
      } catch {
        setActionError("Erreur de connexion. Réessayez.");
        setModifyingId(null);
        setViewing(null);
      }
    });
  }

  function cancel(offer: TradeOffer) {
    setActionError(null);
    setCancellingId(offer.id);
    startCancel(async () => {
      try {
        const result = await cancelTradeOffer(offer.id);
        if (!result?.ok) setActionError(result?.message ?? "Impossible d'annuler cet échange.");
      } catch {
        setActionError("Erreur de connexion. Réessayez.");
      } finally {
        setCancellingId(null);
      }
    });
  }

  return (
    <>
      <section id="composer-echange" className="relative rounded-2xl border border-amber-500/30 bg-[linear-gradient(120deg,rgba(245,158,11,0.12),rgba(10,13,19,0.86)_45%,rgba(34,211,238,0.08))] p-4 shadow-[0_0_30px_rgba(245,158,11,0.08)] sm:p-5">
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
          <div className="absolute -right-10 -top-16 h-44 w-44 rounded-full bg-amber-500/10 blur-3xl" />
        </div>
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 font-display text-xs font-semibold uppercase tracking-[0.18em] text-amber-400/90">
              <Handshake size={15} strokeWidth={2} /> Troc direct
            </p>
            <h2 className="mt-1 font-display text-2xl font-bold uppercase leading-tight sm:text-3xl">Trouver un joueur</h2>
            <p className="mt-1 max-w-2xl text-sm text-zinc-400">
              Proposez jusqu&apos;à 5 cartes de votre inventaire, demandez jusqu&apos;à 5 cartes à votre partenaire.
              Les pièces ne peuvent venir que de l&apos;initiateur de la proposition.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong bg-[#0b0e13]/80 px-3 py-1.5 text-sm text-zinc-300">
            <Coins size={16} strokeWidth={1.8} className="text-amber-400" />
            <b className="tabular-nums text-white">{me.coins.toLocaleString("fr-FR")}</b> pièces
          </span>
        </div>

        <form onSubmit={search} className="relative mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <div className="block min-w-0">
            <label htmlFor={targetInputId} className="mb-1 block font-display text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
              Pseudo du destinataire de l&apos;échange
            </label>
            <div
              className="relative"
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setSuggestionsOpen(false);
              }}
            >
              {suggestionPending ? (
                <Loader2 size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 animate-spin text-amber-400" />
              ) : (
                <Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-zinc-500" />
              )}
              <input
                ref={targetInputRef}
                id={targetInputId}
                type="text"
                role="combobox"
                aria-autocomplete="list"
                aria-haspopup="listbox"
                aria-expanded={suggestionsOpen && target.trim().length > 0}
                aria-controls={suggestionListId}
                aria-activedescendant={activeSuggestion >= 0 ? `${suggestionListId}-${activeSuggestion}` : undefined}
                value={target}
                onChange={(event) => {
                  const value = event.target.value;
                  suppressSuggestions.current = false;
                  setTarget(value);
                  setLookupError(null);
                  if (!value.trim()) {
                    setSuggestions([]);
                    setSuggestionsOpen(false);
                    setSuggestionPending(false);
                    setActiveSuggestion(-1);
                  }
                }}
                onFocus={() => {
                  if (suggestions.length > 0 && target.trim()) setSuggestionsOpen(true);
                }}
                onKeyDown={onTargetKeyDown}
                placeholder="Ex. Ayrton75"
                autoComplete="off"
                spellCheck={false}
                className="w-full !py-2.5 !pl-9 !pr-3"
              />

              {suggestionsOpen && target.trim().length > 0 && (
                <div
                  id={suggestionListId}
                  role="listbox"
                  aria-label="Joueurs correspondants"
                  className="absolute inset-x-0 top-full z-40 mt-1 overflow-hidden rounded-xl border border-line-strong bg-panel shadow-2xl shadow-black/50"
                >
                  {suggestions.length === 0 ? (
                    <p className="flex items-center gap-2 px-3 py-2.5 text-sm text-zinc-500">
                      {suggestionPending ? (
                        <>
                          <Loader2 size={15} className="animate-spin text-amber-400" />
                          Recherche de joueurs…
                        </>
                      ) : (
                        <>Aucun joueur ne correspond à « {target.trim()} ».</>
                      )}
                    </p>
                  ) : (
                    <ul className="max-h-64 overflow-y-auto py-1">
                      {suggestions.map((suggestion, index) => {
                        const active = index === activeSuggestion;
                        return (
                          <li
                            key={suggestion.id}
                            id={`${suggestionListId}-${index}`}
                            role="option"
                            aria-selected={active}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => chooseSuggestion(suggestion)}
                            onMouseEnter={() => setActiveSuggestion(index)}
                            className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                              active ? "bg-amber-500/15 text-amber-100" : "text-zinc-200 hover:bg-zinc-800"
                            }`}
                          >
                            <span
                              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border font-display text-xs font-bold uppercase ${
                                active
                                  ? "border-amber-400/70 bg-amber-500/20 text-amber-200"
                                  : "border-line-strong bg-[#0b0e13] text-zinc-400"
                              }`}
                            >
                              {suggestion.username.slice(0, 1).toUpperCase()}
                            </span>
                            <span className="min-w-0 flex-1 truncate font-medium">{suggestion.username}</span>
                            {active && <Handshake size={14} className="shrink-0 text-amber-300" />}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>
          <button
            type="submit"
            disabled={lookupPending}
            className="flex min-h-11 items-center justify-center gap-2 self-end rounded-lg bg-amber-500 px-5 text-sm font-semibold text-black transition-colors hover:bg-amber-400 disabled:cursor-wait disabled:opacity-60"
          >
            {lookupPending ? <Loader2 size={18} className="animate-spin" /> : <Handshake size={18} strokeWidth={2} />}
            {lookupPending ? "Recherche…" : "Proposer un échange"}
          </button>
        </form>
        {lookupError && (
          <p role="alert" className="relative mt-2 rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {lookupError}
          </p>
        )}
      </section>

      {actionError && (
        <p role="alert" className="rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {actionError}
        </p>
      )}

      <section className="space-y-3">
        <SectionTitle icon={<Send size={20} strokeWidth={1.8} />} title="Propositions envoyées" count={outgoing.length} />
        {outgoing.length === 0 ? (
          <EmptyList
            icon={<Send size={20} strokeWidth={1.6} />}
            action={
              <a href="#composer-echange" className={buttonClass({ variant: "ghost", size: "sm" })}>
                Composer un échange
              </a>
            }
          >
            Aucune proposition en attente de votre part.
          </EmptyList>
        ) : (
          <div className="space-y-3">
            {outgoing.map((offer) => {
              const offered = offer.items.filter((item) => item.side === "proposer");
              const requested = offer.items.filter((item) => item.side === "recipient");
              return (
                <article key={offer.id} className="rounded-xl border border-line bg-panel p-3 sm:p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-display text-base font-bold uppercase tracking-wide">
                        À <span className="text-amber-300">{usernameOf(offer.recipient_id)}</span>
                      </p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-500">
                        <Clock size={13} /> Expire le {formatDateTime(offer.expires_at)}
                      </p>
                    </div>
                    <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                      En attente
                    </span>
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="min-w-0">
                      <p className="mb-1.5 font-display text-[11px] font-semibold uppercase tracking-wide text-amber-300">Je propose</p>
                      <CardChips items={offered} />
                      {offer.proposer_coins > 0 && (
                        <p className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-200">
                          <Coins size={13} /> + {offer.proposer_coins.toLocaleString("fr-FR")} pièces
                        </p>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="mb-1.5 font-display text-[11px] font-semibold uppercase tracking-wide text-cyan-300">Je demande</p>
                      <CardChips items={requested} />
                    </div>
                  </div>

                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() => cancel(offer)}
                      disabled={cancellingId === offer.id}
                      className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-red-500/60 px-3 text-sm font-semibold text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                    >
                      {cancellingId === offer.id ? <Loader2 size={15} className="animate-spin" /> : <X size={15} strokeWidth={2.4} />}
                      Annuler l&apos;échange
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <SectionTitle icon={<Inbox size={20} strokeWidth={1.8} />} title="Propositions reçues" count={incoming.length} />
        {incoming.length === 0 ? (
          <EmptyList
            icon={<Inbox size={20} strokeWidth={1.6} />}
            action={
              <a href="#composer-echange" className={buttonClass({ variant: "ghost", size: "sm" })}>
                Proposer un échange
              </a>
            }
          >
            Aucune demande reçue pour le moment.
          </EmptyList>
        ) : (
          <div className="space-y-2">
            {incoming.map((offer) => (
              <article
                key={offer.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-panel p-3 sm:p-4"
              >
                <div className="min-w-0">
                  <p className="font-display text-base font-bold uppercase tracking-wide">
                    Demande de <span className="text-amber-300">{usernameOf(offer.proposer_id)}</span>
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-500">
                    <Clock size={13} /> Expire le {formatDateTime(offer.expires_at)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setViewing({ offer, senderName: usernameOf(offer.proposer_id) })}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-amber-500/70 px-4 text-sm font-semibold text-amber-300 hover:bg-amber-500/10"
                >
                  <ArrowRightLeft size={16} strokeWidth={2} /> Voir l&apos;offre
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      {composer && (
        <TradeComposer
          mode={composer.mode}
          tradeId={composer.mode === "counter" ? composer.tradeId : undefined}
          me={me}
          partner={composer.partner}
          initialProposed={composer.mode === "counter" ? composer.initialProposed : []}
          initialRequested={composer.mode === "counter" ? composer.initialRequested : []}
          onClose={() => setComposer(null)}
          onSubmitted={() => setComposer(null)}
        />
      )}

      {viewing && (
        <TradeIncomingModal
          offer={viewing.offer}
          senderName={viewing.senderName}
          currentCoins={me.coins}
          modifying={modifyingId === viewing.offer.id}
          onClose={() => setViewing(null)}
          onModify={() => openCounter(viewing.offer, viewing.senderName)}
          onDone={() => setViewing(null)}
        />
      )}
    </>
  );
}
