import { Logo } from "@/components/Logo";

/**
 * Écran de lancement affiché au démarrage de la session, sur téléphone.
 *
 * Purement CSS : il est présent dès le premier rendu serveur (pas d'attente de
 * l'hydratation), se retire tout seul et ne capture plus les interactions une
 * fois terminé. Un script inline dans le layout pose `data-launch-splash` dès
 * la deuxième page d'une même session pour ne pas rejouer l'écran. Les styles
 * sont dans globals.css (`.launch-splash`), avec un masquage sur les appareils
 * à pointeur fin (ordinateur) et une version simplifiée pour
 * `prefers-reduced-motion`.
 */
export function LaunchSplash() {
  return (
    <div className="launch-splash" role="status">
      <span className="sr-only">Chargement de CarsDuel…</span>
      <div aria-hidden className="launch-splash-glow" />
      <div aria-hidden className="launch-splash-content">
        <span className="launch-logo">
          <Logo size={104} />
        </span>
        <p className="launch-wordmark font-display">
          Cars<span className="text-zinc-500">Duel</span>
        </p>
        <div className="launch-lights">
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
        <div className="launch-bar">
          <span />
        </div>
        <p className="launch-caption">Démarrage du moteur…</p>
      </div>
    </div>
  );
}
