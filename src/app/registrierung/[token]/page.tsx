import { RegistrationClient } from "./registration-client";

export default async function RegistrationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <RegistrationClient token={token} />;
}
