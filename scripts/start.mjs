import { spawn } from "node:child_process"
import { existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const server = join(root, ".next", "standalone", "server.js")

if (!existsSync(server)) {
  console.error("Production server not found. Run npm run build first.")
  process.exit(1)
}

const child = spawn(process.execPath, [server], {
  cwd: root,
  env: { ...process.env, NODE_ENV: "production" },
  stdio: "inherit",
})

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  else process.exit(code ?? 1)
})
