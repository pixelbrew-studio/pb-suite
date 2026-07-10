#!/usr/bin/env bun
/**
 * pb-qa — visit a running URL via headless Chromium, capture console errors,
 * network failures, and broken images per route. No code edits.
 *
 * Output: JSON to stdout with aggregated findings + per-route detail.
 */

import { chromium, type Page, type ConsoleMessage } from "playwright";
import { mkdir } from "node:fs/promises";

type Finding = {
  severity: "blocker" | "important" | "nit";
  category: "console-error" | "page-error" | "http-error" | "broken-image" | "console-warning";
  detail: string;
};

type RouteReport = {
  path: string;
  finalUrl: string;
  title: string;
  status: number;
  findings: Finding[];
  screenshot: string | null;
  elapsed_ms: number;
};

type Report = {
  baseUrl: string;
  routesChecked: number;
  totals: { blocker: number; important: number; nit: number };
  findings: Finding[];
  routes: RouteReport[];
};

type Args = {
  baseUrl: string;
  routes: string[] | null;
  max: number;
  fullPageScreenshots: boolean;
  storageState: string | null;
  noScreenshots: boolean;
};

function parseArgs(argv: string[]): Args {
  const args = argv.slice(2);
  let baseUrl: string | null = null;
  let routes: string[] | null = null;
  let max = 10;
  let fullPageScreenshots = false;
  let storageState: string | null = null;
  let noScreenshots = false;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--routes") {
      routes = (args[++i] || "").split(",").map((s) => s.trim()).filter(Boolean);
    } else if (a === "--max") {
      max = Number(args[++i]) || 10;
    } else if (a === "--full-page-screenshots") {
      fullPageScreenshots = true;
    } else if (a === "--storage-state") {
      storageState = args[++i] || null;
    } else if (a === "--no-screenshots") {
      noScreenshots = true;
    } else if (!a.startsWith("-") && !baseUrl) {
      baseUrl = a;
    }
  }

  if (!baseUrl) {
    process.stderr.write(
      "usage: bun qa.ts <baseUrl> [--routes a,b,c] [--max N] " +
        "[--full-page-screenshots] [--no-screenshots] [--storage-state path]\n",
    );
    process.exit(2);
  }
  return { baseUrl, routes, max, fullPageScreenshots, storageState, noScreenshots };
}

function classifyConsoleError(text: string): "blocker" | "important" {
  if (/hydration|uncaught|cannot read|undefined is not/i.test(text)) return "blocker";
  return "important";
}

function classifyHttpError(status: number, url: string): Finding["severity"] | null {
  if (status === 401 || status === 403) return "nit";
  if (status >= 500) return "blocker";
  if (status >= 400) {
    if (/favicon|\.map$|sourcemap/.test(url)) return "nit";
    return "important";
  }
  return null;
}

async function checkRoute(
  page: Page,
  baseUrl: string,
  path: string,
  screenshotDir: string,
  args: Args,
): Promise<RouteReport> {
  const findings: Finding[] = [];

  // Skip console-errors that are 1:1 duplicates of HTTP-errors we already log via the
  // response listener — "Failed to load resource: ... 4xx/5xx" is the same event seen
  // from two angles. Project console.error() calls with custom text still come through.
  const isResourceLoadError = (text: string): boolean =>
    /^Failed to load resource:.*\b\d{3}\b/i.test(text);

  const consoleHandler = (msg: ConsoleMessage) => {
    const text = msg.text();
    if (msg.type() === "error") {
      if (isResourceLoadError(text)) return;
      findings.push({
        severity: classifyConsoleError(text),
        category: "console-error",
        detail: text,
      });
    } else if (msg.type() === "warning" && !/deprecated|sourcemap/i.test(text)) {
      findings.push({ severity: "nit", category: "console-warning", detail: text });
    }
  };
  const pageErrorHandler = (err: Error) => {
    findings.push({ severity: "blocker", category: "page-error", detail: err.message });
  };
  // Catch failed XHR/API/subresource responses (and the main document) directly.
  // Redirects (3xx) classify to null and are ignored; favicon/.map/4xx-auth are
  // downgraded inside classifyHttpError.
  const responseHandler = (res: { status(): number; url(): string }) => {
    const severity = classifyHttpError(res.status(), res.url());
    if (severity) {
      findings.push({ severity, category: "http-error", detail: `${res.status()} ${res.url()}` });
    }
  };

  page.on("console", consoleHandler);
  page.on("pageerror", pageErrorHandler);
  page.on("response", responseHandler);

  const t0 = Date.now();
  const url = new URL(path, baseUrl).toString();
  let status = 0;
  let finalUrl = url;
  let title = "";

  try {
    const response = await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
    status = response?.status() ?? 0;
    finalUrl = page.url();
    title = await page.title();

    const brokenImages = await page.$$eval("img", (imgs) =>
      imgs
        .filter((i) => !(i as HTMLImageElement).complete || (i as HTMLImageElement).naturalWidth === 0)
        .map((i) => (i as HTMLImageElement).src)
        .filter((s) => s && !s.startsWith("data:")),
    );
    for (const src of brokenImages) {
      findings.push({ severity: "important", category: "broken-image", detail: src });
    }
  } catch (err) {
    findings.push({
      severity: "blocker",
      category: "page-error",
      detail: (err as Error).message,
    });
  }

  page.off("console", consoleHandler);
  page.off("pageerror", pageErrorHandler);
  page.off("response", responseHandler);

  let screenshot: string | null = null;
  if (!args.noScreenshots) {
    const safe = path.replace(/[^a-z0-9.-]/gi, "_").slice(0, 60) || "_root";
    const out = `${screenshotDir}/${safe}.png`;
    try {
      await page.screenshot({ path: out, fullPage: args.fullPageScreenshots });
      screenshot = out;
    } catch {
      screenshot = null;
    }
  }

  return {
    path,
    finalUrl,
    title,
    status,
    findings,
    screenshot,
    elapsed_ms: Date.now() - t0,
  };
}

async function discoverRoutes(page: Page, baseUrl: string, max: number): Promise<string[]> {
  const base = new URL(baseUrl);
  const hrefs = await page.$$eval("a[href]", (as) =>
    as.map((a) => (a as HTMLAnchorElement).getAttribute("href")),
  );

  const seen = new Set<string>(["/"]);
  for (const h of hrefs) {
    if (!h) continue;
    let path: string | null = null;
    if (h.startsWith("/") && !h.startsWith("//") && !h.startsWith("/_")) {
      path = h;
    } else if (h.startsWith("http")) {
      try {
        const u = new URL(h);
        if (u.host === base.host) path = u.pathname + u.search;
      } catch {
        // skip
      }
    }
    if (!path) continue;
    if (/\.(png|jpg|jpeg|gif|svg|ico|webp|pdf|zip|css|js|map|xml|json)(\?|$)/i.test(path)) continue;
    if (path.includes("#")) path = path.split("#")[0];
    seen.add(path);
    if (seen.size >= max) break;
  }
  return Array.from(seen).slice(0, max);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  const ts = Date.now();
  const screenshotDir = `.pb-qa/${new URL(args.baseUrl).hostname.replace(/[^a-z0-9.-]/gi, "_")}-${ts}`;
  if (!args.noScreenshots) await mkdir(screenshotDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (compatible; pb-qa/1)",
      viewport: { width: 1280, height: 800 },
      ...(args.storageState ? { storageState: args.storageState } : {}),
    });
    const page = await context.newPage();

    let routes = args.routes;
    if (!routes) {
      try {
        await page.goto(args.baseUrl, { waitUntil: "networkidle", timeout: 30000 });
        routes = await discoverRoutes(page, args.baseUrl, args.max);
      } catch (err) {
        routes = ["/"];
      }
    }

    const routeReports: RouteReport[] = [];
    for (const path of routes.slice(0, args.max)) {
      const report = await checkRoute(page, args.baseUrl, path, screenshotDir, args);
      routeReports.push(report);
    }

    // Aggregate: detect sticky-redirect targets — N distinct paths landing on the same
    // finalUrl. Three or more is the threshold; two can be legitimate (/home → /).
    const redirectBuckets = new Map<string, string[]>();
    for (const r of routeReports) {
      if (r.path !== new URL(r.finalUrl).pathname + new URL(r.finalUrl).search) {
        const existing = redirectBuckets.get(r.finalUrl) ?? [];
        existing.push(r.path);
        redirectBuckets.set(r.finalUrl, existing);
      }
    }

    const aggregateFindings: Finding[] = [];
    for (const [target, paths] of redirectBuckets.entries()) {
      if (paths.length >= 3) {
        aggregateFindings.push({
          severity: "nit",
          category: "http-error",
          detail: `${paths.length} routes redirected to same target: ${target} (from ${paths.join(", ")}) — review middleware / auth redirect logic`,
        });
      }
    }

    const totals = { blocker: 0, important: 0, nit: 0 };
    for (const r of routeReports) {
      for (const f of r.findings) totals[f.severity]++;
    }
    for (const f of aggregateFindings) totals[f.severity]++;

    const report: Report = {
      baseUrl: args.baseUrl,
      routesChecked: routeReports.length,
      totals,
      findings: aggregateFindings,
      routes: routeReports,
    };
    process.stdout.write(JSON.stringify(report, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((err: Error) => {
  process.stderr.write(`pb-qa: ${err.message}\n`);
  process.exit(1);
});
