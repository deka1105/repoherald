"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Attempt = {
  fullName: string;
  source: "caption" | "screen" | "narration";
  via: "url" | "model-fast" | "model-deep" | "web-search";
  resolved: boolean;
};

type Result = {
  repo: {
    fullName: string;
    description: string | null;
    language: string | null;
    stars: number;
    archived: boolean;
    avatarUrl: string;
  } | null;
  foundIn: string | null;
  confidence: number;
  reasoning: string;
  attempts: Attempt[];
  modelCalls: number;
  tokens: number;
  ms: number;
  degraded?: boolean;
  error?: string;
};

type Fields = { caption: string; stillsText: string; transcript: string };

const EMPTY: Fields = { caption: "", stillsText: "", transcript: "" };

/**
 * One preset per way this is hard, because the interesting cases are the ones
 * nobody would think to type. The names are real repositories from the
 * catalogue; the damage is the damage the pipeline actually sees.
 */
const PRESETS: { label: string; hint: string; fields: Fields }[] = [
  {
    label: "A plain link",
    hint: "costs zero model calls — a regex reads a URL correctly",
    fields: {
      ...EMPTY,
      caption:
        "This one is actually free 👇\n\nhttps://github.com/HKUDS/ViMax\n\n#opensource #devtools",
    },
  },
  {
    label: "Spoken aloud",
    hint: "Whisper: the slash is said, the capitals and spacing are gone",
    fields: {
      ...EMPTY,
      transcript:
        "okay so number one on my list is ertasselli slash openterminal and honestly it should have way more stars than it does, link is in my bio",
    },
  },
  {
    label: "Read off the screen",
    hint: "OCR mangles glyphs — 5 for S, 1 for l, 0 for O",
    fields: {
      ...EMPTY,
      stillsText: "FREE ALTERNATIVE\nHKUD5/ViMax\ngithub\nSAVE THIS",
    },
  },
  {
    label: "Named nowhere",
    hint: "the reel describes it and never says what it is called",
    fields: {
      ...EMPTY,
      caption: "the open source tool that turns a long video into short clips automatically. self hosted, no watermark, no subscription",
    },
  },
];

const VIA_LABEL: Record<Attempt["via"], string> = {
  url: "literal link",
  "model-fast": "Nemotron, fast tier",
  "model-deep": "Nemotron, deep tier",
  "web-search": "web search",
};

export function IdentifyForm() {
  const [fields, setFields] = useState<Fields>(PRESETS[1].fields);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (key: keyof Fields) => (e: React.ChangeEvent<HTMLTextAreaElement>) =>
    setFields((f) => ({ ...f, [key]: e.target.value }));

  async function identify() {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/identify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      setResult(await res.json());
    } catch {
      setResult({
        repo: null,
        foundIn: null,
        confidence: 0,
        reasoning: "",
        attempts: [],
        modelCalls: 0,
        tokens: 0,
        ms: 0,
        error: "Could not reach the server.",
      });
    } finally {
      setBusy(false);
    }
  }

  const empty = !fields.caption && !fields.stillsText && !fields.transcript;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((preset) => (
          <Button
            key={preset.label}
            type="button"
            variant="outline"
            size="sm"
            title={preset.hint}
            onClick={() => {
              setFields(preset.fields);
              setResult(null);
            }}
          >
            {preset.label}
          </Button>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setFields(EMPTY);
            setResult(null);
          }}
        >
          Clear
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="caption">Caption</Label>
          <Textarea id="caption" rows={6} value={fields.caption} onChange={set("caption")} placeholder="What the post said in writing" />
          <p className="text-xs text-muted-foreground">Highest fidelity — often a literal link.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="stills">On-screen text</Label>
          <Textarea id="stills" rows={6} value={fields.stillsText} onChange={set("stillsText")} placeholder="OCR of the frames" />
          <p className="text-xs text-muted-foreground">Near-verbatim, with mangled characters.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="transcript">Narration</Label>
          <Textarea id="transcript" rows={6} value={fields.transcript} onChange={set("transcript")} placeholder="What was said out loud" />
          <p className="text-xs text-muted-foreground">Lossiest — punctuation is spoken, hyphens are not.</p>
        </div>
      </div>

      <Button onClick={identify} disabled={busy || empty}>
        {busy ? "Identifying…" : "Identify the repository"}
      </Button>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {result.error
                ? "Something went wrong"
                : result.repo
                  ? "Identified"
                  : "No repository found"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {result.error ? (
              <p className="text-sm text-muted-foreground">{result.error}</p>
            ) : (
              <>
                {result.repo ? (
                  <div className="space-y-1">
                    <a
                      href={`https://github.com/${result.repo.fullName}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-sm font-semibold underline underline-offset-4"
                    >
                      {result.repo.fullName}
                    </a>
                    {result.repo.description && (
                      <p className="text-sm text-muted-foreground">{result.repo.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {result.repo.language && <Badge variant="secondary">{result.repo.language}</Badge>}
                      <Badge variant="secondary">★ {result.repo.stars.toLocaleString()}</Badge>
                      {result.foundIn && <Badge variant="outline">found in {result.foundIn}</Badge>}
                      <Badge variant="outline">
                        confidence {Math.round(result.confidence * 100)}%
                      </Badge>
                      {result.repo.archived && <Badge variant="destructive">archived</Badge>}
                    </div>
                  </div>
                ) : result.degraded ? (
                  <p className="text-sm text-muted-foreground">
                    No literal github.com link in that text, and this deployment has no model
                    configured — so the rungs that reconstruct a mangled or spoken name never
                    ran. This is the honest &ldquo;before&rdquo; state: it is exactly what the
                    pipeline could do when a person had to do the rest.
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nothing it proposed exists on GitHub, so it returned nothing rather than a
                    guess. In the real pipeline this post goes to the review queue — which is
                    where every post went before any of this.
                  </p>
                )}

                {result.reasoning && <p className="text-sm">{result.reasoning}</p>}

                {result.attempts.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">
                      Every candidate, and what GitHub said about it
                    </p>
                    <ul className="space-y-1">
                      {result.attempts.map((a, i) => (
                        <li key={`${a.fullName}-${i}`} className="flex items-baseline gap-2 text-sm">
                          <span className={a.resolved ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}>
                            {a.resolved ? "✓" : "✗"}
                          </span>
                          <span className="font-mono">{a.fullName}</span>
                          <span className="text-xs text-muted-foreground">
                            {VIA_LABEL[a.via]}
                            {a.resolved ? "" : " — does not exist"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  {result.modelCalls === 0
                    ? "No model call needed."
                    : `${result.modelCalls} Nemotron call${result.modelCalls === 1 ? "" : "s"}, ${result.tokens.toLocaleString()} tokens`}
                  {` · ${(result.ms / 1000).toFixed(1)}s`}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
