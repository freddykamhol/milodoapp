import { AppShell } from "../_components/app-shell";
import { Card } from "../_components/ui";
import { ProfileEditClient } from "./_components/profile-edit-client";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/viewer";

export default async function ProfilePage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");

  return (
    <AppShell title="Mein Profil" subtitle="Deine persönlichen Daten und Einstellungen.">
      <Card title="Stammdaten" description="Username ist nicht editierbar.">
        <ProfileEditClient
          username={viewer.username}
          initial={{
            firstName: viewer.firstName ?? "",
            lastName: viewer.lastName ?? "",
            geb: viewer.geb ? viewer.geb.toISOString().slice(0, 10) : "",
            strasse: viewer.strasse ?? "",
            hausnummer: viewer.hausnummer ?? "",
            plz: viewer.plz ?? "",
            ort: viewer.ort ?? "",
            ortErgaenzung: viewer.ortErgaenzung ?? "",
            email: viewer.email ?? "",
            telefon: viewer.telefon ?? "",
            publicGeb: viewer.publicGeb ?? false,
            publicQualifications: viewer.publicQualifications ?? true,
            publicAddress: viewer.publicAddress ?? false,
            publicContact: viewer.publicContact ?? false,
          }}
        />
      </Card>
    </AppShell>
  );
}
