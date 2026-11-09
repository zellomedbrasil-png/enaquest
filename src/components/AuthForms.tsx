"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset, signIn, signUp, updatePassword, type AuthState } from "@/app/actions";

function Feedback({ state }: { state: AuthState }) {
  if (state.error) {
    return (
      <div className="alert alert-error" role="alert">
        {state.error}
      </div>
    );
  }
  if (state.notice) {
    return (
      <div className="alert alert-ok" role="status">
        {state.notice}
      </div>
    );
  }
  return null;
}

export function SignInForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(signIn, {});
  return (
    <form action={action} style={{ display: "grid", gap: 12 }}>
      <input type="hidden" name="next" value={next ?? ""} />
      <div>
        <label className="label" htmlFor="email">
          E-mail
        </label>
        <input id="email" name="email" type="email" className="input" autoComplete="email" required defaultValue={state.email} key={state.email} />
      </div>
      <div>
        <label className="label" htmlFor="password">
          Senha
        </label>
        <input id="password" name="password" type="password" className="input" autoComplete="current-password" required minLength={8} />
      </div>
      <Feedback state={state} />
      <button className="btn btn-primary" disabled={pending}>
        {pending ? "Entrando…" : "Entrar"}
      </button>
      <p className="muted" style={{ fontSize: 14, display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <Link href="/cadastrar">Criar conta</Link>
        <Link href="/esqueci-senha">Esqueci a senha</Link>
      </p>
    </form>
  );
}

export function SignUpForm() {
  const [state, action, pending] = useActionState(signUp, {});
  return (
    <form action={action} style={{ display: "grid", gap: 12 }}>
      <div>
        <label className="label" htmlFor="email">
          E-mail
        </label>
        <input id="email" name="email" type="email" className="input" autoComplete="email" required defaultValue={state.email} key={state.email} />
      </div>
      <div>
        <label className="label" htmlFor="password">
          Senha (mínimo de 8 caracteres)
        </label>
        <input id="password" name="password" type="password" className="input" autoComplete="new-password" required minLength={8} />
      </div>
      <label style={{ display: "flex", gap: 8, fontSize: 14, alignItems: "flex-start" }}>
        <input type="checkbox" name="accept" required style={{ marginTop: 4 }} />
        <span>
          Li e aceito os <Link href="/termos">termos de uso</Link> e a <Link href="/privacidade">política de privacidade</Link>.
        </span>
      </label>
      <Feedback state={state} />
      <button className="btn btn-primary" disabled={pending}>
        {pending ? "Criando…" : "Criar conta grátis"}
      </button>
      <p className="muted" style={{ fontSize: 14 }}>
        Já tem conta? <Link href="/entrar">Entrar</Link>
      </p>
    </form>
  );
}

export function ResetForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, {});
  return (
    <form action={action} style={{ display: "grid", gap: 12 }}>
      <div>
        <label className="label" htmlFor="email">
          E-mail
        </label>
        <input id="email" name="email" type="email" className="input" autoComplete="email" required defaultValue={state.email} key={state.email} />
      </div>
      <Feedback state={state} />
      <button className="btn btn-primary" disabled={pending}>
        Enviar link
      </button>
    </form>
  );
}

export function NewPasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, {});
  return (
    <form action={action} style={{ display: "grid", gap: 12 }}>
      <div>
        <label className="label" htmlFor="password">
          Nova senha
        </label>
        <input id="password" name="password" type="password" className="input" autoComplete="new-password" required minLength={8} />
      </div>
      <Feedback state={state} />
      <button className="btn btn-primary" disabled={pending}>
        Salvar senha
      </button>
    </form>
  );
}
