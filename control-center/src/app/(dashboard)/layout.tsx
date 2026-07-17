import { Shell } from "@/components/shell";
import { requireSession } from "@/lib/auth";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireSession();
  return <Shell>{children}</Shell>;
}
