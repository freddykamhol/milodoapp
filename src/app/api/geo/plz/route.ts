import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const plz = String(url.searchParams.get("plz") ?? "").trim();
  if (!/^\d{5}$/.test(plz)) return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });

  try {
    const res = await fetch(`https://api.zippopotam.us/de/${plz}`, { cache: "no-store" });
    if (!res.ok) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    const json = (await res.json()) as { places?: Array<{ "place name"?: string }> };
    const places = Array.isArray(json.places) ? json.places : [];
    const cities = places
      .map((p) => String(p["place name"] ?? "").trim())
      .filter(Boolean);
    return NextResponse.json({ ok: true, plz, cities: Array.from(new Set(cities)) });
  } catch {
    return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });
  }
}

