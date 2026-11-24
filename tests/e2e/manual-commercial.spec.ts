import { expect, test } from "@playwright/test";

const marker = process.env.MANUAL_E2E_MARKER || "local-commercial-validation";
const company = `Empresa manual ${marker}`;
const contact = `Contacte ${marker}`;
const opportunity = `Oportunitat ${marker}`;

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Correu electrònic").fill(process.env.ADMIN_EMAIL || "admin@aimetos.local");
  await page.getByLabel("Contrasenya").fill(process.env.ADMIN_PASSWORD || "AdminAimetos2026!");
  await page.getByRole("button", { name: "Iniciar sessió" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("manual creation and commercial follow-up", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/companies/new");
  await page.getByLabel("Nom comercial").fill(company);
  await page.getByRole("button", { name: "Desa l’empresa" }).click();
  await page.waitForURL(url => url.pathname.startsWith("/companies/") && url.pathname !== "/companies/new");
  const companyId = new URL(page.url()).pathname.split("/").pop()!;
  await page.getByRole("link", { name: "Edita", exact: true }).click();
  await page.getByLabel("Ciutat").fill("Terrassa validada");
  await page.getByRole("button", { name: "Desa els canvis" }).click();
  await expect(page.getByText(/Terrassa validada/)).toBeVisible();
  await page.goto(`/contacts/new?companyId=${companyId}`);
  await page.getByLabel("Nom", { exact: false }).first().fill(contact);
  await page.getByLabel("Correu electrònic").fill(`${marker}@example.test`);
  await page.getByRole("button", { name: "Desa el contacte" }).click();
  await page.waitForURL(url => url.pathname.startsWith("/contacts/") && url.pathname !== "/contacts/new");
  await page.getByRole("link", { name: "Edita", exact: true }).click();
  await page.getByLabel("Càrrec").fill("Responsable comercial");
  await page.getByRole("button", { name: "Desa els canvis" }).click();
  await expect(page.getByText(/Responsable comercial/)).toBeVisible();
  await page.getByRole("link", { name: "Crea oportunitat" }).click();
  await page.getByLabel("Títol").fill(opportunity);
  await page.getByLabel("Valor", { exact: false }).fill("1500");
  await page.getByLabel("Import recurrent").fill("190");
  await page.getByLabel("Periodicitat").selectOption("MONTHLY");
  await page.getByLabel("Data prevista d'inici").fill("2027-01-15");
  await page.getByRole("button", { name: "Desa l’oportunitat" }).click();
  await page.getByRole("link", { name: opportunity, exact: true }).click();
  await page.getByRole("link", { name: "Edita", exact: true }).click();
  await page.getByLabel("Valor", { exact: true }).fill("1750");
  await page.getByRole("button", { name: "Desa els canvis" }).click();
  await page.getByLabel("Nova nota").fill(`Reunió ${marker}: acordat enviar proposta; compromís de trucada demà.`);
  await page.getByRole("button", { name: "Afegeix nota" }).click();
  await expect(page.getByText(`Reunió ${marker}: acordat enviar proposta; compromís de trucada demà.`)).toBeVisible();
  await page.getByRole("link", { name: "Programa seguiment" }).click();
  await page.getByLabel("Títol").fill(`Seguiment ${marker}`);
  await page.getByLabel("Venciment").fill("2027-01-15T10:30");
  await page.getByRole("button", { name: "Desa la tasca" }).click();
  await expect(page.getByText(`Seguiment ${marker}`, { exact: true })).toBeVisible();
  await page.getByRole("link", { name: `Seguiment ${marker}`, exact: true }).click();
  await page.getByLabel("Venciment").fill("2027-01-16T11:00");
  await page.getByRole("button", { name: "Desa els canvis" }).click();
  await expect(page.getByText(`Seguiment ${marker}`, { exact: true })).toBeVisible();
  await page.goto("/pipeline?view=unfollowed");
  await expect(page.getByRole("link", { name: opportunity, exact: true })).toHaveCount(0);
  await page.goto("/pipeline");
  const card = page.locator("article").filter({ has: page.getByRole("link", { name: opportunity, exact: true }) });
  await card.getByRole("combobox").selectOption({ label: "Contactado" });
  await expect(card.getByRole("combobox")).toHaveValue(await page.locator('option').filter({ hasText: /^Contactado$/ }).first().getAttribute("value") || "");
});

test("manual persistence after application restart", async ({ page }) => {
  await page.goto("/pipeline");
  await page.getByRole("link", { name: opportunity, exact: true }).click();
  await expect(page).toHaveURL(/\/pipeline\/[^/?]+$/);
  await expect(page.getByText(/^Contactado · /)).toBeVisible();
  await expect(page.getByText(/Import recurrent:.*190,00/)).toBeVisible();
  await expect(page.getByText(`Seguiment ${marker}`, { exact: true })).toBeVisible();
  await expect(page.getByText(`Reunió ${marker}: acordat enviar proposta; compromís de trucada demà.`)).toBeVisible();
  await page.screenshot({ path: "test-results/opportunity-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("heading", { name: opportunity, exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/opportunity-mobile.png", fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("link", { name: company, exact: true }).click();
  await expect(page.getByText(/Terrassa validada/)).toBeVisible();
});

test("anonymous requests cannot access commercial data", async ({ browser, baseURL }) => {
  const anonymous = await browser.newContext({ baseURL });
  try {
    for (const path of ["/contacts", "/pipeline", "/tasks", "/api/exports/contacts"]) {
      const response = await anonymous.request.get(path, { maxRedirects: 0 });
      expect([302, 303, 307, 308]).toContain(response.status());
      expect(response.headers().location).toContain("/login");
    }
  } finally { await anonymous.close(); }
});
