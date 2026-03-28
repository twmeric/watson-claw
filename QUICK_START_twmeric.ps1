# Watson Claw - Quick Start for twmeric
# 自動化 GitHub Repository 設置腳本

param(
    [string]$Username = "twmeric",
    [string]$RepoName = "watson-claw"
)

$ErrorActionPreference = "Stop"

Write-Host @"
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   🦞 Watson Claw - GitHub 自動化設置                          ║
║                                                              ║
║   用戶: twmeric                                               ║
║   倉庫: watson-claw                                           ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
"@ -ForegroundColor Cyan

# ========== 步驟 1: 環境檢查 ==========
Write-Host "`n📋 步驟 1: 環境檢查" -ForegroundColor Green

# 檢查 Git
try {
    $gitVersion = git --version
    Write-Host "  ✅ Git: $gitVersion" -ForegroundColor Gray
} catch {
    Write-Host "  ❌ Git 未安裝，請訪問 https://git-scm.com/download/win" -ForegroundColor Red
    exit 1
}

# 檢查 GitHub CLI
try {
    $ghVersion = (gh --version | Select-Object -First 1)
    Write-Host "  ✅ GitHub CLI: $ghVersion" -ForegroundColor Gray
    $hasGh = $true
} catch {
    Write-Host "  ⚠️  GitHub CLI 未安裝，將使用手動方式" -ForegroundColor Yellow
    Write-Host "      建議安裝: winget install --id GitHub.cli" -ForegroundColor Gray
    $hasGh = $false
}

# ========== 步驟 2: 初始化 Git ==========
Write-Host "`n📋 步驟 2: Git 初始化" -ForegroundColor Green

Set-Location "C:\Users\Owner\Cloudflare\AIWACRM\watson-claw"

if (Test-Path ".git") {
    Write-Host "  ℹ️  Git 倉庫已存在" -ForegroundColor Gray
} else {
    git init
    git config user.name "twmeric"
    git config user.email "twmeric@users.noreply.github.com"
    Write-Host "  ✅ Git 初始化完成" -ForegroundColor Gray
}

# ========== 步驟 3: 添加文件 ==========
Write-Host "`n📋 步驟 3: 添加文件" -ForegroundColor Green

git add .

$commitMessage = @"
🚀 Initial commit: Watson Claw core setup

Features:
- CI/CD with GitHub Actions (staging + production)
- Cloudflare Workers architecture
- D1 database with migrations
- SaleSmartly webhook handler
- OpenRouter LLM integration
- CloudWapi WhatsApp messaging
- Security utilities and tests

Architecture:
- Serverless Cloudflare Worker
- D1 SQLite database
- Cron triggers for reminders
- Zero-downtime deployments
"@

git commit -m $commitMessage
Write-Host "  ✅ 文件已提交" -ForegroundColor Gray

# ========== 步驟 4: 創建 GitHub Repository ==========
Write-Host "`n📋 步驟 4: 創建 GitHub Repository" -ForegroundColor Green

if ($hasGh) {
    Write-Host "  🔄 使用 GitHub CLI 創建..." -ForegroundColor Gray
    
    # 檢查是否已登錄
    $authStatus = gh auth status 2>&1
    if ($authStatus -match "not logged") {
        Write-Host "  🔑 請先登錄 GitHub CLI:" -ForegroundColor Yellow
        gh auth login
    }
    
    # 創建倉庫
    try {
        gh repo create $RepoName --public --source=. --remote=origin --push
        Write-Host "  ✅ Repository 創建成功" -ForegroundColor Green
    } catch {
        Write-Host "  ⚠️  創建失敗，可能已存在，嘗試推送..." -ForegroundColor Yellow
        git remote remove origin 2>$null
        git remote add origin "https://github.com/$Username/$RepoName.git"
        git push -u origin main
    }
} else {
    Write-Host "  請手動執行以下操作:" -ForegroundColor Yellow
    Write-Host "  1. 訪問: https://github.com/new" -ForegroundColor White
    Write-Host "  2. Repository name: $RepoName" -ForegroundColor White
    Write-Host "  3. 選擇 Public" -ForegroundColor White
    Write-Host "  4. 不要勾選 README" -ForegroundColor White
    Write-Host "  5. 點擊 Create repository" -ForegroundColor White
    Write-Host ""
    Read-Host "  完成後按 Enter 繼續"
    
    git remote remove origin 2>$null
    git remote add origin "https://github.com/$Username/$RepoName.git"
    git push -u origin main
}

# ========== 步驟 5: 設置 Secrets ==========
Write-Host "`n📋 步驟 5: 設置 GitHub Secrets" -ForegroundColor Green

$secretsInstructions = @"

需要設置以下 Secrets:

🔐 CLOUDFLARE_API_TOKEN
   獲取方式: https://dash.cloudflare.com/profile/api-tokens
   權限: Cloudflare Workers Scripts:Edit

🔐 CLOUDFLARE_ACCOUNT_ID
   獲取方式: Cloudflare Dashboard 右側欄

🔐 SALESMARTLY_SECURITY_STAGING
   值: jsUJNQBR4Ao1XfG

🔐 SALESMARTLY_SECURITY_PROD
   值: jsUJNQBR4Ao1XfG

🔐 CLOUDWAPI_KEY_STAGING
   值: 9QHFyJqc9wRd748jsUJNQBR4Ao1XfG

🔐 CLOUDWAPI_KEY_PRODUCTION
   值: 9QHFyJqc9wRd748jsUJNQBR4Ao1XfG

🔐 OPENROUTER_API_KEY
   獲取方式: https://openrouter.ai/keys

"@

Write-Host $secretsInstructions -ForegroundColor Cyan

if ($hasGh) {
    Write-Host "使用 GitHub CLI 設置 Secrets (推薦):" -ForegroundColor Green
    Write-Host ""
    
    $setSecrets = @"
# 請逐一執行以下命令，粘貼對應的值:

cd C:\Users\Owner\Cloudflare\AIWACRM\watson-claw

gh secret set CLOUDFLARE_API_TOKEN --repo $Username/$RepoName
# 粘貼你的 Cloudflare API Token

gh secret set CLOUDFLARE_ACCOUNT_ID --repo $Username/$RepoName  
# 粘貼你的 Cloudflare Account ID

gh secret set SALESMARTLY_SECURITY_STAGING --repo $Username/$RepoName --body "jsUJNQBR4Ao1XfG"

gh secret set SALESMARTLY_SECURITY_PROD --repo $Username/$RepoName --body "jsUJNQBR4Ao1XfG"

gh secret set CLOUDWAPI_KEY_STAGING --repo $Username/$RepoName --body "9QHFyJqc9wRd748jsUJNQBR4Ao1XfG"

gh secret set CLOUDWAPI_KEY_PRODUCTION --repo $Username/$RepoName --body "9QHFyJqc9wRd748jsUJNQBR4Ao1XfG"

gh secret set OPENROUTER_API_KEY --repo $Username/$RepoName
# 粘貼你的 OpenRouter API Key

"@
    Write-Host $setSecrets -ForegroundColor Yellow
} else {
    Write-Host "手動設置 Secrets:" -ForegroundColor Green
    Write-Host "  訪問: https://github.com/$Username/$RepoName/settings/secrets/actions" -ForegroundColor White
    Write-Host "  點擊 'New repository secret' 逐一添加" -ForegroundColor White
}

# ========== 步驟 6: 驗證 ==========
Write-Host "`n📋 步驟 6: 驗證設置" -ForegroundColor Green

Write-Host @"

✅ Repository URL: https://github.com/$Username/$RepoName

下一步:
1. 設置所有 Secrets
2. 創建 develop 分支: git checkout -b develop; git push origin develop
3. 查看 Actions: https://github.com/$Username/$RepoName/actions
4. 等待 Staging 部署完成
5. 測試: curl https://watson-claw-staging.jimsbond007.workers.dev/health

"@ -ForegroundColor Cyan

# 創建快速設置腳本供以後使用
$quickSetSecrets = @"
# Quick Secrets Setup for twmeric/watson-claw
# Run these commands one by one:

cd C:\Users\Owner\Cloudflare\AIWACRM\watson-claw

echo "Setting secrets for twmeric/watson-claw..."

gh secret set CLOUDFLARE_API_TOKEN
gh secret set CLOUDFLARE_ACCOUNT_ID
gh secret set SALESMARTLY_SECURITY_STAGING --body "jsUJNQBR4Ao1XfG"
gh secret set SALESMARTLY_SECURITY_PROD --body "jsUJNQBR4Ao1fG"
gh secret set CLOUDWAPI_KEY_STAGING --body "9QHFyJqc9wRd748jsUJNQBR4Ao1XfG"
gh secret set CLOUDWAPI_KEY_PRODUCTION --body "9QHFyJqc9wRd748jsUJNQBR4Ao1XfG"
gh secret set OPENROUTER_API_KEY

echo "Done!"
"@

$quickSetSecrets | Out-File -FilePath "set-secrets.bat" -Encoding UTF8
Write-Host "  📝 已創建 set-secrets.bat 快速設置腳本" -ForegroundColor Gray

Write-Host "`n🎉 初始化完成！" -ForegroundColor Green
