import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { isAbsolute, normalize, resolve } from "node:path";

const HOME = process.env.HOME ?? process.env.USERPROFILE ?? "";

export interface AgentConfig {
  name: string;
  path: string;
  skillsDir: string;
}

export interface Config {
  source: string;
  agents: AgentConfig[];
}

const DEFAULT_AGENTS: AgentConfig[] = [
  { name: "claude", path: resolve(HOME, ".claude"), skillsDir: "skills" },
  { name: "cursor", path: resolve(HOME, ".cursor"), skillsDir: "skills" },
];

export function getSourceDir(): string {
  return process.env.SKILLECTA_SOURCE ?? resolve(HOME, ".agents/skills");
}

export async function loadConfig(): Promise<Config> {
  const source = resolve(getSourceDir());
  const configPath =
    process.env.SKILLECTA_CONFIG ?? resolve(HOME, ".agents/config.toml");

  if (!existsSync(configPath)) {
    return { source, agents: DEFAULT_AGENTS };
  }

  const content = await readFile(configPath, "utf-8");
  const agents = parseAgentsFromToml(content);

  return { source, agents: normalizeAgents(agents.length > 0 ? agents : DEFAULT_AGENTS) };
}

function parseAgentsFromToml(content: string): AgentConfig[] {
  const agents: AgentConfig[] = [];
  let current: Partial<AgentConfig> | null = null;

  for (const raw of content.split("\n")) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;

    const sectionMatch = line.match(/^\[agents\.([a-zA-Z0-9_-]+)\]$/);
    if (sectionMatch) {
      if (current?.name && current.path) {
        agents.push({
          name: current.name,
          path: current.path,
          skillsDir: current.skillsDir ?? "skills",
        });
      }
      current = { name: sectionMatch[1] };
      continue;
    }

    if (!current) continue;

    const kvMatch = line.match(/^(\w+)\s*=\s*"(.+)"$/);
    if (!kvMatch) continue;

    const [, key, value] = kvMatch;
    if (key === "path") {
      current.path = value.replace(/^~/, HOME);
    } else if (key === "skills_dir") {
      current.skillsDir = value;
    }
  }

  // Push last section
  if (current?.name && current.path) {
    agents.push({
      name: current.name,
      path: current.path,
      skillsDir: current.skillsDir ?? "skills",
    });
  }

  return agents;
}

function normalizeAgents(agents: AgentConfig[]): AgentConfig[] {
  return agents.map((agent) => ({
    ...agent,
    path: resolve(agent.path),
    skillsDir: normalizeSkillsDir(agent.skillsDir),
  }));
}

function normalizeSkillsDir(skillsDir: string): string {
  const normalized = normalize(skillsDir);

  if (!normalized || isAbsolute(normalized)) {
    throw new Error(`Invalid skills_dir "${skillsDir}". Use a relative path, e.g. "skills".`);
  }

  const parts = normalized.split(/[\\/]+/).filter(Boolean);
  if (parts.length === 0 || parts.some((part) => part === "..")) {
    throw new Error(`Invalid skills_dir "${skillsDir}". Path traversal is not allowed.`);
  }

  return normalized;
}
