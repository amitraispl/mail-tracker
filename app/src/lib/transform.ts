import * as cheerio from "cheerio";
import { nanoid } from "nanoid";

export interface TransformedLink {
  token: string;
  originalUrl: string;
  label: string | null;
}

export interface TransformResult {
  html: string;
  links: TransformedLink[];
}

export interface TransformOptions {
  baseUrl: string;
  openToken: string;
}

/** Opaque token for a campaign's tracking pixel. */
export const newOpenToken = (): string => nanoid(14);

/** Per-link token, so every link counts independently. */
const newLinkToken = (): string => nanoid(12);

/** Only absolute http(s) links are rewritten: mailto:, tel:, #anchors and
 *  relative URLs are all left untouched. */
const TRACKABLE_HREF = /^https?:\/\//i;

const stripTrailingSlash = (url: string): string => url.replace(/\/+$/, "");

/**
 * Rewrite every trackable `<a href>` through the click redirect and append the
 * open pixel. Returns the tracked HTML plus the links that were rewritten, in
 * document order.
 */
export function transformHtml(
  html: string,
  opts: TransformOptions,
): TransformResult {
  const baseUrl = stripTrailingSlash(opts.baseUrl);
  const $ = cheerio.load(html);
  const links: TransformedLink[] = [];

  $("a[href]").each((_i, el) => {
    const $a = $(el);

    // Opt-out hatch: <a data-no-track href="...">
    if ($a.attr("data-no-track") !== undefined) return;

    const href = ($a.attr("href") ?? "").trim();
    if (!TRACKABLE_HREF.test(href)) return;

    const token = newLinkToken();
    const label = $a.text().replace(/\s+/g, " ").trim() || null;

    links.push({ token, originalUrl: href, label });
    $a.attr(
      "href",
      `${baseUrl}/api/track/click/${token}?u=${encodeURIComponent(href)}`,
    );
  });

  // 1x1 pixel. Deliberately not `display:none` — several mail clients skip
  // fetching hidden images, which would silently drop every open.
  const pixel =
    `<img src="${baseUrl}/api/track/open/${opts.openToken}" alt="" width="1" height="1" ` +
    `style="display:block;width:1px;height:1px;border:0;outline:none;text-decoration:none;overflow:hidden" />`;

  const $body = $("body");
  if ($body.length > 0) {
    $body.append(pixel);
  } else {
    $.root().append(pixel);
  }

  return { html: $.html(), links };
}
