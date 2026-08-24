import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";

const root = process.cwd();
const mobileRoot = join(root, "src/apps/professional-mobile");
const desktopRoots = [
  join(root, "src/pages/desktop"),
  join(root, "src/apps/professional-desktop"),
];

async function files(dir) {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    const nested = await Promise.all(
      entries.map((entry) => {
        const path = join(dir, entry.name);
        return entry.isDirectory() ? files(path) : [path];
      }),
    );
    return nested.flat();
  } catch {
    return [];
  }
}

const violations = [];

for (const file of await files(mobileRoot)) {
  if (![".ts", ".tsx", ".js", ".jsx"].includes(extname(file))) continue;
  const source = await readFile(file, "utf8");
  if (
    source.includes("@/pages/desktop") ||
    source.includes("@/components/desktop")
  ) {
    violations.push(
      `${relative(root, file)} imports a desktop UI boundary`,
    );
  }
}

for (const desktopRoot of desktopRoots) {
  for (const file of await files(desktopRoot)) {
    if (![".ts", ".tsx", ".js", ".jsx"].includes(extname(file))) continue;
    const source = await readFile(file, "utf8");
    if (source.includes("@/apps/professional-mobile")) {
      violations.push(
        `${relative(root, file)} imports the professional mobile boundary`,
      );
    }
  }
}

if (violations.length) {
  console.error("Frontend boundary violations:\n" + violations.map((v) => `- ${v}`).join("\n"));
  process.exit(1);
}

console.log("Frontend surface boundaries are valid.");
