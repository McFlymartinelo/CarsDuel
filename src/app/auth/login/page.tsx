import { AuthPanel } from "@/components/auth/AuthPanel";
import { AuthScene } from "@/components/auth/AuthScene";
import { getCurrentUser } from "@/lib/session";
import { otpEnabled } from "@/lib/otp";
import { resendOtp, signIn, verifyOtp } from "../actions";

export const metadata = { title: "Connexion — CarsDuel" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // Pas de redirect ici : AuthPanel affiche un écran de succès après connexion,
  // puis l'utilisateur continue vers le garage. Une session déjà présente est
  // redirigée par AuthPanel à son montage.
  const signedIn = Boolean(await getCurrentUser());

  return (
    <AuthScene>
      <AuthPanel
        mode="login"
        signIn={signIn}
        resendOtp={resendOtp}
        verifyOtp={verifyOtp}
        signedIn={signedIn}
        otpEnabled={otpEnabled()}
      />
    </AuthScene>
  );
}
