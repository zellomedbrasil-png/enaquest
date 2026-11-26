// Traduz os erros do Supabase Auth em mensagens que dizem o que fazer.
// A mensagem genérica escondia a causa (e-mail que não sai, limite de envio, banco fora do ar).

type AuthErrorLike = { code?: string; message?: string; status?: number } | null | undefined;

export type AuthProblem =
  | "rate_limit"
  | "email_send"
  | "email_invalid"
  | "weak_password"
  | "signup_disabled"
  | "not_confirmed"
  | "invalid_credentials"
  | "unavailable"
  | "unknown";

export function classifyAuthError(error: AuthErrorLike): AuthProblem {
  const code = error?.code ?? "";
  const message = (error?.message ?? "").toLowerCase();
  if (code.startsWith("over_") || message.includes("rate limit") || error?.status === 429) return "rate_limit";
  if (message.includes("sending") && message.includes("email")) return "email_send";
  if (code === "email_address_invalid" || code === "validation_failed" || message.includes("invalid format")) return "email_invalid";
  if (code === "weak_password" || message.includes("password should")) return "weak_password";
  if (code === "signup_disabled" || code === "email_provider_disabled" || message.includes("signups not allowed")) return "signup_disabled";
  if (code === "email_not_confirmed" || message.includes("not confirmed")) return "not_confirmed";
  if (code === "invalid_credentials" || message.includes("invalid login credentials")) return "invalid_credentials";
  if ((error?.status ?? 0) >= 500 || message.includes("database error") || message.includes("fetch failed")) return "unavailable";
  return "unknown";
}

const MESSAGES: Record<AuthProblem, string> = {
  rate_limit: "Muitas tentativas em pouco tempo. Espere alguns minutos e tente de novo.",
  email_send: "Não conseguimos enviar o e-mail de confirmação agora. Tente de novo em alguns minutos.",
  email_invalid: "Esse e-mail não parece válido. Confira o endereço.",
  weak_password: "Essa senha é fraca demais. Use pelo menos 8 caracteres, misturando letras e números.",
  signup_disabled: "Os cadastros estão fechados no momento.",
  not_confirmed: "Você ainda não confirmou seu e-mail. Abra o link que enviamos, ou peça um novo abaixo.",
  invalid_credentials: "E-mail ou senha incorretos.",
  unavailable: "O serviço está fora do ar agora. Tente de novo em alguns minutos.",
  unknown: "Não foi possível concluir. Tente de novo em alguns minutos.",
};

export function authErrorMessage(problem: AuthProblem): string {
  return MESSAGES[problem];
}
