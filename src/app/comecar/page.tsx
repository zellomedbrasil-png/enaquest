import type { Metadata } from "next";
import { MascotProvider } from "@/components/MyMascot";
import { Onboarding } from "@/components/Onboarding";
import { todayBR } from "@/lib/game/streak";
import { getMascotForPage } from "@/lib/server/mascot";
import { firstNameOf, suggestNickname } from "@/lib/server/onboarding";
import { getProfile, requireUser } from "@/lib/server/session";
import { admin } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Monte seu percurso" };

export default async function StartPage() {
  const user = await requireUser();
  const firstName = firstNameOf(user);
  const [profile, mascot, { data: schools }] = await Promise.all([
    getProfile(user.id),
    getMascotForPage(user.id),
    admin().from("schools").select("id, name, uf").eq("active", true).order("name"),
  ]);
  const nickname = await suggestNickname(profile.nickname, firstName);

  return (
    <main id="conteudo" className="onb-page">
      <MascotProvider character={mascot.character} name={mascot.name}>
        <Onboarding
          firstName={firstName}
          today={todayBR()}
          schools={schools ?? []}
          initial={{
            // Antes do onboarding, prova e tempo ficam sem escolha para a pessoa decidir de propósito.
            targetExam: profile.goals_set ? profile.target_exam : null,
            minutes: profile.goals_set ? profile.daily_minutes : null,
            examDate: profile.exam_date,
            nickname,
            schoolId: profile.school_id,
            showSchool: profile.show_school,
          }}
        />
      </MascotProvider>
    </main>
  );
}
