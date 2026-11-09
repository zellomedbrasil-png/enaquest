// Mascote médico em SVG, montado por camadas: fundo, corpo com a roupa, cabeça, rosto, item de cabeça e acessório.
// Não tem estado: funciona em componente de servidor e de cliente. As cores são da ilustração, iguais nos dois temas.
import { DEFAULT_LOOK, findItem, type Look } from "@/lib/game/shop";

export type Mood = "neutro" | "feliz" | "comemorando" | "preocupado" | "dormindo";

const INK = "#1b1d33";

const CHARACTER: Record<string, { skin: string; hair: string }> = {
  doc: { skin: "#f0c29c", hair: "#3b2a20" },
  cirurgia: { skin: "#8d5a3c", hair: "#1d1a22" },
  pediatra: { skin: "#ffd9bd", hair: "#e8793a" },
  socorrista: { skin: "#d9a071", hair: "#7b2d26" },
};

const OUTFIT: Record<string, { torso: string; sleeve: string; pants: string; trim: string }> = {
  jaleco: { torso: "#f6f8ff", sleeve: "#f6f8ff", pants: "#2b3058", trim: "#cfd5ee" },
  pijama_verde: { torso: "#3fbf8f", sleeve: "#3fbf8f", pants: "#3fbf8f", trim: "#2c9a71" },
  pijama_azul: { torso: "#4d9be6", sleeve: "#4d9be6", pants: "#4d9be6", trim: "#3478c0" },
  avental: { torso: "#8fd8dc", sleeve: "#8fd8dc", pants: "#5fb3b8", trim: "#5fb3b8" },
  samu: { torso: "#24306b", sleeve: "#24306b", pants: "#24306b", trim: "#ffe27a" },
};

const SCENE: Record<string, { wall: string; floor: string }> = {
  enfermaria: { wall: "#dff1ff", floor: "#b9dcf5" },
  ps: { wall: "#ffd9d4", floor: "#f2a9a0" },
  centro: { wall: "#cfeeee", floor: "#9fd3d3" },
  noturno: { wall: "#1c2250", floor: "#121738" },
};

const MOOD_TEXT: Record<Mood, string> = {
  neutro: "tranquilo",
  feliz: "feliz",
  comemorando: "comemorando",
  preocupado: "preocupado",
  dormindo: "dormindo",
};

function Background({ id }: { id: string }) {
  const scene = SCENE[id] ?? SCENE.enfermaria;
  return (
    <g>
      <rect width="200" height="220" rx="28" fill={scene.floor} />
      <path d="M0 28Q0 0 28 0H172Q200 0 200 28V196H0Z" fill={scene.wall} />
      {id === "enfermaria" && (
        <>
          <rect x="22" y="26" width="44" height="40" rx="6" fill="#fff" opacity=".75" />
          <path d="M44 26v40M22 46h44" stroke="#b9dcf5" strokeWidth="3" />
          <path d="M160 34v20M150 44h20" stroke="#3ddc97" strokeWidth="7" strokeLinecap="round" />
        </>
      )}
      {id === "ps" && (
        <>
          <circle cx="160" cy="44" r="17" fill="#fff" />
          <path d="M160 34v20M150 44h20" stroke="#e5484d" strokeWidth="7" strokeLinecap="round" />
          <rect x="26" y="34" width="26" height="14" rx="7" fill="#e5484d" />
          <rect x="22" y="48" width="34" height="6" rx="3" fill="#8f3a36" />
          <path d="M39 22v6M24 27l4 5M54 27l-4 5" stroke="#e5484d" strokeWidth="3" strokeLinecap="round" />
        </>
      )}
      {id === "centro" && (
        <>
          <path d="M60 18L20 196H180L140 18Z" fill="#fff" opacity=".28" />
          <ellipse cx="100" cy="14" rx="48" ry="11" fill="#f6f8ff" />
          <circle cx="78" cy="15" r="6" fill="#ffe27a" />
          <circle cx="100" cy="17" r="6" fill="#ffe27a" />
          <circle cx="122" cy="15" r="6" fill="#ffe27a" />
        </>
      )}
      {id === "noturno" && (
        <>
          <circle cx="158" cy="44" r="17" fill="#ffe27a" />
          <circle cx="166" cy="38" r="15" fill={scene.wall} />
          {[
            [30, 30, 2.4],
            [56, 58, 1.8],
            [86, 22, 2],
            [120, 50, 1.6],
            [40, 96, 1.6],
            [176, 92, 2],
            [24, 150, 1.8],
            [180, 150, 1.6],
          ].map(([x, y, r]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill="#fff" />
          ))}
        </>
      )}
    </g>
  );
}

function Hair({ character, color, covered }: { character: string; color: string; covered: boolean }) {
  // Com touca ou gorro, só aparece o que escapa por baixo.
  const cap = !covered && <path d="M57 80Q54 36 100 36Q146 36 143 80Q130 58 100 58Q70 58 57 80Z" fill={color} />;
  if (character === "cirurgia") {
    return (
      <g>
        <circle cx="100" cy="30" r="14" fill={color} />
        {cap}
      </g>
    );
  }
  if (character === "pediatra") {
    return (
      <g fill={color}>
        <circle cx="60" cy="72" r="10" />
        <circle cx="140" cy="72" r="10" />
        {!covered && (
          <>
            <circle cx="66" cy="56" r="13" />
            <circle cx="82" cy="45" r="14" />
            <circle cx="100" cy="41" r="15" />
            <circle cx="118" cy="45" r="14" />
            <circle cx="134" cy="56" r="13" />
          </>
        )}
      </g>
    );
  }
  if (character === "socorrista") {
    return (
      <g>
        <path d="M138 58Q172 66 160 118Q152 98 140 86Z" fill={color} />
        {cap}
      </g>
    );
  }
  return <g>{cap}</g>;
}

function Face({ mood, character }: { mood: Mood; character: string }) {
  const happy = mood === "feliz" || mood === "comemorando";
  return (
    <g>
      <circle cx="72" cy="99" r="7" fill="#ff8fa3" opacity=".45" />
      <circle cx="128" cy="99" r="7" fill="#ff8fa3" opacity=".45" />
      {character === "pediatra" && (
        <g fill="#c9703a" opacity=".7">
          <circle cx="70" cy="94" r="1.3" />
          <circle cx="75" cy="97" r="1.3" />
          <circle cx="125" cy="97" r="1.3" />
          <circle cx="130" cy="94" r="1.3" />
        </g>
      )}

      {happy && <path d="M78 88Q84 79 90 88M110 88Q116 79 122 88" stroke={INK} strokeWidth="3.5" strokeLinecap="round" fill="none" />}
      {mood === "dormindo" && <path d="M78 86Q84 92 90 86M110 86Q116 92 122 86" stroke={INK} strokeWidth="3.5" strokeLinecap="round" fill="none" />}
      {(mood === "neutro" || mood === "preocupado") && (
        <>
          <circle cx="84" cy="87" r="4.6" fill={INK} />
          <circle cx="116" cy="87" r="4.6" fill={INK} />
          <circle cx="85.600" cy="85.400" r="1.500" fill="#fff" />
          <circle cx="117.600" cy="85.400" r="1.500" fill="#fff" />
        </>
      )}
      {mood === "preocupado" && <path d="M76 75L91 79M124 75L109 79" stroke={INK} strokeWidth="3" strokeLinecap="round" />}

      {mood === "neutro" && <path d="M92 102Q100 109 108 102" stroke={INK} strokeWidth="3" strokeLinecap="round" fill="none" />}
      {mood === "feliz" && <path d="M88 100Q100 114 112 100" stroke={INK} strokeWidth="3.5" strokeLinecap="round" fill="none" />}
      {mood === "comemorando" && <path d="M88 100Q100 118 112 100Z" fill="#7a2e3a" stroke={INK} strokeWidth="2.500" strokeLinejoin="round" />}
      {mood === "preocupado" && <path d="M92 107Q100 100 108 107" stroke={INK} strokeWidth="3" strokeLinecap="round" fill="none" />}
      {mood === "dormindo" && <circle cx="100" cy="105" r="3.500" fill="#7a2e3a" />}

      {character === "doc" && (
        <g stroke={INK} strokeWidth="2.500" fill="none">
          <circle cx="84" cy="87" r="10.500" />
          <circle cx="116" cy="87" r="10.500" />
          <path d="M94.500 87h11" />
        </g>
      )}
    </g>
  );
}

function HeadItem({ id }: { id: string | null }) {
  if (id === "touca") {
    return (
      <g>
        <path d="M55 76Q52 28 100 28Q148 28 145 76Q100 62 55 76Z" fill="#5fd0c0" />
        <path d="M55 76Q100 62 145 76" stroke="#3aa697" strokeWidth="4" fill="none" strokeLinecap="round" />
      </g>
    );
  }
  if (id === "gorro") {
    return (
      <g>
        <path d="M55 76Q52 28 100 28Q148 28 145 76Q100 62 55 76Z" fill="#ff7eb6" />
        <g fill="#fff">
          <circle cx="76" cy="50" r="3.500" />
          <circle cx="100" cy="42" r="3.500" />
          <circle cx="124" cy="50" r="3.500" />
          <circle cx="88" cy="60" r="3" />
          <circle cx="112" cy="60" r="3" />
        </g>
        <path d="M55 76Q100 62 145 76" stroke="#d9588f" strokeWidth="4" fill="none" strokeLinecap="round" />
      </g>
    );
  }
  if (id === "espelho") {
    return (
      <g>
        <path d="M57 72Q100 52 143 72" stroke="#555d8a" strokeWidth="6" fill="none" strokeLinecap="round" />
        <circle cx="100" cy="56" r="13" fill="#dfe6ff" stroke="#8f97c4" strokeWidth="3" />
        <circle cx="100" cy="56" r="4" fill="#8f97c4" />
      </g>
    );
  }
  if (id === "coroa") {
    return (
      <g>
        <path d="M68 50L74 22L90 40L100 14L110 40L126 22L132 50Z" fill="#ffd84d" stroke="#c2860f" strokeWidth="3" strokeLinejoin="round" />
        <circle cx="100" cy="40" r="4" fill="#ff6b5b" />
        <circle cx="82" cy="43" r="3" fill="#5bc0ff" />
        <circle cx="118" cy="43" r="3" fill="#5bc0ff" />
      </g>
    );
  }
  return null;
}

/** O que vai na mão direita, desenhado em volta do ponto (0, 0) da mão. */
function Handheld({ id }: { id: string | null }) {
  if (id === "prancheta") {
    return (
      <g>
        <rect x="-13" y="-28" width="28" height="36" rx="3" fill="#b9814d" />
        <rect x="-10" y="-23" width="22" height="28" fill="#fff" />
        <rect x="-4" y="-31" width="10" height="6" rx="2" fill="#8f97c4" />
        <path d="M-6 -15h14M-6 -9h14M-6 -3h9" stroke="#aab1d6" strokeWidth="2" strokeLinecap="round" />
      </g>
    );
  }
  if (id === "cafe") {
    return (
      <g>
        <path d="M-5 -32q-4 -5 0 -10M4 -32q-4 -5 0 -10" stroke="#fff" strokeWidth="2.500" fill="none" strokeLinecap="round" opacity=".85" />
        <path d="M-10 -22H10L8 4H-8Z" fill="#fff" />
        <rect x="-9.500" y="-14" width="19" height="9" fill="#b9814d" />
        <rect x="-11" y="-26" width="22" height="5" rx="2" fill="#3b2a20" />
      </g>
    );
  }
  if (id === "martelo") {
    return (
      <g>
        <path d="M0 8V-26" stroke="#8f97c4" strokeWidth="4" strokeLinecap="round" />
        <path d="M-12 -36H12L7 -24H-7Z" fill="#ff6b5b" stroke="#cf3f2e" strokeWidth="2" strokeLinejoin="round" />
      </g>
    );
  }
  return null;
}

function Outfit({ id, skin }: { id: string; skin: string }) {
  const o = OUTFIT[id] ?? OUTFIT.jaleco;
  if (id === "avental") {
    return (
      <g>
        <path d="M64 132Q100 120 136 132L146 198Q100 206 54 198Z" fill={o.torso} />
        <path d="M88 126Q100 134 112 126" stroke={o.trim} strokeWidth="4" fill="none" strokeLinecap="round" />
        <path d="M60 166Q100 174 140 166" stroke={o.trim} strokeWidth="4" fill="none" strokeLinecap="round" />
      </g>
    );
  }
  if (id === "samu") {
    return (
      <g>
        <path d="M66 132Q100 120 134 132L140 186Q100 194 60 186Z" fill={o.torso} />
        <path d="M70 131L92 126L100 150L108 126L130 131L137 186Q100 193 63 186Z" fill="#ff8a3d" />
        <path d="M65 162Q100 169 135 162" stroke={o.trim} strokeWidth="6" fill="none" />
        <circle cx="119" cy="146" r="5.500" fill="#fff" />
        <path d="M119 142v8M115.500 144l7 4M122.500 144l-7 4" stroke="#3478c0" strokeWidth="1.600" strokeLinecap="round" />
      </g>
    );
  }
  if (id === "pijama_verde" || id === "pijama_azul") {
    return (
      <g>
        <path d="M66 132Q100 120 134 132L140 186Q100 194 60 186Z" fill={o.torso} />
        <path d="M89 125L100 142L111 125Z" fill={skin} />
        <path d="M89 125L100 142L111 125" stroke={o.trim} strokeWidth="3.500" fill="none" strokeLinejoin="round" strokeLinecap="round" />
        <rect x="74" y="152" width="17" height="15" rx="3" fill="none" stroke={o.trim} strokeWidth="2.500" />
      </g>
    );
  }
  return (
    <g>
      <path d="M66 132Q100 120 134 132L140 186Q100 194 60 186Z" fill={o.torso} />
      <path d="M89 125L100 144L111 125Z" fill="#4dd6c1" />
      <path d="M87 126L100 148L113 126" stroke={o.trim} strokeWidth="3" fill="none" strokeLinejoin="round" />
      <path d="M100 148V190" stroke={o.trim} strokeWidth="2.500" />
      <circle cx="105" cy="160" r="2.300" fill="#aab1d6" />
      <circle cx="105" cy="174" r="2.300" fill="#aab1d6" />
      <rect x="114" y="154" width="15" height="13" rx="2.500" fill="none" stroke={o.trim} strokeWidth="2.500" />
    </g>
  );
}

function Stethoscope({ gold }: { gold: boolean }) {
  const tube = gold ? "#c2860f" : "#2b3058";
  return (
    <g>
      <path d="M83 126Q78 160 100 165Q122 160 117 126" stroke={tube} strokeWidth="4" fill="none" strokeLinecap="round" />
      <circle cx="100" cy="169" r="6.500" fill={gold ? "#ffd84d" : "#c9cfe8"} stroke={tube} strokeWidth="2.500" />
    </g>
  );
}

export function Mascot({
  look = DEFAULT_LOOK,
  mood = "neutro",
  size = 160,
  name,
  background = true,
  decorative = false,
}: {
  look?: Look;
  mood?: Mood;
  size?: number;
  name?: string;
  /** Sem fundo, só o boneco (para usar dentro de cartões). */
  background?: boolean;
  /** Quando o texto ao lado já diz tudo, o leitor de tela pula a ilustração. */
  decorative?: boolean;
}) {
  const character = CHARACTER[look.character] ? look.character : "doc";
  const { skin, hair } = CHARACTER[character];
  const outfit = OUTFIT[look.body] ?? OUTFIT.jaleco;
  const up = mood === "comemorando";
  const leftHand = up ? { x: 38, y: 104 } : { x: 51, y: 173 };
  const rightHand = up ? { x: 162, y: 104 } : { x: 149, y: 173 };
  const covered = look.head === "touca" || look.head === "gorro";
  const handheld = look.accessory === "prancheta" || look.accessory === "cafe" || look.accessory === "martelo";

  const wearing = [look.body, look.head, look.accessory]
    .map((id) => (id ? findItem(id)?.name.toLowerCase() : null))
    .filter(Boolean)
    .join(", ");
  const label = `${name ?? findItem(character)?.name ?? "Mascote"}, ${MOOD_TEXT[mood]}${wearing ? `, usando ${wearing}` : ""}`;

  return (
    <svg
      className={`mascot mood-${mood}`}
      width={size}
      height={size * 1.1}
      viewBox="0 0 200 220"
      {...(decorative ? { "aria-hidden": true } : { role: "img", "aria-label": label })}
    >
      {background && <Background id={look.background} />}
      <g className="mascot-figure">
        {/* Pernas e sapatos */}
        <rect x="76" y="182" width="18" height="22" rx="6" fill={outfit.pants} />
        <rect x="106" y="182" width="18" height="22" rx="6" fill={outfit.pants} />
        <ellipse cx="84" cy="206" rx="13" ry="6" fill={INK} />
        <ellipse cx="116" cy="206" rx="13" ry="6" fill={INK} />

        {/* Braço esquerdo */}
        <path d={`M65 139L${leftHand.x} ${leftHand.y}`} stroke={outfit.sleeve} strokeWidth="18" strokeLinecap="round" />
        <circle cx={leftHand.x} cy={leftHand.y} r="9" fill={skin} />

        {/* Tronco */}
        <rect x="91" y="118" width="18" height="16" fill={skin} />
        <Outfit id={look.body} skin={skin} />
        {(look.accessory === "esteto" || look.accessory === "esteto_ouro") && <Stethoscope gold={look.accessory === "esteto_ouro"} />}

        {/* Braço direito, com o que estiver na mão */}
        <path d={`M135 139L${rightHand.x} ${rightHand.y}`} stroke={outfit.sleeve} strokeWidth="18" strokeLinecap="round" />
        {handheld && (
          <g transform={`translate(${rightHand.x} ${rightHand.y})`}>
            <Handheld id={look.accessory} />
          </g>
        )}
        <circle cx={rightHand.x} cy={rightHand.y} r="9" fill={skin} />

        {/* Cabeça */}
        <circle cx="56" cy="88" r="8" fill={skin} />
        <circle cx="144" cy="88" r="8" fill={skin} />
        <circle cx="100" cy="82" r="44" fill={skin} />
        <Hair character={character} color={hair} covered={covered} />
        <Face mood={mood} character={character} />
        <HeadItem id={look.head} />
      </g>

      {mood === "comemorando" && (
        <g fill="#ffd84d" className="mascot-sparkles">
          <path d="M22 70l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" />
          <path d="M180 62l2.500 6 6 2.500-6 2.500-2.500 6-2.500-6-6-2.500 6-2.500z" />
          <path d="M168 140l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" />
        </g>
      )}
      {mood === "preocupado" && <path d="M150 58q7 10 0 15q-7-5 0-15z" fill="#5bc0ff" />}
      {mood === "dormindo" && (
        <g fill={look.background === "noturno" && background ? "#fff" : INK} fontFamily="var(--font-display), sans-serif" fontWeight="800">
          <text x="150" y="52" fontSize="20">
            z
          </text>
          <text x="166" y="36" fontSize="14">
            z
          </text>
        </g>
      )}
    </svg>
  );
}
