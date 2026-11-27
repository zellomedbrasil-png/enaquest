import Link from "next/link";
import { AccessLabel } from "./AccessLabel";
import styles from "./landing.module.css";

export function MarketingHeader({ signedIn, plans = false, tools = false, method = false }: { signedIn: boolean; plans?: boolean; tools?: boolean; method?: boolean }) {
  const elsewhere = plans || tools || method;
  const sections = [["#recursos", "Recursos"], ["#duvidas", "Dúvidas"]] as const;
  return (
    <header className={styles.header}>
      <div className={styles.navbar}>
        <Link href="/" className={styles.brand}>
          <span className={styles.cross} aria-hidden="true">✚</span>Ena<span>Quest</span>
        </Link>
        <nav aria-label="Navegação principal">
          {sections.map(([hash, label]) => elsewhere
            ? <Link key={hash} href={"/" + hash}>{label}</Link>
            : <a key={hash} href={hash}>{label}</a>
          )}
          <Link href="/metodo" aria-current={method ? "page" : undefined}>Método</Link>
          <Link href="/ferramentas" aria-current={tools ? "page" : undefined}>Ferramentas</Link>
          <Link href="/planos" aria-current={plans ? "page" : undefined}>Planos</Link>
        </nav>
        <Link className={styles.signIn} href={signedIn ? "/app" : "/entrar?next=%2Fapp"}>
          <AccessLabel>{signedIn ? "Abrir o app" : "Entrar no app"}</AccessLabel> <span aria-hidden="true">→</span>
        </Link>
      </div>
    </header>
  );
}
