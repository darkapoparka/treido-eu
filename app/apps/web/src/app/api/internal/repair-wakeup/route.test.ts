import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  config: vi.fn(),
  database: vi.fn(),
  send: vi.fn(),
  executor: vi.fn(),
  query: vi.fn(),
}));
vi.mock("../../../../server/jobs/config.server", () => ({
  requireJobBindings: mocks.config,
}));
vi.mock("../../../../server/db/database", () => ({
  getDatabase: mocks.database,
}));
vi.mock("../../../../server/jobs/inngest.server", () => ({
  createJobExecutor: mocks.executor,
}));
import { GET } from "./route";
const secret = "repairsecret0000000000000000000000";
const url = "https://treido.eu/api/internal/repair-wakeup";
const bindings = {
  applicationId: "treido-prod",
  environment: "production",
  origin: "https://treido.eu",
  repairServiceId: "treido-repair",
  repairScheduler: "external-minute",
};
function request(address = url, headers = {}) {
  return new Request(address, {
    headers: { authorization: `Bearer ${secret}`, ...headers },
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CRON_SECRET", secret);
  vi.stubEnv("TREIDO_ENV", "production");
  vi.stubEnv("VERCEL_ENV", "production");
  vi.stubEnv("VERCEL_URL", "");
  vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
  mocks.config.mockReturnValue(bindings);
  mocks.database.mockReturnValue({ pool: { query: mocks.query } });
  mocks.query
    .mockReset()
    .mockResolvedValue({ rows: [{ ready: true, due: false }] });
  mocks.send.mockReset().mockResolvedValue({ ids: ["event-id"] });
  mocks.executor.mockReturnValue({ sendRepairWakeup: mocks.send });
});
afterEach(() => vi.unstubAllEnvs());
describe("authenticated production repair timer route", () => {
  it("rejects bad auth and query credentials before config/database/send", async () => {
    for (const input of [
      request(url, { authorization: "Bearer wrong" }),
      request(url + "?action=repair"),
      new Request(url),
    ])
      expect((await GET(input)).status).toBe(403);
    expect(mocks.config).not.toHaveBeenCalled();
    expect(mocks.database).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("rejects wrong deployment, disabled mode, origin, path and non-minute timer before DB/send", async () => {
    for (const value of ["preview", "development", ""]) {
      vi.stubEnv("VERCEL_ENV", value);
      expect((await GET(request())).status).toBe(403);
    }
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("TREIDO_ENV", "preview");
    expect((await GET(request())).status).toBe(403);
    vi.stubEnv("TREIDO_ENV", "production");
    mocks.config.mockReturnValueOnce({
      ...bindings,
      repairScheduler: "inngest-cron",
    });
    expect((await GET(request())).status).toBe(403);
    for (const input of [
      request("https://other.example.com/api/internal/repair-wakeup"),
      request(url + "/extra"),
      request(url, { "x-vercel-cron-schedule": "*/5 * * * *" }),
      new Request(url, {
        method: "POST",
        headers: { authorization: `Bearer ${secret}` },
        body: "{}",
      }),
    ])
      expect((await GET(input)).status).toBe(403);
    expect(mocks.database).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("keeps successful empty responses private and sends nothing", async () => {
    const response = await GET(
      request(url, { "x-vercel-cron-schedule": "* * * * *" }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ status: "empty" });
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("allows only canonical or exact safe platform deployment URLs", async () => {
    vi.stubEnv("VERCEL_URL", "treido-eu-deployment.vercel.app");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "treido-eu.vercel.app");
    for (const origin of [
      "https://treido.eu",
      "https://treido-eu-deployment.vercel.app",
      "https://treido-eu.vercel.app",
    ])
      expect(
        (await GET(request(origin + "/api/internal/repair-wakeup"))).status,
      ).toBe(200);
    mocks.database.mockClear();
    for (const origin of [
      "http://treido-eu.vercel.app",
      "https://foreign.vercel.app",
      "https://treido-eu.vercel.app.attacker.example",
      "https://treido-eu.vercel.app:8443",
    ])
      expect(
        (
          await GET(
            request(origin + "/api/internal/repair-wakeup", {
              "x-forwarded-host": "treido-eu.vercel.app",
            }),
          )
        ).status,
      ).toBe(403);
    expect(mocks.database).not.toHaveBeenCalled();
  });
  it("rejects malformed or foreign platform metadata before DB/send", async () => {
    for (const hostname of [
      "https://treido-eu.vercel.app",
      "treido-eu.vercel.app/path",
      "treido-eu.vercel.app?query=1",
      "user@treido-eu.vercel.app",
      "treido-eu.vercel.app:443",
      " treido-eu.vercel.app",
      "treido-eu.vercel.app ",
      "treido-eu.vercel.app.attacker.example",
      "foreign.example.com",
      "-treido.vercel.app",
      "treido_.vercel.app",
      "vercel.app",
    ]) {
      vi.stubEnv("VERCEL_URL", hostname);
      vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", hostname);
      expect(
        (
          await GET(
            request("https://treido-eu.vercel.app/api/internal/repair-wakeup"),
          )
        ).status,
      ).toBe(403);
    }
    expect(mocks.database).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("queues due/unknown work and never reports an ambiguous enqueue as success", async () => {
    mocks.query.mockResolvedValue({ rows: [{ ready: true, due: true }] });
    expect(await (await GET(request())).json()).toEqual({ status: "queued" });
    mocks.query.mockRejectedValue(Error("private database diagnosis"));
    expect((await GET(request())).status).toBe(200);
    mocks.send.mockRejectedValue(Error("private provider diagnosis"));
    const failed = await GET(request());
    expect(failed.status).toBe(503);
    expect(await failed.json()).toEqual({ code: "NOT_AVAILABLE" });
  });
  it("configuration failure cannot reach database or sender", async () => {
    mocks.config.mockImplementationOnce(() => {
      throw Error("unsafe config");
    });
    expect((await GET(request())).status).toBe(503);
    expect(mocks.database).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });
});
