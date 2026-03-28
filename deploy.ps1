# Watson Claw - Auto Deploy Script
# 使用 Cloudflare Super Token 自动化部署

param(
    [string]$Environment = "production",
    [switch]$SkipBuild = $false
)

$ErrorActionPreference = "Stop"

# 配置
$ProjectName = "watson-claw"
$CloudflareToken = "cfat_WPMsz9VesfGGOJEK9l7d7SpplHKeeZIbPpl6cVj2ae335b72"
$AccountId = "dfbee5c2a5706a81bc04675499c933d4"

# 设置环境变量
$env:CLOUDFLARE_API_TOKEN = $CloudflareToken

Write-Host "🚀 Watson Claw 自动化部署开始..." -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green

# 检查 wrangler
Write-Host "📦 检查 Wrangler CLI..." -ForegroundColor Cyan
try {
    $wranglerVersion = wrangler --version
    Write-Host "✅ Wrangler 版本: $wranglerVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Wrangler 未安装，正在安装..." -ForegroundColor Red
    npm install -g wrangler
}

# 验证登录
Write-Host "🔐 验证 Cloudflare 认证..." -ForegroundColor Cyan
try {
    $whoami = wrangler whoami 2>&1
    Write-Host "✅ 认证成功" -ForegroundColor Green
} catch {
    Write-Host "❌ 认证失败，请检查 Token" -ForegroundColor Red
    exit 1
}

# 部署到 Cloudflare Pages
Write-Host "📤 部署到 Cloudflare Pages..." -ForegroundColor Cyan
try {
    wrangler pages deploy . --project-name="$ProjectName" --branch="main"
    Write-Host "✅ 部署成功!" -ForegroundColor Green
} catch {
    Write-Host "❌ 部署失败: $_" -ForegroundColor Red
    exit 1
}

# 获取部署URL
try {
    $deployments = Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/accounts/$AccountId/pages/projects/$ProjectName/deployments" -Headers @{
        "Authorization" = "Bearer $CloudflareToken"
        "Content-Type" = "application/json"
    }
    $latestUrl = $deployments.result[0].url
    Write-Host "🌐 最新部署URL: $latestUrl" -ForegroundColor Green
} catch {
    Write-Host "⚠️  无法获取部署URL，但部署可能成功" -ForegroundColor Yellow
}

Write-Host "================================" -ForegroundColor Green
Write-Host "🎉 部署完成!" -ForegroundColor Green
Write-Host "📍 生产环境: https://watson-claw.jkdcoding.com" -ForegroundColor Cyan
