import { redirect } from "next/navigation";

export default function Home() {
  redirect("/garage"); // le middleware renvoie vers /auth/login si non connecté
}
