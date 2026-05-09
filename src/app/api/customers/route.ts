import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { and, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { customers, users } from "@/db/schema";
import { getViewer } from "@/lib/viewer";
import { sendWelcomeEmail } from "@/lib/welcome-email";

export const runtime = "nodejs";

function canManageCustomers(role: string) {
  return role === "ADMIN" || role === "VERWALTUNG";
}

function hashPassword(plain: string) {
  const salt = crypto.randomBytes(16);
  const derivedKey = crypto.scryptSync(plain, salt, 32);
  return `scrypt$${salt.toString("hex")}$${derivedKey.toString("hex")}`;
}

async function usernameExists(username: string) {
  const row = await db.query.users.findFirst({
    where: (t, { eq }) => eq(t.username, username),
    columns: { id: true },
  });
  return Boolean(row?.id);
}

async function buildCustomerUsername() {
  const yy = String(new Date().getFullYear() % 100).padStart(2, "0");
  const prefix = yy;
  const rows = await db
    .select({ username: users.username })
    .from(users)
    .where(and(eq(users.role, "KUNDE"), sql`${users.username} like ${prefix + "%"}`))
    .limit(5000);

  let maxSeq = 0;
  for (const r of rows) {
    const u = String(r.username || "");
    if (u.length !== 6 || !u.startsWith(prefix)) continue;
    const tail = Number(u.slice(2));
    if (Number.isFinite(tail)) maxSeq = Math.max(maxSeq, tail);
  }

  const next = maxSeq + 1;
  const candidate = `${yy}${String(next).padStart(4, "0")}`;
  if (!(await usernameExists(candidate))) return candidate;
  return `${yy}${String(next + 1).padStart(4, "0")}`;
}

export async function GET() {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });
  if (!canManageCustomers(viewer.role)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const rows = await db.query.customers.findMany({ orderBy: (t, { asc }) => [asc(t.name), asc(t.id)] });
  return NextResponse.json({
    ok: true,
    customers: rows.map((c) => ({
      id: c.id,
      name: c.name,
      contactName: c.contactName,
      mainBereich: c.mainBereich,
      street: c.street,
      houseNumber: c.houseNumber,
      plz: c.plz,
      city: c.city,
      email: c.email,
      phone: c.phone,
      accountUserId: c.accountUserId,
    })),
  });
}

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "no_viewer" }, { status: 401 });
  if (!canManageCustomers(viewer.role)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });

  const norm = (v: unknown) => String(v ?? "").trim();

  const name = norm(body.name);
  if (!name) return NextResponse.json({ ok: false, error: "invalid_name" }, { status: 400 });

  const mb = norm(body.mainBereich);
  const mainBereich = (["RD_BOERSE", "SANITATSDIENST", "ERSTE_HILFE"].includes(mb) ? mb : "RD_BOERSE") as
    | "RD_BOERSE"
    | "SANITATSDIENST"
    | "ERSTE_HILFE";

  const inserted = await db
    .insert(customers)
    .values({
      name,
      mainBereich,
      contactName: norm(body.contactName),
      street: norm(body.street),
      houseNumber: norm(body.houseNumber),
      plz: norm(body.plz),
      city: norm(body.city),
      email: norm(body.email),
      phone: norm(body.phone),
      updatedAt: new Date(),
    })
    .returning({ id: customers.id });

  const customerId = inserted.at(0)?.id ?? null;

  const createAccount = Boolean(body.createAccount);
  if (createAccount && customerId) {
    const email = norm(body.email);
    if (!email) return NextResponse.json({ ok: false, error: "missing_email_for_account" }, { status: 400 });

    const existing = await db.query.users.findFirst({ where: (t, { eq }) => eq(t.email, email) });
    const randomSecret = crypto.randomBytes(24).toString("base64url");
    const passwordHash = hashPassword(randomSecret);

    if (existing?.id) {
      if (existing.role !== "KUNDE") {
        return NextResponse.json({ ok: false, error: "email_already_used" }, { status: 409 });
      }

      await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, existing.id));
      await db.update(customers).set({ accountUserId: existing.id, updatedAt: new Date() }).where(eq(customers.id, customerId));
      void sendWelcomeEmail({ to: email, username: existing.username, passwordPlain: randomSecret }).catch(() => null);
    } else {
      const username = await buildCustomerUsername();
      const userInserted = await db
        .insert(users)
        .values({ username, email, role: "KUNDE", passwordHash })
        .returning({ id: users.id });
      const userId = userInserted.at(0)?.id ?? null;

      if (userId) {
        await db.update(customers).set({ accountUserId: userId, updatedAt: new Date() }).where(eq(customers.id, customerId));
        void sendWelcomeEmail({ to: email, username, passwordPlain: randomSecret }).catch(() => null);
      }
    }
  }

  return NextResponse.json({ ok: true, id: customerId });
}
