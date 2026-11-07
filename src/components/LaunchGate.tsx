import { cookies } from "next/headers";
import { LaunchSplash } from "@/components/LaunchSplash";

/**
 * Porte d'entrée de l'écran de lancement.
 *
 * Le cookie de session est lu côté serveur : au premier chargement il est
 * absent, on affiche le splash et un script le pose pour la suite de la
 * session. Aux chargements suivants, le serveur ne rend plus rien : aucun
 * écart d'hydratation, aucun flash.
 */
export async function LaunchGate() {
  const launchSeen = (await cookies()).has("carsduel_launch");
  if (launchSeen) return null;

  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html:
            'try{if(!document.cookie.split("; ").some(function(c){return c.indexOf("carsduel_launch=1")===0})){document.cookie="carsduel_launch=1; path=/; SameSite=Lax"+(location.protocol==="https:"?"; Secure":"")}}catch(e){}',
        }}
      />
      <LaunchSplash />
    </>
  );
}
