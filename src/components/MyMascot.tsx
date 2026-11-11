"use client";

import { createContext, useContext, type ReactNode } from "react";
import { DEFAULT_MASCOT, type MascotId } from "@/lib/game/mascots";
import { Mascot, type Mood } from "./Mascot";

type Mine = { character: MascotId; name: string };
const MascotContext = createContext<Mine>({ character: DEFAULT_MASCOT.id, name: DEFAULT_MASCOT.name });

export function MascotProvider({ character, name, children }: Mine & { children: ReactNode }) {
  return <MascotContext.Provider value={{ character, name }}>{children}</MascotContext.Provider>;
}

export function useMyMascot(): Mine {
  return useContext(MascotContext);
}

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
  const { character, name } = useMyMascot();
  return <Mascot character={character} name={name} mood={mood} size={size} background={background} decorative={decorative} />;
}
