# GitHub Setup Notes

1. Create repository on GitHub (for example `https://github.com/<you>/clawtomations`).
2. From local project root:

```bash
git init
git add .
git commit -m "chore: initial Clawtomations implementation"
git remote add origin https://github.com/<you>/clawtomations.git
git branch -M main
git push -u origin main
```

3. For private repos, configure collaborator access for any operators.
4. Add a simple webhook by enabling Actions if you later add CI.

## Advanced / troubleshooting

- OpenClaw command examples:
  - v1: `openclaw run --workflow {{workflow.path}} --output {{workflow.output}}`
  - v2: `openclaw agent run --workflow {{workflow.path}} --output {{workflow.output}}`
- Force command with env var:
  - `CLAWTOMATIONS_OPENCLAW_COMMAND`
- Local OpenClaw runner command:
  - `node src/cli.js openclaw --workflow workflows/sample-workflow.yaml`
- If login/session fails:
  - Re-run capture and replace `auth/<alias>-session.json`
  - Delete stale auth files and recapture
- If browser automation fails:
  - verify selectors in `workflows/sample-workflow.yaml`
  - add wait steps where needed
