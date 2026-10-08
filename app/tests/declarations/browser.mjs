/* global window: readonly, document: readonly, Event: readonly */
import fs from "node:fs/promises";
import path from "node:path";
import console from "node:console";
import assert from "node:assert/strict";
import { startDeclarationFixture } from "./fixture-server.mjs";

const fixture = await startDeclarationFixture();
const { chromium } = fixture.req("@playwright/test");
const outcomes = [];
const errors = [];
const external = [];
let browser;
let failure;
let currentContext;
const componentSelector = "[data-rendered-component]";
const labels = {
  en: {
    prepare: "Review decision",
    confirm: "Confirm decision",
    reason: "Reason for the seller",
    retry: "Retry this decision",
    reload: "Reload current state",
    resume: "Keep reason and review current state",
    checking: "Checking current access…",
    current: "Open current declaration",
  },
  bg: {
    prepare: "Прегледай решението",
    confirm: "Потвърди решението",
    reason: "Основание за търговеца",
    retry: "Повтори това решение",
    reload: "Зареди текущото състояние",
    resume: "Запази основанието и прегледай текущото състояние",
    checking: "Проверка на текущия достъп…",
    current: "Отвори текущата декларация",
  },
};
try {
  browser = await chromium.launch({ headless: true });
  async function open(query = "", viewport = { width: 393, height: 793 }) {
    if (currentContext) await currentContext.close();
    currentContext = await browser.newContext({ viewport });
    await currentContext.route("**/*", (route) => {
      if (
        route
          .request()
          .url()
          .startsWith(fixture.url + "/")
      )
        return route.continue();
      external.push(route.request().url());
      return route.abort();
    });
    const page = await currentContext.newPage();
    page.on("pageerror", (error) => errors.push(String(error)));
    page.on("dialog", (dialog) => {
      void dialog.accept();
    });
    await page.goto(fixture.url + "/?" + query);
    await page.locator("[data-fixture-controls]").waitFor();
    return page;
  }
  function component(page) {
    return page.locator(componentSelector);
  }
  async function calls(page, kind, subject) {
    return page.evaluate(
      ([kind, subject]) =>
        window.__declarationFixture
          .requests()
          .filter(
            (request) =>
              (!kind || request.kind === kind) &&
              (!subject || request.subject === subject),
          ),
      [kind, subject],
    );
  }
  async function next(page, kind, subject) {
    await page.waitForFunction(
      ([kind, subject]) =>
        window.__declarationFixture
          ?.requests()
          .some(
            (request) =>
              !request.done &&
              request.kind === kind &&
              request.subject === subject,
          ),
      [kind, subject],
    );
    return (await calls(page, kind, subject))
      .filter((request) => !request.done)
      .at(-1);
  }
  async function settle(page, request, outcome = "success") {
    await page.evaluate(
      ([id, outcome]) => window.__declarationFixture.settle(id, outcome),
      [request.id, outcome],
    );
  }
  async function ready(page, subject = "operator-A") {
    await component(page)
      .getByText(subject + "-PRIVATE-test business", { exact: true })
      .waitFor();
  }
  async function noPrivate(page, subject = "operator-A") {
    const markup = await component(page).innerHTML();
    assert(!markup.includes(subject + "-PRIVATE-"), markup);
    assert(!markup.includes("A-ONLY-REASON"), markup);
  }
  async function prepare(page, reason, language = "en") {
    await component(page)
      .getByRole("textbox", { name: labels[language].reason, exact: true })
      .fill(reason);
    await component(page)
      .getByRole("button", { name: labels[language].prepare, exact: true })
      .click();
    await page.getByRole("dialog").waitFor();
  }
  async function confirm(page, language = "en", subject = "operator-A") {
    await page
      .getByRole("dialog")
      .getByRole("button", { name: labels[language].confirm, exact: true })
      .click();
    return next(page, "write", subject);
  }

  let page = await open("auto=0");
  await noPrivate(page);
  await settle(page, await next(page, "read", "operator-A"));
  await ready(page);
  await prepare(page, "A-ONLY-REASON");
  const oldWrite = await confirm(page);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  const oldRead = await next(page, "read", "operator-A");
  const switchedMarkup = await page.evaluate(() => {
    window.__declarationFixture.setAuth("operator-B");
    return document.querySelector("[data-rendered-component]").innerHTML;
  });
  assert(!switchedMarkup.includes("operator-A-PRIVATE-"));
  assert(!switchedMarkup.includes("A-ONLY-REASON"));
  await settle(page, oldRead);
  await settle(page, oldWrite);
  await noPrivate(page);
  await page
    .getByRole("button", { name: "Open B review", exact: true })
    .click();
  await settle(page, await next(page, "read", "operator-B"), "NOT_AVAILABLE");
  await noPrivate(page);
  await component(page)
    .getByRole("button", { name: labels.en.reload, exact: true })
    .click();
  await settle(page, await next(page, "read", "operator-B"));
  await ready(page, "operator-B");
  const bDraft = await component(page).getByRole("textbox").inputValue();
  assert.equal(bDraft, "");
  outcomes.push(
    "A→B conceals A facts/reason immediately; delayed A read/write do not restore them; failed B read stays private; new B route recovers independently",
  );

  page = await open("auto=0");
  await settle(page, await next(page, "read", "operator-A"));
  await ready(page);
  await prepare(page, "A-ONLY-REASON");
  const logoutWrite = await confirm(page);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  const logoutRead = await next(page, "read", "operator-A");
  await page
    .getByRole("button", { name: "Log out fixture", exact: true })
    .click();
  await noPrivate(page);
  await settle(page, logoutRead);
  await settle(page, logoutWrite);
  await noPrivate(page);
  assert.equal(await component(page).getByRole("textbox").count(), 0);
  outcomes.push(
    "Logout hides private facts and editable reason; deferred reads/writes cannot reopen the form",
  );

  page = await open();
  await ready(page);
  await prepare(page, "Controlled exact retry reason");
  const uncertain = await confirm(page);
  assert.equal(uncertain.args.actorKey, "a".repeat(64));
  assert.equal(uncertain.args.input.expectedDeclarationRevision, 1);
  assert.equal(uncertain.args.input.expectedSetupRevision, 1);
  assert.equal(await component(page).getByRole("textbox").isDisabled(), true);
  await settle(page, uncertain, "committed-unconfirmed");
  await component(page)
    .getByRole("button", { name: labels.en.retry, exact: true })
    .waitFor();
  await page.reload();
  await component(page)
    .getByRole("button", { name: labels.en.retry, exact: true })
    .waitFor();
  assert.equal(
    await component(page).getByRole("textbox").inputValue(),
    "Controlled exact retry reason",
  );
  await component(page)
    .getByRole("button", { name: labels.en.retry, exact: true })
    .click();
  const retried = await next(page, "write", "operator-A");
  assert.deepEqual(retried.args, uncertain.args);
  await settle(page, retried);
  await component(page)
    .getByText("Declaration decision recorded.", { exact: true })
    .waitFor();
  assert.equal(
    await page.locator("[data-fixture-committed]").textContent(),
    "1",
  );
  assert.equal(
    await component(page)
      .getByRole("button", { name: labels.en.retry, exact: true })
      .count(),
    0,
  );
  outcomes.push(
    "Unknown committed outcome survives full page reload; retry sends the exact actor/request/revisions/reason and recovers one synthetic receipt even when source is already decided",
  );

  page = await open();
  await ready(page);
  await prepare(page, "Keep this reason after stale setup");
  const rejected = await confirm(page);
  await page.evaluate(() => window.__declarationFixture.changeSetup());
  await settle(page, rejected, "CONFLICT");
  await component(page)
    .getByRole("button", { name: labels.en.resume, exact: true })
    .click();
  await component(page)
    .getByRole("button", { name: labels.en.prepare, exact: true })
    .waitFor();
  assert.equal(
    await component(page).getByRole("textbox").inputValue(),
    "Keep this reason after stale setup",
  );
  await component(page)
    .getByRole("button", { name: labels.en.prepare, exact: true })
    .click();
  const revised = await confirm(page);
  assert.equal(revised.args.input.expectedSetupRevision, 2);
  assert.equal(revised.args.input.expectedDeclarationRevision, 1);
  assert.notEqual(revised.args.input.requestId, rejected.args.input.requestId);
  assert.equal(revised.args.input.reason, rejected.args.input.reason);
  await settle(page, revised);
  outcomes.push(
    "A definite conflict requires deliberate current-state review, preserves the reason and captures new setup revision/request identity",
  );

  page = await open("auto=0");
  await settle(page, await next(page, "read", "operator-A"));
  await ready(page);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  const earlier = await next(page, "read", "operator-A");
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  const current = await next(page, "read", "operator-A");
  await settle(page, current, "stale");
  await component(page)
    .getByRole("link", { name: labels.en.current, exact: true })
    .waitFor();
  await settle(page, earlier);
  assert.equal(await component(page).getByRole("textbox").isDisabled(), true);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await settle(page, await next(page, "read", "operator-A"), "FORBIDDEN");
  await noPrivate(page);
  outcomes.push(
    "Latest read epoch wins; delayed older success cannot restore review permission; revoked read conceals all private facts",
  );

  page = await open();
  await ready(page);
  await page
    .getByRole("checkbox", {
      name: "Fail sessionStorage (form recovery)",
      exact: true,
    })
    .check();
  await prepare(page, "Retained when browser storage fails");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: labels.en.confirm, exact: true })
    .click();
  assert.equal((await calls(page, "write")).length, 0);
  await page.keyboard.press("Escape");
  assert.equal(
    await component(page).getByRole("textbox").inputValue(),
    "Retained when browser storage fails",
  );
  assert.equal(
    await component(page)
      .getByRole("button", { name: labels.en.prepare, exact: true })
      .isDisabled(),
    true,
  );
  await component(page)
    .getByRole("button", { name: labels.en.retry, exact: true })
    .waitFor();
  await page
    .getByRole("checkbox", {
      name: "Fail sessionStorage (form recovery)",
      exact: true,
    })
    .uncheck();
  await page
    .getByRole("checkbox", {
      name: "Fail localStorage (unrelated to this form)",
      exact: true,
    })
    .check();
  await component(page)
    .getByRole("button", { name: labels.en.retry, exact: true })
    .click();
  const persisted = await next(page, "write", "operator-A");
  assert.equal(
    persisted.args.input.reason,
    "Retained when browser storage fails",
  );
  assert.equal(persisted.args.input.expectedDeclarationRevision, 1);
  assert.equal(persisted.args.input.expectedSetupRevision, 1);
  const recovered = await page.evaluate(() => {
    const keys = Object.keys(window.sessionStorage).filter((key) =>
      key.startsWith("treido-contact-v1:treido-declaration-review:"),
    );
    return keys.map((key) => ({
      key,
      value: window.sessionStorage.getItem(key),
    }));
  });
  assert.equal(recovered.length, 1);
  assert.deepEqual(
    JSON.parse(recovered[0].value).attempt,
    persisted.args.input,
  );
  assert(!recovered[0].value.includes("operator-A-PRIVATE-"));
  assert(!recovered[0].value.includes("contactEmail"));
  assert(!recovered[0].value.includes("contactAddress"));
  await settle(page, persisted);
  outcomes.push(
    "Failed session storage keeps input and submits zero commands; recovery permits submission after storage returns; failed local storage has no effect; browser draft excludes contact facts",
  );

  page = await open();
  await ready(page);
  await prepare(page, "Keyboard confirmation test");
  for (let index = 0; index < 6; index++) {
    await page.keyboard.press("Tab");
    const focus = await page.evaluate(() => ({
      inside: document.querySelector("dialog").contains(document.activeElement),
      modal: document.querySelector("dialog").matches(":modal"),
      focused: document.hasFocus(),
      activeTag: document.activeElement.tagName,
      activeLabel: document.activeElement.getAttribute("aria-label"),
    }));
    assert.equal(focus.modal, true, JSON.stringify({ index, focus }));
    // Native Tab navigation may reach browser chrome, never the app background.
    assert(
      focus.inside || (!focus.focused && focus.activeTag === "BODY"),
      JSON.stringify({ index, focus }),
    );
  }
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("dialog").count(), 0);
  assert.equal(
    await component(page)
      .getByRole("button", { name: labels.en.prepare, exact: true })
      .evaluate((element) => element === document.activeElement),
    true,
  );
  assert.equal((await calls(page, "write")).length, 0);
  await page
    .getByRole("button", { name: "Corrupt stored input", exact: true })
    .click();
  await component(page)
    .getByText(
      "The saved review input is invalid. Discard it before preparing another decision.",
      { exact: true },
    )
    .waitFor();
  await component(page)
    .getByRole("button", { name: "Discard invalid input", exact: true })
    .click();
  assert.equal(await component(page).getByRole("textbox").inputValue(), "");
  outcomes.push(
    "Native confirmation dialog retains keyboard focus, Escape restores opener without a command, and corrupted recovery requires deliberate discard",
  );

  for (const language of ["en", "bg"])
    for (const width of [320, 393, 1440]) {
      page = await open("lang=" + language + "&long=1", {
        width,
        height: width === 1440 ? 1000 : 793,
      });
      await component(page).locator("[data-declaration-review]").waitFor();
      await component(page)
        .getByRole("button", { name: labels[language].prepare, exact: true })
        .waitFor();
      const dimensions = await page.evaluate(() => ({
        document: document.documentElement.scrollWidth,
        viewport: window.innerWidth,
        component: document
          .querySelector("[data-rendered-component]")
          .getBoundingClientRect().width,
      }));
      assert(
        dimensions.document <= dimensions.viewport + 1,
        JSON.stringify({ language, width, dimensions }),
      );
      await prepare(
        page,
        language === "bg"
          ? "Прегледано контролирано основание ".repeat(25)
          : "Controlled review reason with long content ".repeat(25),
        language,
      );
      const dialog = await page.getByRole("dialog").boundingBox();
      assert(dialog.x >= -1 && dialog.x + dialog.width <= width + 1);
      await page.screenshot({
        path: path.join(
          fixture.output,
          `SYNTHETIC-${language}-${width}-confirmation.png`,
        ),
        fullPage: true,
      });
      await page.keyboard.press("Escape");
      await page.screenshot({
        path: path.join(
          fixture.output,
          `SYNTHETIC-${language}-${width}-review.png`,
        ),
        fullPage: true,
      });
      outcomes.push(
        `${language}/${width}: actual CSS, maximum-length synthetic facts/reason, viewport overflow and bounded confirmation; screenshot saved for manual acceptance`,
      );
    }
  assert.deepEqual(errors, []);
  assert.deepEqual(external, []);
} catch (error) {
  failure = error;
} finally {
  if (currentContext) await currentContext.close();
  if (browser) await browser.close();
  await fixture.close();
  const result = {
    passed: !failure,
    outcomes,
    errors,
    external,
    failure: failure ? String(failure) : null,
    fixtureOnly: true,
    sourceComponentAndCssUnchanged: true,
    authModelSynthetic: true,
    actualClerkVerification: false,
    realOperatorAuthorityVerified: false,
    nativeDatabaseVerified: false,
    providerIntegrationVerified: false,
    visualApproval: false,
  };
  await fs.writeFile(
    path.join(fixture.output, "result.json"),
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result, null, 2));
}
if (failure) throw failure;
