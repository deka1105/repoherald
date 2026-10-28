import Link from "next/link";
import { Header } from "@/components/header";
import { nemotronConfigured } from "@/lib/nemotron";
import { IdentifyForm } from "./identify-form";

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

        {!nemotronConfigured() ? (
          <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-950 dark:text-amber-300">
            Identification isn&rsquo;t configured on this deployment, so only
            literal github.com links would resolve. The code and setup
            instructions are in the{" "}
            <Link
              href="https://github.com/deka1105/repoherald"
              className="underline underline-offset-4"
            >
              repository
            </Link>
            .
          </p>
        ) : (
          <IdentifyForm />
        )}

        <p className="max-w-3xl pt-2 text-xs text-muted-foreground">
          Text you submit here is sent to Nebius for inference and is not stored
          by repoherald. The demo is rate-limited so a finite credit balance
          survives being public.
        </p>
      </main>
    </>
  );
}
