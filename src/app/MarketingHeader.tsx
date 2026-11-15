import Link from "next/link";
import { AccessLabel } from "./AccessLabel";
import styles from "./landing.module.css";

export function MarketingHeader({ signedIn, plans = false }: { signedIn: boolean; plans?: boolean }) {
  const sections = [["#recursos", "Recursos"], ["#metodo", "Método"], ["#duvidas", "Dúvidas"]] as const;
  return (
    <header className={styles.header}>
      <div className={styles.navbar}>
        <Link href="/" className={styles.brand}>
          <span className={styles.cross} aria-hidden="true">✚</span>Ena<span>Quest</span>
        </Link>
        <nav aria-label="Navegação principal">
          {sections.map(([hash, label]) => plans
            ? <Link key={hash} href={"/" + hash}>{label}</Link>
            : <a key={hash} href={hash}>{label}</a>
          )}
          <Link href="/planos" aria-current={plans ? "page" : undefined}>Planos</Link>
        </nav>
        <Link className={styles.signIn} href={signedIn ? "/app" : "/entrar?next=%2Fapp"}>
          <AccessLabel>{signedIn ? "Abrir o app" : "Entrar no app"}</AccessLabel> <span aria-hidden="true">→</span>
        </Link>
      </div>
    </header>
  );
}
