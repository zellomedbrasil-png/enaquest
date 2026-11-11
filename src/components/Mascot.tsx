import Image from "next/image";
import { DEFAULT_MASCOT, resolveMascot } from "@/lib/game/mascots";

export type Mood = "neutro" | "feliz" | "comemorando" | "preocupado" | "dormindo";

export function Mascot({
  character = DEFAULT_MASCOT.id,
  mood = "neutro",
  size = 96,
  name,
  background = false,
  decorative = false,
}: {
  character?: string;
  mood?: Mood;
  size?: number;
  name?: string;
  background?: boolean;
  decorative?: boolean;
}) {
  const mascot = resolveMascot(character);
  return (
    <Image
      className={`mascot mood-${mood}${background ? " mascot-with-background" : ""}`}
      src={mascot.image}
      alt={decorative ? "" : name ?? mascot.name}
      width={size}
      height={size * 1.5}
      sizes={`${size}px`}
      style={{ objectFit: "contain" }}
      draggable={false}
    />
  );
}
