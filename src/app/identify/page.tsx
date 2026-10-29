import Link from "next/link";
import { Header } from "@/components/header";
import { nemotronConfigured } from "@/lib/nemotron";
import { IdentifyForm } from "./identify-form";

/**
 * Rendered per request, not prerendered.
 *
 * This page branches on whether NEBIUS_API_KEY is set. Prerendered, that read
 * happens at build time and gets baked in — so a deploy that ran before the
 * key was added would keep telling visitors identification is unconfigured
 * long after it worked. The page does nothing else dynamic; this is only here
 * to make the env read a request-time one.
 */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Identify a repository — repoherald",
  description:
    "Turn a post's caption, on-screen text or narration into the GitHub repository it is actually about.",
};

export default function IdentifyPage() {
  return (
    <>
      <Header />
      <main
        id="main"
        tabIndex={-1}
        className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-6 pb-24 md:pb-14"
      >
        <div className="space-y-2">
          <h1 className="text-xl font-semibold">Which repository is this?</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            When you send repoherald a post, something has to work out which
            repository it is about. That used to be a person reading the caption
            and searching GitHub by hand, which is why the catalogue could never
            grow faster than someone&rsquo;s evening. This is that step, running
            on{" "}
            <span className="font-medium text-foreground">
              NVIDIA Nemotron via Nebius Token Factory
            </span>
            .
          </p>
          <p className="max-w-3xl text-sm text-muted-foreground">
            The model only proposes names.{" "}
            <span className="font-medium text-foreground">GitHub decides.</span>{" "}
            Every candidate is checked against the real API, and one that
            doesn&rsquo;t resolve is discarded however confident the model
            sounded — so this can tell you it doesn&rsquo;t know, but it
            can&rsquo;t invent a repository that was never there.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border p-3">
            <p className="text-2xl font-semibold tabular-nums">24.6%</p>
            <p className="text-xs text-muted-foreground">
              identified automatically <span className="font-medium">before</span> — a regex
              over literal github.com links, and nothing at all from OCR or speech
            </p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-2xl font-semibold tabular-nums">89.9%</p>
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">with Nemotron</span>, over the same 228 real
              cases — one wrong answer, traceable to a stale name in our own catalogue
            </p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-2xl font-semibold tabular-nums">1.03</p>
            <p className="text-xs text-muted-foreground">
              model calls per post on average, because a quarter of posts carry a literal
              link and cost nothing at all
            </p>
          </div>
        </div>

        <details className="rounded-lg border p-3 text-sm">
          <summary className="cursor-pointer font-medium">
            The five rungs, cheapest first — and which model does what
          </summary>
          <ol className="mt-3 space-y-2 text-muted-foreground">
            <li>
              <span className="font-medium text-foreground">A literal link.</span> A regex.
              No model, no cost, and the only path that earns full confidence.
            </li>
            <li>
              <span className="font-medium text-foreground">Nemotron 3 Super (120B), fast tier.</span>{" "}
              Reads the caption, the OCR and the transcript together. Most posts stop here.
            </li>
            <li>
              <span className="font-medium text-foreground">Nemotron 3 Ultra (550B), deep tier.</span>{" "}
              Runs only on candidates GitHub has already rejected, and is{" "}
              <em>told which ones</em>, so it repairs rather than repeating itself. This is
              the rung that undoes spoken punctuation.
            </li>
            <li>
              <span className="font-medium text-foreground">Tavily web search.</span> Only
              when the post named nothing at all. Two searches, then Nemotron ranks the
              results — taking the first link would be picking by result order.
            </li>
            <li>
              <span className="font-medium text-foreground">Nemotron verifies.</span> The
              one rung that can say no: it compares the post against the repository&rsquo;s{" "}
              <em>real</em> GitHub description and vetoes a near-miss. We added it because
              search alone was wrong a third of the time and never once abstained.
            </li>
          </ol>
          <p className="mt-3 text-xs text-muted-foreground">
            A post with a link answers instantly. A spoken name takes about two seconds. A
            post that names nothing can take twenty — it is four model calls and two
            searches, and we would rather it be slow than wrong.
          </p>
        </details>

        {!nemotronConfigured() && (
          <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-950 dark:text-amber-300">
            <strong>Running without a model on this deployment.</strong> Rung one
            of the ladder is a regex over literal github.com links and needs no
            model, so those still resolve — but a mangled transcript or OCR dump
            will come back empty, because the rungs that repair them are the ones
            that call Nemotron. Setup instructions are in the{" "}
            <Link
              href="https://github.com/deka1105/repoherald"
              className="underline underline-offset-4"
            >
              repository
            </Link>
            .
          </p>
        )}

        <IdentifyForm />

        <p className="max-w-3xl pt-2 text-xs text-muted-foreground">
          Text you submit here is sent to Nebius for inference and is not stored
          by repoherald. The demo is rate-limited so a finite credit balance
          survives being public.
        </p>
      </main>
    </>
  );
}
