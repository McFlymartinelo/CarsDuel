"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Check, ChevronDown, Cog, Star, X } from "lucide-react";
import { Modal } from "@/components/Modal";
import { CardDraw } from "@/components/CardDraw";
import { TileBody, tileClass } from "@/components/ActionTile";
import { WorkshopStage, type StageId, type WorkshopKind } from "./workshop-games";
import { claimReconditionedPart } from "./workshop-actions";
import type { DrawnCard } from "@/lib/types";

type Kind = WorkshopKind;
type Step = { id: StageId; name: string; rule: string };
type Tile = { kind: Kind; title: string; modalTitle: string; image: string };
const TILES: Tile[] = [
  { kind: "moteur", title: "Moteur commun", modalTitle: "Reconditionner un moteur", image: "/workshop/engine-workshop-v2.png" },
  { kind: "boite", title: "Boîte commune", modalTitle: "Reconditionner une boîte", image: "/workshop/gearbox.png" },
  { kind: "pneus", title: "Pneu Route", modalTitle: "Rechaper des pneus", image: "/workshop/tires.png" },
];

/** Ordre des étapes de chaque parcours : ajouter ou déplacer un jeu se fait ici. */
const WORK: Record<Kind, Step[]> = {
  moteur: [
    { id: "stetho", name: "Diagnostic au stéthoscope", rule: "Écoutez les 4 cylindres : repérez celui dont le signal cliquette, puis signalez-le." },
    { id: "scrub", name: "Bain de dégraissage", rule: "Frottez le bloc : glissez le doigt sur les 5 taches de gras pour décaper le métal." },
    { id: "valveLap", name: "Rodage des soupapes", rule: "Rôdez les soupapes : tapotez quand l'aiguille traverse la zone verte, 3 fois." },
    { id: "rings", name: "Insertion des segments", rule: "Insérez les segments : glissez chaque segment dans la gorge claire du piston." },
    { id: "torque", name: "Serrage de culasse", rule: "Serrez au couple : maintenez chaque boulon jusqu'à la zone verte, puis relâchez." },
    { id: "timing", name: "Calage de distribution", rule: "Calez la distribution : alignez le vilebrequin, puis l'arbre à cames, sur leurs repères." },
    { id: "valves", name: "Réglage du jeu aux soupapes", rule: "Réglez le jeu : choisissez la bonne cale, puis amenez la jauge dans la zone verte." },
    { id: "cooling", name: "Circuit de refroidissement", rule: "Raccordez les durites : pivotez-les pour relier la pompe au radiateur sans fuite." },
    { id: "firing", name: "Ordre d'allumage", rule: "Observez l'ordre des étincelles, puis reliez les bougies dans cet ordre." },
    { id: "leak", name: "Recherche de fuite", rule: "Promenez le détecteur sur le bloc et marquez les 3 points de fuite." },
    { id: "rev", name: "Premier coup de démarreur", rule: "Lancez le moteur : tapotez pour garder le régime dans la zone verte pendant 3 secondes." },
    { id: "rods", name: "Montage des bielles", rule: "Montez les bielles : associez chaque diamètre à son cylindre, orientez chaque chapeau comme indiqué, puis contrôlez le montage." },
    { id: "compression", name: "Diagnostic de compression", rule: "Comparez les 4 compressions : sélectionnez le cylindre qui sort de la tolérance affichée, puis signalez-le." },
    { id: "ignition", name: "Calage de l'allumage", rule: "Calez l'avance : amenez l'aiguille dans la zone verte de la jauge, puis validez le calage." },
    { id: "airFilter", name: "Remplacement du filtre à air", rule: "Repérez le filtre colmaté, retirez-le, puis choisissez le filtre de remplacement aux bonnes dimensions." },
    { id: "crankBalance", name: "Équilibrage du vilebrequin", rule: "Équilibrez le vilebrequin : posez des masses à l'opposé du balourd jusqu'à passer sous 3 g·cm, puis lancez le contrôle." },
  ],
  boite: [
    { id: "debris", name: "Extraction des pignons usés", rule: "Dégagez les rebuts : touchez les 6 pignons fissurés (fêlure rouge) et laissez les pignons sains intacts." },
    { id: "diagnosis", name: "Diagnostic des rapports", rule: "Testez les 5 rapports : désignez celui dont la courbe accroche." },
    { id: "pinions", name: "Montage du train de pignons", rule: "Posez chaque pignon sur l'arbre et à la taille qui lui correspondent." },
    { id: "mesh", name: "Calage des pignons et synchros", rule: "Calez l'arbre : faites tourner le pignon orange jusqu'au repère vert." },
    { id: "sync", name: "Synchronisation au banc", rule: "Réglez la vitesse du pignon bleu sur celle du pignon orange, puis accouplez." },
    { id: "preload", name: "Précharge des roulements", rule: "Ajustez le jeu : gardez le curseur dans la zone 45–55 % pendant 2 secondes." },
    { id: "forks", name: "Sélection des rapports", rule: "Déplacez les fourchettes pour engager 1 à 5 dans l'ordre, sans blocage." },
    { id: "linkage", name: "Réglage de la tringlerie", rule: "Guidez le levier : changez de colonne au point mort, puis engagez le rapport demandé." },
    { id: "oil", name: "Remplissage d'huile", rule: "Faites le niveau : maintenez pour verser, relâchez entre MIN et MAX." },
    { id: "tightness", name: "Test d'étanchéité", rule: "Un seul des 5 joints fuit : cliquez sur la goutte brillante, pas sur les traces brunes. Chaque erreur coûte 6 % de pression ; sous 40 %, le carter est regonflé." },
    { id: "noisyGear", name: "Diagnostic d'un rapport bruyant", rule: "Comparez les 5 signaux : repérez le rapport dont la courbe produit un à-coup, puis signalez-le." },
    { id: "bearings", name: "Montage des roulements", rule: "Montez les roulements dans l'ordre : associez chaque référence à son poste et orientez le joint du bon côté." },
    { id: "selector", name: "Réglage du sélecteur", rule: "Guidez le sélecteur dans la grille : atteignez chaque rapport demandé sans passer par la position interdite." },
    { id: "gearOil", name: "Choix de l'huile de boîte", rule: "Lisez les caractéristiques requises, sélectionnez l'huile qui les respecte toutes, puis validez." },
    { id: "axialPlay", name: "Contrôle du jeu axial", rule: "Réglez le jeu axial dans la tolérance affichée à la jauge, puis validez la mesure." },
  ],
  pneus: [
    { id: "carcass", name: "Inspection de carcasse", rule: "Tournez le pneu et qualifiez chaque défaut : coupure, hernie ou objet incrusté." },
    { id: "depth", name: "Contrôle de profondeur", rule: "Mesurez les 4 rainures de chaque pneu, puis décidez s'il est rechapable." },
    { id: "treadScrub", name: "Râpage de l'ancienne bande", rule: "Préparez la carcasse : frottez les 8 résidus de gomme usée sur le pneu." },
    { id: "puncture", name: "Réparation de crevaison", rule: "Repérez la fuite dans le bac d'eau, poncez la zone, puis collez la rustine." },
    { id: "tread", name: "Motif de sculpture", rule: "Orientez les blocs de gomme pour reproduire le motif de référence." },
    { id: "band", name: "Encollage de la nouvelle bande", rule: "Appliquez la bande : partez du repère vert et suivez toute la circonférence du pneu." },
    { id: "thermo", name: "Cuisson à l'autoclave", rule: "Vulcanisez la gomme : maintenez la température entre 60 et 80 °C pendant 3 secondes." },
    { id: "inflation", name: "Pression de gonflage", rule: "Gonflez jusqu'à la zone verte sans dépasser la zone rouge, puis tenez 1 seconde." },
    { id: "balance", name: "Équilibrage de roue", rule: "Posez des masses de 5 g à l'opposé du point lourd pour annuler le balourd." },
    { id: "rotateWheels", name: "Permutation des roues", rule: "Permutez les roues : placez chaque pneu selon son niveau d'usure à l'emplacement qui lui correspond." },
    { id: "sidewall", name: "Inspection des flancs", rule: "Faites tourner le pneu et touchez uniquement les dommages du flanc (coupure, hernie, objet incrusté), pas les simples rayures." },
    { id: "tireBalance", name: "Mesure du balourd", rule: "Mesurez le balourd : ajoutez des masses à l'opposé du point lourd jusqu'à descendre sous 5 g, puis lancez la mesure." },
    { id: "tireCompound", name: "Choix de la gomme", rule: "Lisez les conditions de piste et la météo, choisissez le composé adapté, puis validez." },
    { id: "tireDirection", name: "Contrôle du sens de montage", rule: "Orientez le pneu : alignez la flèche de rotation et la face extérieure sur la cible, puis validez." },
  ],
};

/** Nombre de mini-jeux joués à chaque parcours, tirés au hasard dans la liste ci-dessus. */
const COURSE_LENGTH: Record<Kind, number> = { moteur: 6, boite: 5, pneus: 4 };

function pickCourse(kind: Kind): Step[] {
  const pool = [...WORK[kind]];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, COURSE_LENGTH[kind]);
}

export function ReconditioningWorkshop({ available }: { available: Record<Kind, boolean> }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Kind | null>(null);
  const [course, setCourse] = useState<Step[]>([]);
  const [step, setStep] = useState(-1);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");
  const [draw, setDraw] = useState<DrawnCard | undefined>();
  const [showDraw, setShowDraw] = useState(false);
  const [error, setError] = useState("");
  const [misses, setMisses] = useState(0);
  const [stageWon, setStageWon] = useState(false);
  const stages = selected ? COURSE_LENGTH[selected] : 0;
  const current = course[step];
  const tile = TILES.find((t) => t.kind === selected);
  const quality = Math.max(0, 100 - misses * 6);
  const stars = quality >= 90 ? 3 : quality >= 70 ? 2 : 1;
  const nextStage = useCallback(() => { setStageWon(false); setStep((v) => v + 1); setError(""); }, []);
  const begin = () => {
    if (!selected) return;
    setCourse(pickCourse(selected));
    setStep(0);
    setStageWon(false);
    setError("");
  };
  const noteMiss = useCallback(() => setMisses((value) => value + 1), []);
  const claim = async () => {
    if (!selected) return;
    setBusy(true); setError("");
    const answer = await claimReconditionedPart(selected);
    setBusy(false);
    if (!answer.ok) { setError(answer.message); return; }
    if (!answer.rewarded) {
      setResult(`Parcours terminé. Vous possédez déjà une pièce ${selected === "moteur" ? "moteur" : selected === "boite" ? "boîte" : "de pneus"} opérationnelle : aucune récompense de secours n'est attribuée.`);
      return;
    }
    setDraw(answer.draw);
    if (answer.draw) setShowDraw(true);
    setResult(selected === "pneus" ? "Un pneu Route neuf (100 % de gomme) a rejoint votre inventaire." : `Votre pièce ${selected === "moteur" ? "moteur" : "boîte"} commune, reconditionnée sans garantie, a rejoint votre inventaire.`);
    router.refresh();
  };
  const close = () => { if (busy) return; setSelected(null); setCourse([]); setStep(-1); setResult(""); setError(""); setMisses(0); };

  return <>
    {showDraw && draw && <CardDraw cards={[draw]} title="Tirage de reconditionnement" onClose={() => setShowDraw(false)} />}
    <details className="group overflow-hidden rounded-2xl border border-line bg-panel-deep">
      <summary className="flex cursor-pointer list-none items-center gap-3 p-4 transition hover:bg-panel [&::-webkit-details-marker]:hidden">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-amber-500/25 bg-amber-500/10 text-amber-300"><Cog size={18}/></span>
        <span className="min-w-0 flex-1"><span className="block font-display text-base font-bold uppercase tracking-wide">Atelier de reconditionnement</span><span className="mt-1 block text-xs text-zinc-400">Un parcours de secours pour remettre votre garage en état de rouler.</span></span>
        <span className="flex shrink-0 items-center gap-2"><span className="rounded-full border border-line bg-black/30 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-zinc-400">3</span><ChevronDown size={16} className="text-zinc-500 transition group-open:rotate-180" /></span>
      </summary>
      <div className="grid gap-3 border-t border-line p-3 sm:grid-cols-2 lg:grid-cols-3">
        {TILES.map((item) => {
          const reward = available[item.kind];
          return (
            <button
              key={item.kind}
              type="button"
              onClick={() => { setSelected(item.kind); setCourse([]); setStep(-1); setResult(""); setError(""); setMisses(0); }}
              className={tileClass()}
            >
              <TileBody
                title={item.title}
                text={`${COURSE_LENGTH[item.kind]} étapes parmi ${WORK[item.kind].length} jeux`}
                image={item.image}
                imageFit="contain"
                badge={
                  <span
                    className={`mt-2 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                      reward
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                        : "border-white/[0.07] bg-white/[0.03] text-zinc-400"
                    }`}
                  >
                    <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${reward ? "bg-emerald-400" : "bg-zinc-500"}`} />
                    {reward ? "Récompense disponible" : "Jeu libre"}
                  </span>
                }
              />
            </button>
          );
        })}
      </div>
    </details>
    {selected && tile && <Modal labelledBy="workshop-title" size="lg" onClose={close}>
      <header className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-amber-300">Atelier de reconditionnement</p><h2 id="workshop-title" className="mt-1 font-display text-2xl font-bold uppercase">{tile.modalTitle}</h2></div><button onClick={close} aria-label="Fermer" className="rounded-lg p-2 text-zinc-400 hover:bg-white/5"><X size={18}/></button></header>
      {result ? <div className="mt-7 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-center"><Check className="mx-auto text-emerald-300"/><p className="mt-3 font-semibold text-emerald-100">Parcours terminé !</p><p className="mt-2 text-sm text-zinc-300">{result}</p><button onClick={close} className="mt-5 rounded-lg bg-emerald-500/20 px-5 py-2 font-semibold text-emerald-200">Fermer</button></div> : step < 0 ? <><div className="relative mb-4 h-32 overflow-hidden rounded-xl border border-line bg-black/30 sm:h-40"><Image src={tile.image} alt="" fill sizes="(min-width: 640px) 560px, 90vw" className="object-contain object-center opacity-85" /></div><p className="mt-5 text-sm leading-relaxed text-zinc-300">{selected === "pneus" ? "Préparez une carcasse, posez la nouvelle bande et vulcanisez-la." : "Démontez, réglez et remettez en route une pièce de dépannage."} Le parcours comporte {stages} étapes tirées parmi {WORK[selected].length} mini-jeux. {selected === "pneus" ? "Récompense possible : un pneu Route neuf." : `Récompense possible : une pièce ${selected === "moteur" ? "moteur" : "boîte"} aléatoire de rareté commune, sans garantie.`} Elle est attribuée uniquement si vous ne possédez aucune pièce opérationnelle de cette catégorie à la fin du parcours. Vous pouvez jouer dans tous les cas.</p><div className="mt-7 flex flex-wrap justify-end gap-2"><button onClick={close} className="rounded-lg border border-line px-4 py-2 text-sm text-zinc-300 hover:bg-white/5">Abandonner</button><button onClick={begin} className="rounded-lg bg-amber-500 px-5 py-2 font-semibold text-black hover:bg-amber-400">Commencer</button></div></> : step < stages ? stageWon ? <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-center"><Check className="mx-auto text-emerald-300"/><p className="mt-3 font-semibold text-emerald-100">Bien joué, étape réussie !</p><p className="mt-2 text-sm text-zinc-300">{current.name} est terminée. Progression : {step + 1} / {stages}.</p><button onClick={nextStage} className="mt-5 rounded-lg bg-emerald-500 px-5 py-2 font-semibold text-black">Étape suivante</button></div> : <><p className="mt-3 text-sm text-zinc-400">Étape {step + 1} / {stages}</p><p className="mt-3 font-semibold leading-relaxed text-zinc-200">{current.rule}</p><div className="mt-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-500"><span>Qualité</span><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800"><span className={`block h-full rounded-full bg-gradient-to-r ${quality >= 60 ? "from-amber-600 to-amber-300" : "from-red-700 to-red-400"}`} style={{ width: `${quality}%` }} /></div><span className="tabular-nums text-amber-300">{quality}%</span></div><WorkshopStage key={`${selected}-${step}`} stage={current.id} name={current.name} onWin={() => setStageWon(true)} onMiss={noteMiss}/><div className="mt-4 flex justify-end"><button onClick={close} className="rounded-lg border border-line px-4 py-2 text-sm text-zinc-300 hover:bg-white/5">Abandonner</button></div></> : <div className="mt-6 space-y-4"><div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4 text-center"><p className="font-display text-lg font-bold uppercase text-emerald-200">Toutes les étapes sont validées.</p><div className="mt-2 flex justify-center gap-1.5">{[0, 1, 2].map((index) => <Star key={index} size={26} className={index < stars ? "fill-amber-300 text-amber-300" : "text-zinc-700"} />)}</div><p className="mt-2 text-sm text-zinc-300">Qualité {quality}% · {misses} erreur{misses > 1 ? "s" : ""}</p><div className="mx-auto mt-3 flex max-w-xs items-center gap-2 rounded-lg border border-line bg-black/30 p-2 text-left"><span className="relative h-12 w-16 shrink-0"><Image src={tile.image} alt="" fill sizes="64px" className="object-contain" /></span><span className="text-xs text-zinc-400">{selected === "pneus" ? "Pneu Route neuf" : `Pièce ${selected === "moteur" ? "moteur" : "boîte"} commune`}<span className="block text-[10px] text-zinc-500">{quality >= 90 ? "Reconditionnée sans faute" : "Reconditionnée sans garantie"}</span></span></div></div>{error && <p role="alert" className="text-sm text-red-300">{error}</p>}<div className="flex justify-end gap-2"><button disabled={busy} onClick={close} className="rounded-lg border border-line px-4 py-2 text-sm">Abandonner</button><button disabled={busy} onClick={claim} className="rounded-lg bg-amber-500 px-5 py-2 font-semibold text-black disabled:opacity-60">{busy ? "Attribution…" : "Valider le parcours"}</button></div></div>}
    </Modal>}
  </>;
}
