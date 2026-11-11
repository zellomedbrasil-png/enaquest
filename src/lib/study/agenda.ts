// Agenda de revisão: quantas questões voltam em cada um dos próximos dias.

export type AgendaDay = { day: string; count: number };

/** Soma dias a uma data "AAAA-MM-DD" sem depender do fuso do aparelho. */
export function addDays(day: string, amount: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

/**
 * Conta as questões por dia, de hoje até hoje + (days - 1).
 * Questões atrasadas entram em "hoje"; as que voltam depois da janela ficam de fora.
 * `dueDays` são datas "AAAA-MM-DD" no fuso do Brasil.
 */
export function buildAgenda(dueDays: string[], today: string, days = 7): AgendaDay[] {
  const agenda = Array.from({ length: days }, (_, index) => ({ day: addDays(today, index), count: 0 }));
  for (const due of dueDays) {
    const slot = due <= today ? 0 : agenda.findIndex((entry) => entry.day === due);
    if (slot >= 0) agenda[slot].count++;
  }
  return agenda;
}

const WEEKDAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function agendaLabel(day: string, index: number): string {
  if (index === 0) return "Hoje";
  if (index === 1) return "Amanhã";
  return WEEKDAY_SHORT[new Date(`${day}T12:00:00Z`).getUTCDay()];
}
