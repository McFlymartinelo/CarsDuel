import type { ReactNode } from "react";

export const metadata = { title: "Règles du jeu — CarsDuel" };

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-4 space-y-3 rounded-xl border border-zinc-800 bg-[#10131a] p-4 sm:p-5">
      <h2 className="font-display text-xl font-bold uppercase tracking-wide text-amber-400">{title}</h2>
      {children}
    </section>
  );
}

const H3 = ({ children }: { children: ReactNode }) => (
  <h3 className="pt-1 font-display text-base font-semibold uppercase tracking-wider text-zinc-200">{children}</h3>
);

const P = ({ children }: { children: ReactNode }) => <p className="text-sm leading-relaxed text-zinc-300">{children}</p>;

const Formula = ({ children }: { children: ReactNode }) => (
  <p className="overflow-x-auto rounded-lg border border-zinc-800 bg-[#0a0c10] px-3 py-2 font-mono text-sm text-amber-200">{children}</p>
);

const List = ({ items }: { items: ReactNode[] }) => (
  <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-zinc-300 marker:text-zinc-600">
    {items.map((item, i) => (
      <li key={i}>{item}</li>
    ))}
  </ul>
);

function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-800">
      <table className="w-full min-w-[32rem] text-left text-sm">
        <thead className="bg-zinc-900/80 font-display text-xs uppercase tracking-wider text-zinc-400">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-3 py-2 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800 text-zinc-300">
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} className={`px-3 py-2 align-top ${j === 0 ? "font-semibold text-white" : ""}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const b = (t: string) => <b className="text-white">{t}</b>;

const SUMMARY = [
  ["principe", "Principe général"],
  ["deck", "Deck et raretés"],
  ["duel", "Déroulement du duel"],
  ["pneus", "Pneus et météo"],
  ["bonus", "Cartes bonus"],
  ["economie", "Récompenses et économie"],
  ["rangs", "Classements et rangs"],
];

export default function RulesPage() {
  return (
    <section className="mx-auto max-w-4xl space-y-4">
      <header className="space-y-1">
        <h1 className="font-display text-3xl font-bold uppercase">Règles officielles de Cars Duel</h1>
        <p className="text-sm text-zinc-400">Tout ce qu&apos;il faut savoir pour composer son deck, courir et grimper au classement.</p>
      </header>

      <nav aria-label="Sommaire" className="flex flex-wrap gap-2">
        {SUMMARY.map(([id, label]) => (
          <a key={id} href={`#${id}`} className="rounded-lg border border-zinc-800 bg-[#10131a] px-3 py-1.5 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-white">
            {label}
          </a>
        ))}
      </nav>

      <Section id="principe" title="1. Principe général du jeu">
        <P>
          Cars Duel est un jeu de cartes et de stratégie automobile tactique fondé sur le deck-building mécanique. Deux modes d&apos;affrontement régissent les courses :
        </P>
        <List
          items={[
            <>
              {b("Mode « Affronter au hasard » :")} une confrontation asynchrone où un joueur {b("Actif")} défie le fantôme d&apos;un joueur {b("Passif")} tiré au sort sur le serveur. Le joueur Actif engage ses pièces, subit l&apos;usure et les risques de casse. Le joueur Passif défend son rang de manière autonome, sans risquer de dégradation mécanique.
            </>,
            <>
              {b("Mode « Organiser un duel » :")} un défi direct entre deux pilotes ciblés. Les deux adversaires sont en statut {b("Actif")} : chacun engage son propre deck, choisit optionnellement un bonus et assume l&apos;usure ainsi que les risques mécaniques de la course.
            </>,
          ]}
        />
        <P>La victoire revient au pilote qui génère le {b("Score de Performance (SP)")} le plus élevé à l&apos;issue des tests de fiabilité et du calcul de course.</P>
      </Section>

      <Section id="deck" title="2. Composition du deck et raretés">
        <P>Chaque deck valide est obligatoirement composé de {b("trois pièces mécaniques")} :</P>
        <List
          items={[
            <>
              {b("Le Moteur :")} défini par son architecture, sa puissance brute en chevaux (ch), son poids en kilogrammes (kg), son risque initial de casse R0 (%) et sa sensibilité à l&apos;usure delta_R (% par run). Il ne comporte aucune statistique de couple.
            </>,
            <>
              {b("La Boîte de vitesses :")} définie par sa technologie (manuelle, séquentielle, double embrayage ou robotisée), son temps de passage de rapport (ms), son poids (kg), son risque initial de casse R0 (%) et sa sensibilité à l&apos;usure delta_R (% par run).
            </>,
            <>
              {b("Le Train de pneus :")} défini par sa typologie de gomme, son taux d&apos;usure de base par run et sa jauge de gomme restante (de 100 % à 0 %).
            </>,
            <>
              {b("La Carte Bonus (optionnelle en mode Actif) :")} consommable à usage unique, activé avant le départ et détruit lors du lancement. Les cartes bonus n&apos;ont aucun niveau de rareté et ne peuvent pas être vendues sur la Marketplace.
            </>,
          ]}
        />
        <H3>Échelle de rareté (moteurs et boîtes uniquement)</H3>
        <Table
          head={["Rareté", "Probabilité d'obtention"]}
          rows={[
            ["Commune", "70,0 %"],
            ["Rare", "20,0 %"],
            ["Très rare", "7,0 %"],
            ["Épique", "2,5 %"],
            ["Légendaire", "0,5 %"],
          ]}
        />
      </Section>

      <Section id="duel" title="3. Déroulement du duel et formules">
        <P>Chaque confrontation se déroule en deux phases successives pour tout joueur engagé en statut Actif.</P>

        <H3>Phase 1 : test de fiabilité mécanique (statut Actif)</H3>
        <P>Le moteur puis la boîte de vitesses subissent un contrôle de résistance. La probabilité de rupture (P_casse) est calculée ainsi :</P>
        <Formula>P_casse = max(0 ; (R0 + (runs × delta_R) + Mod_meteo_casse) × Mod_bonus_casse)</Formula>
        <List
          items={[
            <>{b("R0 :")} risque intrinsèque de la pièce (en %).</>,
            <>{b("runs :")} nombre de duels courus par le composant.</>,
            <>{b("delta_R :")} sensibilité à l&apos;usure par duel (en %).</>,
            <>{b("Mod_meteo_casse :")} impact thermique des conditions de piste.</>,
            <>{b("Mod_bonus_casse :")} multiplicateur réducteur (vaut 0,5 si une huile de compétition est active, sinon 1,0).</>,
          ]}
        />
        <P>
          {b("Conséquences d'une casse.")} Un tirage aléatoire uniforme est effectué entre 0 et 100. Si le résultat est inférieur ou égal à P_casse, la pièce casse immédiatement :
        </P>
        <List
          items={[
            <>Le duel se termine sur une {b("défaite instantanée")}.</>,
            <>
              La pièce endommagée n&apos;est pas détruite : elle est automatiquement envoyée dans votre {b("« Musée de la casse »")}. Elle ne peut plus être équipée ni vendue, mais peut être conservée pour l&apos;honneur ou {b("recyclée contre 1 pièce")}.
            </>,
            <>
              {b("Garantie constructeur :")} chaque moteur et chaque boîte est garanti pendant un nombre de runs affiché sur sa carte. Tant que la pièce cassée n&apos;a pas dépassé cette garantie, elle peut être {b("réparée gratuitement")} depuis le musée de la casse : elle redevient utilisable et son risque de casse repart de R0. La garantie, elle, ne repart pas et continue de se consommer.
            </>,
            <>
              {b("Prolonger la garantie :")} depuis l&apos;inventaire, une seule fois par carte et tant que la garantie n&apos;a pas expiré, il est possible de la prolonger de {b("2 runs")} en échange d&apos;une carte bonus {b("« Révision complète »")} et de {b("5 pièces")}. Une pièce cassée ne peut pas être prolongée.
            </>,
            <>Si la carte bonus {b("« Assistance plateau »")} était engagée, le duel est perdu mais la pièce réintègre directement l&apos;inventaire actif sans passer par le musée de la casse.</>,
          ]}
        />
        <P>
          <i>En mode « Affronter au hasard », le joueur Passif est exempté de la Phase 1.</i>
        </P>

        <H3>Phase 2 : calcul du Score de Performance (SP)</H3>
        <P>Si aucun composant actif ne casse, la confrontation est arbitrée par le calcul du SP de chaque véhicule :</P>
        <ol className="list-decimal space-y-3 pl-5 text-sm text-zinc-300 marker:text-zinc-500">
          <li className="space-y-1.5">
            <span className="text-white">Poids total</span>
            <Formula>Poids_total = Poids_moteur + Poids_boite</Formula>
          </li>
          <li className="space-y-1.5">
            <span className="text-white">Score mécanique</span>
            <Formula>Score_Meca = max(10 ; 100 + (Puissance × 0,55) − (Poids_total × 0,25) − (Temps_passage × 0,05))</Formula>
          </li>
          <li className="space-y-1.5">
            <span className="text-white">Dégradation du grip sous le seuil critique</span>
            <p>
              Tant que la jauge de gomme est supérieure ou égale à 70 %, aucun malus ne s&apos;applique. Dès qu&apos;elle descend sous les 70 %, une pénalité de −1 % est appliquée par tranche complète de 3 % manquante :
            </p>
            <Formula>Malus_usure = floor((70 − Gomme) / 3)</Formula>
          </li>
          <li className="space-y-1.5">
            <span className="text-white">Multiplicateur pneumatique final</span>
            <Formula>Mod_pneus = max(0,10 ; 1,0 + ((Bonus_meteo − Malus_usure) / 100))</Formula>
          </li>
          <li className="space-y-1.5">
            <span className="text-white">Score de Performance final</span>
            <Formula>SP = Score_Meca × Mod_pneus</Formula>
          </li>
        </ol>
        <List
          items={[
            <>{b("Attribution de la victoire :")} le joueur avec le plus haut SP remporte le duel.</>,
            <>
              {b("Égalité parfaite :")} en mode « Affronter au hasard », l&apos;avantage revient au joueur Passif. En mode « Organiser un duel », l&apos;égalité débouche sur un match nul.
            </>,
          ]}
        />
      </Section>

      <Section id="pneus" title="4. Pneumatiques et conditions météo">
        <P>La météo du tracé est tirée au sort au départ parmi quatre situations équiprobables (25 % de chance chacune).</P>

        <H3>Types de gommes et durabilité nominale</H3>
        <Table
          head={["Type de pneu", "Usure par run", "Durée de vie estimée", "Particularité"]}
          rows={[
            ["Route", "−3 %", "33 - 34 duels", "Polyvalent sous toutes conditions météo"],
            ["Sport", "−5 %", "20 duels", "Équilibre adhérence et longévité"],
            ["Pluie", "−7 %", "14 duels", "Profil sculpté spécifique à l'évacuation d'eau"],
            ["Semi-slicks", "−8 %", "12 - 13 duels", "Très haute performance sur piste sèche"],
            ["Slicks", "−10 %", "10 duels", "Adhérence piste absolue sur sol sec"],
          ]}
        />
        <P>
          <i>Dès qu&apos;un train de pneus atteint 0 % de gomme, il est détruit et inutilisable. Le deck est verrouillé tant qu&apos;un nouveau pneu n&apos;est pas monté.</i>
        </P>

        <H3>Impact de la météo sur les composants</H3>
        <Table
          head={["Météo", "Moteur", "Boîte", "Pneus (perf / usure par run)"]}
          rows={[
            [
              "Piste sèche et chaude",
              "+2,0 % casse (surchauffe)",
              "+0,5 % casse",
              "Slicks +20 % / −10 % · Semi-slicks +12 % / −8 % · Sport +5 % / −5 % · Route 0 % / −3 % · Pluie −30 % / −14 % (usure doublée)",
            ],
            [
              "Piste sèche et froide",
              "0,0 % casse",
              "0,0 % casse",
              "Slicks +10 % / −10 % · Semi-slicks +7 % / −8 % · Sport +3 % / −5 % · Route 0 % / −3 % · Pluie −20 % / −10,5 % (usure ×1,5)",
            ],
            [
              "Piste humide et chaude",
              "0,0 % casse",
              "0,0 % casse",
              "Usure divisée par 2 hors pluie : Pluie +25 % / −7 % · Route 0 % / −1,5 % · Sport −15 % / −2,5 % · Semi-slicks −35 % / −4,0 % · Slicks −60 % / −5,0 %",
            ],
            [
              "Piste humide et froide",
              "−1,0 % casse (refroidissement)",
              "0,0 % casse",
              "Usure divisée par 2 hors pluie : Pluie +20 % / −7 % · Route 0 % / −1,5 % · Sport −20 % / −2,5 % · Semi-slicks −45 % / −4,0 % · Slicks −70 % / −5,0 %",
            ],
          ]}
        />
      </Section>

      <Section id="bonus" title="5. Les cartes bonus">
        <P>Consommables d&apos;appui utilisables uniquement par un joueur en statut Actif :</P>
        <List
          items={[
            <>{b("« Révision express » :")} gèle l&apos;usure du moteur pour la course (le compteur de runs ne s&apos;incrémente pas).</>,
            <>{b("« Vidange de boîte » :")} gèle l&apos;usure de la boîte pour la course (le compteur de runs ne s&apos;incrémente pas).</>,
            <>{b("« Révision complète » :")} gèle simultanément l&apos;usure du moteur et de la boîte de vitesses.</>,
            <>{b("« Huile moteur de compétition » :")} multiplie par 0,5 le risque de casse calculé du moteur sur ce run.</>,
            <>{b("« Huile de boîte compétition » :")} multiplie par 0,5 le risque de casse calculé de la boîte sur ce run.</>,
            <>{b("« Assistance plateau » :")} en cas d&apos;échec au test de casse, le duel est perdu mais le composant cassé réintègre directement l&apos;inventaire au lieu d&apos;être envoyé au Musée de la casse.</>,
          ]}
        />
      </Section>

      <Section id="economie" title="6. Récompenses, tirages et recyclage">
        <H3>Barème de gains par duel</H3>
        <P>Les gains en pièces équivalent point par point aux points d&apos;expérience (XP) accordés.</P>
        <Table
          head={["Statut", "Issue", "Pièces", "XP", "Modalités"]}
          rows={[
            ["Actif", "Victoire", "+10", "+10", "Décompte complet de l'usure"],
            ["Actif", "Défaite", "+2", "+2", "Décompte complet de l'usure"],
            ["Passif (hasard)", "Victoire", "+4", "+4", "Plafonné aux 5 premiers duels subis par jour"],
            ["Passif (hasard)", "Défaite", "+1", "+1", "Plafonné aux 5 premiers duels subis par jour"],
          ]}
        />
        <P>
          <i>Au-delà des 5 premiers duels subis par jour en mode passif, les courses s&apos;inscrivent dans l&apos;historique sans attribuer de pièces ni d&apos;XP.</i>
        </P>

        <H3>Les tirages gratuits</H3>
        <List
          items={[
            <>{b("Tirage quotidien :")} offre 3 cartes Bonus chaque jour (réinitialisation à minuit, heure de Paris).</>,
            <>{b("Tirage hebdomadaire :")} offre 1 pièce mécanique (un Moteur ou une Boîte, selon la grille de rareté) chaque semaine.</>,
          ]}
        />

        <H3>La Marketplace joueurs</H3>
        <List
          items={[
            <>Marché d&apos;occasion libre entre pilotes : vente de moteurs, boîtes et pneus (neufs ou usagés). Les cartes bonus ne peuvent pas y être proposées.</>,
            <>{b("Prix minimum :")} une annonce comme une offre doit être d&apos;au moins 10 pièces.</>,
            <>{b("Séquestre automatique :")} la pièce mise en vente est immobilisée et ne peut pas être engagée en duel tant qu&apos;elle est en vente.</>,
            <>
              {b("Frais de vente de 10 % :")} une retenue de 10 % est prélevée sur le montant encaissé par le vendeur (gain net = floor(Prix × 0,90)). Cette commission freine la spéculation artificielle et l&apos;achat/revente immédiat.
            </>,
          ]}
        />

        <H3>Le recyclage</H3>
        <P>Cartes mécaniques en état :</P>
        <Table
          head={["Catégorie", "Valeur de base", "Formule de rachat"]}
          rows={[
            ["Moteur", "50 pièces", "50 × (1 − taux d'usure)"],
            ["Boîte de vitesses", "30 pièces", "30 × (1 − taux d'usure)"],
            ["Pneus", "10 pièces", "10 × (1 − taux d'usure)"],
          ]}
        />
        <List
          items={[
            <>Un moteur à 90 % d&apos;état rapporte 50 × 0,90 = {b("45 pièces")}.</>,
            <>Une boîte à 80 % d&apos;état rapporte 30 × 0,80 = {b("24 pièces")}.</>,
            <>Un train de pneus à 50 % de gomme restante rapporte 10 × 0,50 = {b("5 pièces")}.</>,
            <>{b("Cartes bonus :")} tarif fixe de 1 pièce.</>,
            <>{b("Pièces du Musée de la casse :")} rachat à 1 pièce.</>,
          ]}
        />
      </Section>

      <Section id="rangs" title="7. Classements et rangs">
        <P>Les compteurs de rang sont réinitialisés le premier jour de chaque mois à 00:00:00 (heure de Paris).</P>
        <Table
          head={["Rang", "XP mensuel requis", "Coefficient de primes"]}
          rows={[
            ["Niveau 1 · Rookie", "0 - 119 XP", "×1"],
            ["Niveau 2 · Amateur de Paddock", "120 - 299 XP", "×1,5"],
            ["Niveau 3 · Pro de la Config", "300 - 599 XP", "×2"],
            ["Niveau 4 · Pilote d'Élite", "600 - 889 XP", "×2,5"],
            ["Niveau 5 · Légende de la Piste", "890 XP et +", "×3"],
          ]}
        />
        <P>
          Le coefficient du rang atteint sur l&apos;XP du mois multiplie les {b("primes de classement")} hebdomadaires et mensuelles
          (montant arrondi à la pièce). Il est figé sur l&apos;XP du mois où la période se termine, au moment du versement.
        </P>
        <H3>Classements calendaires (fuseau Europe/Paris)</H3>
        <List
          items={[
            <>{b("Classement hebdomadaire :")} cumul de l&apos;XP du lundi 00:00:00 au dimanche 23:59:59.</>,
            <>{b("Classement mensuel :")} cumul de l&apos;XP du premier jour du mois à 00:00:00 au dernier jour à 23:59:59.</>,
          ]}
        />
      </Section>
    </section>
  );
}
