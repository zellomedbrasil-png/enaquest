# EnaQuest

Banco de questões gamificado para o ENAMED e o ENARE acesso direto. Next.js, Supabase e Stripe.

## Ver funcionando no computador

Precisa do Docker Desktop aberto.

```bash
npx supabase start
node scripts/dev-seed-demo.mjs
node scripts/dev-local.mjs dev
```

Abra http://localhost:3000/entrar com a conta de demonstração que o segundo comando mostra. `dev-seed-demo` apaga o banco local e publica o piloto **sem revisão, só nesta máquina**.

## Testes

```bash
npm test
npm run test:db
npm run test:e2e
```

## Conteúdo

1. `npm run content:pipeline -- entrada.json saida.json` gera um lote (precisa de `ANTHROPIC_API_KEY`).
2. `npm run content:import -- saida.json` importa como rascunho.
3. A revisão e a publicação acontecem em `/admin`, por um médico.

## Documentos

- `docs/matriz-enamed-2026.md`: análise do caderno oficial.
- `docs/piloto-001-relatorio.md`: como o piloto foi feito e o que revisar.
- `docs/variaveis-de-ambiente.md`: chaves necessárias.
