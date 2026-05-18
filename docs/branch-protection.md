# Branch Protection Checklist

## What to enable on the `main` branch in GitHub

### Navigation
GitHub → Repository → Settings → Branches → Add branch protection rule → Branch name pattern: `main`

---

## Required Settings

| Setting | Value | Rationale |
|---------|-------|-----------|
| **Require a pull request before merging** | ✅ Enabled | No direct push to main |
| Require approvals | 1 (minimum) | At least one peer review |
| Dismiss stale pull request approvals when new commits are pushed | ✅ Enabled | Re-review after force-push |
| Require review from Code Owners | Optional (enable if CODEOWNERS file exists) | — |
| **Require status checks to pass before merging** | ✅ Enabled | CI must be green |
| Require branches to be up to date before merging | ✅ Enabled | No stale branches |
| **Required status checks** | See table below | — |
| **Require conversation resolution before merging** | ✅ Enabled | No unresolved review comments |
| **Require linear history** | ✅ Recommended | Cleaner git history; requires rebase or squash merge |
| **Do not allow bypassing the above settings** | ✅ Enabled | Applies to admins too |
| Restrict who can push to matching branches | Optional | Limit to team members |
| Allow force pushes | ❌ Disabled | Prevents history rewrite on main |
| Allow deletions | ❌ Disabled | Prevents accidental branch deletion |

### Required Status Checks

Add these check names (must match exactly as they appear in CI):

| Check name | Workflow | Required |
|------------|----------|----------|
| `Unit Tests + Debug Build` | `android-ci.yml` | ✅ Required |
| `Backend CI / test (20.x)` | `backend-ci.yml` | ✅ Required |
| `Backend CI / test (22.x)` | `backend-ci.yml` | ✅ Required |
| `Backend CI / lint` | `backend-ci.yml` | Optional (lint can be advisory) |
| `Release Build (signing-optional)` | `android-ci.yml` | Optional (blocked without secrets) |

> **Note**: Status check names must match the `name:` field in the workflow job, not the file name.
> Check the exact names after the first CI run under Actions → workflow run → job names.

---

## Current Status

| Item | Status |
|------|--------|
| main branch protection enabled | ❌ **TODO** — must be configured manually in GitHub Settings |
| Require PR before merging | ❌ **TODO** |
| Required status checks (backend-ci) | ❌ **TODO** |
| Required status checks (android-ci) | ❌ **TODO** |
| Require conversation resolution | ❌ **TODO** |
| Linear history | ❌ **TODO** |
| No direct push to main | ❌ **TODO** |

**Reason not enabled via API**: The GitHub MCP available in this environment is restricted to the `shrfyusupova-afk/stugram-full` repository and does not include branch protection write access. Branch protection must be configured via GitHub web UI.

---

## Step-by-Step Instructions

1. Go to: `https://github.com/shrfyusupova-afk/stugram-full/settings/branches`
2. Click **Add branch protection rule**
3. In **Branch name pattern**, type: `main`
4. Enable the checkboxes as listed in the Required Settings table above
5. Under **Require status checks to pass before merging**, search for and add:
   - `Unit Tests + Debug Build`
   - `Backend CI / test (20.x)`
   - `Backend CI / test (22.x)`
6. Enable **Require branches to be up to date before merging**
7. Enable **Do not allow bypassing the above settings**
8. Click **Create**

---

## Verification

After enabling:
```bash
# Attempt direct push to main — should be rejected
git checkout main
echo "test" >> README.md
git add README.md && git commit -m "test direct push"
git push origin main
# Expected: ! [remote rejected] main -> main (protected branch hook declined)
```

---

## Signed Commits (Optional)

Requiring signed commits is optional for beta. If desired:
- Enable **Require signed commits** in the branch protection rule
- Each contributor must configure GPG or SSH signing locally:
  ```bash
  git config --global commit.gpgsign true
  git config --global user.signingkey <YOUR_GPG_KEY_ID>
  ```
- GitHub documentation: https://docs.github.com/en/authentication/managing-commit-signature-verification
