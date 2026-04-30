#!/usr/bin/env node

import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { loadConfig, getSourceDir } from "./config.js";
import { status, sync, adopt, list } from "./skills.js";
import { fmt } from "./output.js";

const HELP = `
${fmt.bold("skillecta")} — sync agent skills from ~/.agents/skills

${fmt.bold("Usage:")}
  skillecta status            Show skill state across all agents
  skillecta sync [--dry-run]  Link source skills to all agents
  skillecta adopt [--dry-run] Adopt untracked agent skills into source
  skillecta list              List source skills

${fmt.bold("Config:")}
  ~/.agents/config.toml     Agent definitions (optional)
  SKILLECTA_SOURCE            Override source dir (default: ~/.agents/skills)

${fmt.bold("Config format:")}
  [agents.claude]
  path = "~/.claude"
  skills_dir = "skills"     # optional, defaults to "skills"
`.trim();

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const dryRun = rest.includes("--dry-run");

  const sourceDir = getSourceDir();
  if (!existsSync(sourceDir)) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question(
      `${fmt.yellow("~/.agents/skills")} doesn't exist yet. Create it? ${fmt.dim("[Y/n]")} `
    );
    rl.close();
    if (answer && !answer.match(/^y(es)?$/i)) {
      process.exit(0);
    }
    await mkdir(sourceDir, { recursive: true });
    console.log(`${fmt.green("✓")} Created ${sourceDir}\n`);
  }

  const config = await loadConfig();

  switch (command) {
    case "status":
      return status(config);
    case "sync":
      return sync(config, dryRun);
    case "adopt":
      return adopt(config, dryRun);
    case "list":
      return list(config);
    case "-h":
    case "--help":
    case "help":
      console.log(HELP);
      return;
    default:
      console.log(HELP);
      process.exit(command ? 1 : 0);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
