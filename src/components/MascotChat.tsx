"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore, type CSSProperties, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { conversations, type MascotMoment } from "@/lib/ui/mascot-conversation";
import { MyMascot, useMyMascot } from "./MyMascot";

const preferenceKey = "enaquest-mascot-companion";
let memory = '{"hidden":false,"position":0}';
let preferencesLoaded = false;
const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
function snapshot() {
  if (!preferencesLoaded && typeof window !== "undefined") {
    preferencesLoaded = true;
    try {
      memory = sessionStorage.getItem(preferenceKey) ?? memory;
    } catch {
      // A preferência também funciona em memória.
    }
  }
  return memory;
}
function readPreferences() {
  try {
    const value = JSON.parse(snapshot());
    return { hidden: value.hidden === true, position: Math.max(0, Math.min(1, Number(value.position) || 0)) };
  } catch {
    return { hidden: false, position: 0 };
  }
}
function updatePreferences(change: Partial<ReturnType<typeof readPreferences>>) {
  memory = JSON.stringify({ ...readPreferences(), ...change });
  try {
    sessionStorage.setItem(preferenceKey, memory);
  } catch {
    // A memória mantém a preferência quando o armazenamento está indisponível.
  }
  listeners.forEach((listener) => listener());
}
const greetings = new Map<MascotMoment, { remaining: number[]; previous: number }>();
function greeting(moment: MascotMoment) {
  const lines = conversations[moment].greetings;
  const bag = greetings.get(moment) ?? { remaining: [], previous: -1 };
  if (!bag.remaining.length) {
    bag.remaining = lines.map((_, index) => index);
    for (let i = bag.remaining.length - 1; i > 0; i--) {
      const other = Math.floor(Math.random() * (i + 1));
      [bag.remaining[i], bag.remaining[other]] = [bag.remaining[other], bag.remaining[i]];
    }
    if (bag.remaining[0] === bag.previous) bag.remaining.push(bag.remaining.shift()!);
  }
  bag.previous = bag.remaining.shift()!;
  greetings.set(moment, bag);
  return lines[bag.previous];
}
const subscribeClient = () => () => {};

export function MascotChat({ moment, contextId = moment }: { moment: MascotMoment; contextId?: string }) {
  return <Companion key={`${contextId}:${moment}`} moment={moment} contextId={contextId} />;
}

function Companion({ moment, contextId }: { moment: MascotMoment; contextId: string }) {
  const { name } = useMyMascot();
  const ready = useSyncExternalStore(subscribeClient, () => true, () => false);
  useSyncExternalStore(subscribe, snapshot, () => memory);
  const { hidden, position } = readPreferences();
  const [dialogue, setDialogue] = useState<{ context: string; text: string; reply: boolean; breathe: boolean; farewell?: boolean } | null>(null);
  const [breath, setBreath] = useState(0);
  const [blocked, setBlocked] = useState(false);
  const [bounds, setBounds] = useState({ min: 90, max: 500, space: 600 });
  const [dragPosition, setDragPosition] = useState<number | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const firstChoice = useRef<HTMLButtonElement>(null);
  const continueButton = useRef<HTMLButtonElement>(null);
  const drag = useRef<{ y: number; top: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const bubbleId = useId();
  const context = `${contextId}:${moment}`;
  const open = dialogue?.context === context && !blocked && !hidden;
  const breathing = open && dialogue.breathe && breath < 6;

  function close() {
    setDialogue(null);
    trigger.current?.focus({ preventScroll: true });
  }

  useEffect(() => {
    if (!open) return;
    const target = dialogue.reply ? continueButton : firstChoice;
    target.current?.focus({ preventScroll: true });
  }, [open, dialogue?.reply]);

  useEffect(() => {
    if (!open || !dialogue.farewell) return;
    const timer = window.setTimeout(() => {
      setDialogue(null);
      trigger.current?.focus({ preventScroll: true });
    }, 2200);
    return () => window.clearTimeout(timer);
  }, [open, dialogue?.farewell]);

  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDialogue(null);
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, []);

  useEffect(() => {
    if (!breathing) return;
    const timer = window.setInterval(() => setBreath((value) => value + 1), 4000);
    return () => window.clearInterval(timer);
  }, [breathing]);

  useEffect(() => {
    if (!ready) return;
    function measure() {
      const modal = document.querySelector('[aria-modal="true"], dialog[open]');
      setBlocked(Boolean(modal));
      const viewport = window.visualViewport;
      const height = viewport?.height ?? window.innerHeight;
      const offset = viewport?.offsetTop ?? 0;
      let bottom = height + offset - 24;
      for (const element of document.querySelectorAll(".appnav, .sticky-action, .simulado-navigation")) {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        const reserved = style.position === "fixed" || style.position === "sticky" || element.classList.contains("simulado-navigation");
        if (reserved && rect.top > height / 2 && rect.top < bottom && rect.bottom > 0) {
          bottom = rect.top - 12;
        }
      }
      const topbar = document.querySelector(".topbar")?.getBoundingClientRect().bottom ?? 64;
      const min = Math.max(offset + 12, topbar + 12);
      const widgetHeight = root.current?.getBoundingClientRect().height ?? 180;
      setBounds({ min, max: Math.max(min, bottom - widgetHeight), space: Math.max(180, bottom - min) });
    }
    measure();
    const resize = new ResizeObserver(measure);
    if (root.current) resize.observe(root.current);
    const observer = new MutationObserver(measure);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-modal", "open"] });
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    window.visualViewport?.addEventListener("resize", measure);
    return () => {
      resize.disconnect();
      observer.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      window.visualViewport?.removeEventListener("resize", measure);
    };
  }, [ready, hidden, open]);

  const top = dragPosition ?? bounds.max - position * (bounds.max - bounds.min);
  function pointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    drag.current = { y: event.clientY, top, moved: false };
    suppressClick.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function pointerMove(event: PointerEvent<HTMLButtonElement>) {
    if (!drag.current) return;
    if (Math.abs(event.clientY - drag.current.y) > 6) drag.current.moved = true;
    if (drag.current.moved) {
      const nextTop = drag.current.top + event.clientY - drag.current.y;
      setDragPosition(Math.max(bounds.min, Math.min(bounds.max, nextTop)));
    }
  }
  function endDrag(event: PointerEvent<HTMLButtonElement>) {
    if (!drag.current) return;
    suppressClick.current = drag.current.moved;
    if (drag.current.moved && dragPosition !== null) {
      updatePreferences({ position: (bounds.max - dragPosition) / Math.max(1, bounds.max - bounds.min) });
    }
    drag.current = null;
    setDragPosition(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  function toggle() {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    if (open) {
      close();
      return;
    }
    setBreath(0);
    setDialogue({ context, text: greeting(moment), reply: false, breathe: false });
  }
  function choose(index: number) {
    const choice = conversations[moment].choices[index];
    setBreath(0);
    setDialogue({ context, text: choice.reply, reply: true, breathe: Boolean(choice.breathe), farewell: choice.close });
  }

  const mood = open && moment === "fim" ? "comemorando" : open && moment === "acerto" ? "feliz" : "neutro";
  const breathLabel = breath >= 6
    ? "No seu tempo. Podemos continuar."
    : `${breath % 2 === 0 ? "Inspire suavemente" : "Solte o ar"} · ${Math.floor(breath / 2) + 1} de 3`;

  if (!ready) return null;
  return createPortal(
    <div
      ref={root}
      className={`mascot-chat ${open ? "is-open" : ""} ${dragPosition !== null ? "is-dragging" : ""}`}
      style={{ top, "--mascot-space": `${bounds.space}px`, visibility: blocked ? "hidden" : "visible" } as CSSProperties}
      onKeyDown={(event) => {
        if (event.key === "Escape") close();
        event.stopPropagation();
      }}
    >
      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {open ? dialogue.text : ""}
      </span>
      {hidden ? (
        <button
          className="mascot-chat-restore"
          type="button"
          aria-label={`Mostrar ${name}`}
          onClick={() => updatePreferences({ hidden: false })}
        >
          <MyMascot size={40} />
        </button>
      ) : (
        <>
          {open && (
            <section id={bubbleId} className="mascot-chat-bubble" aria-label={`Conversa com ${name}`}>
              <div className="mascot-chat-content">
                <div className="mascot-chat-heading">
                  <span>{name}</span>
                  <button type="button" aria-label="Fechar conversa" onClick={close}>×</button>
                </div>
                <p>{dialogue.text}</p>
                {dialogue.breathe && (
                  <div className="mascot-breath" aria-live="polite">
                    <span className={`mascot-breath-orb ${breathing ? "is-breathing" : ""}`} aria-hidden="true" />
                    <span>{breathLabel}</span>
                  </div>
                )}
                <div className="mascot-chat-choices">
                  {dialogue.reply ? (
                    <button ref={continueButton} type="button" onClick={close}>
                      {breathing ? "Encerrar pausa" : "Continuar meu plantão"}
                      <span aria-hidden="true">↗</span>
                    </button>
                  ) : conversations[moment].choices.map((choice, index) => (
                    <button
                      ref={index === 0 ? firstChoice : undefined}
                      key={choice.label}
                      type="button"
                      onClick={() => choose(index)}
                    >
                      {choice.label}<span aria-hidden="true">↗</span>
                    </button>
                  ))}
                </div>
              </div>
            </section>
          )}
          <div className="mascot-chat-character">
            <div className="mascot-chat-tools">
              <button
                type="button"
                aria-label={position > .5 ? "Mover mascote para baixo" : "Mover mascote para cima"}
                onClick={() => updatePreferences({ position: position > .5 ? 0 : 1 })}
              >↕</button>
              <button
                type="button"
                aria-label={`Ocultar ${name}`}
                onClick={() => {
                  setDialogue(null);
                  updatePreferences({ hidden: true });
                }}
              >×</button>
            </div>
            <button
              ref={trigger}
              className="mascot-chat-button"
              type="button"
              aria-label={`Conversar com ${name}`}
              aria-expanded={open}
              aria-controls={open ? bubbleId : undefined}
              onPointerDown={pointerDown}
              onPointerMove={pointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onClick={toggle}
            >
              <span className="mascot-chat-figure"><MyMascot size={144} mood={mood} /></span>
              <span className="mascot-chat-dots" aria-hidden="true">•••</span>
            </button>
            <span className="mascot-chat-shadow" aria-hidden="true" />
          </div>
        </>
      )}
    </div>,
    document.body,
  );
}
