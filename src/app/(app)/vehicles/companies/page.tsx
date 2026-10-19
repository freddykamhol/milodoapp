import { notFound, redirect } from "next/navigation";
import { getViewer } from "@/lib/viewer";

export default async function VehicleCompaniesPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (viewer.role !== "ADMIN" && viewer.role !== "VERWALTUNG") notFound();
  redirect("/maintenance-companies");
}
