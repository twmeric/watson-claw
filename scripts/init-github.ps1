# Watson Claw - GitHub Repository 初始化腳本
# 使用方法: .\scripts\init-github.ps1 -Username "your-github-username"

param(
    [Parameter(Mandatory=$true)]
    [string]$Username,
    
    [string]$RepoName = "watson-claw",
    [bool]$Private = $false
)

Write-Host "🚀 Watson Claw GitHub 初始化腳本" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# 檢查 git
Write-Host "📦 檢查 Git..." -NoNewline
try {
    $gitVersion = git --version 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host " ✅ $gitVersion" -ForegroundColor Green
    } else {
        throw "Git not found"
    }
} catch {
    Write-Host " ❌" -ForegroundColor Red
    Write-Host "請先安裝 Git: https://git-scm.com/download/win" -ForegroundColor Red
    exit 1
}

# 檢查 GitHub CLI
Write-Host "📦 檢查 GitHub CLI..." -NoNewline
$ghVersion = gh --version 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host " ⚠️  未安裝" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "建議安裝 GitHub CLI 以便自動化操作:" -ForegroundColor Cyan
    Write-Host "  winget install --id GitHub.cli" -ForegroundColor Yellow
    Write-Host ""
    $continue = Read-Host "是否繼續使用手動方式? (Y/n)"
    if ($continue -eq 'n') {
        exit 0
    }
    $useGh = $false
} else {
    Write-Host " ✅" -ForegroundColor Green
    $useGh = $true
}

# 檢查是否在正確的目錄
$repoDir = "C:\Users\Owner\Cloudflare\AIWACRM\watson-claw"
if ($PWD.Path -ne $repoDir) {
    Write-Host "📁 切換到項目目錄..." -ForegroundColor Cyan
    Set-Location $repoDir
}

# 檢查是否已有 git 倉庫
if (Test-Path ".git") {
    Write-Host "⚠️  已存在 Git 倉庫" -ForegroundColor Yellow
    $reinit = Read-Host "是否重新初始化? (y/N)"
    if ($reinit -ne 'y') {
        Write-Host "使用現有倉庫繼續..." -ForegroundColor Cyan
    } else {
        Remove-Item -Recurse -Force .git
    }
}

# 初始化 Git 倉庫
if (-not (Test-Path ".git")) {
    Write-Host "📦 初始化 Git 倉庫..." -ForegroundColor Cyan
    git init
    git branch -M main
}

# 添加所有文件
Write-Host "📥 添加文件到 Git..." -ForegroundColor Cyan
git add .

# 檢查是否有更改要提交
$status = git status --porcelain
if ($status) {
    Write-Host "💾 創建初始提交..." -ForegroundColor Cyan
    git commit -m "Initial commit: CI/CD setup + core structure

- Add GitHub Actions workflows for staging and production
- Set up Cloudflare Workers configuration
- Add database migrations
- Create core handlers and services
- Add security utilities and tests"
} else {
    Write-Host "⚠️  沒有要提交的更改" -ForegroundColor Yellow
}

# 創建 GitHub Repository
Write-Host ""
Write-Host "🌐 創建 GitHub Repository..." -ForegroundColor Cyan

if ($useGh) {
    # 使用 GitHub CLI
    Write-Host "使用 GitHub CLI 創建..." -ForegroundColor Gray
    
    $visibility = if ($Private) { "--private" } else { "--public" }
    
    gh repo create $RepoName $visibility --source=. --remote=origin --push
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ 創建失敗，嘗試手動方式..." -ForegroundColor Yellow
        $useGh = $false
    }
} 

if (-not $useGh) {
    # 手動方式
    Write-Host ""
    Write-Host "請手動創建 Repository:" -ForegroundColor Cyan
    Write-Host "1. 訪問: https://github.com/new" -ForegroundColor White
    Write-Host "2. Repository name: $RepoName" -ForegroundColor White
    Write-Host "3. $(if ($Private) { "選擇 Private" } else { "選擇 Public" })" -ForegroundColor White
    Write-Host "4. 不要勾選 README 或 .gitignore" -ForegroundColor White
    Write-Host "5. 點擊 Create repository" -ForegroundColor White
    Write-Host ""
    
    Read-Host "按 Enter 繼續 (創建完成後)..."
    
    # 添加遠程倉庫
    $repoUrl = "https://github.com/$Username/$RepoName.git"
    Write-Host "添加遠程倉庫: $repoUrl" -ForegroundColor Gray
    
    git remote remove origin 2>$null
    git remote add origin $repoUrl
    
    # 推送代碼
    Write-Host "🚀 推送代碼到 GitHub..." -ForegroundColor Cyan
    git push -u origin main
}

# 顯示成功信息和下一步
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "              ✅ Repository 創建成功！" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "下一步: 添加 Secrets" -ForegroundColor Cyan
Write-Host ""

if ($useGh) {
    Write-Host "使用 GitHub CLI 快速添加 Secrets:" -ForegroundColor White
    Write-Host ""
    Write-Host "  1. 確保已登錄: gh auth login" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  2. 在項目目錄執行:" -ForegroundColor Yellow
    Write-Host "     gh secret set CLOUDFLARE_API_TOKEN" -ForegroundColor Yellow
    Write-Host "     gh secret set CLOUDFLARE_ACCOUNT_ID" -ForegroundColor Yellow
    Write-Host "     gh secret set SALESMARTLY_SECURITY_STAGING" -ForegroundColor Yellow
    Write-Host "     gh secret set CLOUDWAPI_KEY_STAGING" -ForegroundColor Yellow
    Write-Host "     gh secret set OPENROUTER_API_KEY" -ForegroundColor Yellow
    Write-Host ""
} else {
    Write-Host "手動添加 Secrets:" -ForegroundColor White
    Write-Host "  訪問: https://github.com/$Username/$RepoName/settings/secrets/actions" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "需要的 Secrets:" -ForegroundColor Cyan
Write-Host "  • CLOUDFLARE_API_TOKEN         (從 Cloudflare Dashboard 獲取)" -ForegroundColor White
Write-Host "  • CLOUDFLARE_ACCOUNT_ID        (從 Cloudflare Dashboard 獲取)" -ForegroundColor White
Write-Host "  • SALESMARTLY_SECURITY_STAGING (jsUJNQBR4Ao1XfG)" -ForegroundColor White
Write-Host "  • SALESMARTLY_SECURITY_PROD    (jsUJNQBR4Ao1XfG)" -ForegroundColor White
Write-Host "  • CLOUDWAPI_KEY_STAGING        (9QHFyJqc9wRd748jsUJNQBR4Ao1XfG)" -ForegroundColor White
Write-Host "  • CLOUDWAPI_KEY_PRODUCTION     (9QHFyJqc9wRd748jsUJNQBR4Ao1XfG)" -ForegroundColor White
Write-Host "  • OPENROUTER_API_KEY           (從 openrouter.ai 獲取)" -ForegroundColor White
Write-Host ""
Write-Host "詳細指南: GITHUB_SETUP_GUIDE.md" -ForegroundColor Gray
Write-Host ""
