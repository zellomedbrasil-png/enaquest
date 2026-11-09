import { expect, test } from "@playwright/test";
import { db, makePremium, makeQuestions, PASSWORD, SECRET_TIP, signUp, todayBR } from "./support";

const LETTER = ["A", "B", "C", "D"];

test.describe("visitante", () => {
  test("vê a landing e os planos, com as restrições de pagamento claras", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Treine como é a prova");
    await expect(page.getByText("sem vínculo com o Inep")).toBeVisible();
    await page.goto("/planos");
    await expect(page.getByText("R$ 29")).toBeVisible();
    await expect(page.getByText(/não aceitamos cartão de débito/)).toBeVisible();
  });

  test("não entra na área logada", async ({ page }) => {
    for (const path of ["/app", "/app/treino", "/admin", "/assinar"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/entrar/);
    }
  });
});

test.describe.serial("aluno", () => {
  let questions: Awaited<ReturnType<typeof makeQuestions>>;
  const day = todayBR();

  test.beforeAll(async () => {
    questions = await makeQuestions(10, "Plantão");
    await db.from("daily_challenges").delete().eq("day", day);
    await db.from("daily_challenges").insert({ day, question_ids: questions.map((q) => q.id) });
  });

  test.afterAll(async () => {
    await db.from("daily_challenges").delete().eq("day", day);
  });

  test("plantão completo no celular, sem vazar gabarito antes de responder", async ({ page }) => {
    await signUp(page);
    await expect(page.getByText("Conta criada")).toBeVisible();

    // Perfil
    await page.getByLabel("Apelido nos rankings").fill(`aluno_${Date.now()}`);
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Perfil salvo")).toBeVisible();

    // Hoje
    await page.goto("/app");
    await expect(page.getByText("Plantão do Dia", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Começar plantão" })).toBeVisible();

    // O HTML e os dados da página não podem conter o comentário.
    const response = await page.goto("/app/plantao");
    const body = await response!.text();
    expect(body).not.toContain(SECRET_TIP);
    expect(body).not.toContain("correct_index");
    expect(body).not.toContain("correctIndex");

    // Responde todas: acerta 9 e erra a última.
    for (let i = 0; i < questions.length; i++) {
      const stem = page.locator(".stem");
      const text = await stem.innerText();
      const number = Number(text.match(/número (\d+)/)![1]) - 1;
      const question = questions[number];
      const pick = i === questions.length - 1 ? (question.correct + 1) % 4 : question.correct;
      await page.getByRole("radio", { name: new RegExp(`Alternativa ${LETTER[pick]}`) }).click();
      await page.getByRole("button", { name: "Tenho certeza" }).click();
      await page.getByRole("button", { name: "Responder" }).click();
      await expect(page.getByText("Em 20 segundos")).toBeVisible();
      await expect(page.getByText("Macete de prova")).toBeVisible();
      await expect(page.getByText(/Verificada por IA/).first()).toBeVisible();
      if (i === 0) {
        await expect(page.getByText(/\+\d+ XP/).first()).toBeVisible();
        await expect(page.getByText(/Nivelamento: faltam/)).toBeVisible();
      }
      if (i === questions.length - 1) {
        await expect(page.getByText("Por que você errou?")).toBeVisible();
        await page.getByRole("button", { name: "Li errado" }).click();
        await expect(page.getByText(/Plantão concluído: 9\/10/)).toBeVisible();
      }
      await page.getByRole("button", { name: "Continuar" }).click();
    }

    await expect(page.getByText("Rodada concluída")).toBeVisible();
    await expect(page.getByText("9/10")).toBeVisible();

    await page.goto("/app");
    await expect(page.getByText("Concluído: 9/10")).toBeVisible();
    await expect(page.getByText(/Ranking de hoje/)).toBeVisible();

    // Discussão da turma
    await page.goto("/app/plantao");
    await page.getByRole("link", { name: /Tema Plantão/ }).first().click();
    await page.getByRole("button", { name: "Ver discussão da turma" }).click();
    await expect(page.getByText("Ninguém comentou ainda")).toBeVisible();
    await page.getByLabel("Seu comentário").fill("Vale lembrar do critério principal do caso.");
    await page.getByRole("button", { name: "Publicar" }).click();
    await expect(page.getByText("Vale lembrar do critério principal do caso.")).toBeVisible();

    // Evolução
    await page.goto("/app/evolucao");
    await expect(page.getByRole("heading", { name: "Conquistas" })).toBeVisible();
    await expect(page.getByText("Li errado")).toBeVisible();
    await expect(page.getByText(/faz parte da assinatura/)).toBeVisible();

    // Plano grátis: treino bloqueado
    await page.goto("/app/treino");
    await expect(page.getByRole("link", { name: /Assinar por R\$ 29/ })).toBeVisible();
    await page.goto("/app/revisao");
    await expect(page.getByRole("link", { name: /Assinar por R\$ 29/ })).toBeVisible();
    await page.goto("/app/simulados");
    await expect(page.getByRole("link", { name: /Assinar por R\$ 29/ })).toBeVisible();

    // Painel editorial bloqueado
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/app$/);
  });

  test("assinante treina, revisa e vê o Termômetro aguardando dados", async ({ page }) => {
    const { id } = await signUp(page);
    await makePremium(id);

    await page.goto("/app/treino");
    await page.getByRole("button", { name: "5", exact: true }).click();
    await page.getByRole("button", { name: "Começar treino" }).click();
    await expect(page.locator(".stem")).toBeVisible();
    await page.getByRole("radio").first().click();
    await page.getByRole("button", { name: "Estou em dúvida" }).click();
    await page.getByRole("button", { name: "Responder" }).click();
    await expect(page.getByText("Em 20 segundos")).toBeVisible();

    // A dúvida entra na revisão.
    await db.from("srs_cards").update({ due: new Date(Date.now() - 60_000).toISOString() }).eq("user_id", id);
    await page.goto("/app/revisao");
    await expect(page.getByText(/1 para revisar agora/)).toBeVisible();
    await page.getByRole("radio").first().click();
    await page.getByRole("button", { name: "Responder" }).click();
    await expect(page.getByText("Em 20 segundos")).toBeVisible();

    await page.goto("/app/evolucao");
    await expect(page.getByText(/para a primeira leitura/)).toBeVisible();
    await expect(page.getByText("Fez o ENAMED 2026? Ajude a calibrar")).toBeVisible();
  });

  test("simulado com relógio, retomada e entrega", async ({ page }) => {
    const { id } = await signUp(page);
    await makePremium(id);
    const small = await makeQuestions(5, "Simulado");
    const { data: simulado } = await db
      .from("simulados")
      .insert({
        title: `Simulado E2E ${Date.now()}`,
        opens_at: new Date(Date.now() - 3_600_000).toISOString(),
        closes_at: new Date(Date.now() + 86_400_000).toISOString(),
        duration_minutes: 300,
        question_ids: small.map((q) => q.id),
        published: true,
      })
      .select("id")
      .single();

    await page.goto(`/app/simulados/${simulado!.id}`);
    await expect(page.getByLabel("Tempo restante")).toContainText(/^[45]:/);
    await page.getByRole("radio", { name: /Alternativa A/ }).click();
    await page.getByRole("button", { name: "Próxima" }).click();
    await page.getByRole("radio", { name: /Alternativa B/ }).click();
    await expect(page.getByText("2 de 5 marcadas")).toBeVisible();
    await expect(page.getByText(/Salvo/)).toBeVisible({ timeout: 12_000 });

    // Sem gabarito antes de entregar, e a tentativa continua depois de recarregar.
    const body = await (await page.goto(`/app/simulados/${simulado!.id}`))!.text();
    expect(body).not.toContain(SECRET_TIP);
    await expect(page.getByText("2 de 5 marcadas")).toBeVisible();

    await page.getByRole("button", { name: "Entregar prova" }).click();
    await expect(page.getByText(/Você deixou 3 em branco/)).toBeVisible();
    await page.getByRole("button", { name: "Entregar", exact: true }).click();
    await page.waitForURL(/resultado/);
    await expect(page.getByRole("heading", { name: "Por área" })).toBeVisible();
    await expect(page.getByText("Questões comentadas")).toBeVisible();
    await expect(page.getByText("não uma previsão da sua nota oficial")).toBeVisible();
  });

  test("turma e liga", async ({ page }) => {
    const { id } = await signUp(page);
    await makePremium(id);
    await page.goto("/app/ligas");
    await page.getByLabel("Criar turma").fill("Internato E2E");
    await page.getByRole("button", { name: "Criar", exact: true }).click();
    await expect(page.getByText("Internato E2E")).toBeVisible();
    await expect(page.getByText(/Código:/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Média de XP por aluno ativo" })).toBeVisible();
  });

  test("entrar, sair e excluir a conta", async ({ page }) => {
    const { email, id } = await signUp(page);
    await page.goto("/app/conta");
    await page.getByRole("button", { name: "Sair da conta" }).click();
    await page.waitForURL("/");
    await page.goto("/entrar");
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Senha").fill("senha-errada-123");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByText("E-mail ou senha incorretos")).toBeVisible();
    await page.getByLabel("Senha").fill(PASSWORD);
    await page.getByRole("button", { name: "Entrar" }).click();
    await page.waitForURL(/\/app$/);

    await page.goto("/app/conta");
    await page.getByText("Excluir minha conta").click();
    await page.getByLabel("Digite EXCLUIR para confirmar").fill("EXCLUIR");
    await page.getByRole("button", { name: "Excluir para sempre" }).click();
    await page.waitForURL(/conta=excluida/);
    const { data } = await db.from("profiles").select("id").eq("id", id);
    expect(data).toHaveLength(0);
  });
});

test("assinatura sem Stripe configurado avisa, sem quebrar", async ({ page }) => {
  await signUp(page);
  await page.goto("/assinar");
  await expect(page.getByText(/cartão de débito, Pix, Elo, Hipercard/)).toBeVisible();
});
