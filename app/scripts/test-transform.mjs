// Standalone proof for src/lib/transform.ts. Run: node scripts/test-transform.mjs
// (Node >= 22.18 strips the TypeScript types natively, so no build step.)
import assert from "node:assert/strict";
import { transformHtml, newOpenToken } from "../src/lib/transform.ts";

const BASE = "http://localhost:3000";
const OPEN_TOKEN = "OPENTOKEN12345";

let passed = 0;
const test = (name, fn) => {
  try {
    fn();
    passed += 1;
    console.log(`  PASS  ${name}`);
  } catch (err) {
    console.log(`  FAIL  ${name}`);
    console.log(String(err && err.message ? err.message : err));
    process.exitCode = 1;
  }
};

const SAMPLE = `<!DOCTYPE html>
<html>
  <body>
    <p>Hello</p>
    <a href="https://example.com/pricing?plan=pro&ref=email#top">See pricing</a>
    <a href="http://example.org/blog">Blog</a>
    <a href="https://example.com/pricing?plan=pro&ref=email#top">Same URL again</a>
    <a href="mailto:sales@example.com">Email us</a>
    <a href="tel:+15551234567">Call us</a>
    <a href="#footer">Jump to footer</a>
    <a href="/relative/path">Relative</a>
    <a href="https://example.com/unsubscribe" data-no-track>Unsubscribe</a>
  </body>
</html>`;

const result = transformHtml(SAMPLE, { baseUrl: BASE, openToken: OPEN_TOKEN });
const out = result.html;

console.log("--- transformHtml output ---");
console.log(out);
console.log("--- links ---");
console.log(JSON.stringify(result.links, null, 2));
console.log("--- assertions ---");

test("rewrites all 3 absolute http(s) links and nothing else", () => {
  assert.equal(result.links.length, 3);
  assert.deepEqual(
    result.links.map((l) => l.originalUrl),
    [
      "https://example.com/pricing?plan=pro&ref=email#top",
      "http://example.org/blog",
      "https://example.com/pricing?plan=pro&ref=email#top",
    ],
  );
});

test("query string + fragment survive round-trip through ?u=", () => {
  const original = "https://example.com/pricing?plan=pro&ref=email#top";
  const link = result.links[0];
  const expectedHref = `${BASE}/api/track/click/${link.token}?u=${encodeURIComponent(original)}`;
  assert.ok(
    out.includes(expectedHref.replace(/&/g, "&amp;")) || out.includes(expectedHref),
    `tracked href not found in output:\n${expectedHref}`,
  );
  const u = new URL(expectedHref).searchParams.get("u");
  assert.equal(u, original, "decoded u= must equal the original URL");
});

test("mailto: is left alone", () => {
  assert.ok(out.includes('href="mailto:sales@example.com"'));
  assert.ok(!result.links.some((l) => l.originalUrl.startsWith("mailto:")));
});

test("tel: is left alone", () => {
  assert.ok(out.includes('href="tel:+15551234567"'));
});

test("#anchor is left alone", () => {
  assert.ok(out.includes('href="#footer"'));
});

test("relative URL is left alone", () => {
  assert.ok(out.includes('href="/relative/path"'));
});

test("data-no-track link is left alone", () => {
  assert.ok(out.includes('href="https://example.com/unsubscribe"'));
  assert.ok(!result.links.some((l) => l.originalUrl.includes("unsubscribe")));
});

test("each link gets a distinct token, even for identical URLs", () => {
  const tokens = result.links.map((l) => l.token);
  assert.equal(new Set(tokens).size, tokens.length, `duplicate tokens: ${tokens}`);
  tokens.forEach((t) => assert.equal(t.length, 12, `token ${t} is not nanoid(12)`));
  assert.notEqual(result.links[0].token, result.links[2].token);
});

test("captures link text as label", () => {
  assert.deepEqual(
    result.links.map((l) => l.label),
    ["See pricing", "Blog", "Same URL again"],
  );
});

test("pixel is appended immediately before </body>", () => {
  const pixelSrc = `${BASE}/api/track/open/${OPEN_TOKEN}`;
  assert.ok(out.includes(pixelSrc), "pixel src missing");
  const pixelAt = out.indexOf(pixelSrc);
  const bodyEndAt = out.lastIndexOf("</body>");
  assert.ok(bodyEndAt > pixelAt, "pixel must come before </body>");
  const tail = out.slice(pixelAt, bodyEndAt);
  assert.ok(!tail.includes("<a "), "pixel must be the last thing in <body>");
  assert.ok(/width="1"/.test(out) && /height="1"/.test(out), "pixel must be 1x1");
  assert.equal((out.match(/api\/track\/open\//g) ?? []).length, 1, "exactly one pixel");
});

test("appends to document root when there is no <body>", () => {
  const frag = transformHtml('<p>hi <a href="https://a.test/x?y=1">a</a></p>', {
    baseUrl: BASE,
    openToken: OPEN_TOKEN,
  });
  assert.ok(frag.html.includes(`${BASE}/api/track/open/${OPEN_TOKEN}`));
  assert.equal(frag.links.length, 1);
});

test("baseUrl trailing slash is normalised", () => {
  const r = transformHtml('<body><a href="https://a.test/x">a</a></body>', {
    baseUrl: "https://track.example.com/",
    openToken: OPEN_TOKEN,
  });
  assert.ok(!r.html.includes("com//api/"), "double slash in tracked URL");
  assert.ok(r.html.includes("https://track.example.com/api/track/open/"));
});

test("newOpenToken returns a 14-char token", () => {
  const a = newOpenToken();
  const b = newOpenToken();
  assert.equal(a.length, 14);
  assert.notEqual(a, b);
});

console.log(`\n${passed} passed, exit code ${process.exitCode ?? 0}`);
