import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { safePath } from "@/lib/safe-path";
import { createClient } from "@/lib/supabase/server";

const TYPES: EmailOtpType[] = ["signup", "email", "recovery", "invite", "magiclink", "email_change"];

/**
 * Link dos e-mails do Supabase (confirmação e nova senha), no formato token_hash.
 * Diferente do /auth/callback, funciona mesmo quando o link é aberto em outro aparelho ou navegador.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safePath(searchParams.get("next"));

  if (tokenHash && type && TYPES.includes(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
    console.error("[auth] confirmar link:", { code: error.code, status: error.status, message: error.message });
  }
  return NextResponse.redirect(`${origin}/entrar?erro=link`);
}
