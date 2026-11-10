# Plano de melhorias e gamificação do EnaQuest

Escrito em 09/11/2026, a partir da leitura do código atual (`src/lib/game`, `src/lib/server`, telas em `src/app/app`).

> **Situação em 10/11/2026:** a Fase 1 está pronta, e a jornada do estudante (ver plano de jornada) e o mascote com lojinha de XP também. As Fases 2 a 5 deste documento seguem como roteiro; o item 2.1 (missões com recompensa) continua pendente.

## 1. Onde o projeto está

O EnaQuest já tem a base de um jogo sério. O que falta é fazer o jogador **sentir** o que o sistema já calcula.

| Já existe | Onde | O que falta para divertir |
|---|---|---|
| XP e 7 níveis (Doutorando a Preceptor) | `game/xp.ts` | O teto é 5.000 XP. Um assinante ativo chega lá em poucas semanas e a barra para de andar. |
| Rating Elo e 7 patentes | `game/rating.ts` | Subir de patente só rende um confete e uma etiqueta. |
| Sequência de dias com escudo | `game/streak.ts` | O topo mostra só "N dias". O escudo nunca aparece na tela, nem quando é ganho ou gasto. |
| 3 missões por dia | `game/progress.ts` | Completar missão **não dá nada**. Não há XP nem recompensa ligada a elas. |
| 12 conquistas | `game/progress.ts` | Ficam escondidas em Evolução, sem barra de progresso, e desbloqueiam sem cerimônia. |
| Combo de acertos | `server/answers.ts` | Aparece como etiqueta "N seguidas" a partir de 3. Não muda nada no jogo. |
| Confiança antes de responder | `QuestionRunner.tsx` | É coletada e alimenta a revisão, mas o jogador não ganha nem perde nada com ela. |
| Ligas semanais, faculdades e turmas | `server/leagues.ts` | A virada da semana acontece no cron sem nenhuma tela de resultado. |
| Plantão do Dia com ranking | `server/daily.ts` | O resultado não pode ser compartilhado. |
| PWA com service worker | `public/sw.js` | Sem notificação push, som ou vibração. |

### Três problemas que vêm antes da gamificação

1. **Conteúdo.** O piloto tem 60 questões e o Plantão consome 10 por dia. O banco acaba em 6 dias. Nenhuma mecânica segura um jogador que não tem o que responder. A produção de lotes pelo pipeline é pré-requisito de tudo abaixo.
2. **O plano grátis termina em 10 questões.** Treino, revisão e simulados são pagos, então quem não assina joga cerca de 10 minutos e não tem mais o que fazer. Como a liga é decidida por XP semanal, o grátis também não consegue competir. Isso derruba a retenção e a conversão ao mesmo tempo.
3. **Nada foi commitado.** O repositório não tem nenhum commit. Vale fazer o commit inicial antes de começar as fases.

## 2. Princípios

O comentário no topo de `xp.ts` já diz o certo: o XP premia o comportamento que ensina, não só o acerto. Tudo abaixo segue isso.

- **Nada que bloqueie o estudo.** Sem vidas, sem energia, sem espera para jogar de novo.
- **Tempo nunca entra no rating.** Modos cronometrados são opcionais e valem só XP.
- **Recompensa é cosmética ou de proteção** (escudo, moldura, título). Nunca vantagem em nota.
- **Tom de plantão, não de joguinho infantil.** O público é médico formando. A metáfora hospitalar que o app já usa (plantão, patente, preceptor, troca de plantão) é o tema.
- **Respeitar `prefers-reduced-motion`** e ter botão para desligar som, como o CSS já faz com o confete.

## 3. Fases

### Fase 1. Fazer sentir (1 a 2 semanas, sem mudar o banco)

Maior ganho de diversão pelo menor esforço. Tudo aqui é interface sobre dados que já existem.

| # | O que fazer | Arquivos |
|---|---|---|
| 1.1 | **Chama de sequência** no topo, com calendário da semana e escudos visíveis. Aviso "plantão coberto por um colega" quando o escudo é gasto e "você ganhou uma troca de plantão" quando é ganho. | `app/layout.tsx`, `answers.ts` (devolver `usedShield` e `earnedShield`, que `nextStreak` já calcula) |
| 1.2 | **Medidor de combo** que cresce a cada acerto e quebra com animação no erro. Marcos em 3, 5 e 10. | `QuestionRunner.tsx`, `globals.css` |
| 1.3 | **Barra de XP animada** depois de cada resposta, com o número subindo. Hoje o XP do topo só atualiza ao navegar. | `QuestionRunner.tsx`, `layout.tsx` |
| 1.4 | **Tela de subida de patente e de nível** em tela cheia, com o emblema novo. Hoje é uma etiqueta. | componente novo `Celebration.tsx` |
| 1.5 | **Conquista desbloqueada na hora**, em aviso com animação, e não só no fim da rodada. | `QuestionRunner.tsx` |
| 1.6 | **Som e vibração** curtos em acerto, erro, combo e subida, com botão de desligar em Conta. | hook novo `useFeedback.ts` |
| 1.7 | **Fim de rodada melhor**: XP por origem, variação de rating, maior combo, progresso das missões e botão "mais uma rodada". | `QuestionRunner.tsx` |
| 1.8 | **Conquistas com barra de progresso** e as 3 mais próximas na tela Hoje. | `evolucao/page.tsx`, `app/page.tsx` |

### Fase 2. Motivo para voltar todo dia (2 a 3 semanas)

| # | O que fazer | Observação |
|---|---|---|
| 2.1 | **Missões com recompensa.** XP por missão e um "kit do plantão" ao fechar as 3, com XP extra e chance de escudo. | Novos `kind` em `award_xp`. A trava por `ref` já impede pagar duas vezes. |
| 2.2 | **Aposta de confiança.** Marcar "certeza" e acertar rende bônus. Marcar "certeza" e errar rende zero de bônus e destaca a questão para revisão. Chutar e acertar rende menos. | Ensina calibração, que já é medida em "Sua confiança é confiável?". |
| 2.3 | **Compartilhar o Plantão** em grade de acertos e erros sem revelar as questões, no estilo Wordle, com link do app. | Web Share API. É o principal canal de crescimento gratuito via WhatsApp de turma. |
| 2.4 | **Notificações push**: plantão novo, sequência em risco às 20h, alguém passou você na liga, revisões vencidas. | Push no `sw.js` e tabela de inscrições. Limite de 1 por dia e opção de desligar por tipo. |
| 2.5 | **Marcos de sequência** em 3, 7, 14, 30, 60 e 100 dias, cada um com moldura de emblema. | Amplia as conquistas "semana" e "mês". |
| 2.6 | **Contagem regressiva para a prova** e meta semanal de questões escolhida pelo jogador. | Campo novo em `profiles`. |
| 2.7 | **Gosto de treino para o grátis**: depois do Plantão, liberar "revisar os erros de hoje" e uma rodada curta de 5 por dia. | Mexe em `isPremium` dentro de `submitAnswer`. Decisão de negócio, ver seção 5. |

### Fase 3. Modos de jogo novos (3 a 5 semanas)

| # | Modo | Como funciona |
|---|---|---|
| 3.1 | **Mapa do hospital** | Cada área da matriz do ENAMED é uma ala. Acertos enchem a ala em 5 estrelas de maestria. Substitui a lista de áreas do Treino por um mapa de progresso. |
| 3.2 | **Prova de título** | Ao encher uma ala, libera 5 questões difíceis daquela área. Passar dá o selo de especialista da área, visível no perfil e nos rankings. |
| 3.3 | **Caso em evolução** | Um paciente em 3 ou 4 questões encadeadas: admissão, exame, conduta, complicação. Exige formato novo no pipeline de conteúdo (`scripts/pipeline/schema.ts`). |
| 3.4 | **Código Azul** | Sprint opcional de 5 questões com relógio. Vale XP e ranking próprio, não mexe no rating. |
| 3.5 | **Duelo assíncrono** | Desafiar um colega da turma nas mesmas 5 questões. Cada um responde quando puder e o resultado sai quando os dois terminam. Sem tempo real, usa a estrutura de `groups`. |

### Fase 4. Social e competição (2 a 3 semanas)

| # | O que fazer |
|---|---|
| 4.1 | **Cerimônia de fim de semana**: tela de resultado da liga na primeira visita após a virada, com posição final, subida ou descida e recompensa. |
| 4.2 | **Liga ao vivo na tela Hoje**: sua posição, quem está logo acima e quantos XP faltam para passar. |
| 4.3 | **Missão da turma**: meta coletiva semanal, por exemplo 500 questões somadas. Coopera em vez de só competir. |
| 4.4 | **Convite com recompensa**: quem entra por código de turma rende escudo para os dois. |
| 4.5 | **Perfil público simples**: patente, selos de área, sequência e conquistas em destaque. |
| 4.6 | **Liga das Faculdades com temporada mensal** e título para a campeã. |

### Fase 5. Progressão de longo prazo (contínuo)

- **Mais níveis e prestígio**: estender a escala além de Preceptor (Staff, Chefe de serviço, Professor titular) com curva mais longa, ou reiniciar com estrela de prestígio.
- **Cosméticos**: molduras de emblema, títulos ao lado do apelido e temas de cor, ganhos por conquista, marco e temporada.
- **Temporadas trimestrais** alinhadas ao calendário de provas, com trilha de recompensas.
- **Eventos**: semana de uma área com XP dobrado, simulado nacional com ranking ao vivo.
- **Retrospectiva mensal** compartilhável, com questões, acerto por área e evolução do rating.

## 4. Como medir

Antes da Fase 1, registrar eventos básicos para comparar depois.

| Métrica | Por quê |
|---|---|
| Retenção em D1, D7 e D30 | Mostra se voltar todo dia funciona. |
| Taxa de conclusão do Plantão | Saúde do hábito principal. |
| Questões por sessão e sessões por semana | Mostra se "mais uma rodada" funciona. |
| Sequência mediana e uso de escudo | Mostra se a sequência prende sem frustrar. |
| Compartilhamentos por plantão concluído | Crescimento orgânico. |
| Conversão de grátis para assinante | Efeito do item 2.7. |
| Acerto em revisão e calibração de confiança | Garante que a diversão não piora o aprendizado. |

## 5. Decisões que dependem de você

1. **Quanto liberar no plano grátis** (item 2.7). Recomendo liberar a revisão dos erros do dia e 5 questões de treino, porque hoje o grátis não tem como criar hábito nem competir na liga.
2. **Liga separada para grátis e assinante**, ou liga única contando só o XP do Plantão. Recomendo liga única com XP do Plantão valendo em dobro, para o grátis continuar no jogo.
3. **Modo cronometrado** (item 3.4). É divertido, mas pode incentivar pressa. Recomendo manter fora do rating e fora da liga.

## 6. Por onde começar

Fase 1 inteira, mais os itens 2.1 (missões com recompensa) e 2.3 (compartilhar o Plantão). São as mudanças de maior efeito por esforço e nenhuma depende de conteúdo novo. Em paralelo, produzir lotes de questões, porque com 60 questões o resto do plano não se sustenta.
