# Watson Claw - Quick Deploy Script
# Usage: .\scripts\deploy.ps1 [staging|production]

param(
    [string]$Environment = "staging"
)

Write-Host "🚀 Watson Claw Deployment Script" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Validate environment
if ($Environment -notin @("staging", "production")) {
    Write-Host "❌ Invalid environment. Use 'staging' or 'production'" -ForegroundColor Red
    exit 1
}

# Check for uncommitted changes
$gitStatus = & git status --porcelain 2>$null
if ($gitStatus) {
    Write-Host "⚠️  Warning: You have uncommitted changes:" -ForegroundColor Yellow
    Write-Host $gitStatus -ForegroundColor Gray
    Write-Host ""
    $continue = Read-Host "Continue anyway? (y/N)"
    if ($continue -ne 'y' -and $continue -ne 'Y') {
        Write-Host "Deployment cancelled." -ForegroundColor Yellow
        exit 0
    }
}

# Run tests
Write-Host "🧪 Running tests..." -ForegroundColor Cyan
& npm test 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Tests failed or not configured" -ForegroundColor Yellow
    $continue = Read-Host "Continue anyway? (y/N)"
    if ($continue -ne 'y' -and $continue -ne 'Y') {
        exit 0
    }
}

# Run linter
Write-Host "🔍 Running linter..." -ForegroundColor Cyan
& npm run lint 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Linter found issues" -ForegroundColor Yellow
}

# Deploy
Write-Host ""
if ($Environment -eq "production") {
    Write-Host "🚀 Deploying to PRODUCTION..." -ForegroundColor Red
    $confirm = Read-Host "Are you sure? Type 'deploy' to confirm"
    if ($confirm -ne "deploy") {
        Write-Host "Deployment cancelled." -ForegroundColor Yellow
        exit 0
    }
    
    # Apply migrations
    Write-Host "🗄️  Applying database migrations..." -ForegroundColor Cyan
    & npx wrangler d1 migrations apply watson-claw-db
    
    # Deploy
    Write-Host "📤 Deploying worker..." -ForegroundColor Cyan
    & npx wrangler deploy
    
    Write-Host ""
    Write-Host "✅ Production deployment complete!" -ForegroundColor Green
    Write-Host "🔗 https://watson-claw.jimsbond007.workers.dev" -ForegroundColor Cyan
} else {
    Write-Host "🚀 Deploying to STAGING..." -ForegroundColor Green
    
    # Apply migrations
    Write-Host "🗄️  Applying database migrations..." -ForegroundColor Cyan
    & npx wrangler d1 migrations apply watson-claw-staging-db --config wrangler.staging.toml
    
    # Deploy
    Write-Host "📤 Deploying worker..." -ForegroundColor Cyan
    & npx wrangler deploy --config wrangler.staging.toml
    
    Write-Host ""
    Write-Host "✅ Staging deployment complete!" -ForegroundColor Green
    Write-Host "🔗 https://watson-claw-staging.jimsbond007.workers.dev" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "Done! 🎉" -ForegroundColor Green
