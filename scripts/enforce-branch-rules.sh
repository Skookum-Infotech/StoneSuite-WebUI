#!/usr/bin/env bash
#
# Enforce StoneSuite-WebUI branching rules on GitHub via repo settings + rulesets.
#
#   feature -> develop (PR): SQUASH merge, branch deleted after
#   develop -> master (release): MERGE COMMIT (--no-ff), NEVER squash
#
# Per-branch merge-method enforcement uses GitHub Repository Rulesets
# ("pull request merge method" rule, GA 2025-03-24).
# REQUIRES: a Team or Enterprise plan, and admin on the repo.
#
# Prereqs:
#   gh auth login          # must be an account with admin on the repo
#   gh auth status
#
# Usage:
#   ./scripts/enforce-branch-rules.sh
#
set -euo pipefail

OWNER="Skookum-Infotech"
REPO="StoneSuite-WebUI"
CI_CHECK="lint-test-build"   # job name from .github/workflows/ci-frontend.yml
REVIEWS=1                    # required approving reviews

echo "==> 1/4  Repo-wide merge-button settings"
# Enable squash (for develop) + merge commit (for master); disable rebase everywhere.
# Auto-delete head branch after merge (satisfies "squash-merged then deleted").
gh api -X PATCH "repos/$OWNER/$REPO" \
  -F allow_squash_merge=true \
  -F allow_merge_commit=true \
  -F allow_rebase_merge=false \
  -F delete_branch_on_merge=true \
  --jq '{allow_squash_merge, allow_merge_commit, allow_rebase_merge, delete_branch_on_merge}'

echo "==> 2/4  Ruleset: develop (squash-only)"
gh api -X POST "repos/$OWNER/$REPO/rulesets" --input - <<JSON | jq -r '"created ruleset #\(.id): \(.name)"'
{
  "name": "develop-branch-rules",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["refs/heads/develop"], "exclude": [] } },
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": $REVIEWS,
        "dismiss_stale_reviews_on_push": true,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": false,
        "allowed_merge_methods": ["squash"]
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": true,
        "required_status_checks": [ { "context": "$CI_CHECK" } ]
      }
    }
  ]
}
JSON

echo "==> 3/4  Ruleset: master (merge-commit only, NEVER squash)"
gh api -X POST "repos/$OWNER/$REPO/rulesets" --input - <<JSON | jq -r '"created ruleset #\(.id): \(.name)"'
{
  "name": "master-release-rules",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["refs/heads/master"], "exclude": [] } },
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": $REVIEWS,
        "dismiss_stale_reviews_on_push": true,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": false,
        "allowed_merge_methods": ["merge"]
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": true,
        "required_status_checks": [ { "context": "$CI_CHECK" } ]
      }
    }
  ]
}
JSON

echo "==> 4/4  Verify"
gh api "repos/$OWNER/$REPO/rulesets" --jq '.[] | "\(.id)\t\(.name)\t\(.enforcement)"'
echo "Done."
