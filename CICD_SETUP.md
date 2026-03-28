# Watson Claw CI/CD 自動化部署指南

> **「一鍵部署，零摩擦開發」**

---

## 🎯 CI/CD 目標

```
開發者推送代碼 → 自動測試 → 自動部署 → 線上驗證
     (30秒)         (60秒)      (30秒)      (即時)

全程無需手動操作，每次 push 都自動完成部署
```

---

## 🏗️ 環境架構

```
┌─────────────────────────────────────────────────────────────────┐
│                        GitHub Repository                         │
│                                                                  │
│  main 分支 ──────────────────────▶ Production 環境              │
│       │                                                          │
│       └── .github/workflows/deploy-production.yml               │
│                                                                  │
│  develop 分支 ───────────────────▶ Staging 環境                  │
│       │                                                          │
│       └── .github/workflows/deploy-staging.yml                  │
│                                                                  │
│  feature/* 分支 ─────────────────▶ PR 預覽環境                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

環境分離：
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Staging    │     │ Production  │     │  PR Preview │
│  (測試用)    │     │  (真實用戶)  │     │  (臨時預覽)  │
├─────────────┤     ├─────────────┤     ├─────────────┤
│ Worker:     │     │ Worker:     │     │ Worker:     │
│ watson-     │     │ watson-     │     │ watson-     │
│ staging     │     │ claw        │     │ pr-xxx      │
├─────────────┤     ├─────────────┤     ├─────────────┤
│ D1:         │     │ D1:         │     │ D1:         │
│ staging-db  │     │ prod-db     │     │ (共享)      │
├─────────────┤     ├─────────────┤     ├─────────────┤
│ SaleSmartly │     │ SaleSmartly │     │ SaleSmartly │
│ (測試號)     │     │ (正式號)     │     │ (測試號)    │
└─────────────┘     └─────────────┘     └─────────────┘
```

---

## 📁 目錄結構

```
watson-claw/
├── .github/
│   └── workflows/
│       ├── deploy-staging.yml      # 開發分支自動部署
│       ├── deploy-production.yml   # 主分支自動部署
│       └── pr-preview.yml          # PR 預覽環境
├── scripts/
│   ├── deploy.sh                   # 本地快速部署腳本
│   ├── setup-secrets.sh            # Secrets 設置腳本
│   └── migrate-db.sh               # 數據庫遷移腳本
├── src/
│   ├── index.js                    # Worker 主入口
│   ├── handlers/
│   │   ├── webhook.js              # SaleSmartly webhook 處理
│   │   ├── chat.js                 # 對話處理
│   │   └── cron.js                 # 定時任務
│   ├── services/
│   │   ├── llm.js                  # LLM 調用
│   │   ├── db.js                   # 數據庫操作
│   │   └── whatsapp.js             # WhatsApp 發送
│   └── utils/
│       ├── security.js             # 安全驗證
│       └── parser.js               # 時間/意圖解析
├── migrations/
│   ├── 001_initial.sql             # 初始表結構
│   └── 002_add_users_table.sql     # 後續遷移
├── tests/
│   ├── unit/                       # 單元測試
│   └── integration/                # 集成測試
├── wrangler.toml                   # Worker 配置
├── wrangler.staging.toml           # Staging 配置
└── package.json
```

---

## ⚙️ GitHub Actions 配置

### 1. Staging 環境部署

```yaml
# .github/workflows/deploy-staging.yml
name: Deploy to Staging

on:
  push:
    branches: [ develop ]
  pull_request:
    branches: [ develop ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run linter
        run: npm run lint
      
      - name: Run unit tests
        run: npm test
        env:
          CI: true

  deploy:
    needs: test
    runs-on: ubuntu-latest
    environment: staging
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run database migrations
        run: npx wrangler d1 migrations apply staging-db --config wrangler.staging.toml
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
      
      - name: Deploy to Cloudflare Workers (Staging)
        run: npx wrangler deploy --config wrangler.staging.toml
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
      
      - name: Notify deployment success
        uses: slackapi/slack-github-action@v1
        if: success()
        with:
          payload: |
            {
              "text": "🚀 Watson Staging 部署成功！",
              "blocks": [
                {
                  "type": "section",
                  "text": {
                    "type": "mrkdwn",
                    "text": "*Watson Claw* staging 環境已更新\n• 分支: `${{ github.ref }}`\n• 提交: `${{ github.sha }}`\n• 部署時間: ${{ github.event.head_commit.timestamp }}"
                  }
                }
              ]
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

### 2. Production 環境部署

```yaml
# .github/workflows/deploy-production.yml
name: Deploy to Production

on:
  push:
    branches: [ main ]
  workflow_dispatch:  # 手動觸發
    inputs:
      version:
        description: '部署版本號'
        required: true
        default: 'v1.0.0'

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run linter
        run: npm run lint
      
      - name: Run unit tests
        run: npm test
      
      - name: Run integration tests
        run: npm run test:integration
        env:
          STAGING_WORKER_URL: ${{ secrets.STAGING_WORKER_URL }}

  deploy:
    needs: test
    runs-on: ubuntu-latest
    environment: production  # 需要人工批准
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Create Sentry release
        uses: getsentry/action-release@v1
        with:
          version: ${{ github.sha }}
        env:
          SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
          SENTRY_ORG: your-org
          SENTRY_PROJECT: watson-claw
      
      - name: Backup current version
        run: |
          echo "Backing up production version..."
          # 可以實現版本回滾機制
      
      - name: Apply database migrations
        run: npx wrangler d1 migrations apply prod-db
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
      
      - name: Deploy to Cloudflare Workers (Production)
        run: npx wrangler deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
      
      - name: Run smoke tests
        run: |
          curl -sf ${{ secrets.PROD_HEALTH_CHECK_URL }} || exit 1
          echo "✅ Production health check passed"
      
      - name: Create GitHub Release
        uses: actions/create-release@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tag_name: ${{ github.event.inputs.version || github.ref }}
          release_name: Release ${{ github.event.inputs.version || github.ref }}
          body: |
            ## 部署信息
            - 提交: ${{ github.sha }}
            - 部署時間: ${{ github.event.head_commit.timestamp }}
            - 部署者: ${{ github.actor }}
            
            ## 變更日誌
            ${{ github.event.head_commit.message }}
          draft: false
          prerelease: false
      
      - name: Notify deployment
        uses: slackapi/slack-github-action@v1
        with:
          payload: |
            {
              "text": "🎉 Watson Production 部署成功！",
              "blocks": [
                {
                  "type": "header",
                  "text": {
                    "type": "plain_text",
                    "text": "🚀 Production 部署完成"
                  }
                },
                {
                  "type": "section",
                  "fields": [
                    {
                      "type": "mrkdwn",
                      "text": "*版本:*\n`${{ github.sha }}`"
                    },
                    {
                      "type": "mrkdwn",
                      "text": "*部署者:*\n${{ github.actor }}"
                    }
                  ]
                }
              ]
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

### 3. PR 預覽環境

```yaml
# .github/workflows/pr-preview.yml
name: PR Preview Deployment

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  preview:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Deploy to preview
        id: deploy
        run: |
          # 使用 PR 號創建預覽環境
          npx wrangler deploy --name watson-claw-pr-${{ github.event.number }}
          echo "url=https://watson-claw-pr-${{ github.event.number }}.jimsbond007.workers.dev" >> $GITHUB_OUTPUT
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
      
      - name: Comment PR
        uses: actions/github-script@v7
        with:
          script: |
            const url = '${{ steps.deploy.outputs.url }}';
            const body = `🚀 **預覽環境已部署**
            
            訪問鏈接: ${url}
            
            測試 webhook: \`${url}/webhook/salesmartly\``;
            
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: body
            });
```

---

## 🔐 Secrets 管理

### GitHub Secrets 設置

```bash
# 需要在 GitHub Repository Settings → Secrets and variables → Actions 中添加：

# Cloudflare 部署
CLOUDFLARE_API_TOKEN          # Cloudflare API Token
CLOUDFLARE_ACCOUNT_ID         # Cloudflare Account ID

# 數據庫
DB_STAGING_TOKEN             # Staging D1 Token
DB_PRODUCTION_TOKEN          # Production D1 Token

# 外部服務
OPENROUTER_API_KEY           # OpenRouter API Key
CLOUDWAPI_KEY_STAGING        # CloudWapi Staging Key
CLOUDWAPI_KEY_PRODUCTION     # CloudWapi Production Key
SALESMARTLY_SECURITY_STAGING # SaleSmartly Staging Security Code
SALESMARTLY_SECURITY_PROD    # SaleSmartly Production Security Code

# 監控和通知
SENTRY_AUTH_TOKEN            # Sentry 錯誤追蹤
SLACK_WEBHOOK_URL            # Slack 通知

# 測試
STAGING_WORKER_URL           # Staging Worker URL for testing
PROD_HEALTH_CHECK_URL        # Production health check endpoint
```

### 生成 Cloudflare API Token

```
1. 登入 Cloudflare Dashboard
2. My Profile → API Tokens → Create Token
3. 使用模板 "Edit Cloudflare Workers"
4. 權限包括：
   - Cloudflare Workers:Edit
   - Account:Read
   - Zone:Read (如果需要自定義域名)
5. 複製 Token 到 GitHub Secrets
```

---

## 🛠️ 本地開發腳本

### package.json 腳本

```json
{
  "name": "watson-claw",
  "version": "1.0.0",
  "scripts": {
    "dev": "wrangler dev",
    "dev:staging": "wrangler dev --config wrangler.staging.toml",
    "deploy": "wrangler deploy",
    "deploy:staging": "wrangler deploy --config wrangler.staging.toml",
    "lint": "eslint src/",
    "lint:fix": "eslint src/ --fix",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:integration": "jest --config jest.integration.config.js",
    "db:migrate": "wrangler d1 migrations apply",
    "db:migrate:staging": "wrangler d1 migrations apply staging-db --config wrangler.staging.toml",
    "db:create-migration": "wrangler d1 migrations create",
    "secrets:sync": "./scripts/sync-secrets.sh",
    "setup": "./scripts/setup-dev.sh"
  },
  "dependencies": {
    "chrono-node": "^2.7.5"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20240320.1",
    "eslint": "^8.57.0",
    "jest": "^29.7.0",
    "wrangler": "^3.34.0"
  }
}
```

### 快速部署腳本

```bash
#!/bin/bash
# scripts/deploy.sh

set -e

ENV=${1:-staging}

echo "🚀 Deploying to $ENV..."

# 檢查未提交的更改
if [ -n "$(git status --porcelain)" ]; then
    echo "❌ 有未提交的更改，請先 commit"
    exit 1
fi

# 運行測試
echo "🧪 Running tests..."
npm test

# 運行 linter
echo "🔍 Running linter..."
npm run lint

# 數據庫遷移
echo "🗄️  Applying migrations..."
if [ "$ENV" = "production" ]; then
    npm run db:migrate
else
    npm run db:migrate:staging
fi

# 部署
if [ "$ENV" = "production" ]; then
    echo "🚀 Deploying to PRODUCTION..."
    wrangler deploy
else
    echo "🚀 Deploying to STAGING..."
    wrangler deploy --config wrangler.staging.toml
fi

echo "✅ Deployed successfully!"
```

### 設置腳本

```bash
#!/bin/bash
# scripts/setup-dev.sh

echo "🦞 Setting up Watson Claw development environment..."

# 檢查依賴
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 20+"
    exit 1
fi

# 安裝依賴
echo "📦 Installing dependencies..."
npm install

# 創建環境文件
if [ ! -f ".dev.vars" ]; then
    echo "📝 Creating .dev.vars..."
    cat > .dev.vars << EOF
SALESMARTLY_SECURITY_CODE=your_test_code
CLOUDWAPI_KEY=your_test_key
OPENROUTER_API_KEY=your_openrouter_key
EOF
    echo "⚠️  Please edit .dev.vars with your actual API keys"
fi

# 創建 D1 數據庫（本地開發用）
echo "🗄️  Creating local D1 database..."
wrangler d1 create watson-local || true

# 運行遷移
echo "🔄 Running migrations..."
wrangler d1 migrations apply watson-local --local

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Edit .dev.vars with your API keys"
echo "  2. Run 'npm run dev' to start development server"
echo "  3. Test webhook with 'curl http://localhost:8787/webhook/salesmartly'"
```

---

## 🧪 測試策略

### 單元測試

```javascript
// tests/unit/parser.test.js
describe('Time Parser', () => {
  test('parses "tomorrow afternoon 3pm"', () => {
    const result = parseTime('明天下午3點有組會');
    expect(result.hour).toBe(15);
    expect(result.task).toBe('有組會');
  });
});

// tests/unit/security.test.js
describe('Security', () => {
  test('validates security code', () => {
    const isValid = validateSecurityCode('correct_code', 'correct_code');
    expect(isValid).toBe(true);
  });
});
```

### 集成測試

```javascript
// tests/integration/webhook.test.js
describe('Webhook Integration', () => {
  test('receives and processes message', async () => {
    const response = await fetch(STAGING_URL + '/webhook/salesmartly', {
      method: 'POST',
      headers: {
        'X-Security-Code': STAGING_SECURITY_CODE,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: '85298765432',
        text: '明天下午3點有組會'
      })
    });
    
    expect(response.status).toBe(200);
  });
});
```

### GitHub Actions 中的測試矩陣

```yaml
# 在 deploy 流程中加入
strategy:
  matrix:
    node-version: [18, 20]
    
steps:
  - name: Test with Node ${{ matrix.node-version }}
    uses: actions/setup-node@v4
    with:
      node-version: ${{ matrix.node-version }}
  - run: npm ci
  - run: npm test
```

---

## 📊 監控與日誌

### 部署狀態 Dashboard

```yaml
# .github/workflows/monitor.yml
name: Monitor Deployment

on:
  schedule:
    - cron: '*/5 * * * *'  # 每5分鐘檢查

jobs:
  health-check:
    runs-on: ubuntu-latest
    steps:
      - name: Check Staging Health
        run: |
          curl -sf ${{ secrets.STAGING_HEALTH_URL }} || echo "⚠️ Staging unhealthy"
      
      - name: Check Production Health
        run: |
          curl -sf ${{ secrets.PROD_HEALTH_URL }} || echo "🚨 Production unhealthy"
```

---

## 🚀 快速開始

### 新開發者入職（5分鐘）

```bash
# 1. 克隆倉庫
git clone https://github.com/your-org/watson-claw.git
cd watson-claw

# 2. 一鍵設置
npm run setup

# 3. 編輯 API keys
vim .dev.vars

# 4. 開始開發
npm run dev

# 5. 訪問測試
open http://localhost:8787
```

### 日常開發流程

```bash
# 創建新功能
git checkout -b feature/new-feature

# 開發...編輯代碼...

# 本地測試
npm run test
npm run dev

# 提交
git add .
git commit -m "feat: add new feature"
git push origin feature/new-feature

# 創建 PR → 自動部署預覽環境 → Code Review → 合併到 develop
# 合併後自動部署到 Staging

# 發布到 Production
git checkout main
git merge develop
git push origin main
# 自動部署到 Production（需要人工批准）
```

---

## 📈 CI/CD 性能指標

| 指標 | 目標 | 當前 |
|-----|------|------|
| 測試運行時間 | < 60秒 | - |
| 部署時間 | < 30秒 | - |
| 從 push 到上線 | < 2分鐘 | - |
| 部署成功率 | > 99% | - |
| 回滾時間 | < 5分鐘 | - |

---

*CI/CD 設計文檔 v1.0*  
*目標：一鍵部署，極速開發*
