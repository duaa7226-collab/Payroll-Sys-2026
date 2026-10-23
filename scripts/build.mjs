import { spawnSync } from "node:child_process"
import { cpSync, existsSync, mkdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const npmCommand = process.platform === "win32" ? "npx.cmd" : "npx"

const result = spawnSync(npmCommand, ["next", "build"], {
  cwd: root,
  stdio: "inherit",
  // .cmd shims on Windows require a shell; POSIX entries do not.
  shell: process.platform === "win32",
})

if (result.status !== 0) {
  process.exit(result.status ?? 1)
}

const staticSource = join(root, ".next", "static")
const standaloneNext = join(root, ".next", "standalone", ".next")
const publicSource = join(root, "public")
const standalonePublic = join(root, ".next", "standalone", "public")

if (!existsSync(staticSource)) throw new Error(`Missing build output: ${staticSource}`)
mkdirSync(standaloneNext, { recursive: true })
cpSync(staticSource, standaloneNext, { recursive: true, force: true })

if (existsSync(publicSource)) {
  mkdirSync(standalonePublic, { recursive: true })
  cpSync(publicSource, standalonePublic, { recursive: true, force: true })
}

console.log("Standalone assets copied successfully.")
