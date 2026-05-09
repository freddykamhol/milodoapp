import Link from "next/link";

import { Card } from "../(app)/_components/ui";

import { ResetPasswordClient } from "./_components/reset-password-client";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const t = String(token ?? "").trim();

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <Card
        title="Passwort zurücksetzen"
        description="Setze ein neues Passwort. Der Link ist zeitlich begrenzt gültig."
        actions={
          <Link href="/" className="text-xs font-semibold text-[color:var(--accent)] hover:underline">
            Zur Startseite
          </Link>
        }
      >
        {t ? <ResetPasswordClient token={t} /> : <p className="text-sm text-[color:var(--muted)]">Token fehlt.</p>}
      </Card>
    </main>
  );
}

