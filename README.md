# skillecta

<p align="center">
  <img width="200" alt="skiller_pointer_transparent" src="https://github.com/user-attachments/assets/44d87138-9ffd-4add-850a-c10de9fc1181" />
</p>

Keep your AI agent skills in sync. One source of truth, symlinked everywhere.

If you use multiple AI coding assistants (Claude, Cursor, etc.) and want to share skills between them, `skillecta` manages the symlinks so you don't have to.

## Install

```sh
npm i -g @novasism/skillecta
```

## How it works

You keep your skills in `~/.agents/skills/`. Each skill is a folder (typically containing a `SKILL.md`). Skillecta symlinks them into agent-specific directories like `~/.claude/skills/` and `~/.cursor/skills/`.

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
skillecta status

# Link all source skills to every agent
skillecta sync

# Found a skill in an agent folder that's not in source? Adopt it
skillecta adopt

# Just list source skills
skillecta list
```

Both `sync` and `adopt` support `--dry-run` to preview changes.

## Config (optional)

By default, skillecta knows about Claude (`~/.claude`) and Cursor (`~/.cursor`). To add more agents, create `~/.agents/config.toml`:

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
| `SKILLECTA_SOURCE` | `~/.agents/skills` | Source skills directory |
| `SKILLECTA_CONFIG` | `~/.agents/config.toml` | Config file path |

## License

MIT
