import { DashboardView } from "@/components/dashboard-view";
import { getControlCenterData } from "@/lib/data";

export const revalidate = 300;

export default async function DashboardPage() {
  const data = await getControlCenterData();
  return <DashboardView data={data} />;
}
