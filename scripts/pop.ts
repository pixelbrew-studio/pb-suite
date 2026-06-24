#!/usr/bin/env bun
/**
 * pop.ts — extract on-page SEO / AI-citability signals from a URL or local file.
 *
 * Sibling of browse.ts, but the inverse intent: browse.ts STRIPS head/script/nav
 * to return readable prose; pop.ts KEEPS them because schema (JSON-LD in
 * <script>), meta tags (in <head>), and structure are the whole point. It also
 * checks whether AI crawlers are even allowed in (robots.txt / llms.txt) — if a
 * page blocks GPTBot/ClaudeBot/PerplexityBot, no on-page work can get it cited.
 * The /pb-pop skill scores the page against references/seo-signals.md from this.
 *
 * Output: JSON to stdout. Errors: human-readable to stderr, non-zero exit.
 */

import { chromium, type BrowserContext } from "playwright";

type Heading = { level: number; text: string };
type Section = { level: number; heading: string; opener: string };

// AI crawlers worth checking. Blocking these is a "cannot be cited" gate.
const AI_BOTS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-Web",
  "anthropic-ai",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot-Extended",
  "CCBot",
  "Bytespider",
  "Amazonbot",
];

type AiAccess = {
  robotsFound: boolean;
  llmsTxt: boolean;
  checked: string[];
  blocked: string[]; // AI bots disallowed from this page's path
};

type Result = {
  url: string;
  title: string;
  metaDescription: string | null;
  canonical: string | null;
  lang: string | null;
  ogTags: Record<string, string>;
  jsonLd: { types: string[]; raw: unknown }[];
  jsonLdParseErrors: number;
  headings: Heading[];
  sections: Section[]; // heading -> its opening passage (extractability signal)
  wordCount: number;
  longestParagraphChars: number; // wall-of-text signal
  paragraphCount: number;
  listItemCount: number;
  tableCount: number;
  faqDetected: boolean;
  images: { total: number; missingAlt: number; altTexts: string[] };
  links: { internal: number; external: number; anchorTexts: string[] };
  aiAccess: AiAccess | null; // null for file:// targets (no robots)
  method: "playwright";
  elapsed_ms: number;
};

type Args = { target: string; timeoutSec: number };

function parseArgs(argv: string[]): Args {
  const args = argv.slice(2);
  let target: string | null = null;
  let timeoutSec = 30;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--timeout") {
      timeoutSec = Number(args[++i]) || 30;
    } else if (!a.startsWith("-") && !target) {
      target = a;
    }
  }
  if (!target) {
    process.stderr.write(
      "usage: bun pop.ts <url | file://path | local-path> [--timeout secs]\n",
    );
    process.exit(2);
  }
  if (!/^(https?|file):\/\//.test(target)) {
    target = "file://" + (target.startsWith("/") ? target : `${process.cwd()}/${target}`);
  }
  return { target, timeoutSec };
}

// ponytail: pragmatic robots.txt parser — exact UA-group match falling back to
// '*', longest-prefix Disallow vs Allow, ties to Allow. Skips wildcard '$'/'*'
// glob semantics inside paths; upgrade to a full matcher only if false reads bite.
type RobotsGroup = { disallow: string[]; allow: string[] };

function parseRobots(txt: string): Record<string, RobotsGroup> {
  const groups: Record<string, RobotsGroup> = {};
  let current: string[] = [];
  let expectingAgents = true;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const m = line.match(/^(user-agent|disallow|allow)\s*:\s*(.*)$/i);
    if (!m) continue;
    const field = m[1].toLowerCase();
    const value = m[2].trim();
    if (field === "user-agent") {
      if (!expectingAgents) current = [];
      expectingAgents = true;
      const ua = value.toLowerCase();
      if (!groups[ua]) groups[ua] = { disallow: [], allow: [] };
      current.push(ua);
    } else {
      expectingAgents = false;
      for (const ua of current) {
        if (field === "disallow") groups[ua].disallow.push(value);
        else groups[ua].allow.push(value);
      }
    }
  }
  return groups;
}

function isBlocked(
  groups: Record<string, RobotsGroup>,
  bot: string,
  path: string,
): boolean {
  const g = groups[bot.toLowerCase()] ?? groups["*"];
  if (!g) return false;
  const longest = (rules: string[]) =>
    rules
      .filter((r) => r !== "" && path.startsWith(r))
      .reduce((m, r) => Math.max(m, r.length), -1);
  return longest(g.disallow) > longest(g.allow);
}

async function checkAiAccess(
  context: BrowserContext,
  finalUrl: string,
): Promise<AiAccess | null> {
  if (!/^https?:/.test(finalUrl)) return null;
  const origin = new URL(finalUrl).origin;
  const path = new URL(finalUrl).pathname || "/";

  let robotsFound = false;
  let blocked: string[] = [];
  try {
    const res = await context.request.get(`${origin}/robots.txt`, { timeout: 10000 });
    if (res.ok()) {
      robotsFound = true;
      const groups = parseRobots(await res.text());
      blocked = AI_BOTS.filter((b) => isBlocked(groups, b, path));
    }
  } catch {
    /* no robots.txt reachable → treat as all-allowed */
  }

  let llmsTxt = false;
  try {
    const res = await context.request.get(`${origin}/llms.txt`, { timeout: 10000 });
    llmsTxt = res.ok();
  } catch {
    /* absent */
  }

  return { robotsFound, llmsTxt, checked: AI_BOTS, blocked };
}

const CAP = 100; // ponytail: cap alt/anchor arrays — a 100-link page is enough signal.

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  const t0 = Date.now();

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (compatible; pb-pop/1; +https://github.com/pixelbrew-studio/pb-suite)",
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();
    await page.goto(args.target, {
      waitUntil: "networkidle",
      timeout: args.timeoutSec * 1000,
    });

    const finalUrl = page.url();
    const title = await page.title();

    const data = await page.evaluate((cap: number) => {
      const txt = (el: Element | null) => (el?.textContent || "").trim();

      const jsonLd: { types: string[]; raw: unknown }[] = [];
      let jsonLdParseErrors = 0;
      document
        .querySelectorAll('script[type="application/ld+json"]')
        .forEach((s) => {
          try {
            const parsed = JSON.parse(s.textContent || "");
            const collect = (node: any): string[] => {
              if (!node || typeof node !== "object") return [];
              const t = node["@type"];
              const here = Array.isArray(t) ? t : t ? [t] : [];
              const graph = node["@graph"];
              const nested = Array.isArray(graph) ? graph.flatMap(collect) : [];
              return [...here, ...nested];
            };
            const types = Array.isArray(parsed)
              ? parsed.flatMap(collect)
              : collect(parsed);
            jsonLd.push({ types, raw: parsed });
          } catch {
            jsonLdParseErrors++;
          }
        });

      const meta = (sel: string) =>
        (document.querySelector(sel) as HTMLMetaElement | null)?.content?.trim() ||
        null;

      const ogTags: Record<string, string> = {};
      document.querySelectorAll('meta[property^="og:"]').forEach((m) => {
        const p = m.getAttribute("property");
        const c = (m as HTMLMetaElement).content;
        if (p && c) ogTags[p] = c.trim();
      });

      const headings = Array.from(
        document.querySelectorAll("h1,h2,h3,h4,h5,h6"),
      ).map((h) => ({ level: Number(h.tagName[1]), text: txt(h) }));

      // Sections: each heading paired with the first paragraph that follows it,
      // in document order. This is the passage AI engines lift when they cite —
      // "answer-first" sections score high, branding-headings-then-fluff low.
      const flow = Array.from(
        document.querySelectorAll("h1,h2,h3,h4,h5,h6,p"),
      );
      const sections: { level: number; heading: string; opener: string }[] = [];
      for (let i = 0; i < flow.length && sections.length < 40; i++) {
        const el = flow[i];
        if (!/^H[1-6]$/.test(el.tagName)) continue;
        let opener = "";
        for (let j = i + 1; j < flow.length; j++) {
          if (/^H[1-6]$/.test(flow[j].tagName)) break;
          const t = txt(flow[j]);
          if (t) {
            opener = t;
            break;
          }
        }
        sections.push({
          level: Number(el.tagName[1]),
          heading: txt(el),
          opener: opener.slice(0, 240),
        });
      }

      const paragraphs = Array.from(document.querySelectorAll("p")).map((p) =>
        txt(p),
      );
      const longestParagraphChars = paragraphs.reduce(
        (m, p) => Math.max(m, p.length),
        0,
      );

      const listItemCount = document.querySelectorAll("li").length;
      const tableCount = document.querySelectorAll("table").length;
      const questionHeadings = headings.filter((h) =>
        h.text.trim().endsWith("?"),
      ).length;
      const faqDetected =
        jsonLd.some((b) => b.types.includes("FAQPage")) ||
        document.querySelectorAll("details").length >= 2 ||
        questionHeadings >= 3;

      const imgs = Array.from(document.querySelectorAll("img"));
      const altTexts: string[] = [];
      let missingAlt = 0;
      imgs.forEach((img) => {
        const alt = (img.getAttribute("alt") || "").trim();
        if (!alt) missingAlt++;
        else if (altTexts.length < cap) altTexts.push(alt);
      });

      const here = location.hostname;
      let internal = 0;
      let external = 0;
      const anchorTexts: string[] = [];
      document.querySelectorAll("a[href]").forEach((a) => {
        const href = (a as HTMLAnchorElement).href;
        let host = "";
        try {
          host = new URL(href).hostname;
        } catch {
          /* relative / mailto / file */
        }
        if (!host || host === here) internal++;
        else external++;
        const t = txt(a);
        if (t && anchorTexts.length < cap) anchorTexts.push(t);
      });

      const wordCount = (document.body?.innerText || "")
        .split(/\s+/)
        .filter(Boolean).length;

      return {
        metaDescription: meta('meta[name="description"]'),
        canonical:
          (document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null)
            ?.href || null,
        lang: document.documentElement.getAttribute("lang"),
        ogTags,
        jsonLd,
        jsonLdParseErrors,
        headings,
        sections,
        wordCount,
        longestParagraphChars,
        paragraphCount: paragraphs.length,
        listItemCount,
        tableCount,
        faqDetected,
        images: { total: imgs.length, missingAlt, altTexts },
        links: { internal, external, anchorTexts },
      };
    }, CAP);

    const aiAccess = await checkAiAccess(context, finalUrl);

    const result: Result = {
      url: finalUrl,
      title,
      ...data,
      aiAccess,
      method: "playwright",
      elapsed_ms: Date.now() - t0,
    };
    process.stdout.write(JSON.stringify(result, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((err: Error) => {
  process.stderr.write(`pop: ${err.message}\n`);
  process.exit(1);
});
