import { defineConfig, devices } from "@playwright/test";

// Exige o Supabase local no ar. O app sobe sozinho, com os valores do CLI.
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "line",
  use: { baseURL: "http://localhost:3000", trace: "retain-on-failure" },
  webServer: {
    command: "node scripts/dev-local.mjs dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 180_000,
  },
  projects: [
    { name: "celular", use: { ...devices["Pixel 7"] } },
  ],
});
