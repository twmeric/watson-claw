# Watson Claw - Development Environment Setup Script
# Run with: npm run setup

Write-Host "🦞 Setting up Watson Claw development environment..." -ForegroundColor Cyan
Write-Host ""

# Check Node.js version
Write-Host "📦 Checking Node.js..." -NoNewline
$nodeVersion = & node --version 2>$null
if (-not $nodeVersion) {
    Write-Host " ❌" -ForegroundColor Red
    Write-Host "Node.js not found. Please install Node.js 20+ from https://nodejs.org/" -ForegroundColor Red
    exit 1
}
$majorVersion = [int]($nodeVersion -replace 'v', '' -split '\.' )[0]
if ($majorVersion -lt 20) {
    Write-Host " ⚠️  Found $nodeVersion, but 20+ recommended" -ForegroundColor Yellow
} else {
    Write-Host " ✅ $nodeVersion" -ForegroundColor Green
}

# Check if npm is available
Write-Host "📦 Checking npm..." -NoNewline
$npmVersion = & npm --version 2>$null
if (-not $npmVersion) {
    Write-Host " ❌" -ForegroundColor Red
    exit 1
}
Write-Host " ✅ $npmVersion" -ForegroundColor Green

# Install dependencies
Write-Host ""
Write-Host "📥 Installing dependencies..." -ForegroundColor Cyan
& npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Dependencies installed" -ForegroundColor Green

# Check for wrangler
Write-Host ""
Write-Host "🔧 Checking Wrangler CLI..." -NoNewline
$wranglerVersion = & npx wrangler --version 2>$null
if (-not $wranglerVersion) {
    Write-Host " 📥 Installing..." -ForegroundColor Yellow
    & npm install -g wrangler
}
Write-Host " ✅ $wranglerVersion" -ForegroundColor Green

# Create .dev.vars if not exists
Write-Host ""
Write-Host "📝 Setting up environment variables..." -ForegroundColor Cyan
$devVarsPath = ".dev.vars"
if (-not (Test-Path $devVarsPath)) {
    $devVarsContent = @"# Development Environment Variables
# Copy your actual API keys here for local development

# SaleSmartly (測試環境)
SALESMARTLY_SECURITY_CODE=your_test_security_code_here

# CloudWapi (測試環境)
CLOUDWAPI_KEY=your_test_cloudwapi_key_here

# OpenRouter (LLM API)
OPENROUTER_API_KEY=your_openrouter_api_key_here

# Optional: For debugging
# LOG_LEVEL=debug
"@
    Set-Content -Path $devVarsPath -Value $devVarsContent
    Write-Host "✅ Created .dev.vars file" -ForegroundColor Green
    Write-Host "⚠️  Please edit .dev.vars with your actual API keys!" -ForegroundColor Yellow
} else {
    Write-Host "✅ .dev.vars already exists" -ForegroundColor Green
}

# Create .gitignore if not exists
if (-not (Test-Path ".gitignore")) {
    $gitignoreContent = @"# Dependencies
node_modules/

# Environment files
.env
.dev.vars

# Wrangler
.wrangler/
wrangler.toml.bak

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Testing
coverage/
.nyc_output/

# Build
dist/
build/
"@
    Set-Content -Path ".gitignore" -Value $gitignoreContent
    Write-Host "✅ Created .gitignore" -ForegroundColor Green
}

# Create example src/index.js if not exists
$indexPath = "src/index.js"
if (-not (Test-Path $indexPath)) {
    $indexContent = @"// Watson Claw - Main Worker Entry Point

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Health check endpoint
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({
        status: 'ok',
        version: '1.0.0',
        environment: env.ENVIRONMENT || 'development',
        timestamp: new Date().toISOString()
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // SaleSmartly webhook endpoint
    if (url.pathname === '/webhook/salesmartly' && request.method === 'POST') {
      return handleSaleSmartlyWebhook(request, env);
    }
    
    // Default response
    return new Response('🦞 Watson Claw is running!', {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
        'Access-Control-Allow-Origin': '*'
      }
    });
  },
  
  async scheduled(event, env, ctx) {
    // Cron job - check and send reminders
    console.log('Running scheduled reminder check...');
    await checkReminders(env);
  }
};

async function handleSaleSmartlyWebhook(request, env) {
  try {
    // Verify security code
    const securityCode = request.headers.get('X-Security-Code');
    if (securityCode !== env.SALESMARTLY_SECURITY_CODE) {
      return new Response('Unauthorized', { status: 401 });
    }
    
    const data = await request.json();
    
    // TODO: Implement message processing
    console.log('Received webhook:', data);
    
    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response('Error', { status: 500 });
  }
}

async function checkReminders(env) {
  // TODO: Implement reminder checking logic
  console.log('Checking reminders...');
}
"@
    Set-Content -Path $indexPath -Value $indexContent
    Write-Host "✅ Created src/index.js" -ForegroundColor Green
}

# Create a test file
$testPath = "tests/unit/example.test.js"
if (-not (Test-Path $testPath)) {
    $testContent = @"// Example test file
describe('Watson Claw', () => {
  test('environment is set up correctly', () => {
    expect(true).toBe(true);
  });
});
"@
    Set-Content -Path $testPath -Value $testContent
    Write-Host "✅ Created example test file" -ForegroundColor Green
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "                    🎉 Setup Complete!" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host ""
Write-Host "  1. Edit .dev.vars with your API keys:" -ForegroundColor White
Write-Host "     - SaleSmartly Security Code" -ForegroundColor Gray
Write-Host "     - CloudWapi Key" -ForegroundColor Gray
Write-Host "     - OpenRouter API Key" -ForegroundColor Gray
Write-Host ""
Write-Host "  2. Start development server:" -ForegroundColor White
Write-Host "     npm run dev" -ForegroundColor Yellow
Write-Host ""
Write-Host "  3. Test the endpoint:" -ForegroundColor White
Write-Host "     curl http://localhost:8787/health" -ForegroundColor Yellow
Write-Host ""
Write-Host "  4. Start building! 🚀" -ForegroundColor White
Write-Host ""
