/* global document, window */
import { randomUUID } from "node:crypto";
import { URL } from "node:url";
import { join } from "node:path";
import console from "node:console";
export async function exerciseInbox({
  origin,
  sellerId,
  listingId,
  threadId,
  output,
  database,
  admin,
  owner,
  other,
  api,
  req,
}) {
  const { chromium, expect } = req("@playwright/test");
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({
    viewport: { width: 393, height: 793 },
    locale: "bg-BG",
  });
  const page = await context.newPage(),
    errors = [],
    checks = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  const buyer = origin + "/messages/" + threadId + "?lang=bg&role=buyer";
  const seller =
    origin +
    "/app/sellers/" +
    sellerId +
    "/inbox/" +
    threadId +
    "?lang=bg&role=seller";
  async function check(name, work) {
    await work();
    checks.push(name);
  }
  try {
    await check(
      "actual buyer inbox loads stored messages and acknowledges unread",
      async () => {
        await page.goto(buyer);
        await expect(
          page.getByRole("heading", {
            name: "Обява за съобщения",
            exact: true,
          }),
        ).toBeVisible();
        await expect(
          page.getByText("Здравейте от продавача", { exact: true }).last(),
        ).toBeVisible();
        await expect
          .poll(
            async () =>
              (
                await api.readConversation(database, other, {
                  sellerId: null,
                  threadId,
                })
              ).readSequence,
          )
          .toBe(1);
      },
    );
    await check(
      "lost acknowledgement retains the typed message and retry creates only one row",
      async () => {
        await page
          .getByRole("textbox", { name: "Напиши съобщение" })
          .fill("Тестов отговор без дублиране");
        await page
          .getByRole("button", { name: "Изпрати", exact: true })
          .click();
        await expect(page.getByRole("alert")).toContainText("не е потвърдено");
        await expect(
          page.getByRole("textbox", { name: "Напиши съобщение" }),
        ).toHaveValue("Тестов отговор без дублиране");
        await page
          .getByRole("button", { name: "Изпрати", exact: true })
          .click();
        await expect(
          page.getByRole("textbox", { name: "Напиши съобщение" }),
        ).toHaveValue("");
        expect(
          (
            await admin.query(
              "SELECT count(*)::int AS count FROM treido.messages WHERE thread_id=$1 AND body=$2",
              [threadId, "Тестов отговор без дублиране"],
            )
          ).rows[0].count,
        ).toBe(1);
      },
    );
    await check(
      "seller sees the persisted reply on a separate full load",
      async () => {
        await page.goto(seller);
        await expect(
          page
            .getByText("Тестов отговор без дублиране", { exact: true })
            .last(),
        ).toBeVisible();
        await expect(
          page.getByRole("textbox", { name: "Напиши съобщение" }),
        ).toBeVisible();
      },
    );
    await check(
      "contact block applies server-side and buyer replies are disabled",
      async () => {
        await page
          .getByRole("button", { name: "Блокирай контакта", exact: true })
          .click();
        await expect(page.getByRole("dialog")).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(
          page.getByRole("button", { name: "Блокирай контакта", exact: true }),
        ).toBeFocused();
        await page
          .getByRole("button", { name: "Блокирай контакта", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Потвърди", exact: true })
          .click();
        await expect(
          page.getByText("Блокирал си този контакт.", { exact: true }),
        ).toBeVisible();
        await page.goto(buyer);
        await expect(
          page.getByText("Този контакт не приема съобщения.", { exact: true }),
        ).toBeVisible();
        await expect(
          page.getByRole("textbox", { name: "Напиши съобщение" }),
        ).toHaveCount(0);
      },
    );
    await check(
      "unblock restores only the chosen contact flag and enables an authorized reply",
      async () => {
        await page.goto(seller);
        await page
          .getByRole("button", { name: "Отблокирай контакта", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Потвърди", exact: true })
          .click();
        await expect(
          page.getByRole("textbox", { name: "Напиши съобщение" }),
        ).toBeVisible();
        await page.goto(buyer);
        await expect(
          page.getByRole("textbox", { name: "Напиши съобщение" }),
        ).toBeVisible();
      },
    );
    await check(
      "a real message report persists and its receipt reloads privately",
      async () => {
        await page
          .getByRole("button", { name: "Докладвай съобщението", exact: true })
          .first()
          .click();
        await page
          .getByRole("textbox", { name: "Подробности", exact: true })
          .fill("Сигнал за преглед на съобщението");
        await page
          .getByRole("button", { name: "Подай сигнал", exact: true })
          .click();
        await expect(
          page.getByRole("link", { name: "Виж сигнала", exact: true }),
        ).toBeVisible();
        await page
          .getByRole("link", { name: "Виж сигнала", exact: true })
          .click();
        await expect(
          page.getByText("Сигнал за преглед на съобщението", { exact: true }),
        ).toBeVisible();
        const reportId = new URL(page.url()).pathname.split("/").at(-1);
        expect(
          (await api.readReportDetail(database, other, reportId)).report
            .resourceKind,
        ).toBe("message");
      },
    );
    await check(
      "affected buyer submits an actual appeal without changing moderation",
      async () => {
        const report = await api.createResourceReport(database, other, {
          resourceKind: "listing",
          resourceId: listingId,
          reason: "misleading",
          details: "Browser review fixture",
          requestId: randomUUID(),
        });
        const operator = (
          await admin.query(
            "SELECT id FROM treido.users WHERE clerk_subject=$1",
            [owner.subject],
          )
        ).rows[0].id;
        await admin.query(
          "INSERT INTO treido.operator_grants(user_id,capability) VALUES($1,'reports.read'),($1,'moderation.write') ON CONFLICT(user_id,capability) DO UPDATE SET active=true",
          [operator],
        );
        await api.moderateListing(database, owner, {
          listingId,
          reportId: report.id,
          expectedRevision: 1,
          state: "restricted",
          reason: "Fixture review decision",
          requestId: randomUUID(),
        });
        await page.goto(
          origin + "/messages/reports/" + report.id + "?lang=bg&role=buyer",
        );
        await page
          .getByRole("button", { name: "Обжалвай решението", exact: true })
          .click();
        await page
          .getByRole("textbox", { name: "Подробности", exact: true })
          .fill("Моля, прегледайте това решение отново.");
        await page
          .getByRole("button", { name: "Подай обжалване", exact: true })
          .click();
        await expect(page.getByRole("status")).toContainText(
          "Обжалването е изпратено",
        );
        expect(
          (await api.readReportDetail(database, other, report.id)).decisions[0]
            .appeals,
        ).toHaveLength(1);
        expect(
          (
            await admin.query(
              "SELECT moderation_state FROM treido.listings WHERE id=$1",
              [listingId],
            )
          ).rows[0].moderation_state,
        ).toBe("restricted");
      },
    );
    for (const width of [320, 393, 1440])
      await check(
        "buyer and Studio inbox fit " + width + "px in Bulgarian",
        async () => {
          await page.setViewportSize({ width, height: 900 });
          for (const url of [buyer, seller]) {
            await page.goto(url);
            await expect(
              page.getByRole("heading", {
                name: "Обявата не е достъпна",
                exact: true,
              }),
            ).toBeVisible();
            expect(
              await page.evaluate(
                () => document.documentElement.scrollWidth <= window.innerWidth,
              ),
            ).toBe(true);
            await page.evaluate(() => document.fonts.ready);
          }
          if (width === 393 || width === 1440)
            await page.screenshot({
              path: join(output, "inbox-" + width + ".png"),
              animations: "disabled",
            });
        },
      );
    await check(
      "no application errors while executing the connected flow",
      async () => expect(errors).toEqual([]),
    );
    console.log("Inbox component checks:", checks.length, "passed");
    return { checks: checks.length };
  } finally {
    await browser.close();
  }
}
