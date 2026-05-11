#!/usr/bin/env bun
/**
 * pb-browse — fetch a URL via headless Chromium, return clean markdown + optional screenshot.
 *
 * Output: JSON to stdout with { url, title, content, length, truncated, screenshot, method, elapsed_ms }.
 * Errors: human-readable message to stderr, non-zero exit code.
 */

import { chromium } from "playwright";
import TurndownService from "turndown";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

type Result = {
  url: string;
  title: string;
  content: string;
  length: number;
  truncated: boolean;
  screenshot: string | null;
  method: "playwright";
  elapsed_ms: number;
};

type Args = {
  url: string;
  screenshot: boolean;
  screenshotPath: string | null;
  full: boolean;
  raw: boolean;
  timeoutSec: number;
};

function parseArgs(argv: string[]): Args {
  const args = argv.slice(2);
  let url: string | null = null;
  let screenshot = false;
  let screenshotPath: string | null = null;
  let full = false;
  let raw = false;
  let timeoutSec = 30;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--screenshot" || a === "-s") {
      screenshot = true;
      const next = args[i + 1];
      if (next && !next.startsWith("-") && next !== url) {
        screenshotPath = args[++i];
      }
    } else if (a === "--full") {
      full = true;
    } else if (a === "--raw") {
      raw = true;
    } else if (a === "--timeout") {
      timeoutSec = Number(args[++i]) || 30;
    } else if (!a.startsWith("-") && !url) {
      url = a;
    }
  }

  if (!url) {
    process.stderr.write(
      "usage: bun browse.ts <url> [--screenshot [path]] [--raw] [--full] [--timeout secs]\n",
    );
    process.exit(2);
  }
  return { url, screenshot, screenshotPath, full, raw, timeoutSec };
}

const NOISE_SELECTORS = [
  "script",
  "style",
  "noscript",
  "nav",
  "header",
  "footer",
  "aside",
  'form[role="search"]',
  '[role="banner"]',
  '[role="contentinfo"]',
  '[role="navigation"]',
  '[class*="cookie" i]',
  '[class*="newsletter" i]',
  '[class*="advert" i]',
  '[class*="ad-"]',
  '[aria-label*="cookie" i]',
  '[class*="related" i]',
  '[class*="share" i]',
  '[class*="subscribe" i]',
].join(", ");

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  const t0 = Date.now();

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (compatible; pb-browse/1; +https://github.com/pixelbrew-studio/pb-suite)",
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();

    await page.goto(args.url, {
      waitUntil: "networkidle",
      timeout: args.timeoutSec * 1000,
    });

    const finalUrl = page.url();
    const title = await page.title();

    const html = await page.evaluate((noise: string) => {
      document.querySelectorAll(noise).forEach((n) => n.remove());
      const root =
        document.querySelector("main") ||
        document.querySelector("article") ||
        document.querySelector('[role="main"]') ||
        document.body;
      return root.innerHTML;
    }, NOISE_SELECTORS);

    let content = html;
    if (!args.raw) {
      const td = new TurndownService({
        headingStyle: "atx",
        codeBlockStyle: "fenced",
        bulletListMarker: "-",
      });
      content = td.turndown(html);
      content = content.replace(/\n{3,}/g, "\n\n").trim();
    }

    const fullLength = content.length;
    let truncated = false;
    if (!args.full && content.length > 8000) {
      const head = content.slice(0, 6000);
      const tail = content.slice(-1000);
      content = `${head}\n\n... <truncated, ${fullLength - 7000} chars omitted, run with --full> ...\n\n${tail}`;
      truncated = true;
    }

    let screenshotOut: string | null = null;
    if (args.screenshot) {
      const hostname = new URL(finalUrl).hostname.replace(/[^a-z0-9.-]/gi, "_");
      const ts = Date.now();
      const defaultPath = `.pb-browse/${hostname}-${ts}.png`;
      const outPath = args.screenshotPath ?? defaultPath;
      await mkdir(dirname(outPath), { recursive: true });
      await page.screenshot({ path: outPath, fullPage: true });
      screenshotOut = outPath;
    }

    const result: Result = {
      url: finalUrl,
      title,
      content,
      length: fullLength,
      truncated,
      screenshot: screenshotOut,
      method: "playwright",
      elapsed_ms: Date.now() - t0,
    };
    process.stdout.write(JSON.stringify(result, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((err: Error) => {
  process.stderr.write(`pb-browse: ${err.message}\n`);
  process.exit(1);
});
