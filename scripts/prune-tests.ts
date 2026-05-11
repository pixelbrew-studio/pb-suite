#!/usr/bin/env bun
/**
 * pb-prune-tests — scan a repo for likely-obsolete test files.
 *
 * Detects: broken imports (referenced module doesn't exist),
 * skipped/disabled specs (only `.skip` / `xit` content), references to long-merged PRs.
 *
 * Output: JSON to stdout with per-file findings and severity.
 * No deletions — read-only audit.
 */

import { Glob } from "bun";
import { readFile, stat } from "node:fs/promises";
import { resolve, dirname, join } from "node:path";

type Reason =
  | { type: "broken-import"; detail: string }
  | { type: "all-skipped"; detail: string }
  | { type: "stale-pr-ref"; detail: string }
  | { type: "stale-block-comment"; detail: string };

type Severity = "safe-delete" | "likely-delete" | "review";

type Finding = {
  path: string;
  severity: Severity;
  reasons: Reason[];
  metadata: { pr: number | null; skipped_tests: number; total_tests: number; lines: number };
};

type Args = {
  root: string;
  includeColocated: boolean;
  prAgeDays: number;
  ghRepo: string | null;
};

function parseArgs(argv: string[]): Args {
  const args = argv.slice(2);
  let root = process.cwd();
  let includeColocated = false;
  let prAgeDays = 90;
  let ghRepo: string | null = null;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--include-co-located") includeColocated = true;
    else if (a === "--pr-age-days") prAgeDays = Number(args[++i]) || 90;
    else if (a === "--gh-repo") ghRepo = args[++i] || null;
    else if (!a.startsWith("-")) root = resolve(a);
  }
  return { root, includeColocated, prAgeDays, ghRepo };
}

const TEST_GLOBS = [
  "tests/**/*.{test,spec}.{ts,tsx,js,jsx}",
  "e2e/**/*.{test,spec}.{ts,tsx,js,jsx}",
  "__tests__/**/*.{test,spec}.{ts,tsx,js,jsx}",
];

const COLOCATED_GLOB = "src/**/*.{test,spec}.{ts,tsx,js,jsx}";

async function findTestFiles(root: string, includeColocated: boolean): Promise<string[]> {
  const results = new Set<string>();
  const globs = includeColocated ? [...TEST_GLOBS, COLOCATED_GLOB] : TEST_GLOBS;
  for (const pattern of globs) {
    const glob = new Glob(pattern);
    for await (const file of glob.scan({ cwd: root, absolute: true })) {
      if (!file.includes("/node_modules/") && !file.includes("/.pb-")) {
        results.add(file);
      }
    }
  }
  return Array.from(results).sort();
}

async function readTsconfigPaths(root: string): Promise<Record<string, string[]>> {
  try {
    const raw = await readFile(join(root, "tsconfig.json"), "utf8");
    const stripped = raw.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
    const json = JSON.parse(stripped) as {
      compilerOptions?: { paths?: Record<string, string[]>; baseUrl?: string };
    };
    return json.compilerOptions?.paths ?? {};
  } catch {
    return {};
  }
}

function extractImports(content: string): string[] {
  const found = new Set<string>();
  const patterns = [
    /import\s+(?:[^'"]+?\s+from\s+)?['"]([^'"]+)['"]/g,
    /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(content))) {
      found.add(m[1]);
    }
  }
  return Array.from(found);
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function resolveImport(
  spec: string,
  specPath: string,
  root: string,
  tsconfigPaths: Record<string, string[]>,
): Promise<{ resolvable: boolean; tried: string }> {
  if (!spec.startsWith(".") && !spec.startsWith("@/") && !spec.startsWith("~/")) {
    return { resolvable: true, tried: "<external>" };
  }

  const candidates: string[] = [];

  if (spec.startsWith(".")) {
    const base = resolve(dirname(specPath), spec);
    candidates.push(
      base,
      `${base}.ts`,
      `${base}.tsx`,
      `${base}.js`,
      `${base}.jsx`,
      `${base}/index.ts`,
      `${base}/index.tsx`,
    );
  } else {
    for (const [pattern, targets] of Object.entries(tsconfigPaths)) {
      const cleanPattern = pattern.replace(/\*$/, "");
      if (spec.startsWith(cleanPattern)) {
        const tail = spec.slice(cleanPattern.length);
        for (const target of targets) {
          const cleanTarget = target.replace(/\*$/, "");
          const base = resolve(root, cleanTarget + tail);
          candidates.push(
            base,
            `${base}.ts`,
            `${base}.tsx`,
            `${base}.js`,
            `${base}.jsx`,
            `${base}/index.ts`,
            `${base}/index.tsx`,
          );
        }
      }
    }

    if (spec.startsWith("@/") && candidates.length === 0) {
      const tail = spec.slice(2);
      const base = resolve(root, "src", tail);
      candidates.push(
        base,
        `${base}.ts`,
        `${base}.tsx`,
        `${base}.js`,
        `${base}.jsx`,
        `${base}/index.ts`,
        `${base}/index.tsx`,
      );
    }
  }

  for (const c of candidates) {
    if (await fileExists(c)) return { resolvable: true, tried: c };
  }
  return { resolvable: false, tried: candidates[0] ?? spec };
}

function countTests(content: string): { total: number; skipped: number } {
  const totalMatches = content.match(/\b(?:it|test)(?:\.(?:only|skip))?\s*\(/g) ?? [];
  const skippedMatches = content.match(/\b(?:it|test)\.skip\s*\(|\bxit\s*\(|\bxtest\s*\(/g) ?? [];
  return { total: totalMatches.length, skipped: skippedMatches.length };
}

function extractPrRef(content: string): number | null {
  const match = content.match(/E2E tests for PR #(\d+)/i) ?? content.match(/\bPR #(\d+)\b/);
  return match ? Number(match[1]) : null;
}

type PrInfo = { merged_at: string | null; state: string } | null;

async function fetchPrInfo(prNumber: number, repo: string | null): Promise<PrInfo> {
  try {
    const args = ["pr", "view", String(prNumber), "--json", "state,mergedAt"];
    if (repo) args.push("--repo", repo);
    const proc = Bun.spawn(["gh", ...args], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const out = await new Response(proc.stdout).text();
    const code = await proc.exited;
    if (code !== 0) return null;
    const json = JSON.parse(out) as { state: string; mergedAt: string | null };
    return { merged_at: json.mergedAt, state: json.state };
  } catch {
    return null;
  }
}

function classify(reasons: Reason[]): Severity {
  if (reasons.some((r) => r.type === "broken-import")) return "safe-delete";
  if (reasons.some((r) => r.type === "all-skipped")) return "likely-delete";
  if (reasons.some((r) => r.type === "stale-pr-ref")) return "review";
  return "review";
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  const root = args.root;
  const tsconfigPaths = await readTsconfigPaths(root);
  const files = await findTestFiles(root, args.includeColocated);
  const now = Date.now();
  const ageMs = args.prAgeDays * 24 * 60 * 60 * 1000;

  const findings: Finding[] = [];

  for (const file of files) {
    const content = await readFile(file, "utf8");
    const lines = content.split("\n").length;
    const reasons: Reason[] = [];

    const imports = extractImports(content);
    for (const spec of imports) {
      const result = await resolveImport(spec, file, root, tsconfigPaths);
      if (!result.resolvable) {
        reasons.push({
          type: "broken-import",
          detail: `${spec} → not found (tried ${result.tried})`,
        });
      }
    }

    const counts = countTests(content);
    if (counts.total > 0 && counts.skipped === counts.total) {
      reasons.push({
        type: "all-skipped",
        detail: `all ${counts.total} test cases use .skip / xit / xtest`,
      });
    }

    const pr = extractPrRef(content);
    if (pr) {
      const info = await fetchPrInfo(pr, args.ghRepo);
      if (info && info.state === "MERGED" && info.merged_at) {
        const mergedAge = now - new Date(info.merged_at).getTime();
        if (mergedAge > ageMs) {
          const days = Math.floor(mergedAge / (24 * 60 * 60 * 1000));
          reasons.push({
            type: "stale-pr-ref",
            detail: `PR #${pr} merged ${days} days ago`,
          });
        }
      }
    }

    if (reasons.length > 0) {
      findings.push({
        path: file.startsWith(root) ? file.slice(root.length + 1) : file,
        severity: classify(reasons),
        reasons,
        metadata: { pr, skipped_tests: counts.skipped, total_tests: counts.total, lines },
      });
    }
  }

  const totals = { "safe-delete": 0, "likely-delete": 0, review: 0 };
  for (const f of findings) totals[f.severity]++;

  process.stdout.write(
    JSON.stringify(
      { root, scanned: files.length, totals, findings },
      null,
      2,
    ),
  );
}

main().catch((err: Error) => {
  process.stderr.write(`pb-prune-tests: ${err.message}\n`);
  process.exit(1);
});
