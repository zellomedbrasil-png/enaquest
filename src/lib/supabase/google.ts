import "server-only";

/**
 * Pergunta ao Supabase se o provedor Google está ligado. Assim o botão só aparece quando funciona:
 * antes da configuração no painel, o clique cairia numa página de erro crua.
 */
export async function googleEnabled(): Promise<boolean> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
      next: { revalidate: 300 },
    });
    if (!response.ok) return false;
    const settings = (await response.json()) as { external?: { google?: boolean } };
    return settings.external?.google === true;
  } catch {
    return false;
  }
}
