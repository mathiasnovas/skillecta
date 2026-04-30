import { readdir, readlink, cp, rm, symlink, mkdir, realpath } from "node:fs/promises";
import { existsSync, lstatSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import type { Config } from "./config.js";
import { fmt, ok, warn, info, err } from "./output.js";

// ── Skill scanning ──────────────────────────────────────────────────

async function listDirs(dir: string): Promise<string[]> {
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter((e: import("node:fs").Dirent) => e.isDirectory() || e.isSymbolicLink())
    .map((e: import("node:fs").Dirent) => e.name);
}

interface SkillEntry {
  name: string;
  isSymlink: boolean;
  target?: string;
  pointsToSource: boolean;
  broken: boolean;
}

async function scanAgentSkills(
  agentSkillsPath: string,
  sourceDir: string
): Promise<SkillEntry[]> {
  const names = await listDirs(agentSkillsPath);
  const entries: SkillEntry[] = [];

  for (const name of names) {
    const fullPath = resolve(agentSkillsPath, name);
    const stat = lstatSync(fullPath);
    const isSymlink = stat.isSymbolicLink();

    if (isSymlink) {
      const target = await readlink(fullPath);
      const targetNorm = target.replace(/\/$/, "");
      const expectedNorm = resolve(sourceDir, name);
      const broken = !existsSync(fullPath);
      entries.push({
        name,
        isSymlink: true,
        target,
        pointsToSource: targetNorm === expectedNorm,
        broken,
      });
    } else {
      entries.push({
        name,
        isSymlink: false,
        pointsToSource: false,
        broken: false,
      });
    }
  }

  return entries;
}

// ── Commands ────────────────────────────────────────────────────────

export async function status(config: Config) {
  const sourceSkills = await listDirs(config.source);

  console.log(`${fmt.bold("Source")} ${fmt.dim(`(${config.source})`)}`);
  if (sourceSkills.length === 0) {
    console.log(`  ${fmt.dim("(empty)")}`);
  } else {
    for (const skill of sourceSkills) {
      console.log(`  ${fmt.green("●")} ${skill}`);
    }
  }
  console.log();

  for (const agent of config.agents) {
    const skillsPath = safeResolveWithin(agent.path, agent.skillsDir, `${agent.name}.skills_dir`);
    console.log(`${fmt.bold(agent.name)} ${fmt.dim(`(${skillsPath})`)}`);

    if (!existsSync(skillsPath)) {
      console.log(`  ${fmt.dim("(skills directory not found)")}`);
      console.log();
      continue;
    }

    const entries = await scanAgentSkills(skillsPath, config.source);

    for (const entry of entries) {
      if (entry.broken) {
        const targetLabel = entry.target ?? "(unknown target)";
        console.log(
          `  ${fmt.red("✗")} ${entry.name} ${fmt.dim("→")} ${fmt.red(targetLabel)} ${fmt.yellow("(broken symlink)")}`
        );
      } else if (entry.isSymlink && entry.pointsToSource) {
        console.log(
          `  ${fmt.green("✓")} ${entry.name} ${fmt.dim("→ source")}`
        );
      } else if (entry.isSymlink) {
        const targetLabel = entry.target ?? "(unknown target)";
        console.log(
          `  ${fmt.yellow("!")} ${entry.name} ${fmt.dim("→")} ${fmt.red(targetLabel)} ${fmt.yellow("(not linked to source)")}`
        );
      } else {
        console.log(
          `  ${fmt.yellow("!")} ${entry.name} ${fmt.yellow("(local copy, not symlinked)")}`
        );
      }
    }

    // Show missing source skills
    for (const skill of sourceSkills) {
      if (!entries.some((e) => e.name === skill)) {
        console.log(
          `  ${fmt.red("✗")} ${skill} ${fmt.dim("(missing)")}`
        );
      }
    }

    if (entries.length === 0 && sourceSkills.length === 0) {
      console.log(`  ${fmt.dim("(no skills)")}`);
    }

    console.log();
  }
}

export async function sync(config: Config, dryRun: boolean) {
  const sourceSkills = await listDirs(config.source);

  if (sourceSkills.length === 0) {
    err(`No skills found in ${config.source}`);
    process.exit(1);
  }

  let changes = 0;

  for (const agent of config.agents) {
    if (!existsSync(agent.path)) {
      info(`Skipping ${agent.name} — ${agent.path} does not exist`);
      continue;
    }

    const skillsPath = safeResolveWithin(agent.path, agent.skillsDir, `${agent.name}.skills_dir`);

    if (!existsSync(skillsPath)) {
      if (dryRun) {
        info(`Would create ${skillsPath}`);
      } else {
        await mkdir(skillsPath, { recursive: true });
        ok(`Created ${skillsPath}`);
      }
    }

    for (const skill of sourceSkills) {
      const link = safeResolveWithin(skillsPath, skill, `${agent.name}/${skill}`);
      const target = safeResolveWithin(config.source, skill, `source/${skill}`);

      if (lstatSafe(link)?.isSymbolicLink()) {
        const current = await readlink(link);
        const currentNorm = current.replace(/\/$/, "");
        if (currentNorm === target) continue;

        if (dryRun) {
          info(`Would relink ${agent.name}/${skill} (currently → ${current})`);
        } else {
          await rm(link);
          await symlink(target, link);
          ok(`Relinked ${agent.name}/${skill}`);
        }
        changes++;
      } else if (existsSync(link)) {
        warn(
          `${agent.name}/${skill} exists as local copy — run 'skillecta adopt' first`
        );
      } else {
        if (dryRun) {
          info(`Would link ${agent.name}/${skill} → source`);
        } else {
          await symlink(target, link);
          ok(`Linked ${agent.name}/${skill}`);
        }
        changes++;
      }
    }
  }

  if (changes === 0) {
    console.log(fmt.green("Everything in sync."));
  } else if (dryRun) {
    console.log(`\n${fmt.dim("Run without --dry-run to apply.")}`);
  }
}

export async function adopt(config: Config, dryRun: boolean) {
  let adopted = 0;

  for (const agent of config.agents) {
    const skillsPath = safeResolveWithin(agent.path, agent.skillsDir, `${agent.name}.skills_dir`);
    if (!existsSync(skillsPath)) continue;

    const entries = await scanAgentSkills(skillsPath, config.source);

    for (const entry of entries) {
      const itemPath = safeResolveWithin(skillsPath, entry.name, `${agent.name}/${entry.name}`);
      const sourcePath = safeResolveWithin(config.source, entry.name, `source/${entry.name}`);

      // Already correctly linked — skip
      if (entry.isSymlink && entry.pointsToSource) continue;

      // Broken symlink
      if (entry.broken) {
        warn(`${agent.name}/${entry.name} is a broken symlink → ${entry.target}`);
        if (existsSync(sourcePath)) {
          if (dryRun) {
            info("Would relink to source");
          } else {
            await rm(itemPath);
            await symlink(sourcePath, itemPath);
            ok(`Relinked ${agent.name}/${entry.name} → source`);
          }
          adopted++;
        } else {
          warn("  No matching skill in source — skipping");
        }
        continue;
      }

      // Skill not in source — adopt it
      if (!existsSync(sourcePath)) {
        if (entry.isSymlink) {
          // Symlink to somewhere else — resolve and copy
          const resolved = await resolveAdoptSource(itemPath, skillsPath, agent.path);
          if (dryRun) {
            info(
              `Would adopt ${agent.name}/${entry.name} → source (from ${resolved})`
            );
          } else {
            await cp(resolved, sourcePath, { recursive: true });
            await rm(itemPath);
            await symlink(sourcePath, itemPath);
            ok(`Adopted ${agent.name}/${entry.name} → source`);
          }
        } else {
          if (dryRun) {
            info(`Would adopt ${agent.name}/${entry.name} → source`);
          } else {
            await cp(itemPath, sourcePath, { recursive: true });
            await rm(itemPath, { recursive: true });
            await symlink(sourcePath, itemPath);
            ok(`Adopted ${agent.name}/${entry.name} → source`);
          }
        }
        adopted++;
      } else if (!entry.isSymlink) {
        // Exists in both — replace local with symlink
        warn(`${agent.name}/${entry.name} exists locally and in source`);
        if (dryRun) {
          info("Would replace local copy with symlink to source");
        } else {
          await rm(itemPath, { recursive: true });
          await symlink(sourcePath, itemPath);
          ok(`Replaced ${agent.name}/${entry.name} with symlink to source`);
        }
        adopted++;
      }
    }
  }

  if (adopted === 0) {
    console.log(fmt.green("Nothing to adopt."));
  } else if (dryRun) {
    console.log(`\n${fmt.dim("Run without --dry-run to apply.")}`);
  }
}

export async function list(config: Config) {
  const sourceSkills = await listDirs(config.source);
  for (const skill of sourceSkills) {
    console.log(skill);
  }
}

// ── Helpers ─────────────────────────────────────────────────────────

function safeResolveWithin(base: string, child: string, label: string): string {
  const resolved = resolve(base, child);
  if (!isPathWithin(base, resolved)) {
    throw new Error(`Refusing unsafe path for ${label}: ${child}`);
  }
  return resolved;
}

function isPathWithin(base: string, target: string): boolean {
  const rel = relative(base, target);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

async function resolveAdoptSource(itemPath: string, skillsPath: string, agentRoot: string): Promise<string> {
  const symlinkTarget = await readlink(itemPath);
  const resolved = resolve(skillsPath, symlinkTarget);
  const canonical = await realpath(resolved).catch(() => resolved);

  if (!isPathWithin(skillsPath, canonical) && !isPathWithin(agentRoot, canonical)) {
    throw new Error(
      `Refusing to adopt symlink target outside agent directories: ${symlinkTarget}`
    );
  }

  return canonical;
}

function lstatSafe(p: string) {
  try {
    return lstatSync(p);
  } catch {
    return null;
  }
}
