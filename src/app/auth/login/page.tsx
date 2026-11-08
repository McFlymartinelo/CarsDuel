import { Logo } from "@/components/Logo";
import { AuthPanel } from "@/components/auth/AuthPanel";
import { getCurrentUser } from "@/lib/session";
import { otpEnabled } from "@/lib/otp";
import { resendOtp, signIn, signUp, verifyOtp } from "../actions";

export const metadata = { title: "Connexion — CarsDuel" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // Pas de redirect ici : AuthPanel affiche un écran de succès après connexion,
  // puis l'utilisateur continue vers le garage. Une session déjà présente est
  // redirigée par AuthPanel à son montage.
  const signedIn = Boolean(await getCurrentUser());

  return (
    <main
      id="contenu"
      tabIndex={-1}
      className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-8 px-4 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-[max(2.5rem,env(safe-area-inset-top))] outline-none"
    >
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
