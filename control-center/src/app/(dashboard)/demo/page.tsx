import { DashboardView } from "@/components/dashboard-view";
import { getControlCenterData, sanitizeForDemo } from "@/lib/data";

export const revalidate = 300;

export default async function DemoPage() {
  const data = sanitizeForDemo(await getControlCenterData());
  return <DashboardView data={data} demo />;
}
