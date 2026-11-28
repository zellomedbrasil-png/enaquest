import { NextResponse } from "next/server";
import { safePath } from "@/lib/safe-path";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const safe = safePath(searchParams.get("next"));
  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Conta que o Google acabou de criar passa pelo onboarding.
      const isNew = Date.now() - Date.parse(data.user.created_at) < 2 * 60_000;
      return NextResponse.redirect(`${origin}${isNew && safe === "/app" ? "/comecar" : safe}`);
    }
    console.error("[auth] callback", { code: error.code, status: error.status, message: error.message });
  }
  return NextResponse.redirect(`${origin}/entrar?erro=google`);
}
