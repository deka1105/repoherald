/**
 * The Token Factory client's HTTP contract, against a real socket.
 *
 * `resolve-repo.test.ts` injects a fake completer, so it proves the ladder but
 * never exercises the wire: the Bearer header, the retry rules, the response
 * parsing, the `/models` shape. Those are the parts that would fail the first
 * time a real key is used, which is the worst moment to find out — debugging
 * them against the live endpoint costs credits.
 *
 * So this stands up a local server that speaks Token Factory's documented
 * shapes and points the client at it with NEBIUS_BASE_URL. No key, no network
 * beyond loopback, no tokens.
 *
 * Takes a few seconds: the retry tests wait out real backoff, because a retry
 * test that stubs the clock proves the stub works and nothing else.
 */

import { createServer, type Server } from "node:http";
import { AddressInfo } from "node:net";

let pass = 0,
  fail = 0;
const ok = (name: string, cond: boolean) => {
  if (cond) pass++;
  else fail++;
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}`);
};

/** Set before importing the client: MODELS reads env at module load. */
process.env.NEBIUS_API_KEY = "test-key-not-a-real-one";
process.env.NEMOTRON_MODEL_FAST = "nvidia/test-fast";
process.env.NEMOTRON_MODEL_DEEP = "nvidia/test-deep";

type Handler = (
  path: string,
  auth: string | undefined,
  body: string,
  attempt: number,
) => { status: number; headers?: Record<string, string>; body: string };

let handler: Handler;
let attempts = 0;
let lastAuth: string | undefined;
let lastBody = "";
let lastPath = "";

function start(): Promise<Server> {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        attempts++;
        lastAuth = req.headers.authorization;
        lastBody = body;
        lastPath = req.url ?? "";
        const out = handler(req.url ?? "", lastAuth, body, attempts);
        res.writeHead(out.status, {
          "Content-Type": "application/json",
          ...out.headers,
        });
        res.end(out.body);
      });
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

async function main() {
  const server = await start();
  const port = (server.address() as AddressInfo).port;
  process.env.NEBIUS_BASE_URL = `http://127.0.0.1:${port}/v1`;

  // Imported after the env is set, so the module picks up this base url.
  const {
    complete,
    listModels,
    checkModels,
    extractJson,
    NebiusError,
    NebiusRateLimited,
    MissingNebiusKey,
    nemotronConfigured,
  } = await import("@/lib/nemotron");
  const { z } = await import("zod");

  const reset = (h: Handler) => {
    handler = h;
    attempts = 0;
  };

  ok("reports configured when a key is set", nemotronConfigured() === true);

  // ── /models

  reset(() => ({
    status: 200,
    body: JSON.stringify({
      data: [{ id: "nvidia/test-deep" }, { id: "nvidia/test-fast" }, { id: "meta/other" }],
    }),
  }));
  const models = await listModels();
  ok("lists models", models.length === 3);
  ok("sorts model ids", models[0] === "meta/other");
  ok("requests /v1/models", lastPath === "/v1/models");
  ok("sends a Bearer token", lastAuth === "Bearer test-key-not-a-real-one");

  const good = await checkModels();
  ok("reports no missing tiers when both exist", good.missing.length === 0);

  reset(() => ({ status: 200, body: JSON.stringify({ data: [{ id: "meta/other" }] }) }));
  const bad = await checkModels();
  ok("reports both tiers missing when absent", bad.missing.length === 2);
  ok(
    "names which tier is missing",
    bad.missing.some((m) => m.tier === "fast" && m.model === "nvidia/test-fast"),
  );

  // ── chat completions

  reset(() => ({
    status: 200,
    body: JSON.stringify({
      choices: [{ message: { content: '{"candidates":[]}' } }],
      usage: { prompt_tokens: 11, completion_tokens: 7 },
    }),
  }));
  const out = await complete({ tier: "fast", system: "sys", user: "usr" });
  ok("returns the assistant text", out.text === '{"candidates":[]}');
  ok("reports the model used", out.model === "nvidia/test-fast");
  ok("reports token usage", out.promptTokens === 11 && out.completionTokens === 7);
  ok("posts to /v1/chat/completions", lastPath === "/v1/chat/completions");
  {
    const sent = JSON.parse(lastBody);
    ok("sends the configured model id", sent.model === "nvidia/test-fast");
    ok("sends system then user", sent.messages[0].role === "system" && sent.messages[1].role === "user");
    ok("pins temperature to 0 by default", sent.temperature === 0);
  }

  reset(() => ({
    status: 200,
    body: JSON.stringify({ choices: [{ message: { content: null } }] }),
  }));
  const nulled = await complete({ tier: "deep", system: "s", user: "u" });
  ok("a null content becomes an empty string", nulled.text === "");
  ok("uses the deep tier id when asked", nulled.model === "nvidia/test-deep");

  // ── errors and retries

  reset((_p, _a, _b, attempt) =>
    attempt < 3
      ? { status: 429, headers: { "retry-after": "1" }, body: "{}" }
      : { status: 200, body: JSON.stringify({ choices: [{ message: { content: "ok" } }] }) },
  );
  const recovered = await complete({ tier: "fast", system: "s", user: "u" });
  ok("retries a 429 and recovers", recovered.text === "ok");
  ok("took three attempts", attempts === 3);

  reset(() => ({ status: 429, headers: { "retry-after": "1" }, body: "{}" }));
  let rateLimited = false;
  try {
    await complete({ tier: "fast", system: "s", user: "u" });
  } catch (err) {
    rateLimited = err instanceof NebiusRateLimited;
  }
  ok("throws NebiusRateLimited when 429 never clears", rateLimited);
  ok("gave up after three attempts", attempts === 3);

  reset(() => ({ status: 401, body: '{"error":"bad key"}' }));
  let unauthorised = false;
  try {
    await complete({ tier: "fast", system: "s", user: "u" });
  } catch (err) {
    unauthorised = err instanceof NebiusError;
  }
  ok("throws on 401", unauthorised);
  ok("never retries a 401 — a bad key will not fix itself", attempts === 1);

  reset(() => ({ status: 400, body: '{"error":"bad request"}' }));
  let badRequest = false;
  try {
    await complete({ tier: "fast", system: "s", user: "u" });
  } catch {
    badRequest = true;
  }
  ok("throws on 400", badRequest);
  ok("never retries a 400", attempts === 1);

  reset((_p, _a, _b, attempt) =>
    attempt < 2
      ? { status: 503, body: "{}" }
      : { status: 200, body: JSON.stringify({ choices: [{ message: { content: "up" } }] }) },
  );
  const afterOutage = await complete({ tier: "fast", system: "s", user: "u" });
  ok("retries a 5xx and recovers", afterOutage.text === "up" && attempts === 2);

  reset(() => ({ status: 200, body: JSON.stringify({ nonsense: true }) }));
  let badShape = false;
  try {
    await complete({ tier: "fast", system: "s", user: "u" });
  } catch (err) {
    badShape = err instanceof NebiusError;
  }
  ok("rejects an unexpected completion shape", badShape);

  // ── missing key

  delete process.env.NEBIUS_API_KEY;
  ok("reports unconfigured with no key", nemotronConfigured() === false);
  let missing = false;
  try {
    await complete({ tier: "fast", system: "s", user: "u" });
  } catch (err) {
    missing = err instanceof MissingNebiusKey;
  }
  ok("throws MissingNebiusKey rather than calling out", missing);
  process.env.NEBIUS_API_KEY = "test-key-not-a-real-one";

  // ── json extraction, which is what stands in for structured output

  const schema = z.object({ candidates: z.array(z.object({ full_name: z.string() })) });
  ok(
    "extracts bare json",
    extractJson('{"candidates":[{"full_name":"a/b"}]}', schema)?.candidates[0].full_name === "a/b",
  );
  ok(
    "extracts json wrapped in prose",
    extractJson('Sure! Here you go:\n```json\n{"candidates":[{"full_name":"a/b"}]}\n```\nHope that helps.', schema)
      ?.candidates[0].full_name === "a/b",
  );
  ok(
    "survives a brace inside a string value",
    extractJson('{"candidates":[{"full_name":"a/b"}],"reasoning":"has a { brace"}', schema)
      ?.candidates[0].full_name === "a/b",
  );
  ok(
    "survives an escaped quote inside a string value",
    extractJson('{"candidates":[{"full_name":"a/b"}],"reasoning":"a \\" quote"}', schema)
      ?.candidates[0].full_name === "a/b",
  );
  ok("returns null on text with no json", extractJson("no json here", schema) === null);
  ok("returns null on json that fails the schema", extractJson('{"wrong":1}', schema) === null);
  ok("returns null on truncated json", extractJson('{"candidates":[{"full_n', schema) === null);

  server.close();
}

main().then(() => {
  console.log(`\n  ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
});
