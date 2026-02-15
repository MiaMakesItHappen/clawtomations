# Clawtomations

Clawtomations is the local browser automation runner you asked for: one click to run, multi-site workflows, and one-time login capture.

## What this includes

- Playwright workflow runner defined in YAML
- One-time session capture for each site (`capture` command)
- Multi-site workflow execution with text copy + screenshots
- Local control panel UI (button-run)
- Optional macOS daily scheduler (`launchd` plist)
- OpenClaw adapter support for both v1/v2 style command invocation

## Quick start

```bash
cd /Users/mia/Documents/Clawtomations
npm install
npm run run -- --workflow workflows/sample-workflow.yaml
```

## Commands

- `node src/cli.js run --workflow <file>`
  - Run a workflow once.
- `node src/cli.js capture --site <alias> --url <start-url>`
  - Open a browser, let you log in, then save session state.
- `node src/cli.js serve`
  - Start local control panel at `http://localhost:8787`.
- `node src/cli.js openclaw --workflow <file>`
  - Generate the OpenClaw invocation command for this workflow.
- `node src/cli.js schedule --workflow <file> --time 09:00 [--install]`
  - Build a macOS launchd plist, optionally register it.

## Folder layout

- `workflows/` - workflow definitions
- `auth/` - per-site saved session files (do not commit secrets)
- `src/` - runner, CLI, scheduler, server
- `public/` - local one-click control panel HTML

## Create a real workflow

Each workflow is a YAML list with one or more `sites`.

```yaml
name: my-workflow
sites:
  - name: google
    authState: "auth/google.json"
    requiresLogin: true
    steps:
      - action: navigate
        url: "https://accounts.google.com"
      - action: click
        selector: "text=Sign in"
```

### Supported actions

- `navigate`, `open`
- `click`, `fill`, `press`, `check`, `uncheck`, `select`
- `waitForSelector`, `wait`
- `copy`, `screenshot`, `upload`, `eval`, `hover`, `focus`

## OpenClaw integration

Use `CLAWTOMATIONS_OPENCLAW_COMMAND` or add a command template in workflow under `openclaw.command`:

```yaml
openclaw:
  command: "openclaw agent run --workflow {{workflow.path}} --output {{workflow.output}}"
```

This is intentionally explicit so you can point one command at your OpenClaw v1/v2 install without hardcoded assumptions.

## GitHub publish

From inside project root:

```bash
git init
git add .
git commit -m "feat: add Clawtomations runner"
git remote add origin <your-github-repo-url>
git branch -M main
git push -u origin main
```

## Notes

- Do not commit `auth/` session state files.
- Put long-running runs in separate shell scripts if needed.

- `scripts/publish-to-github.sh <repo-url>` to initialize remote and push cleanly.
