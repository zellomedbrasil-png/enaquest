-- Simulado da prova real: cada prova oficial tem, no máximo, um simulado com as questões do caderno
-- (sem as anuladas), na ordem original e sempre disponível.
alter table simulados
  add column official_exam_id text unique references official_exams (id);
