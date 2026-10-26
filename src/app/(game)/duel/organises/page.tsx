import { redirect } from "next/navigation";

export const metadata = { title: "Duels organisés — CarsDuel" };

export default function OrganizedPage() {
  redirect("/duel");
}
