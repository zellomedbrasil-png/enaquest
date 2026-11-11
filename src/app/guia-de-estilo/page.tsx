import type { Metadata } from "next";
import { Mascot, type Mood } from "@/components/Mascot";
import { MASCOTS } from "@/lib/game/mascots";
import {
  AREA_COLOR,
  AreaBars,
  AreaTag,
  Banner,
  CloudBadge,
  DayCard,
  HardTag,
  LevelBar,
  ReviewCard,
  ScoreCard,
  StatChip,
  StatChips,
  StatusPill,
} from "@/components/ui";

export const metadata: Metadata = { title: "Guia de estilo", robots: { index: false } };

const SURFACES = [
  ["--bg", "#0d0f1c", "fundo"],
  ["--bg-2", "#121527", "alternativas"],
  ["--card", "#181c33", "cards"],
  ["--card-2", "#1f2442", "elevado"],
  ["--line", "#2a3058", "bordas"],
  ["--ink", "#eef0ff", "texto"],
  ["--mute", "#9aa1c7", "secundário"],
  ["--dim", "#6b7299", "terciário"],
];
const ACCENTS = [
  ["--lime", "#c8f542", "marca, CTA"],
  ["--coral", "#ff6b5b", "atraso, HARD"],
  ["--sky", "#5bc0ff", "gráficos"],
  ["--gold", "#ffd84d", "marcada"],
  ["--ok", "#3ddc97", "acerto"],
  ["--bad", "#ff5d73", "erro"],
];
const AREAS = [
  ["Clínica Médica", "--cm", "#5bc0ff"],
  ["Cirurgia", "--cir", "#ff9f43"],
  ["Pediatria", "--ped", "#ffd84d"],
  ["GO", "--go", "#ff7eb6"],
  ["Preventiva", "--prev", "#7ee8a2"],
];
const GRADIENTS = [
  ["Progresso", "var(--grad-progress)", "#c8f542 → #7ee8a2"],
  ["HARD / atraso", "var(--grad-hard)", "#ff5d5d → #ff8a3d"],
  ["Avatar", "var(--grad-avatar)", "sky → lime"],
  ["Sombra 3D", "#8fb21e", "#8fb21e · botão e logo"],
];
const RADII = [
  ["11px", "dots", 11],
  ["14px", "botões", 14],
  ["18px", "cards", 18],
  ["22px", "questão", 22],
  ["24px", "resultado", 24],
  ["99px", "pílulas", 99],
] as const;

const MOODS: Mood[] = ["neutro", "feliz", "comemorando", "preocupado", "dormindo"];


function Section({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 34 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
        <h2 style={{ fontSize: 20 }}>{title}</h2>
        <span className="muted" style={{ fontSize: 13 }}>
          {hint}
        </span>
      </div>
      {children}
    </section>
  );
}

function Swatches({ items }: { items: string[][] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 10 }}>
      {items.map(([name, color, note]) => (
        <div key={name} style={{ borderRadius: 16, overflow: "hidden", border: "1px solid var(--line)", background: "var(--card)" }}>
          <i style={{ display: "block", height: 64, background: color }} />
          <div style={{ padding: "8px 10px", fontSize: 12, color: "var(--mute)", lineHeight: 1.35 }}>
            <b style={{ display: "block", color: "var(--ink)", fontSize: 13 }}>{name}</b>
            {note}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function StyleGuidePage() {
  return (
    <div className="wrap" style={{ maxWidth: 860 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <span className="logo" style={{ width: 44, height: 44, fontSize: 20 }} aria-hidden>
          E
        </span>
        <div>
          <h1 style={{ fontSize: 26 }}>EnaQuest</h1>
          <small className="muted">Guia de estilo · tema escuro gamificado</small>
        </div>
      </div>

      <Section title="Paleta" hint="fundos, texto e destaques">
        <Swatches items={SURFACES.map(([n, c, d]) => [n, c, `${c} · ${d}`])} />
        <div style={{ height: 10 }} />
        <Swatches items={ACCENTS.map(([n, c, d]) => [n, c, `${c} · ${d}`])} />
      </Section>

      <Section title="Cores por área" hint="grandes áreas da prova">
        <Swatches items={AREAS.map(([n, v, c]) => [n, c, `${v} ${c}`])} />
      </Section>

      <Section title="Gradientes" hint="progresso, HARD, avatar">
        <Swatches items={GRADIENTS.map(([n, c, d]) => [n, c, d])} />
      </Section>

      <Section title="Tipografia" hint="Bricolage Grotesque + Inter">
        <div className="card" style={{ display: "grid", gap: 14 }}>
          <div>
            <div className="muted" style={{ fontSize: 12 }}>Bricolage Grotesque 800 · títulos, números, placar</div>
            <h1 style={{ fontSize: 44, lineHeight: 1.05 }}>Plantão de Clínica Médica</h1>
          </div>
          <div>
            <div className="muted" style={{ fontSize: 12 }}>Bricolage Grotesque 700 · 20px · seções</div>
            <h2 style={{ fontSize: 20 }}>Evolução nos simulados</h2>
          </div>
          <div>
            <div className="muted" style={{ fontSize: 12 }}>Inter 400 · 16px / 1.65 · enunciado da questão</div>
            <p className="stem">
              Paciente de 58 anos, diabético, com dor torácica há 40 minutos e supradesnivelamento do segmento ST em parede anterior. Qual a conduta mais
              adequada?
            </p>
          </div>
          <div>
            <div className="muted" style={{ fontSize: 12 }}>Inter 500–700 · 15px base · interface</div>
            <p>
              Texto de interface, botões e rótulos usam Inter. <span className="muted">Secundário em --mute.</span> <span className="dim">Terciário em --dim.</span>
            </p>
          </div>
          <div>
            <div className="muted" style={{ fontSize: 12 }}>Bricolage 800 · números grandes</div>
            <span className="display" style={{ fontSize: 44 }}>
              87<small style={{ fontSize: 16, color: "var(--mute)", fontWeight: 600 }}> %</small>
            </span>
          </div>
        </div>
      </Section>

      <Section title="Botões" hint="primário com sombra sólida">
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <button className="btn btn-primary">Começar plantão</button>
          <button className="btn btn-ghost">Voltar ao painel</button>
          <button className="btn btn-flag">Marcada</button>
          <button className="btn btn-dark">Escuro</button>
        </div>
      </Section>

      <Section title="Alertas" hint="estados do dia">
        <div style={{ display: "grid", gap: 10 }}>
          <Banner tone="danger" title="Você está 3 dias atrasado" text="Faça os plantões pendentes para não perder o ritmo." counter={{ value: 3, unit: "dias" }} />
          <Banner tone="today" title="Plantão de hoje liberado" text="10 questões comentadas esperando." action={<button className="btn btn-dark">Abrir</button>} />
          <Banner tone="done" title="Hoje está feito" text="Volte amanhã." />
          <Banner tone="info" title="Rodada HARD disponível" text="Questões sem limite." />
        </div>
      </Section>

      <Section title="Cards e métricas" hint="chips, nível, nuvem">
        <StatChips>
          <StatChip label="Sequência" value={12} unit="dias" />
          <StatChip label="Acerto" value={78} unit="%" />
          <StatChip label="Questões" value={340} />
          <StatChip label="Liga" value="Ouro" color="var(--gold)" />
        </StatChips>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginTop: 12 }}>
          <LevelBar label="Nível 7" value="1.240 XP" progress={0.62} />
          <LevelBar label="HARD" value="Rating 1480" progress={0.48} tone="hard" />
          <CloudBadge />
          <HardTag />
          <StatusPill tone="pend">pendente</StatusPill>
          <StatusPill tone="late">atrasado</StatusPill>
          <StatusPill tone="today">hoje</StatusPill>
        </div>
      </Section>

      <Section title="Lista de dias" hint="card com número, título e status">
        <div style={{ display: "grid", gap: 10 }}>
          <DayCard day={14} meta="09 nov" tag={<AreaTag color={AREA_COLOR.clinica}>CM</AreaTag>} title="Cardiologia" right={<StatusPill tone="today">hoje</StatusPill>} />
          <DayCard
            day={13}
            meta="08 nov"
            tag={<AreaTag color={AREA_COLOR.go}>GO</AreaTag>}
            title="Pré-natal"
            right={
              <span className="display" style={{ fontSize: 24 }}>
                8<small style={{ fontSize: 13, color: "var(--mute)" }}>/10</small>
              </span>
            }
          />
        </div>
      </Section>

      <Section title="Desempenho por área" hint="barras com cor da área">
        <div className="card">
          <AreaBars
            rows={[
              { label: "Clínica Médica", value: 82, color: AREA_COLOR.clinica },
              { label: "Cirurgia", value: 64, color: AREA_COLOR.cirurgia },
              { label: "Pediatria", value: 71, color: AREA_COLOR.pediatria },
              { label: "GO", value: 58, color: AREA_COLOR.go },
              { label: "Preventiva", value: 90, color: AREA_COLOR.coletiva },
            ]}
          />
        </div>
      </Section>

      <Section title="Questão" hint="navegação, alternativas, ações">
        <div className="dots" style={{ marginBottom: 12 }}>
          <span className="dot answered" style={{ display: "grid", placeItems: "center" }}>1</span>
          <span className="dot answered" style={{ display: "grid", placeItems: "center" }}>2</span>
          <span className="dot current" style={{ display: "grid", placeItems: "center" }}>3</span>
          <span className="dot flagged" style={{ display: "grid", placeItems: "center" }}>4</span>
          <span className="dot" style={{ display: "grid", placeItems: "center" }}>5</span>
          <span className="dot" style={{ display: "grid", placeItems: "center" }}>6</span>
        </div>
        <div className="qcard">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, fontSize: 12.5 }} className="muted">
            <span>Questão 3 de 10</span>
            <AreaTag color={AREA_COLOR.clinica}>CM</AreaTag>
          </div>
          <p className="stem">Homem de 62 anos, hipertenso, com dispneia progressiva e edema de membros inferiores. Ecocardiograma com FE de 30%. Qual medicação reduz mortalidade?</p>
          {[
            ["A", "Furosemida isolada", ""],
            ["B", "Sacubitril-valsartana", "selected"],
            ["C", "Digoxina em dose de ataque", "struck"],
            ["D", "Verapamil", ""],
          ].map(([letter, text, state]) => (
            <div key={letter} className={`opt ${state}`}>
              <span className="opt-main" style={{ cursor: "default" }}>
                <span className="letter">{letter}</span>
                <span className="opt-text">{text}</span>
              </span>
              <span className="strike-btn" style={{ display: "grid", placeItems: "center", fontSize: 12, width: "auto", padding: "0 8px" }}>
                riscar
              </span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 14 }}>
            <button className="btn btn-flag">Marcar</button>
            <button className="btn btn-primary">Próxima</button>
          </div>
        </div>
      </Section>

      <Section title="Revisão" hint="faixa lateral de 5px">
        <div style={{ display: "grid", gap: 10 }}>
          <ReviewCard ok title="Questão 1" />
          <ReviewCard ok={false} title="Questão 2" />
        </div>
      </Section>

      <Section title="Resultado" hint="anel SVG">
        <ScoreCard correct={8} total={10} />
      </Section>

      <Section title="Mascote" hint="companheiros de jornada">
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {MOODS.map((mood) => (
            <figure key={mood} style={{ textAlign: "center" }}>
              <Mascot mood={mood} size={104} />
              <figcaption className="muted" style={{ fontSize: 12.5 }}>
                {mood}
              </figcaption>
            </figure>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
          {MASCOTS.map((mascot) => (
            <Mascot key={mascot.id} character={mascot.id} mood="feliz" size={104} />
          ))}
        </div>
      </Section>

      <Section title="Raios e largura" hint="cantos bem arredondados">
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {RADII.map(([size, use, radius]) => (
            <div key={size} style={{ background: "var(--card-2)", border: "1px solid var(--line)", padding: "14px 16px", fontSize: 12.5, color: "var(--mute)", textAlign: "center", borderRadius: radius }}>
              <b style={{ display: "block", color: "var(--ink)" }}>{size}</b>
              {use}
            </div>
          ))}
        </div>
      </Section>

      <p className="dim" style={{ marginTop: 34, fontSize: 12.5, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
        Largura máxima do conteúdo: 860px · padding lateral 16px · base 15px / 1.5 · animações: confete e avisos entram deslizando, o alerta de atraso pulsa, as barras enchem com easing.
      </p>
    </div>
  );
}
