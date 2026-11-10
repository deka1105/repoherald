// The two app-store tiles for the landing page's "Get the app" block.
//
// Drawn here rather than shipped as Apple's and Google's badge artwork, for
// three reasons that all point the same way:
//
//  1. The badges are fixed black (or fixed white) raster assets. This page has
//     a light and a dark theme, and a black PNG on #0a0a0a is a dark square
//     with a hole in it. Drawn tiles take --btn-bg / --chip and follow the
//     theme like everything else on the page.
//  2. Google's brand guidelines allow the Play badge only where it links to a
//     live Play listing. Android is still in review, so there is nothing for
//     it to link to, and a greyed-out copy of the official badge would be the
//     one use the guidelines name.
//  3. The wordmarks are real text, so they are selectable, translatable and
//     readable by a screen reader without an alt attribute standing in.
//
// The Apple and Google Play logos stay as vendor glyphs — those are the part
// that must not be redrawn freehand — and ATTRIBUTION.md records whose marks
// they are. If the official artwork is ever wanted instead, it comes from
// Apple's and Google's own badge tools, not from a search result.

/** Apple's mark, monochrome, inheriting the tile's text colour. */
function AppleGlyph() {
  return (
    <svg
      className="rhl-store-glyph"
      viewBox="0 0 24 24"
      width="26"
      height="26"
      aria-hidden
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701z"
      />
    </svg>
  );
}

/** Google Play's triangle, monochrome — the four-colour version is reserved
 *  for a live listing, and this tile is not one. */
function PlayGlyph() {
  return (
    <svg
      className="rhl-store-glyph"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      aria-hidden
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M22.018 13.298l-3.919 2.218-3.515-3.493 3.543-3.521 3.891 2.202c1.302.74 1.302 2.655 0 3.394zM16.829 7.738L4.85.792l10.274 10.205 1.705-1.26zM4.85 23.208l11.979-6.946-1.705-1.26L4.85 23.208zM4.093 1.633C3.722 1.856 3.5 2.252 3.5 2.717v18.566c0 .465.222.861.593 1.084l11.058-10.95L4.093 1.633z"
      />
    </svg>
  );
}

export function StoreTiles({ appStoreUrl }: { appStoreUrl: string }) {
  return (
    <div className="rhl-stores">
      <a
        className="rhl-store"
        href={appStoreUrl}
        target="_blank"
        rel="noreferrer"
      >
        <AppleGlyph />
        <span className="rhl-store-txt">
          <span className="rhl-store-kicker">Download on the</span>
          <span className="rhl-store-name">App Store</span>
        </span>
      </a>

      {/*
        Not a link, and not a disabled <button> either: there is no action to
        offer and nowhere to go, so it is text. A greyed control implies that
        something would happen if it were enabled, which is the wrong promise
        for a build sitting with a reviewer.

        The kicker carries the honesty. "Get it on" / "Coming soon to" would
        both be claims this page cannot make — Google can still say no — so it
        reads as what is actually true today, and the caption below says who
        is holding it.
      */}
      <div className="rhl-store rhl-store-off">
        <PlayGlyph />
        <span className="rhl-store-txt">
          <span className="rhl-store-kicker">In review for</span>
          <span className="rhl-store-name">Google Play</span>
        </span>
      </div>
    </div>
  );
}
