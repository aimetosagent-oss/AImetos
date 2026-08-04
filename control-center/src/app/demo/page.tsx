import { DashboardView } from "@/components/dashboard-view";
import { getDemoData } from "@/lib/demo-data";

export const revalidate = 300;

export default function DemoPage() {
  return <DashboardView data={getDemoData()} demo />;
}
