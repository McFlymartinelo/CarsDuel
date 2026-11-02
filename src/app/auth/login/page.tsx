import { Logo } from "@/components/Logo";
import { AuthPanel } from "@/components/auth/AuthPanel";
import { getCurrentUser } from "@/lib/session";
import { otpEnabled } from "@/lib/otp";
import { resendOtp, signIn, signUp, verifyOtp } from "../actions";

export const metadata = { title: "Connexion — CarsDuel" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // Pas de redirect ici : après la validation OTP, Next relance ce composant
  // serveur (cookie de session créé). Un redirect immédiat court-circuiterait
  // l'animation de succès côté client. AuthPanel ne redirige que sur le montage
  // initial, quand l'utilisateur est déjà connecté avant d'arriver ici.
  const signedIn = Boolean(await getCurrentUser());

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-8 px-4 pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))]">
      <h1 className="flex flex-col items-center gap-3 text-center font-display text-3xl font-bold text-amber-400">
        <Logo size={120} />
        CarsDuel
      </h1>
      <AuthPanel
        signIn={signIn}
        signUp={signUp}
        resendOtp={resendOtp}
        verifyOtp={verifyOtp}
        signedIn={signedIn}
        otpEnabled={otpEnabled()}
      />
    </main>
  );
}
