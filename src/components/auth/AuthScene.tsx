import { Logo } from "@/components/Logo";

/** Décor commun aux écrans d'authentification : atelier, marque, pied de page. */
export function AuthScene({ children }: { children: React.ReactNode }) {
  return (
    <main id="contenu" tabIndex={-1} className="auth-scene">
      <header className="auth-top">
        <div className="auth-brand">
          <Logo size={30} className="auth-brand-logo" />
          <span>
            CarsDuel
            <small>Duels automobiles</small>
          </span>
        </div>
        <span className="auth-top-note">Duels asynchrones</span>
      </header>

      {children}

      <p className="auth-foot">Duels de cartes automobiles · Jouable sur mobile et ordinateur</p>
    </main>
  );
}
