import { test, expect } from "@playwright/test";
import {
  CSV_COLUMNS,
  csvDocument,
  type CsvRow,
} from "../../apps/web/src/features/catalogue-import/csv";
const item: CsvRow = {
  external_id: "t72-phone-1",
  title: "Тестов телефон – само за проверка",
  description: "Private description must stay in the selected browser file",
  category_id: "cat:electronics/phones",
  condition: "good",
  price: "129,50",
  currency: "EUR",
  locality: "София",
  attributes_json: JSON.stringify({
    brand: "Example",
    model: "One",
    storageGB: 128,
    workingStatus: "working",
  }),
  inventory_mode: "stocked",
  quantity: "3",
  sku: "SYNTHETIC-1",
  options_json: "{}",
};
const file = (rows: CsvRow[], name = "catalogue.csv") => ({
  name,
  mimeType: "text/csv",
  buffer: Buffer.from(
    csvDocument(
      CSV_COLUMNS,
      rows.map((row) => CSV_COLUMNS.map((key) => row[key] ?? "")),
    ),
  ),
});

test("business onboarding validates locally, reports issues and clears sensitive file contents", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 793 });
  await page.goto("/sell/start?kind=business&lang=en");
  const posts: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST") posts.push(request.url());
  });
  await expect(
    page.getByRole("heading", { name: "Check your catalogue file" }),
  ).toBeVisible();
  const input = page.getByLabel("Choose a UTF-8 CSV", { exact: true });
  await input.setInputFiles(
    file([item, { ...item, external_id: "t72-phone-2" }]),
  );
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "2 of 2 rows pass file validation." }),
  ).toBeVisible();
  await input.setInputFiles(
    file([
      item,
      { ...item, external_id: " t72-phone-1 " },
      { ...item, external_id: "t72-phone-3", title: "" },
    ]),
  );
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "0 of 3 rows pass file validation." }),
  ).toBeVisible();
  await expect(
    page.getByText("This ID appears more than once", { exact: false }),
  ).toHaveCount(2);
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download issue report", exact: true })
    .click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("treido-import-issues.csv");
  const stream = await download.createReadStream();
  expect(stream).not.toBeNull();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const report = Buffer.concat(chunks).toString("utf8");
  expect(report).toContain('"external_id","field","code"');
  expect(report).toContain("duplicate_external_id");
  expect(report).not.toContain(item.description!);
  expect(posts).toEqual([]);
  await page.getByRole("button", { name: "Clear file", exact: true }).click();
  await expect(input).toBeFocused();
  await expect(page.getByText(item.title!, { exact: false })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Download issue report", exact: true }),
  ).toHaveCount(0);
  expect(await input.inputValue()).toBe("");
});

test("a late file read cannot replace the newly chosen CSV and rows are paginated", async ({
  page,
}) => {
  await page.goto("/sell/start?kind=business&lang=en");
  await page.evaluate(() => {
    const original = File.prototype.arrayBuffer;
    File.prototype.arrayBuffer = async function () {
      const buffer = await original.call(this);
      if (this.name === "slow.csv")
        await new Promise<void>((resolve) => {
          (window as Window & { releaseOldFile?: () => void }).releaseOldFile =
            resolve;
        });
      return buffer;
    };
  });
  const input = page.getByLabel("Choose a UTF-8 CSV", { exact: true });
  await input.setInputFiles(
    file([{ ...item, title: "Old delayed item" }], "slow.csv"),
  );
  await page.waitForFunction(
    () =>
      typeof (window as Window & { releaseOldFile?: () => void })
        .releaseOldFile === "function",
  );
  await input.setInputFiles(
    file(
      Array.from({ length: 26 }, (_, index) => ({
        ...item,
        external_id: "fresh-" + index,
        title: "Fresh item " + (index + 1),
      })),
      "fresh.csv",
    ),
  );
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "26 of 26 rows pass file validation." }),
  ).toBeVisible();
  await page.evaluate(() =>
    (window as Window & { releaseOldFile?: () => void }).releaseOldFile?.(),
  );
  await expect(
    page.getByText("Old delayed item", { exact: false }),
  ).toHaveCount(0);
  await expect(page.locator("[data-seller-csv-preflight] ol > li")).toHaveCount(
    25,
  );
  await page.getByRole("button", { name: "Next rows", exact: true }).click();
  await expect(page.locator("[data-seller-csv-preflight] ol > li")).toHaveCount(
    1,
  );
  await expect(
    page.getByRole("heading", { name: "Row 26: Fresh item 26", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Next rows", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Previous rows", exact: true })
    .click();
  await expect(page.locator("[data-seller-csv-preflight] ol > li")).toHaveCount(
    25,
  );
});

test("Bulgarian preparation errors stay readable at narrow and desktop widths", async ({
  page,
}) => {
  await page.goto("/sell/start?kind=business&lang=bg");
  const input = page.getByLabel("Избери CSV файл с UTF-8", { exact: true });
  await input.setInputFiles({
    name: "bad.csv",
    mimeType: "text/csv",
    buffer: Buffer.from([0xc3, 0x28]),
  });
  await expect(page.getByRole("alert")).toContainText("UTF-8");
  await input.setInputFiles(
    file([
      {
        ...item,
        title:
          "Много дълго заглавие за проверка на пренасянето на текста и достъпните контроли на малък екран",
        attributes_json: "{}",
      },
    ]),
  );
  for (const width of [320, 390, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
      "horizontal overflow at " + width,
    ).toBe(true);
  }
  await page.setViewportSize({ width: 320, height: 900 });
  await page.evaluate(() => {
    const sizes = Array.from(
      document.querySelectorAll<HTMLElement>("main, main *"),
    ).map((element) => ({
      element,
      size: Number.parseFloat(getComputedStyle(element).fontSize),
    }));
    for (const { element, size } of sizes)
      if (Number.isFinite(size)) element.style.fontSize = size * 2 + "px";
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
  await expect(
    page.getByRole("button", { name: "Изчисти файла", exact: true }),
  ).toBeVisible();
});

test("real support routes are bilingual and never simulate a sent support chat", async ({
  request,
}) => {
  for (const lang of ["en", "bg"])
    for (const route of ["/support", "/support/help", "/support/chat"]) {
      const response = await request.get(route + "?lang=" + lang);
      expect(response.status(), route + lang).toBe(200);
      const html = await response.text();
      expect(html).toContain("data-support-hub");
      expect(html).toContain("/orders?lang=" + lang);
      expect(html).toContain("/messages/reports?lang=" + lang);
      expect(html).toContain("/app/invitations?lang=" + lang);
      expect(html).not.toContain("mira@example.test");
      if (route === "/support/chat")
        expect(html).toContain(
          lang === "en"
            ? "No message has been sent"
            : "Не е изпратено съобщение",
        );
    }
});
