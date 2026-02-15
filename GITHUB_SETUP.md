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
