---
name: release-develop-to-master
description: This skill should be used when the user asks to "cut a release", "promote develop to master", "release to production", "open the release PR", or wants to ship what's currently on develop to master/production. Drafts the release PR body and enforces this repo's unusual per-branch merge-method rule.
disable-model-invocation: true
---

Prepare and open the `develop` → `master` release PR for StoneSuite-WebUI. This
promotion has a merge-method rule that's the **opposite** of every other PR in this
repo, so the main value of this skill is not forgetting it:

| PR direction | Merge method | Why |
|---|---|---|
| feature → `develop` | **Squash** | Keeps `develop` history to one commit per feature. |
| `develop` → `master` | **Merge commit (`--no-ff`), never squash** | `master` must preserve the real commit history of what shipped in each release; squashing it would collapse an entire release into one commit and make `git bisect`/rollback-to-a-specific-feature impossible. |

If `scripts/enforce-branch-rules.sh` has been run against this repo, GitHub's branch
ruleset already restricts `master` to `allowed_merge_methods: ["merge"]` — the squash
button won't even be available. Treat that as a backstop, not a reason to skip the
check below; rulesets can be missing, out of date, or unapplied in a fork.

## Step 1: Confirm develop is release-ready

```bash
git fetch origin
git log origin/develop..origin/master --oneline   # should be empty (master isn't ahead)
git log origin/master..origin/develop --oneline    # the commits about to ship
```

Check CI is green on `develop`'s latest commit — the required status check is named
`lint-test-build` (from `.github/workflows/ci-frontend.yml`):

```bash
gh api repos/Skookum-Infotech/StoneSuite-WebUI/commits/origin/develop/status --jq '.state'
```

If it isn't `success`, stop and fix or wait — don't open the release PR against red CI.

## Step 2: Draft the PR body from what's actually shipping

Generate the commit list and bucket it by Conventional Commits prefix (`feat:`, `fix:`,
`refactor:`, `chore:`, `docs:`) — since feature branches are squash-merged into
`develop`, each commit here is one shipped PR, making this a clean changelog source:

```bash
git log origin/master..origin/develop --pretty=format:'%s'
```

Draft a PR body with a `## What's shipping` section (grouped by prefix, each line
linking the PR if the subject includes a `(#123)` reference) and a `## Test plan`
checklist covering the areas the commit list touches (e.g. if sales/vendor files
changed, note "spot-check Sales Order and Vendor list/detail pages on the preview").
Show the drafted body to the user before creating anything.

## Step 3: Create the PR (with confirmation)

```bash
gh pr create --base master --head develop --title "Release: <short description>" --body "<drafted body>"
```

Confirm with the user before running this — opening a PR is visible to the whole team.

## Step 4: Hand off the merge — do not merge it yourself

Tell the user the PR is ready and that **they** should merge it via the GitHub UI using
"Create a merge commit" (not "Squash and merge"). Do not run `gh pr merge` for this
specific PR direction — the cost of a wrong merge method here (squashing master's
history) is high and not easily undone, so this is a deliberately human-only step even
though this skill can draft and open the PR itself.

## Step 5: What happens after merge (informational — nothing to do)

`.github/workflows/deploy-frontend.yml` triggers automatically on merge to `master`:
lint → build → deploy to Cloudflare Pages (`stonesuite` project) → health check against
`https://stonesuite.pages.dev`. If the health check fails, the workflow's own output
names the rollback path: Cloudflare Pages dashboard → Deployments → previous deploy →
Rollback. Point the user at the Actions run for "Deploy Frontend to Cloudflare Pages"
rather than re-deploying manually.
