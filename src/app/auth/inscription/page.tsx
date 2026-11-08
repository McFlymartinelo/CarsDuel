import { AuthPanel } from "@/components/auth/AuthPanel";
import { AuthScene } from "@/components/auth/AuthScene";
import { getCurrentUser } from "@/lib/session";
import { otpEnabled } from "@/lib/otp";
import { resendOtp, signUp, verifyOtp } from "../actions";

export const metadata = { title: "Créer un compte — CarsDuel" };
export const dynamic = "force-dynamic";

export default async function InscriptionPage() {
  const signedIn = Boolean(await getCurrentUser());

  return (
    <AuthScene>
      <AuthPanel
        mode="register"
        signUp={signUp}
        resendOtp={resendOtp}
        verifyOtp={verifyOtp}
        signedIn={signedIn}
        otpEnabled={otpEnabled()}
      />
    </AuthScene>
  );
}
