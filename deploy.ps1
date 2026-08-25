# =========================================================
#  Gouzi Blog - local deploy script (token stays off chat)
# ---------------------------------------------------------
#  1. Open token.txt in this folder, replace its whole content
#     with your GitHub PAT (jeanzz2026 account, repo scope).
#     Put ONLY the token, no quotes, no spaces, no newline.
#  2. In this folder, open PowerShell and run:  .\deploy.ps1
#
#  Notes:
#   - token is used only for this push and to enable Pages.
#   - after push, the remote URL is reset to strip the token,
#     and credential caching is disabled.
#   - target repo jeanzz2026/my_blog must already exist.
# =========================================================
$ErrorActionPreference = 'Continue'

$owner  = 'jeanzz2026'
$repo   = 'my_blog'
$branch = 'main'
$remoteUrl = ('https://github.com/' + $owner + '/' + $repo + '.git')

# ---- 0. deps ----
if (-not (Get-Command gh  -ErrorAction SilentlyContinue)) { Write-Error 'need gh CLI'; exit 1 }
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { Write-Error 'need git'; exit 1 }

# ---- 1. read local token (never printed) ----
if (-not (Test-Path token.txt)) { Write-Error 'token.txt not found. Put your PAT there.'; exit 1 }
$token = (Get-Content token.txt -Raw).Trim()
if ($token -eq 'REPLACE_WITH_YOUR_PAT' -or $token.Length -lt 30) {
  Write-Error 'token.txt still placeholder or too short. Replace it with your real PAT.'
  exit 1
}
if ($token -match '\s') { Write-Error 'token.txt has whitespace. Put only the raw token.'; exit 1 }

$env:GITHUB_TOKEN = $token
$env:GIT_TERMINAL_PROMPT = '0'

# ---- 2. verify identity ----
Write-Host 'Verifying GitHub identity...'
$me = (gh api user --jq .login 2>$null)
if ($me -ne $owner) {
  Write-Error ('token belongs to ' + $me + ', but target repo is ' + $owner)
  exit 1
}
Write-Host ('Identity OK: ' + $me)

# ---- 3. git init ----
if (-not (Test-Path .git)) {
  git init -q 2>$null
  git branch -M $branch 2>$null
}
git config user.name  $me 2>$null
git config user.email ($me + '@users.noreply.github.com') 2>$null

$hasOrigin = @(git remote 2>$null) -contains 'origin'
if (-not $hasOrigin) { git remote add origin $remoteUrl 2>$null }

# ---- 4. commit ----
git add -A 2>$null
if (git status --porcelain 2>$null) {
  git commit -q -m ('deploy: gouzi blog ' + (Get-Date -Format yyyy-MM-dd-HHmm)) 2>$null
  Write-Host 'Committed.'
} else {
  Write-Host 'Nothing to commit.'
}

# ---- 5. merge remote (if any initial commit) then push ----
$authUrl = ('https://' + $owner + ':' + $token + '@github.com/' + $owner + '/' + $repo + '.git')

try { git fetch origin $branch 2>$null } catch { }
$remoteBranch = $false
try { $remoteBranch = [bool](git rev-parse --verify ('origin/' + $branch) 2>$null) } catch { }
if ($remoteBranch) {
  Write-Host 'Merging remote initial content...'
  try { git pull origin $branch --allow-unrelated-histories -X ours --no-edit 2>$null } catch { }
}

git remote set-url origin $authUrl 2>$null
git -c credential.helper= push -u origin $branch 2>$null
if ($LASTEXITCODE -ne 0) {
  Write-Warning 'Normal push failed, trying force-with-lease...'
  git -c credential.helper= push --force-with-lease -u origin $branch 2>$null
  if ($LASTEXITCODE -ne 0) {
    Write-Error 'Push failed.'
    git remote set-url origin $remoteUrl 2>$null
    exit 1
  }
}
git remote set-url origin $remoteUrl 2>$null
Write-Host 'Code pushed.'

# ---- 6. set default branch ----
try { gh api ('repos/' + $owner + '/' + $repo) --method PATCH -f ('default_branch=' + $branch) 2>$null | Out-Null } catch { }

# ---- 7. enable GitHub Pages ----
Write-Host 'Enabling GitHub Pages...'
$pages = $null
try { $pages = (gh api ('repos/' + $owner + '/' + $repo + '/pages') 2>$null) } catch { }
if (-not $pages) {
  try { gh api ('repos/' + $owner + '/' + $repo + '/pages') --method POST -f ('source[branch]=' + $branch) -f 'source[path]=/' 2>$null | Out-Null } catch { }
}

# ---- 8. done ----
Write-Host ''
Write-Host 'Deploy finished. Public URL (first build ~1 min):'
Write-Host ('https://' + $owner + '.github.io/' + $repo + '/')
