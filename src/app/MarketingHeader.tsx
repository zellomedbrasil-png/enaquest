import Link from "next/link";
import styles from "./landing.module.css";

export function MarketingHeader({ signedIn, plans = false }: { signedIn: boolean; plans?: boolean }) {
  const home = plans ? "/" : "";
  return (
    <header className={styles.header}>
      <div className={styles.navbar}>
        <Link href="/" className={styles.brand}>
          <span className={styles.cross} aria-hidden="true">✚</span>Ena<span>Quest</span>
        </Link>
        <nav aria-label="Navegação principal">
          <Link href={home + "#recursos"}>Recursos</Link>
          <Link href={home + "#metodo"}>Como funciona</Link>
          <Link href={home + "#duvidas"}>Dúvidas</Link>
          <Link href="/planos" aria-current={plans ? "page" : undefined}>Planos</Link>
        </nav>
        <Link className={styles.signIn} href={signedIn ? "/app" : "/entrar"}>
          {signedIn ? "Abrir o app" : "Entrar"} <span aria-hidden="true">↗</span>
        </Link>
      </div>
    </header>
  );
}
