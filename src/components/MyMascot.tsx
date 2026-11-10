"use client";

import { createContext, useContext, type ReactNode } from "react";
import { DEFAULT_LOOK, DEFAULT_NAME, type Look } from "@/lib/game/shop";
import { Mascot, type Mood } from "./Mascot";

type Mine = { look: Look; name: string };

const MascotContext = createContext<Mine>({ look: DEFAULT_LOOK, name: DEFAULT_NAME });

/** O layout do app entrega aqui o mascote da pessoa, para qualquer tela poder mostrá-lo. */
export function MascotProvider({ look, name, children }: Mine & { children: ReactNode }) {
  return <MascotContext.Provider value={{ look, name }}>{children}</MascotContext.Provider>;
}

export function useMyMascot(): Mine {
  return useContext(MascotContext);
}

/** O mascote da pessoa, com a roupa que ela escolheu. */
export function MyMascot({
  mood = "neutro",
  size = 96,
  background = false,
  decorative = true,
}: {
  mood?: Mood;
  size?: number;
  background?: boolean;
  decorative?: boolean;
}) {
  const { look, name } = useMyMascot();
  return <Mascot look={look} name={name} mood={mood} size={size} background={background} decorative={decorative} />;
}
