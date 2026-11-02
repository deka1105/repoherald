import { serializeJsonLd, type JsonLdObject } from "@/lib/schema";

/**
 * Renders JSON-LD into the server-rendered HTML.
 *
 * A server component rather than a `<Script>`: Google does execute JavaScript
 * before reading structured data, but its own guidance is to put time-sensitive
 * markup in the initial response, and markup that depends on hydration is
 * markup that can be missed. This way it is in the first byte.
 *
 * `JSON.stringify` is the only escaping needed for `application/ld+json`, with
 * one exception — a `<` inside a string value would let a crafted repo
 * description close the script element early. Repo descriptions come from
 * GitHub, so that input is not ours to trust; `<` is escaped to its unicode
 * form, which is valid JSON and parses back to the same string.
 */
export function JsonLd({ data }: { data: JsonLdObject | JsonLdObject[] }) {
  const json = serializeJsonLd(data);
  return (
    <script
      type="application/ld+json"
      // Already serialised and escaped above; React would otherwise encode the
      // quotes and the block would stop being valid JSON-LD.
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
