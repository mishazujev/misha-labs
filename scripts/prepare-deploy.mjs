import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const target = join(root, ".deploy");
const files = [
  "index.html",
  "server.mjs",
  "analytics.mjs",
  "package.json",
  "zone-start.mjs",
  "chemistry/index.html",
  "lab/lab.html",
  "lab3d/lab3d.html",
  "hub-assets/lab-biology.jpg",
  "hub-assets/lab-chemistry.jpg",
  "hub-assets/lab-geography.jpg",
  "hub-assets/lab-math.jpg",
  "hub-assets/lab-navigation.jpg",
  "hub-assets/lab-strength.jpg",
  "hub-assets/lab-thermodynamics.jpg"
];

await rm(target, { recursive: true, force: true });
for (const relativePath of files) {
  const destination = join(target, relativePath);
  await mkdir(dirname(destination), { recursive: true });
  await cp(join(root, relativePath), destination);
}

console.log(`Prepared ${files.length} production files in ${target}`);
