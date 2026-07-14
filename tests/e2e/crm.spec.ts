import { expect, test, type Page } from "@playwright/test";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Correu electrònic").fill(process.env.ADMIN_EMAIL ?? "admin@aimetos.local");
  await page.getByLabel("Contrasenya").fill(process.env.ADMIN_PASSWORD ?? "AdminAimetos2026!");
  await page.getByRole("button", { name: "Iniciar sessió" }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: /Bon dia|Dashboard|Resum comercial/i })).toBeVisible();
}

test.describe.serial("fluxos crítics del CRM", () => {
  test.setTimeout(60_000);

  test("login, formulari públic, contacte i oportunitat", async ({ page }) => {
    await login(page);
    const marker = Date.now();
    const email = `e2e-${marker}@example.test`;
    const company = `Empresa E2E ${marker}`;
    const phone = `6${String(marker).slice(-8)}`;
    await page.goto("/f/demanar-una-demo?utm_source=playwright&utm_campaign=critical-flow");
    await page.getByLabel(/^Nom \*/).fill("Eulàlia");
    await page.getByLabel(/Cognoms/).fill("E2E");
    await page.getByLabel(/Correu electrònic/).fill(email);
    await page.getByLabel(/Telèfon/).fill(phone);
    await page.getByLabel(/Empresa/).fill(company);
    await page.getByLabel(/En què et podem ajudar/).fill("Validació end-to-end del CRM.");
    for (const checkbox of await page.getByRole("checkbox").all()) await checkbox.check();
    await page.getByRole("button", { name: "Enviar sol·licitud" }).click();
    await expect(page.getByRole("heading", { name: "Sol·licitud rebuda" })).toBeVisible();

    await page.goto(`/search?q=${encodeURIComponent(email)}`);
    await expect(page.locator('a[href^="/contacts/"]').filter({ hasText: email })).toBeVisible();
    await page.goto("/pipeline");
    await expect(page.getByRole("heading", { name: company, exact: false })).toBeVisible();
  });

  test("pressupost, acceptació pública i conversió en factura", async ({ page }) => {
    await login(page);
    await page.goto("/quotes/new");
    await page.locator("#companyId").selectOption({ label: "Alba Arquitectura Demo" });
    await page.locator("#contactId").selectOption({ label: "Laia Serra" });
    await page.getByLabel("Descripció").fill(`Servei E2E ${Date.now()}`);
    await page.getByLabel("Quantitat").fill("1");
    await page.getByLabel("Preu unitari (€)").fill("1250,00");
    await page.getByRole("button", { name: "Crear pressupost" }).click();
    await page.waitForURL((url) => url.pathname.startsWith("/quotes/") && url.pathname !== "/quotes/new");
    const internalQuoteUrl = page.url();
    await page.getByRole("button", { name: "Enviar per correu" }).click();
    const publicLink = page.getByRole("link", { name: "Enllaç públic" });
    await expect(publicLink).toBeVisible();
    const publicHref = await publicLink.getAttribute("href");
    expect(publicHref).toBeTruthy();

    await page.goto(publicHref!);
    await page.getByLabel("Comentari opcional").fill("Acceptat per la prova E2E");
    await page.getByRole("button", { name: "Acceptar pressupost" }).click();
    await expect(page.getByText("Pressupost acceptat correctament")).toBeVisible();
    const pdf = await page.request.get(`${publicHref}/pdf`);
    expect(pdf.ok()).toBe(true);
    expect(pdf.headers()["content-type"]).toContain("application/pdf");
    expect((await pdf.body()).subarray(0, 4).toString()).toBe("%PDF");

    await page.goto(internalQuoteUrl);
    await page.getByRole("button", { name: "Convertir en factura" }).click();
    await expect(page).toHaveURL(/\/invoices\/[^/]+$/);
    await expect(page.getByText("Factura manual")).not.toBeVisible();
    await page.getByRole("button", { name: "Emetre i enviar" }).click();
    await expect(page.getByRole("link", { name: "Enllaç públic" })).toBeVisible();
  });
});
