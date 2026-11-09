export default function OfflinePage() {
  return (
    <main className="wrap" style={{ textAlign: "center", paddingTop: 80 }}>
      <h1 style={{ fontSize: 28 }}>Você está sem conexão</h1>
      <p className="muted" style={{ marginTop: 8 }}>
        As questões ficam no servidor para proteger o gabarito. Assim que a internet voltar, é só recarregar a página.
      </p>
    </main>
  );
}
