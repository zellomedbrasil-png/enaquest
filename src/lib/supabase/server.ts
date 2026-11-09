import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Cliente ligado à sessão do usuário. Serve para autenticação, e está sujeito à RLS. */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Em Server Components não dá para gravar cookie; o proxy renova a sessão.
        }
      },
    },
  });
}
