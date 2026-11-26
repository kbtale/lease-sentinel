import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/admin";
import { SimulateClient } from "@/components/simulate/SimulateClient";

export const dynamic = "force-dynamic";

export default async function SimulatePage() {
  const session = await auth();
  const userEmail = session?.user?.email || "";
  const isAdmin = isAdminEmail(userEmail);

  return <SimulateClient isAdmin={isAdmin} userEmail={userEmail} />;
}
