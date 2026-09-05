import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const argv = process.argv.slice(2);
const maxIndex = argv.indexOf("--max");
const max = maxIndex >= 0 ? Number(argv[maxIndex + 1]) : undefined;
const cycleIndex = argv.indexOf("--assert-no-cycles");
const json = argv.includes("--json");
const optionIndexes = new Set([
  argv.indexOf("--json"),
  maxIndex,
  maxIndex >= 0 ? maxIndex + 1 : -1,
  cycleIndex,
  cycleIndex >= 0 ? cycleIndex + 1 : -1,
]);
const files = argv.filter((_, index) => !optionIndexes.has(index));

const resolveRelativeImport = (fromFile, specifier) => {
  const base = path.resolve(path.dirname(fromFile), specifier);
  const candidates = [
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, "index.ts"),
    path.join(base, "index.tsx"),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate));
};

const importsFor = (file) => {
  const source = fs.readFileSync(file, "utf8");
  return ts.preProcessFile(source, true, true).importedFiles
    .map(({ fileName }) => fileName)
    .filter((specifier) => specifier.startsWith("."))
    .map((specifier) => resolveRelativeImport(file, specifier))
    .filter((candidate) => candidate !== undefined);
};

const assertNoCycles = (entry) => {
  const visiting = new Set();
  const visited = new Set();
  const stack = [];
  const visit = (file) => {
    const normalized = path.resolve(file);
    if (visiting.has(normalized)) {
      const start = stack.indexOf(normalized);
      throw new Error(`Import cycle: ${[...stack.slice(start), normalized].join(" -> ")}`);
    }
    if (visited.has(normalized)) return;
    visiting.add(normalized);
    stack.push(normalized);
    for (const dependency of importsFor(normalized)) visit(dependency);
    stack.pop();
    visiting.delete(normalized);
    visited.add(normalized);
  };
  visit(entry);
};

const measure = (file) => {
  const source = fs.readFileSync(file, "utf8");
  const physical = source.split(/\r?\n/).length - (source.endsWith("\n") ? 1 : 0);
  const nonblank = source.split(/\r?\n/).filter((line) => line.trim().length > 0).length;
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, true, ts.LanguageVariant.Standard, source);
  const tokenLines = new Set();
  for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) {
    const start = scanner.getTokenPos();
    const end = scanner.getTextPos();
    const startLine = source.slice(0, start).split(/\r?\n/).length;
    const endLine = source.slice(0, Math.max(start, end - 1)).split(/\r?\n/).length;
    for (let line = startLine; line <= endLine; line += 1) tokenLines.add(line);
  }
  return { file: file.replaceAll("\\", "/"), physical, nonblank, pure: tokenLines.size };
};

if (cycleIndex >= 0) {
  const entry = argv[cycleIndex + 1];
  if (!entry) throw new Error("--assert-no-cycles requires an entry file");
  assertNoCycles(entry);
  if (json) console.log(JSON.stringify({ entry, cycles: [] }, null, 2));
  else console.log(`No relative-import cycles from ${entry}`);
} else {
  if (files.length === 0) throw new Error("Provide at least one TypeScript file");
  const reports = files.map(measure);
  if (json) console.log(JSON.stringify(reports.length === 1 ? reports[0] : reports, null, 2));
  else reports.forEach((report) => console.log(`${report.file}: ${report.pure} pure LOC`));
  if (max !== undefined) {
    const oversized = reports.filter((report) => report.pure > max);
    if (oversized.length > 0) {
      console.error(`Pure LOC exceeds ${max}: ${oversized.map(({ file, pure }) => `${file} (${pure})`).join(", ")}`);
      process.exitCode = 1;
    }
  }
}
