import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { db, makePremium, makeQuestions, signUp, todayBR } from "./support";

// Regras WCAG 2.x A e AA. Falha se houver qualquer violação séria ou crítica.
async function scan(page: Page, label: string) {
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  const serious = result.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  const summary = serious.map((v) => `${v.id} (${v.nodes.length}): ${v.nodes[0]?.html.slice(0, 120)}`);
  expect(summary, `Violações em ${label}`).toEqual([]);
}

test.describe.serial("acessibilidade", () => {
  const day = todayBR();

  test.beforeAll(async () => {
    const questions = await makeQuestions(10, "Acessibilidade");
    await db.from("daily_challenges").delete().eq("day", day);
    await db.from("daily_challenges").insert({ day, question_ids: questions.map((q) => q.id) });
  });

  test.afterAll(async () => {
    await db.from("daily_challenges").delete().eq("day", day);
  });

  test("telas principais, sem violações sérias", async ({ page }) => {
    const { id } = await signUp(page);
    await makePremium(id);

    await scan(page, "boas-vindas");
    await page.goto("/app");
    await scan(page, "hoje");
    await page.goto("/app/estudar");
    await scan(page, "estudar");
    await page.goto("/app/ligas");
    await scan(page, "ligas");
    await page.goto("/app/evolucao");
    await scan(page, "evolução");
    await page.goto("/app/conta");
    await scan(page, "conta");
    await page.goto("/app/como-funciona");
    await scan(page, "como funciona");
    await page.goto("/guia-de-estilo");
    await scan(page, "guia de estilo");
  });

  test("questão antes e depois de responder", async ({ page }) => {
    await signUp(page);
    await page.goto("/app/plantao");
    await expect(page.locator(".stem")).toBeVisible();
    await scan(page, "questão");
    await page.getByRole("radio").first().click();
    await page.getByRole("button", { name: "Responder" }).click();
    await expect(page.getByText("Em 20 segundos")).toBeVisible();
    await scan(page, "questão respondida");
  });
});
