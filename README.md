# skiller

Keep your AI agent skills in sync. One source of truth, symlinked everywhere.

If you use multiple AI coding assistants (Claude, Cursor, etc.) and want to share skills between them, `skiller` manages the symlinks so you don't have to.

## Install

```sh
npm i -g @novasism/skiller
```

## How it works

You keep your skills in `~/.agents/skills/`. Each skill is a folder (typically containing a `SKILL.md`). Skiller symlinks them into agent-specific directories like `~/.claude/skills/` and `~/.cursor/skills/`.

```
~/.agents/skills/          <- source of truth
  commit-skill/
  react-doctor/

~/.claude/skills/
  commit-skill -> ~/.agents/skills/commit-skill
  react-doctor -> ~/.agents/skills/react-doctor

~/.cursor/skills/
  commit-skill -> ~/.agents/skills/commit-skill
  react-doctor -> ~/.agents/skills/react-doctor
```

## Usage

```sh
# See what's in sync and what's not
skiller status

# Link all source skills to every agent
skiller sync

# Found a skill in an agent folder that's not in source? Adopt it
skiller adopt

# Just list source skills
skiller list
```

Both `sync` and `adopt` support `--dry-run` to preview changes.

## Config (optional)

By default, skiller knows about Claude (`~/.claude`) and Cursor (`~/.cursor`). To add more agents, create `~/.agents/config.toml`:

```toml
[agents.claude]
path = "~/.claude"

[agents.cursor]
path = "~/.cursor"

[agents.windsurf]
path = "~/.windsurf"
skills_dir = "skills"  # defaults to "skills"
```

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `SKILLER_SOURCE` | `~/.agents/skills` | Source skills directory |
| `SKILLER_CONFIG` | `~/.agents/config.toml` | Config file path |

## License

MIT
