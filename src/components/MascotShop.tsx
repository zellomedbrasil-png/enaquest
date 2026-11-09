"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { buyItemAction, equipAction, renameMascotAction } from "@/app/actions";
import { CATALOG, findItem, itemStatus, NAME_MAX, NAME_MIN, OPTIONAL_SLOTS, SLOT_LABEL, SLOTS, withItem, type Look, type ShopItem, type Slot } from "@/lib/game/shop";
import type { MascotView } from "@/lib/server/mascot";
import { playCue } from "@/lib/ui/feedback";
import { Coach } from "./Coach";
import { Mascot, type Mood } from "./Mascot";
import { ToastStack, useToasts } from "./Toasts";

const sameLook = (a: Look, b: Look) => SLOTS.every((slot) => a[slot] === b[slot]);

export function MascotShop({ initial }: { initial: MascotView }) {
  const [view, setView] = useState(initial);
  const [slot, setSlot] = useState<Slot>("body");
  /** Item que ainda não é da pessoa e está sendo provado no boneco. */
  const [trying, setTrying] = useState<ShopItem | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [mood, setMood] = useState<Mood>("feliz");
  const [error, setError] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [pending, start] = useTransition();
  const { toasts, push } = useToasts();
  const confirmRef = useRef<HTMLDivElement>(null);
  const moodTimer = useRef<number | null>(null);

  const owned = new Set(view.owned);
  const shown = trying ? withItem(view.look, trying.slot, trying.id) : view.look;
  const items = CATALOG.filter((item) => item.slot === slot);

  useEffect(() => {
    if (confirming) confirmRef.current?.focus();
  }, [confirming]);
  useEffect(() => () => void (moodTimer.current && window.clearTimeout(moodTimer.current)), []);

  const celebrate = () => {
    setMood("comemorando");
    if (moodTimer.current) window.clearTimeout(moodTimer.current);
    moodTimer.current = window.setTimeout(() => setMood("feliz"), 2600);
  };

  const wear = (look: Look) => {
    if (sameLook(look, view.look)) return;
    setError(null);
    const before = view;
    setView({ ...view, look });
    start(async () => {
      const result = await equipAction(look);
      if (result.ok) setView(result.data);
      else {
        setView(before);
        setError(result.message);
      }
    });
  };

  const pick = (item: ShopItem) => {
    setError(null);
    setConfirming(false);
    if (owned.has(item.id)) {
      setTrying(null);
      // Tocar de novo no que já está vestindo tira a peça, quando o lugar permite ficar vazio.
      const wearing = view.look[item.slot] === item.id;
      wear(withItem(view.look, item.slot, wearing && OPTIONAL_SLOTS.includes(item.slot) ? null : item.id));
    } else {
      setTrying(trying?.id === item.id ? null : item);
    }
  };

  const buy = () => {
    if (!trying) return;
    const item = trying;
    setError(null);
    start(async () => {
      const result = await buyItemAction(item.id);
      setConfirming(false);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setView(result.data);
      setTrying(null);
      celebrate();
      playCue("achievement");
      push({ tone: "gold", title: `${item.name} agora é seu`, text: `Você trocou ${item.price} XP. Seu nível e sua liga continuam iguais.` });
    });
  };

  const rename = (form: FormData) => {
    const name = String(form.get("name") ?? "");
    setError(null);
    start(async () => {
      const result = await renameMascotAction(name);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setView((current) => ({ ...current, name: result.data }));
      setEditingName(false);
    });
  };

  const tryingStatus = trying ? itemStatus(trying, owned, view.balance) : null;

  return (
    <div className="shop">
      <ToastStack toasts={toasts} />

      <section className="card shop-stage" aria-label="Seu mascote">
        <Mascot look={shown} mood={trying ? "neutro" : mood} size={200} name={view.name} />

        {editingName ? (
          <form action={rename} className="shop-name-form">
            <label className="label" htmlFor="mascot-name">
              Nome do mascote
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <input id="mascot-name" name="name" className="input" defaultValue={view.name} minLength={NAME_MIN} maxLength={NAME_MAX} required autoFocus />
              <button className="btn btn-primary btn-sm" disabled={pending}>
                Salvar
              </button>
            </div>
          </form>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <h2 style={{ fontSize: 24 }}>{view.name}</h2>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingName(true)}>
              Mudar nome
            </button>
          </div>
        )}

        <div className="shop-balance" role="status">
          <span className="eyebrow">XP para gastar</span>
          <strong className="display">{view.balance}</strong>
        </div>
        <p className="dim" style={{ fontSize: 13.5 }}>
          Trocar XP aqui não baixa seu nível nem sua posição na liga.
        </p>

        {trying && tryingStatus && (
          <div className="shop-try">
            <p>
              Provando: <strong>{trying.name}</strong>
            </p>
            {tryingStatus === "merit_locked" && <p className="muted">Este item não se compra. {trying.merit?.text} para liberar.</p>}
            {tryingStatus === "insufficient" && (
              <>
                <p className="muted">
                  Custa {trying.price} XP. Faltam <strong>{trying.price - view.balance} XP</strong>.
                </p>
                <Link href="/app" className="btn btn-primary">
                  Ganhar XP no Plantão
                </Link>
              </>
            )}
            {tryingStatus === "can_buy" && !confirming && (
              <button type="button" className="btn btn-primary" onClick={() => setConfirming(true)}>
                Comprar por {trying.price} XP
              </button>
            )}
            {tryingStatus === "can_buy" && confirming && (
              <div ref={confirmRef} tabIndex={-1} role="group" aria-label="Confirmar troca" className="shop-confirm">
                <p>
                  Trocar <strong>{trying.price} XP</strong> por {trying.name}? Seu nível e sua liga não mudam. Não há devolução.
                </p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
                  <button type="button" className="btn btn-primary" disabled={pending} onClick={buy}>
                    {pending ? "Trocando…" : "Confirmar troca"}
                  </button>
                  <button type="button" className="btn btn-ghost" disabled={pending} onClick={() => setConfirming(false)}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => (setTrying(null), setConfirming(false))}>
              Parar de provar
            </button>
          </div>
        )}

        {error && (
          <div className="alert alert-error" role="alert">
            {error}
          </div>
        )}
      </section>

      <section aria-labelledby="lojinha" className="shop-list">
        <h2 id="lojinha" style={{ fontSize: 20 }}>
          Guarda-roupa e lojinha
        </h2>
        <Coach id="lojinha" title="Como funciona a lojinha">
          Toque em uma peça para provar no boneco. O que já é seu veste na hora; o resto você troca por XP.
        </Coach>

        <div className="shop-tabs" role="group" aria-label="Tipo de item">
          {SLOTS.map((key) => (
            <button
              key={key}
              type="button"
              className="btn btn-ghost btn-sm"
              aria-pressed={slot === key}
              style={slot === key ? { borderColor: "var(--accent)", background: "var(--tip-soft)" } : undefined}
              onClick={() => setSlot(key)}
            >
              {SLOT_LABEL[key]}
            </button>
          ))}
        </div>

        <ul className="shop-grid">
          {items.map((item) => {
            const status = itemStatus(item, owned, view.balance);
            const wearing = view.look[item.slot] === item.id;
            const isTrying = trying?.id === item.id;
            const badge =
              status === "owned"
                ? wearing
                  ? "Vestindo"
                  : "É seu"
                : status === "merit_locked"
                  ? "Mérito"
                  : `${item.price} XP`;
            const action =
              status === "owned"
                ? wearing
                  ? OPTIONAL_SLOTS.includes(item.slot)
                    ? "tirar"
                    : "vestindo"
                  : "vestir"
                : isTrying
                  ? "parar de provar"
                  : "provar";
            return (
              <li key={item.id}>
                <button
                  type="button"
                  className={`shop-item ${wearing ? "wearing" : ""} ${isTrying ? "trying" : ""}`}
                  aria-pressed={wearing || isTrying}
                  aria-label={`${item.name}. ${item.description} ${badge}. Toque para ${action}.`}
                  onClick={() => pick(item)}
                >
                  <Mascot look={withItem(view.look, item.slot, item.id)} mood="feliz" size={92} decorative />
                  <span className="shop-item-name">{item.name}</span>
                  <span className="shop-item-desc">{status === "merit_locked" ? item.merit?.text : item.description}</span>
                  <span className={`status ${status === "owned" ? (wearing ? "status-today" : "status-ok") : status === "can_buy" ? "status-muted" : "status-pend"}`}>
                    {badge}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {findItem(view.look.character) && (
          <p className="dim" style={{ fontSize: 13.5 }}>
            As miniaturas mostram cada peça no seu mascote atual.
          </p>
        )}
      </section>
    </div>
  );
}
