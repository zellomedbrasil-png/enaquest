# EnaQuest

Banco de questões gamificado para o ENAMED e o ENARE acesso direto. Next.js, Supabase e Stripe.

## Ver funcionando no computador

Precisa do Docker Desktop aberto.

```bash
npx supabase start
node scripts/dev-seed-demo.mjs
node scripts/dev-local.mjs dev
```

Abra http://localhost:3000/entrar com a conta de demonstração que o segundo comando mostra. `dev-seed-demo` apaga o banco local e publica o piloto **sem checagem, só nesta máquina**.

## Telas e identidade visual

- `/guia-de-estilo`: página viva com paleta, tipografia, componentes e o mascote.
- `/app/mascote`: escolha entre oito companheiros de jornada, cada um com nome e ilustração próprios.
- `/app/como-funciona`: a jornada do dia e o glossário.

## Testes

```bash
npm test
npm run test:db
npm run test:e2e
```

## Conteúdo

Um comando só gera, checa, importa e publica (precisa de `ANTHROPIC_API_KEY`, exceto para prova oficial):

```bash
npm run content:publicar -- content/blueprints/lote.json   # roteiro novo
npm run content:publicar -- content/lots/piloto-001.json   # lote já escrito
npm run content:publicar -- content/lots/enamed-2025-c1.json  # prova oficial, publica direto
```

- Passou em tudo (escrita, resolução às cegas, checagem de fatos e, no alto risco, uma segunda resolução às cegas por outro modelo): vai ao ar com o selo "Verificada por IA".
- Levantou dúvida: entra fora do ar, em "Precisa de olho" no `/admin`.
- `--simular` faz as checagens sem tocar no banco. O resultado de cada questão fica em `.checagem.json` e só é refeito quando a questão muda.
- Depois de publicada, a questão sai do ar sozinha com 3 denúncias, estatística de acerto incoerente ou data de validade vencida.
- O `/admin` é só a caixa de exceções: publicar, retirar ou marcar "Revisei" (selo "Revisada por médico"). Para corrigir, edite o lote e rode o comando de novo.

### Questões diárias (OpenRouter)

O GitHub Actions roda `npm run content:diario` todo dia às 6h (Brasília): escolhe temas de `content/temas/temario.json` na proporção do ENAMED, prefere os menos usados, escreve com o DeepSeek V4 Pro, confere com o Gemini 3.6 Flash (e, no alto risco, com o Qwen 3.7 Max) e publica. O que levanta dúvida fica em "Precisa de olho" no `/admin`. Custo estimado: cerca de US$ 0,04 por questão, com limite diário em `QUESTOES_LIMITE_DOLARES` (padrão US$ 3).

- Segredos no GitHub: `OPENROUTER_API_KEY` e `SUPABASE_SERVICE_ROLE_KEY`.
- Para trocar modelos ou quantidade, crie as variáveis `QUESTOES_MODELO_AUTOR`, `QUESTOES_MODELO_VERIFICADOR`, `QUESTOES_MODELO_SEGUNDA_OPINIAO` e `QUESTOES_POR_DIA` na aba Variables.
- Para rodar na hora: Actions > Questões diárias > Run workflow.

## Documentos

- `docs/matriz-enamed-2026.md`: análise do caderno oficial.
- `docs/piloto-001-relatorio.md`: como o piloto foi feito e o que revisar.
- `docs/variaveis-de-ambiente.md`: chaves necessárias.
