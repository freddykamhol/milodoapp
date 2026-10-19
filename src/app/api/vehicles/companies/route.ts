import { asc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { vehicleServiceCompanies } from "@/db/schema";
import { getViewer } from "@/lib/viewer";
import {validateCompany,CompanyValidationError,isDuplicateCompany} from "@/lib/maintenance-company";

const canManage = (role: string) => role === "ADMIN" || role === "VERWALTUNG";

export async function GET() {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  if (!canManage(viewer.role)) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  const companies = await db.select().from(vehicleServiceCompanies).orderBy(asc(vehicleServiceCompanies.name));
  return NextResponse.json({ companies });
}

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer || !canManage(viewer.role)) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  try {
    const values=validateCompany(await request.json());
    const [company] = await db.insert(vehicleServiceCompanies).values(values).returning();
    return NextResponse.json({ company });
  } catch(error) {
    if(error instanceof CompanyValidationError||error instanceof SyntaxError)return NextResponse.json({error:error.message},{status:400});
    if(isDuplicateCompany(error))return NextResponse.json({ error: "Diese Firma ist bereits angelegt." }, { status: 409 });
    console.error('[maintenance-companies] create failed',error);
    return NextResponse.json({error:'Firma konnte nicht gespeichert werden.'},{status:500});
  }
}
