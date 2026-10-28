/**
 * Is Nemotron on Nebius actually reachable, and are the configured model ids
 * ones this account can serve?
 *
 * Exists because the two ways this fails are both silent from the app's side:
 * a key that was never set degrades identification to the literal-URL path and
 * looks like "the model is bad at this", and a model id that was renamed in
 * Token Factory's catalogue 404s at the moment someone sends a post rather
 * than at deploy time. One command, run before recording or deploying.
 */

import {
  MODELS,
  checkModels,
  complete,
  nemotronConfigured,
} from "@/lib/nemotron";

async function main() {
  if (!nemotronConfigured()) {
    console.log("✖  NEBIUS_API_KEY is not set.");
    console.log("   Identification will fall back to literal github.com links only.");
    console.log("   Get a key: https://nebius.com/services/token-factory");
    process.exit(1);
  }
  console.log("✓  NEBIUS_API_KEY is set");
  console.log(`   base url: ${process.env.NEBIUS_BASE_URL || "https://api.tokenfactory.nebius.com/v1 (default)"}`);
  console.log(`   fast tier: ${MODELS.fast}`);
  console.log(`   deep tier: ${MODELS.deep}\n`);

  let available: string[] = [];
  try {
    const result = await checkModels();
    available = result.available;
    console.log(`✓  catalogue reachable — ${available.length} models`);
    const nemotron = available.filter((m) => /nemotron/i.test(m));
    if (nemotron.length) {
      console.log("   NVIDIA Nemotron ids this account can serve:");
      for (const m of nemotron) console.log(`     ${m}`);
    } else {
      console.log("   ⚠︎ no model id matching /nemotron/ in the catalogue.");
    }
    if (result.missing.length) {
      console.log("\n✖  configured ids that the catalogue does NOT list:");
      for (const { tier, model } of result.missing) {
        console.log(`     ${tier.padEnd(5)} ${model}`);
      }
      console.log("\n   Set NEMOTRON_MODEL_FAST / NEMOTRON_MODEL_DEEP to ids from the list above.");
      process.exit(1);
    }
    console.log("\n✓  both configured tiers exist in the catalogue");
  } catch (err) {
    console.log(`✖  could not list models: ${(err as Error).message}`);
    process.exit(1);
  }

  // A catalogue entry is not the same as a model that will answer. Ask each
  // tier the cheapest real question there is — both tiers, because they are
  // different models and either can be the broken one.
  //
  // The budget here is deliberately not tiny. Nemotron 3 bills its thinking
  // against `max_tokens`, so a 32-token ping returns empty content from a
  // perfectly healthy model and reads as a platform fault.
  const tiers = ["fast", "deep"] as const;
  let failed = false;
  for (const tier of tiers) {
    try {
      const started = Date.now();
      const out = await complete({
        tier,
        system: 'Reply with exactly: {"ok":true}',
        user: "ping",
        maxTokens: 256,
      });
      const secs = ((Date.now() - started) / 1000).toFixed(1);
      const reply = JSON.stringify(out.text.trim().slice(0, 60));
      if (out.truncated) {
        console.log(`⚠  ${tier} tier (${MODELS[tier]}) hit the token budget before answering`);
        console.log("   thinking used the whole budget — raise maxTokens for this model");
        failed = true;
        continue;
      }
      console.log(`✓  ${tier} tier works — ${MODELS[tier]} replied ${reply} in ${secs}s`);
      console.log(
        `   tokens: ${out.promptTokens ?? "?"} in, ${out.completionTokens ?? "?"} out` +
          (out.reasoningTokens === undefined
            ? " (this model does not report reasoning tokens separately)"
            : ` (${out.reasoningTokens} of them thinking)`),
      );
    } catch (err) {
      console.log(`✖  ${tier} tier (${MODELS[tier]}) failed: ${(err as Error).message}`);
      failed = true;
    }
  }
  if (failed) {
    process.exit(1);
  }

  console.log("\n✓  ready. Run `npm run eval:resolve -- --limit 20` to measure accuracy.");
}

main();
