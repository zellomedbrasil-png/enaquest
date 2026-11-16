import "server-only";
import { admin } from "@/lib/supabase/admin";
import { PLAYABLE_LICENSES } from "./questions";

export type IncidenceArea = {
  id: string;
  name: string;
  color: string;
  count: number;
  pct: number;
  /** Peso da área medido no caderno do ENAMED 2026 (matriz do projeto). */
  matrixPct: number;
  themes: { theme: string; scenario: string }[];
};

export type Incidence = {
  exams: { name: string; booklet: string | null; year: number; valid: number }[];
  total: number;
  areas: IncidenceArea[];
};

/** Incidência por área e tema nas provas oficiais publicadas. Só usa dados de classificação, nunca o enunciado. */
export async function getIncidence(): Promise<Incidence> {
  const db = admin();
  const [{ data: questions }, { data: areas }, { data: exams }] = await Promise.all([
    db
      .from("questions")
      .select("area_id, theme, scenario, official_exam_id")
      .eq("status", "published")
      .in("license", PLAYABLE_LICENSES)
      .eq("annulled", false)
      .not("official_exam_id", "is", null),
    db.from("matrix_areas").select("id, name, color, exam_share").order("sort_order"),
    db.from("official_exams").select("id, name, booklet, year"),
  ]);
  const rows = (questions ?? []) as { area_id: string; theme: string; scenario: string; official_exam_id: string }[];
  const total = rows.length;
  const perExam = new Map<string, number>();
  for (const r of rows) perExam.set(r.official_exam_id, (perExam.get(r.official_exam_id) ?? 0) + 1);
  const shareSum = (areas ?? []).reduce((sum: number, a: { exam_share: number | string }) => sum + Number(a.exam_share), 0) || 1;

  return {
    total,
    exams: ((exams ?? []) as { id: string; name: string; booklet: string | null; year: number }[])
      .filter((e) => perExam.has(e.id))
      .map((e) => ({ name: e.name, booklet: e.booklet, year: e.year, valid: perExam.get(e.id) ?? 0 }))
      .sort((a, b) => b.year - a.year),
    areas: ((areas ?? []) as { id: string; name: string; color: string; exam_share: number | string }[])
      .map((area) => {
        const own = rows.filter((r) => r.area_id === area.id);
        return {
          id: area.id,
          name: area.name,
          color: area.color,
          count: own.length,
          pct: total ? Math.round((own.length / total) * 100) : 0,
          matrixPct: Math.round((Number(area.exam_share) / shareSum) * 100),
          themes: own.map((r) => ({ theme: r.theme, scenario: r.scenario })).sort((a, b) => a.theme.localeCompare(b.theme, "pt-BR")),
        };
      })
      .sort((a, b) => b.count - a.count),
  };
}
