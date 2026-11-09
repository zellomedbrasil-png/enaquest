-- Dados de referência. Não contém questões; elas entram por lote (scripts/import-lot.ts).

insert into exam_tracks (id, name, options_count, questions_count, duration_minutes) values
  ('enamed', 'ENAMED e ENARE acesso direto', 4, 100, 300);

-- exam_share: medida no caderno 1 do ENAMED 2026. Ver docs/matriz-enamed-2026.md.
insert into matrix_areas (id, name, short_name, color, sort_order, exam_share) values
  ('clinica',   'Clínica Médica',                   'Clínica',    '#5bc0ff', 1, 0.180),
  ('pediatria', 'Pediatria',                        'Pediatria',  '#ffd84d', 2, 0.160),
  ('go',        'Ginecologia e Obstetrícia',        'GO',         '#ff7eb6', 3, 0.150),
  ('cirurgia',  'Cirurgia Geral',                   'Cirurgia',   '#ff9f43', 4, 0.140),
  ('mental',    'Saúde Mental',                     'Mental',     '#b39dff', 5, 0.140),
  ('coletiva',  'Saúde Coletiva',                   'Coletiva',   '#7ee8a2', 6, 0.120),
  ('mfc',       'Medicina de Família e Comunidade', 'Família',    '#4dd6c1', 7, 0.110);

insert into competencies (id, name) values
  ('hipotese',   'Formulação de hipóteses diagnósticas'),
  ('propedeutica', 'Plano propedêutico e exames'),
  ('terapeutica', 'Plano terapêutico'),
  ('urgencia',   'Urgências e emergências'),
  ('decisao',    'Tomada de decisão no contexto assistencial'),
  ('sus',        'Epidemiologia, vigilância e SUS'),
  ('etica',      'Ética, comunicação e trabalho em equipe');

-- Amostra para desenvolvimento. A lista completa virá do cadastro e-MEC antes do lançamento.
insert into schools (name, city, uf) values
  ('Universidade Federal do Ceará', 'Fortaleza', 'CE'),
  ('Universidade Estadual do Ceará', 'Fortaleza', 'CE'),
  ('Universidade de Fortaleza', 'Fortaleza', 'CE'),
  ('Universidade de São Paulo', 'São Paulo', 'SP'),
  ('Universidade Federal de Minas Gerais', 'Belo Horizonte', 'MG'),
  ('Universidade Federal do Rio de Janeiro', 'Rio de Janeiro', 'RJ'),
  ('Universidade Federal da Bahia', 'Salvador', 'BA'),
  ('Universidade Federal do Rio Grande do Sul', 'Porto Alegre', 'RS'),
  ('Universidade Federal de Pernambuco', 'Recife', 'PE'),
  ('Universidade de Brasília', 'Brasília', 'DF');

insert into app_config (key, value) values
  ('editorial', '{"responsible_name": null, "responsible_crm": null}'),
  ('proficiency_calibration', '{"calibrated": false, "boletins": 0}');
