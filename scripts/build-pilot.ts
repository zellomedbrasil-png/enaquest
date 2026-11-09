// Junta as partes do piloto em um lote, com as fontes, e valida antes de gravar.
import { readFileSync, writeFileSync } from "node:fs";
import { LotSchema } from "./pipeline/schema";
import { lintLot } from "./pipeline/lint";

const CHECKED = "2026-11-09";
const BVS = "https://bvsms.saude.gov.br/bvs/publicacoes";

const sources = [
  ["ms-dengue-2024", "Dengue: diagnóstico e manejo clínico: adulto e criança, 6ª edição", "Ministério da Saúde", 2024, `${BVS}/dengue_diagnostico_manejo_clinico_6ed.pdf`],
  ["ms-tb-2019", "Manual de recomendações para o controle da tuberculose no Brasil, 2ª edição", "Ministério da Saúde", 2019, `${BVS}/manual_recomendacoes_controle_tuberculose_brasil_2_ed.pdf`],
  ["ms-has-2014", "Cadernos de Atenção Básica nº 37: Hipertensão arterial sistêmica", "Ministério da Saúde", 2014, `${BVS}/hipertensao_arterial_sistemica_cab37.pdf`],
  ["ms-dm-2013", "Cadernos de Atenção Básica nº 36: Diabetes mellitus", "Ministério da Saúde", 2013, `${BVS}/estrategias_cuidado_pessoa_diabetes_mellitus_cab36.pdf`],
  ["ms-avc-2013", "Manual de rotinas para atenção ao AVC", "Ministério da Saúde", 2013, `${BVS}/manual_rotinas_para_atencao_avc.pdf`],
  ["ms-samu-2016", "Protocolos de Suporte Avançado de Vida do SAMU 192", "Ministério da Saúde", 2016, `${BVS}/protocolo_suporte_avancado_vida.pdf`],
  ["ms-aidpi-2017", "Manual de quadros de procedimentos AIDPI Criança: 2 meses a 5 anos", "Ministério da Saúde", 2017, `${BVS}/manual_quadros_procedimentos_aidpi_crianca_2meses_5anos.pdf`],
  ["ms-calendario-2026", "Calendário Nacional de Vacinação da criança", "Ministério da Saúde", 2026, "https://www.gov.br/saude/pt-br/vacinacao/calendario"],
  ["ms-crianca-2012", "Cadernos de Atenção Básica nº 33: Saúde da criança, crescimento e desenvolvimento", "Ministério da Saúde", 2012, `${BVS}/saude_crianca_crescimento_desenvolvimento.pdf`],
  ["ms-gar-2022", "Manual de gestação de alto risco", "Ministério da Saúde", 2022, `${BVS}/manual_gestacao_alto_risco.pdf`],
  ["ms-ist-2015", "PCDT para Atenção Integral às Pessoas com Infecções Sexualmente Transmissíveis", "Ministério da Saúde", 2015, `${BVS}/protocolo_clinico_diretrizes_terapeutica_atencao_integral_pessoas_infeccoes_sexualmente_transmissiveis.pdf`],
  ["ms-queimaduras-2012", "Cartilha para tratamento de emergência das queimaduras", "Ministério da Saúde", 2012, `${BVS}/cartilha_tratamento_emergencia_queimaduras.pdf`],
  ["ms-mental-2013", "Cadernos de Atenção Básica nº 34: Saúde mental", "Ministério da Saúde", 2013, `${BVS}/cadernos_atencao_basica_34_saude_mental.pdf`],
  ["ms-gvs-2022", "Guia de Vigilância em Saúde, 5ª edição revisada", "Ministério da Saúde", 2022, `${BVS}/guia_vigilancia_saude_5ed_rev_atual.pdf`],
  ["ms-rastreamento-2010", "Cadernos de Atenção Primária nº 29: Rastreamento", "Ministério da Saúde", 2010, `${BVS}/caderno_atencao_primaria_29_rastreamento.pdf`],
  ["cfm-cem-2019", "Código de Ética Médica (Resolução CFM nº 2.217/2018)", "Conselho Federal de Medicina", 2019, "https://portal.cfm.org.br/images/PDF/cem2019.pdf"],
  ["lei-14443-2022", "Lei nº 14.443, de 2 de setembro de 2022", "Presidência da República", 2022, "https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2022/lei/l14443.htm"],
  ["ms-idoso-2006", "Cadernos de Atenção Básica nº 19: Envelhecimento e saúde da pessoa idosa", "Ministério da Saúde", 2006, `${BVS}/evelhecimento_saude_pessoa_idosa.pdf`],
].map(([id, title, publisher, year, url]) => ({ id, title, publisher, year, url, checked_on: CHECKED }));

const part = (name: string) => JSON.parse(readFileSync(`content/lots/${name}.json`, "utf8"));

const lot = LotSchema.parse({
  id: "piloto-001",
  notes:
    "Piloto de 60 questões, na proporção medida no ENAMED 2026. Fatos conferidos no texto das fontes oficiais. Atenção na revisão: fontes antigas (PCDT IST 2015, Rastreamento 2010, Caderno do Idoso 2006) podem ter versão mais nova.",
  sources,
  questions: [...part("piloto-001-parte1"), ...part("piloto-001-parte2")],
});

const report = lintLot(lot);
const byArea: Record<string, number> = {};
for (const q of lot.questions) byArea[q.area_id] = (byArea[q.area_id] ?? 0) + 1;

console.log(`Questões: ${lot.questions.length}`);
console.log("Por área:", byArea);
console.log("Gabarito por letra:", report.keys.counts.join(", "), report.keys.balanced ? "(equilibrado)" : "(desequilibrado)");
console.log("Alto risco:", lot.questions.filter((q) => q.risk_level === "alto").length);
for (const item of report.report) {
  for (const issue of item.issues) console.log(`${issue.fatal ? "ERRO " : "aviso"} ${item.slug}: ${issue.code}: ${issue.message}`);
}
if (report.duplicates.length) console.log("Parecidas:", report.duplicates);
if (report.duplicateSlugs.length) console.log("Slugs repetidos:", report.duplicateSlugs);
if (report.fatalCount) process.exit(1);

writeFileSync("content/lots/piloto-001.json", JSON.stringify(lot, null, 2) + "\n");
writeFileSync(
  "content/lots/piloto-001.sem-gabarito.json",
  JSON.stringify(
    lot.questions.map((q) => ({ slug: q.slug, stem: q.stem, exams: q.exams, options: q.options })),
    null,
    2,
  ) + "\n",
);
console.log("Lote gravado.");
