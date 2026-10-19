import { notFound, redirect } from "next/navigation";
import { getViewer } from "@/lib/viewer";
import { calendarCategoryColors } from "@/db/schema";
import { db } from "@/lib/db";
import { CalendarSettingsClient } from "./client";
export default async function CalendarSettingsPage() { const viewer = await getViewer(); if (!viewer) redirect("/login"); if (viewer.role !== "ADMIN" && viewer.role !== "VERWALTUNG") notFound(); return <CalendarSettingsClient initial={await db.select().from(calendarCategoryColors)} />; }
