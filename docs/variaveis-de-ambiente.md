# Variáveis de ambiente

Crie um arquivo `.env.local` na raiz do projeto com as variáveis abaixo. Ele nunca deve ser versionado.

| Variável | Para que serve | Onde encontrar |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Endereço do Supabase | `npx supabase status` no ambiente local |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave pública | `npx supabase status` |
| `SUPABASE_SERVICE_ROLE_KEY` | Acesso total do servidor. Nunca expor no navegador | `npx supabase status` |
| `NEXT_PUBLIC_APP_URL` | Endereço público do app | `http://localhost:3000` no ambiente local |
| `STRIPE_SECRET_KEY` | Chave secreta da Stripe. Use só `sk_test_` até o lançamento | Painel da Stripe > Desenvolvedores |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Chave pública da Stripe (`pk_test_`) | Painel da Stripe > Desenvolvedores |
| `STRIPE_WEBHOOK_SECRET` | Confere a assinatura dos webhooks | `stripe listen` no ambiente local |
| `STRIPE_PRICE_ID` | Preço mensal de R$ 29 | Painel da Stripe > Produtos |
| `CRON_SECRET` | Protege a virada semanal das ligas | Gere um texto aleatório longo |
| `ANTHROPIC_API_KEY` | Só para gerar conteúdo em lote. O app do aluno não usa | Console da Anthropic |

Para o ambiente local, `node scripts/setup-env.mjs` cria o `.env.local` com os valores do Supabase local. As chaves da Stripe são preenchidas por você.
