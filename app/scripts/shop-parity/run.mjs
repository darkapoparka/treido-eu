import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { chromium } from "@playwright/test";
import sharp from "../../apps/web/node_modules/sharp/dist/index.mjs";
import { flowRecipes } from "./recipes.mjs";
import { createLoadingReplay } from "./loading-replay.mjs";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ROOT = path.resolve(__dirname, "../..");
const REF_ROOT = path.join(ROOT, "references/shop");
const QA_ROOT = path.join(ROOT, ".qa/shop-parity");
fs.mkdirSync(QA_ROOT, { recursive: true });
const manifest = JSON.parse(
  fs.readFileSync(path.join(REF_ROOT, "manifest.json"), "utf8"),
);
const BASE_URL = process.env.SHOP_PARITY_BASE_URL || "http://127.0.0.1:6412";
const target = new URL(BASE_URL);
if (
  !["127.0.0.1", "localhost", "[::1]"].includes(target.hostname) ||
  target.username ||
  target.password ||
  !["http:", "https:"].includes(target.protocol)
) {
  throw new Error(
    "Shop parity may only inspect the owned loopback preview, never a live service.",
  );
}
const WIDTH = 393;
const HEIGHT = 793;
const SOURCE_NORMALIZED_HEIGHT = 892;
const SOURCE_TOP_CROP = 59;
const BAD_PIXEL_THRESHOLD = 12;
const pausedClocks = new WeakSet();
const installedClocks = new WeakSet();

function routeHint(flowNo) {
  if (flowNo === 1) return ["onboarding", "/onboarding"];
  if (flowNo === 2 || flowNo === 42) return ["home", "/"];
  if (flowNo === 3) return ["home-notifications", "/notifications"];
  if (flowNo === 4) return ["home-deals", "/deals"];
  if (flowNo >= 5 && flowNo <= 6) return ["following", "/following"];
  if (flowNo >= 7 && flowNo <= 13) return ["saved", "/saved"];
  if ([14, 16].includes(flowNo))
    return ["store", "/stores/kitsch/collections/whats-new"];
  if (flowNo === 15) return ["store", "/stores/kitsch/video"];
  if (flowNo >= 17 && flowNo <= 19) return ["product", "/products/shea-butter"];
  if (flowNo === 20 || flowNo === 22 || flowNo === 23)
    return ["cart", "/products/shampoo-bag"];
  if (flowNo === 21) return ["checkout", "/products/shampoo-bag"];
  if (flowNo >= 24 && flowNo <= 30)
    return ["checkout", "/checkout?store=kitsch"];
  if (flowNo === 31) return ["checkout", "/orders/REF-1001/receipt"];
  if (flowNo === 32 || flowNo === 37 || flowNo === 38)
    return ["product", "/products/shea-butter"];
  if (flowNo >= 33 && flowNo <= 36)
    return ["reviews", "/products/shea-butter/reviews"];
  if (flowNo === 39) return ["store", "/stores/kitsch/reviews"];
  if (flowNo === 40) return ["store", "/stores/kitsch/search"];
  if (flowNo === 41 || flowNo === 96) return ["store", "/stores/kitsch"];
  if (flowNo === 97) return ["store", "/stores/kitsch/info"];
  if (flowNo === 43 || flowNo === 44 || flowNo === 48 || flowNo === 49)
    return ["search", flowNo === 48 ? "/search?q=Jeans" : "/search"];
  if (flowNo >= 45 && flowNo <= 47) return ["assistant", "/assistant"];
  if (flowNo === 50) return ["explore", "/explore"];
  if (flowNo === 51) return ["explore", "/explore/Beauty"];
  if (flowNo === 52) return ["minis", "/minis"];
  if (flowNo >= 53 && flowNo <= 56) return ["minis-sol", "/minis/sol"];
  if (flowNo === 57) return ["minis-skin", "/minis/skin"];
  if (flowNo === 58) return ["minis-look", "/minis/look"];
  if (flowNo === 59) return ["minis-gift", "/minis/gift"];
  if (flowNo === 60) return ["orders", "/orders"];
  if (flowNo >= 61 && flowNo <= 63) return ["orders", "/orders/REF-1001"];
  if (flowNo >= 64 && flowNo <= 65)
    return ["orders", "/orders/REF-1001?view=tracking"];
  if (flowNo === 66) return ["orders", "/orders/archived"];
  if (flowNo === 67) return ["orders", "/orders/REF-1001/review"];
  if (flowNo === 68) return ["orders", "/orders/new"];
  if (
    flowNo === 69 ||
    flowNo === 80 ||
    flowNo === 81 ||
    flowNo === 83 ||
    flowNo === 93
  )
    return [
      flowNo >= 80 && flowNo <= 81
        ? "account-payments"
        : flowNo === 83
          ? "account-addresses"
          : "account-profile",
      "/profile",
    ];
  if (flowNo >= 70 && flowNo <= 77) return ["account-profile", "/account"];
  if (flowNo === 78) return ["account-people", "/account/people"];
  if (flowNo === 79) return ["orders", "/orders/history"];
  if (flowNo === 82)
    return [
      "account-payments",
      "/account/payments?view=detail&id=card-source-4263&return=profile",
    ];
  if (flowNo === 84) return ["account-addresses", "/account/addresses"];
  if (flowNo === 85) return ["account-security", "/account/security"];
  if (flowNo === 86) return ["account-notifications", "/account/notifications"];
  if (flowNo === 87 || flowNo === 88)
    return ["account-connections", "/account/connections"];
  if (flowNo === 89) return ["account-privacy", "/account/privacy"];
  if (flowNo === 90) return ["support", "/support"];
  if (flowNo === 91) return ["support", "/support/chat"];
  if (flowNo === 92) return ["support", "/about"];
  if (flowNo === 94) return ["login", "/login"];
  if (flowNo === 95) return ["widgets", "/widgets"];
  return ["unclassified", "/"];
}
function parseArgs(argv) {
  const out = { command: argv[0] || "help" };
  for (let i = 1; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) out[key] = true;
    else {
      out[key] = next;
      i += 1;
    }
  }
  return out;
}

function allFrames() {
  return manifest.flows.flatMap((flow, flowIndex) => {
    const flowNo = flowIndex + 1;
    const [hintFamily, hintRoute] = routeHint(flowNo);
    const recipe = flowRecipes[flowNo];
    return flow.screens.map((screen, frameIndex) => ({
      id: `f${String(flowNo).padStart(3, "0")}-${String(frameIndex + 1).padStart(3, "0")}`,
      flowNo,
      frameNo: frameIndex + 1,
      flowId: flow.id,
      title: flow.title,
      reference: path.join(REF_ROOT, screen.file),
      source: screen,
      family: recipe?.family || hintFamily,
      route: recipe?.startUrl || hintRoute,
      recipeFrame: recipe?.frames?.[frameIndex] || null,
      mappingStatus: recipe?.frames?.[frameIndex]?.unresolved
        ? "needs-replay"
        : recipe?.frames?.[frameIndex]
          ? "reproducible"
          : "route-hint",
    }));
  });
}
function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function serializeFrame(frame) {
  return {
    id: frame.id,
    flowNo: frame.flowNo,
    frameNo: frame.frameNo,
    flowId: frame.flowId,
    title: frame.title,
    family: frame.family,
    route: frame.route,
    queryState: frame.route.includes("?") ? frame.route.split("?")[1] : "",
    state: frame.recipeFrame?.state || null,
    notes: frame.recipeFrame?.notes || null,
    setupActions: frame.recipeFrame?.actions || [],
    scrollPosition:
      frame.recipeFrame?.actions?.findLast?.((a) => a.type === "scroll")?.y ??
      null,
    overlayState: frame.recipeFrame?.overlay || "none",
    mappingStatus: frame.mappingStatus,
    scoreable: frame.mappingStatus === "reproducible",
    masks: frame.recipeFrame?.masks ?? [],
    entry: frame.recipeFrame?.entry ?? null,
    reference: path.relative(ROOT, frame.reference).replaceAll("\\", "/"),
    sourceWidth: frame.source.width,
    sourceHeight: frame.source.height,
  };
}

function writeFrameMap() {
  const frames = allFrames();
  const payload = {
    viewport: { width: WIDTH, height: HEIGHT },
    sourceNormalization: {
      width: WIDTH,
      height: SOURCE_NORMALIZED_HEIGHT,
      cropTop: SOURCE_TOP_CROP,
      cropHeight: HEIGHT,
    },
    flows: manifest.flows.length,
    frames: frames.length,
    reproducibleFrames: frames.filter(
      (frame) => frame.mappingStatus === "reproducible",
    ).length,
    entries: frames.map(serializeFrame),
  };
  fs.writeFileSync(
    path.join(QA_ROOT, "frame-map.json"),
    JSON.stringify(payload, null, 2),
  );
  return payload;
}
function roleLocator(page, action) {
  const options = { name: action.name };
  if (action.exact !== undefined) options.exact = action.exact;
  const scope = action.withinDialog ? page.getByRole("dialog") : page;
  const locator = action.selector
    ? scope.locator(action.selector)
    : action.label
      ? scope.getByLabel(action.label, { exact: action.exact })
      : scope.getByRole(action.role, options);
  return action.nth === undefined ? locator : locator.nth(action.nth);
}

async function perform(page, action, loadingReplay) {
  if (action.type === "holdRsc") {
    loadingReplay.holdRsc(action.url);
  } else if (action.type === "waitRscHeld") {
    await loadingReplay.waitRsc();
  } else if (action.type === "releaseRsc") {
    await loadingReplay.releaseRsc();
  } else if (action.type === "delayCatalog") {
    loadingReplay.delayCatalog(action.url, action.ms);
  } else if (action.type === "waitCatalogDelayed") {
    await loadingReplay.waitCatalog();
  } else if (action.type === "click") {
    await roleLocator(page, action).click();
  } else if (action.type === "clickSelector") {
    await page.locator(action.selector).first().click();
  } else if (action.type === "fill") {
    await roleLocator(page, action).fill(action.value);
  } else if (action.type === "select") {
    await roleLocator(page, action).selectOption(action.value);
  } else if (action.type === "check") {
    await roleLocator(page, action).setChecked(action.checked ?? true);
  } else if (action.type === "uploadAsset") {
    if (!/^[a-z0-9-]+$/.test(action.key))
      throw new Error("Invalid local artwork key");
    const response = await page.request.get(
      `${BASE_URL}/api/reference-media/${action.key}`,
    );
    if (!response.ok())
      throw new Error(`Reference artwork ${action.key}: ${response.status()}`);
    await roleLocator(page, action).setInputFiles({
      name: `${action.key}.webp`,
      mimeType: "image/webp",
      buffer: await response.body(),
    });
  } else if (action.type === "blur") {
    await roleLocator(page, action).evaluate((node) => node.blur());
  } else if (action.type === "scroll") {
    const override = process.env.SHOP_PARITY_SCROLL_OVERRIDE;
    const y = override && action.y !== 0 ? Number(override) : action.y;
    await page.evaluate((targetY) => window.scrollTo(0, targetY), y);
  } else if (action.type === "anchor") {
    await settle(page);
    const locator = roleLocator(page, action);
    await locator.waitFor({ state: "visible" });
    await locator.evaluate((node, targetY) => {
      const rect = node.getBoundingClientRect();
      window.scrollBy(0, rect.top - targetY);
    }, action.y);
  } else if (action.type === "pauseClock") {
    if (!installedClocks.has(page)) {
      await page.clock.install();
      installedClocks.add(page);
    }
    await page.clock.pauseAt(
      new Date(await page.evaluate(() => Date.now() + 60_000)),
    );
    pausedClocks.add(page);
  } else if (action.type === "advanceClock") {
    if (!pausedClocks.has(page))
      throw new Error("Advance requires a paused capture clock");
    await page.clock.runFor(action.ms);
  } else if (action.type === "resumeClock") {
    await page.clock.resume();
    pausedClocks.delete(page);
  } else if (action.type === "waitVisible") {
    await roleLocator(page, action).waitFor({
      state: "visible",
      timeout: action.timeoutMs,
    });
  } else if (action.type === "waitUrl") {
    await page.waitForURL(action.url);
  } else if (action.type === "wait") {
    await page.waitForTimeout(action.ms);
  } else if (action.type === "goto") {
    if (!action.url.startsWith("/") || action.url.startsWith("//"))
      throw new Error("Replay navigation must remain local");
    await page.goto(`${BASE_URL}${action.url}`, {
      waitUntil: "domcontentloaded",
    });
    await page
      .locator('[data-shop-interactive="true"]')
      .first()
      .waitFor({ state: "attached" });
  } else if (action.type === "viewport") {
    if (
      action.width !== 393 ||
      !Number.isInteger(action.height) ||
      action.height < 200 ||
      action.height > 793
    )
      throw new Error(
        "Only source-width keyboard viewport reductions are allowed",
      );
    await page.setViewportSize({ width: action.width, height: action.height });
  } else if (action.type === "anchorSelector") {
    await settle(page);
    await page
      .locator(action.selector)
      .first()
      .evaluate(
        (node, y) => window.scrollBy(0, node.getBoundingClientRect().top - y),
        action.y,
      );
  } else if (action.type === "scrollElement") {
    await page
      .locator(action.selector)
      .evaluate((node, position) => node.scrollTo(position), {
        top: action.y ?? 0,
        left: action.x ?? 0,
      });
  } else if (action.type === "key") {
    await page.keyboard.press(action.key);
  } else {
    throw new Error(`Unknown action type: ${action.type}`);
  }
  await page.waitForTimeout(60);
}
async function settle(page) {
  await page.waitForLoadState("domcontentloaded");
  // Streamed route images can be inserted after the first visible heading.
  // Wait for the current DOM's decoded images before measuring scroll anchors.
  await page.waitForFunction(() =>
    [...document.images].every(
      (image) =>
        !image.getAttribute("src") ||
        (image.complete && image.naturalWidth > 0),
    ),
  );
  await page.evaluate(async () => {
    await document.fonts.ready;
    // Background photographs (including pseudo-elements) are not document.images.
    // Decode them too: a cold request must not produce a scored blank backdrop.
    const backgroundUrls = new Set();
    for (const element of document.querySelectorAll("*")) {
      if (!element.getClientRects().length) continue;
      for (const pseudo of [null, "::before", "::after"]) {
        const background = getComputedStyle(element, pseudo).backgroundImage;
        for (const match of background.matchAll(
          /url\((?:"([^"]*)"|'([^']*)'|([^)]*))\)/g,
        )) {
          backgroundUrls.add(match[1] ?? match[2] ?? match[3]);
        }
      }
    }
    await Promise.all([
      ...[...document.images].map((image) =>
        image.getAttribute("src") ? image.decode() : Promise.resolve(),
      ),
      ...[...backgroundUrls].map(async (url) => {
        const image = new Image();
        image.src = url;
        await image.decode();
      }),
    ]);
  });
  const painted = page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  // Keep font/image and two-paint readiness even when a short recorded state
  // is sampled under Playwright's clock. No application state is injected.
  if (pausedClocks.has(page)) await page.clock.runFor(50);
  await painted;
}

async function normalizeReference(sourcePath, outputPath) {
  await sharp(sourcePath)
    .resize(WIDTH, SOURCE_NORMALIZED_HEIGHT, {
      fit: "fill",
      kernel: sharp.kernel.lanczos3,
    })
    .extract({
      left: 0,
      top: SOURCE_TOP_CROP,
      width: WIDTH,
      height: HEIGHT,
    })
    .png()
    .toFile(outputPath);
}

async function rawRgb(imagePath) {
  const result = await sharp(imagePath)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (result.info.width !== WIDTH || result.info.height !== HEIGHT)
    throw new Error(
      `Unexpected image size ${result.info.width}x${result.info.height}: ${imagePath}`,
    );
  return result.data;
}
function inMask(x, y, masks) {
  return masks.some(
    (mask) =>
      x >= mask.x &&
      x < mask.x + mask.width &&
      y >= mask.y &&
      y < mask.y + mask.height,
  );
}

async function compareImages(referencePath, livePath, masks = []) {
  const reference = await rawRgb(referencePath);
  const live = await rawRgb(livePath);
  const heat = Buffer.alloc(WIDTH * HEIGHT * 3);
  const overlay = Buffer.alloc(WIDTH * HEIGHT * 3);
  let sumAbs = 0;
  let sumSq = 0;
  let pixels = 0;
  let badPixels = 0;

  for (let p = 0; p < WIDTH * HEIGHT; p += 1) {
    const x = p % WIDTH;
    const y = Math.floor(p / WIDTH);
    const offset = p * 3;
    let pixelAbs = 0;
    for (let channel = 0; channel < 3; channel += 1) {
      const diff = Math.abs(
        reference[offset + channel] - live[offset + channel],
      );
      overlay[offset + channel] = Math.round(
        (reference[offset + channel] + live[offset + channel]) / 2,
      );
      pixelAbs += diff;
      if (!inMask(x, y, masks)) {
        sumAbs += diff;
        sumSq += diff * diff;
      }
    }
    if (!inMask(x, y, masks)) {
      pixels += 1;
      const meanPixelAbs = pixelAbs / 3;
      if (meanPixelAbs > BAD_PIXEL_THRESHOLD) badPixels += 1;
      const intensity = Math.min(255, Math.round(meanPixelAbs * 4));
      heat[offset] = intensity;
      heat[offset + 1] = 0;
      heat[offset + 2] = 0;
    }
  }

  const channels = pixels * 3;
  return {
    metrics: {
      maePct: channels ? (100 * sumAbs) / (255 * channels) : null,
      rmsePct: channels ? (100 * Math.sqrt(sumSq / channels)) / 255 : null,
      badPixelPct: pixels ? (100 * badPixels) / pixels : null,
      comparedPixels: pixels,
      maskedPixels: WIDTH * HEIGHT - pixels,
      badPixelThreshold: BAD_PIXEL_THRESHOLD,
    },
    heat,
    overlay,
  };
}

async function writeRgb(buffer, outputPath) {
  await sharp(buffer, {
    raw: { width: WIDTH, height: HEIGHT, channels: 3 },
  })
    .png()
    .toFile(outputPath);
}
export function replayStartForFrame(frames, frameNo) {
  if (!Number.isInteger(frameNo) || frameNo < 1 || frameNo > frames.length)
    throw new RangeError("Frame number is outside the replay recipe");
  let start = 0;
  for (let index = 0; index < frameNo; index += 1)
    if (frames[index].entry) start = index;
  return start;
}

// Reuse only consecutive states from the same recorded entry. A failed replay,
// explicit fixture entry, skipped frame, or next flow gets a fresh context.
export function canContinueReplay(session, frame, replayStart) {
  return Boolean(
    session &&
    !session.afterCaptureAdvanced &&
    session.flowNo === frame.flowNo &&
    session.replayStart === replayStart &&
    session.nextFrameIndex === frame.frameNo - 1,
  );
}

export async function closeCaptureSession(session) {
  try {
    await session.loadingReplay.dispose();
  } finally {
    await session.context.close();
  }
}

async function captureFrame(browser, frame, runDir, replay = null) {
  if (!frame.recipeFrame) throw new Error(`No replay recipe for ${frame.id}`);
  const recipe = flowRecipes[frame.flowNo];
  const replayStart = replayStartForFrame(recipe.frames, frame.frameNo);
  const entry = recipe.frames[replayStart].entry ?? {};
  const startUrl = entry.startUrl ?? recipe.startUrl;
  const scenario = entry.scenario ?? recipe.scenario;
  if (!startUrl.startsWith("/") || startUrl.startsWith("//"))
    throw new Error("Replay entry must be a local route");
  const frameDir = path.join(runDir, frame.id);
  ensureDir(frameDir);
  const referencePath = path.join(frameDir, "reference.png");
  const livePath = path.join(frameDir, "live.png");
  let session = canContinueReplay(replay?.session, frame, replayStart)
    ? replay.session
    : null;
  if (!session) {
    if (replay?.session) await closeCaptureSession(replay.session);
    const context = await browser.newContext({
      viewport: { width: WIDTH, height: HEIGHT },
      deviceScaleFactor: 1,
      reducedMotion: "reduce",
    });
    await context.route("**/*", async (route) => {
      try {
        if (new URL(route.request().url()).origin === new URL(BASE_URL).origin)
          await route.continue();
        else await route.abort();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (
          !/already handled|context or browser has been closed/i.test(message)
        )
          throw error;
      }
    });
    if (scenario)
      await context.addCookies([
        {
          name: "shop-reference-scenario",
          value: scenario,
          url: BASE_URL,
          httpOnly: true,
          sameSite: "Lax",
        },
      ]);
    const page = await context.newPage();
    const loadingReplay = createLoadingReplay(page, BASE_URL);
    const browserErrors = [];
    page.on("pageerror", (error) => browserErrors.push(error.message));

    session = {
      context,
      page,
      loadingReplay,
      browserErrors,
      flowNo: frame.flowNo,
      replayStart,
      nextFrameIndex: replayStart,
      initialized: false,
    };
    if (replay) replay.session = session;
  }
  const { page, loadingReplay, browserErrors } = session;
  let passed = false;

  try {
    if (!session.initialized) {
      await loadingReplay.install();
      page.setDefaultTimeout(10_000);
      await page.goto(`${BASE_URL}${startUrl}`, {
        waitUntil: "domcontentloaded",
      });
      await page
        .locator('[data-shop-interactive="true"]')
        .first()
        .waitFor({ state: "attached" });
      if (
        scenario &&
        (await page.locator("html").getAttribute("data-reference-scenario")) !==
          scenario
      )
        throw new Error(
          `Scenario not enabled by the reference server: ${scenario}`,
        );
      await page.addStyleTag({
        content:
          "html{scroll-behavior:auto!important}*{caret-color:transparent!important}" +
          (process.env.SHOP_PARITY_INJECT_CSS || ""),
      });
      session.initialized = true;
    }
    for (
      let index = session.nextFrameIndex;
      index < frame.frameNo;
      index += 1
    ) {
      for (const action of recipe.frames[index].actions || []) {
        await perform(page, action, loadingReplay);
      }
    }
    session.nextFrameIndex = frame.frameNo;
    await settle(page);
    const guard = frame.recipeFrame.captureGuard;
    const assertCaptureState = async () => {
      if (guard && !(await roleLocator(page, guard).isVisible()))
        throw new Error(
          `Required capture state is no longer visible: ${frame.id}`,
        );
    };
    await assertCaptureState();
    await normalizeReference(frame.reference, referencePath);
    const viewport = page.viewportSize();
    const captureUrl = page.url();
    const screenshot = await page.screenshot({
      fullPage: false,
      animations: "disabled",
    });
    await assertCaptureState();
    for (const action of frame.recipeFrame.afterCapture || [])
      await perform(page, action, loadingReplay);
    if (viewport.height < HEIGHT) {
      const masks = frame.recipeFrame.masks ?? [];
      for (let y = viewport.height; y < HEIGHT; y += 1)
        for (let x = 0; x < WIDTH; x += 1) {
          if (!inMask(x, y, masks))
            throw new Error(
              "A reduced viewport may only pad explicitly masked system pixels",
            );
        }
      await sharp(screenshot)
        .extend({ bottom: HEIGHT - viewport.height, background: "white" })
        .png()
        .toFile(livePath);
    } else fs.writeFileSync(livePath, screenshot);
    const comparison = await compareImages(
      referencePath,
      livePath,
      frame.recipeFrame.masks || [],
    );
    await writeRgb(comparison.overlay, path.join(frameDir, "overlay.png"));
    await writeRgb(
      comparison.heat,
      path.join(frameDir, "difference-heatmap.png"),
    );
    // Post-capture checks may release a held request. Start the next frame
    // from its recorded entry instead of releasing that request twice.
    session.afterCaptureAdvanced = Boolean(
      frame.recipeFrame.afterCapture?.length,
    );
    passed = true;
    return {
      ...serializeFrame(frame),
      status: "scored",
      url: captureUrl,
      continuationUrl: frame.recipeFrame.afterCapture?.length
        ? page.url()
        : undefined,
      scenario: scenario ?? "default",
      replayEntryFrame: replayStart + 1,
      afterCaptureVerified: (frame.recipeFrame.afterCapture?.length ?? 0) > 0,
      browserErrors,
      ...comparison.metrics,
      artifacts: {
        reference: path.relative(ROOT, referencePath).replaceAll("\\", "/"),
        live: path.relative(ROOT, livePath).replaceAll("\\", "/"),
        overlay: path
          .relative(ROOT, path.join(frameDir, "overlay.png"))
          .replaceAll("\\", "/"),
        heatmap: path
          .relative(ROOT, path.join(frameDir, "difference-heatmap.png"))
          .replaceAll("\\", "/"),
      },
    };
  } catch (error) {
    await page
      .screenshot({ path: path.join(frameDir, "failure.png") })
      .catch(() => undefined);
    const body = await page
      .locator("body")
      .innerText()
      .catch(() => "Body unavailable during failure capture");
    fs.writeFileSync(
      path.join(frameDir, "failure.txt"),
      `${page.url()}\n${body}\n${String(error)}\n${JSON.stringify(browserErrors)}`,
    );
    throw error;
  } finally {
    if (!replay || !passed) {
      if (replay) replay.session = null;
      await closeCaptureSession(session);
    }
  }
}

function selectFrames(args) {
  let frames = allFrames();
  if (args.flow)
    frames = frames.filter((frame) => frame.flowNo === Number(args.flow));
  if (args.flows) {
    const selected = new Set(
      args.flows.split(",").flatMap((part) => {
        const [from, to = from] = part.split("-").map(Number);
        if (
          !Number.isInteger(from) ||
          !Number.isInteger(to) ||
          from < 1 ||
          to > manifest.flows.length ||
          from > to
        )
          throw new Error(`Invalid flow range: ${part}`);
        return Array.from({ length: to - from + 1 }, (_, i) => from + i);
      }),
    );
    frames = frames.filter((frame) => selected.has(frame.flowNo));
  }
  if (args.frame)
    frames = frames.filter((frame) => frame.frameNo === Number(args.frame));
  if (args.family)
    frames = frames.filter((frame) => frame.family === args.family);
  if (!args.all)
    frames = frames.filter((frame) => frame.mappingStatus === "reproducible");
  return frames;
}
function roundMetric(value) {
  return value == null ? "" : Number(value.toFixed(4));
}

function csvCell(value) {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function aggregateFamilies(rows) {
  const grouped = new Map();
  for (const row of rows.filter((item) => item.status === "scored")) {
    if (!grouped.has(row.family)) grouped.set(row.family, []);
    grouped.get(row.family).push(row);
  }
  return [...grouped.entries()]
    .map(([family, items]) => ({
      family,
      frames: items.length,
      meanMaePct:
        items.reduce((sum, item) => sum + item.maePct, 0) / items.length,
      worstMaePct: Math.max(...items.map((item) => item.maePct)),
      meanBadPixelPct:
        items.reduce((sum, item) => sum + item.badPixelPct, 0) / items.length,
    }))
    .sort((a, b) => b.meanMaePct - a.meanMaePct);
}

function writeReports(runDir, rows, metadata) {
  const scored = rows
    .filter((row) => row.status === "scored")
    .sort((a, b) => b.maePct - a.maePct);
  const nonScored = rows.filter((row) => row.status !== "scored");
  const ranked = [...scored, ...nonScored];
  const families = aggregateFamilies(rows);
  const report = { ...metadata, families, rows: ranked };
  fs.writeFileSync(
    path.join(runDir, "report.json"),
    JSON.stringify(report, null, 2),
  );
  const csvHeaders = [
    "rank",
    "id",
    "flow",
    "frame",
    "family",
    "state",
    "mae_pct",
    "rmse_pct",
    "bad_pixel_12_pct",
    "status",
    "notes",
  ];
  const csvRows = ranked.map((row, index) => [
    row.status === "scored" ? index + 1 : "",
    row.id,
    row.flowNo,
    row.frameNo,
    row.family,
    row.state || "",
    roundMetric(row.maePct),
    roundMetric(row.rmsePct),
    roundMetric(row.badPixelPct),
    row.status,
    row.error || row.mappingStatus || "",
  ]);
  fs.writeFileSync(
    path.join(runDir, "ranking.csv"),
    [csvHeaders, ...csvRows]
      .map((row) => row.map(csvCell).join(","))
      .join("\n") + "\n",
  );

  const md = [
    `# Shop parity run: ${metadata.run}`,
    "",
    `Base URL: \`${metadata.baseUrl}\`  `,
    `Viewport: ${WIDTH}×${HEIGHT}  `,
    `Scored: ${scored.length}; non-scored: ${nonScored.length}`,
    "",
    "## Family ranking",
    "| Family | Frames | Mean MAE % | Worst MAE % | Mean bad-pixel % |",
    "| --- | ---: | ---: | ---: | ---: |",
    ...families.map(
      (item) =>
        `| ${item.family} | ${item.frames} | ${item.meanMaePct.toFixed(3)} | ${item.worstMaePct.toFixed(3)} | ${item.meanBadPixelPct.toFixed(3)} |`,
    ),
    "",
    "## Frame ranking (worst → best)",
    "",
    "| Rank | Frame | Flow | Family/state | MAE % | RMSE % | Bad pixel % | Status |",
    "| ---: | --- | --- | --- | ---: | ---: | ---: | --- |",
    ...ranked.map((row, index) => {
      const rank = row.status === "scored" ? String(index + 1) : "—";
      const mae = row.maePct == null ? "—" : row.maePct.toFixed(3);
      const rmse = row.rmsePct == null ? "—" : row.rmsePct.toFixed(3);
      const bad = row.badPixelPct == null ? "—" : row.badPixelPct.toFixed(3);
      const state = row.state ? `${row.family}/${row.state}` : row.family;
      return `| ${rank} | ${row.id} | ${row.flowNo} ${row.title} | ${state} | ${mae} | ${rmse} | ${bad} | ${row.status} |`;
    }),
    "",
  ];
  fs.writeFileSync(path.join(runDir, "ranking.md"), md.join("\n"));
  return report;
}

function isoRunName() {
  return new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
}
async function runBaseline(args) {
  const run = args.run || isoRunName();
  const runDir = path.join(QA_ROOT, "runs", run);
  ensureDir(runDir);
  const frames = selectFrames(args);
  if (!frames.length) throw new Error("No frames matched the requested scope.");

  const rows = [];
  const replay = args.sequential ? { session: null } : null;
  const startedAt = new Date().toISOString();
  const browser = await chromium.launch({
    channel: process.env.PLAYWRIGHT_CHANNEL || "chrome",
    headless: true,
  });
  try {
    for (const frame of frames) {
      if (!frame.recipeFrame || frame.recipeFrame.unresolved) {
        rows.push({
          ...serializeFrame(frame),
          status: "unmapped",
          error:
            frame.recipeFrame?.unresolved ||
            "No deterministic replay recipe yet",
        });
        continue;
      }
      process.stdout.write(`score ${frame.id} ${frame.title} ... `);
      try {
        const row = await captureFrame(browser, frame, runDir, replay);
        rows.push(row);
        console.log(`${row.maePct.toFixed(3)}% MAE`);
      } catch (error) {
        rows.push({
          ...serializeFrame(frame),
          status: "failed",
          error: error instanceof Error ? error.message : String(error),
        });
        console.log(`FAILED: ${error.message || error}`);
      }
    }
  } finally {
    try {
      if (replay?.session) await closeCaptureSession(replay.session);
    } finally {
      await browser.close();
    }
  }
  const report = writeReports(runDir, rows, {
    run,
    createdAt: new Date().toISOString(),
    startedAt,
    replayMode: replay ? "continuous-flow" : "isolated-frame",
    runtime: {
      platform: process.platform,
      node: process.version,
      browser: browser.version(),
      channel: process.env.PLAYWRIGHT_CHANNEL || "chrome",
      deviceScaleFactor: 1,
    },
    gitHead: execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: ROOT,
      encoding: "utf8",
    }).trim(),
    gitStatus: execFileSync("git", ["status", "--short"], {
      cwd: ROOT,
      encoding: "utf8",
    }).trim(),
    baseUrl: BASE_URL,
    viewport: { width: WIDTH, height: HEIGHT },
    formula:
      "MAE% = 100 * sum(abs(referenceRGB-liveRGB)) / (255 * 3 * unmaskedPixels)",
    sourceNormalization: {
      width: WIDTH,
      height: SOURCE_NORMALIZED_HEIGHT,
      crop: { x: 0, y: SOURCE_TOP_CROP, width: WIDTH, height: HEIGHT },
    },
  });
  console.log(`report: ${path.join(runDir, "ranking.md")}`);
  if (rows.some((row) => row.status === "failed" || row.browserErrors?.length))
    process.exitCode = 1;
  return report;
}

function printInventory() {
  const payload = writeFrameMap();
  const byFlow = manifest.flows.map((flow, index) => {
    const flowNo = index + 1;
    const mapped =
      flowRecipes[flowNo]?.frames?.filter((frame) => frame && !frame.unresolved)
        .length || 0;
    return `${String(flowNo).padStart(2, "0")} ${String(flow.screens.length).padStart(2, "0")} frames, ${String(mapped).padStart(2, "0")} recipes - ${flow.title}`;
  });
  console.log(
    `${payload.flows} flows / ${payload.frames} frames / ${payload.reproducibleFrames} deterministic replay recipes`,
  );
  console.log(byFlow.join("\n"));
  console.log(`frame map: ${path.join(QA_ROOT, "frame-map.json")}`);
}
function loadReport(run) {
  const reportPath = path.join(QA_ROOT, "runs", run, "report.json");
  return JSON.parse(fs.readFileSync(reportPath, "utf8"));
}

function compareRuns(args) {
  if (!args.before || !args.after)
    throw new Error("compare-runs requires --before <run> --after <run>");
  const before = loadReport(args.before);
  const after = loadReport(args.after);
  const beforeById = new Map(before.rows.map((row) => [row.id, row]));
  const comparisons = after.rows
    .filter(
      (row) =>
        row.status === "scored" && beforeById.get(row.id)?.status === "scored",
    )
    .map((row) => {
      const prior = beforeById.get(row.id);
      return {
        id: row.id,
        flowNo: row.flowNo,
        frameNo: row.frameNo,
        family: row.family,
        state: row.state,
        beforeMaePct: prior.maePct,
        afterMaePct: row.maePct,
        deltaMaePct: row.maePct - prior.maePct,
      };
    })
    .sort((a, b) => b.deltaMaePct - a.deltaMaePct);
  const meanDelta = comparisons.length
    ? comparisons.reduce((sum, item) => sum + item.deltaMaePct, 0) /
      comparisons.length
    : null;
  console.log(
    JSON.stringify(
      { before: args.before, after: args.after, meanDelta, comparisons },
      null,
      2,
    ),
  );
}
function printHelp() {
  console.log(`Shop parity QA

Commands:
  enumerate
  baseline [--flow N] [--frame N] [--family NAME] [--all] [--sequential] [--run NAME]
  compare-runs --before RUN --after RUN

Examples:
  node scripts/shop-parity/run.mjs enumerate
  node scripts/shop-parity/run.mjs baseline --flow 84 --frame 2 --run before-address
  node scripts/shop-parity/run.mjs baseline --family account-payments --run payments-before
  node scripts/shop-parity/run.mjs baseline --all --run corpus-map
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  writeFrameMap();
  if (args.command === "enumerate") return printInventory();
  if (args.command === "baseline") return runBaseline(args);
  if (args.command === "compare-runs") return compareRuns(args);
  printHelp();
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
