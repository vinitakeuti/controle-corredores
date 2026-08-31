import { redirect } from "next/navigation";
import { defaultPathForRole, getCurrentUser } from "@/lib/auth";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  redirect(defaultPathForRole(user.role));
}
