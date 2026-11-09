import type { Metadata } from "next";
import { Welcome } from "@/components/Welcome";
import { admin } from "@/lib/supabase/admin";
import { getProfile, requireUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "Boas-vindas" };

export default async function WelcomePage() {
  const user = await requireUser();
  const [profile, { data: schools }] = await Promise.all([
    getProfile(user.id),
    admin().from("schools").select("id, name, uf").eq("active", true).order("name"),
  ]);
  return (
    <div style={{ maxWidth: 560 }}>
      <Welcome nickname={profile.nickname} schoolId={profile.school_id} showSchool={profile.show_school} schools={schools ?? []} />
    </div>
  );
}
