# GitHub Repository 設置指南

## 步驟 1: 創建 GitHub Repository

### 選項 A: 使用 GitHub CLI (推薦)

```bash
# 1. 安裝 GitHub CLI (如果還沒有)
# Windows (PowerShell):
winget install --id GitHub.cli

# Mac:
brew install gh

# 2. 登錄 GitHub
gh auth login

# 3. 創建 Repository
cd C:\Users\Owner\Cloudflare\AIWACRM\watson-claw
gh repo create watson-claw --public --source=. --remote=origin --push
```

### 選項 B: 手動創建

1. 訪問 https://github.com/new
2. Repository name: `watson-claw`
3. 選擇 Public 或 Private
4. 不要勾選 "Initialize this repository with a README" (我們已有 README)
5. 點擊 "Create repository"
6. 按照頁面指示推送代碼：

```bash
cd C:\Users\Owner\Cloudflare\AIWACRM\watson-claw
git init
git add .
git commit -m "Initial commit: CI/CD + core structure"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/watson-claw.git
git push -u origin main
```

---

## 步驟 2: 添加 GitHub Secrets

### 方法 A: 使用 GitHub CLI (推薦)

```bash
# 確保在項目目錄中
cd C:\Users\Owner\Cloudflare\AIWACRM\watson-claw

# 1. Cloudflare API Token
git secret set CLOUDFLARE_API_TOKEN
# 然後粘貼你的 Token

# 2. Cloudflare Account ID
git secret set CLOUDFLARE_ACCOUNT_ID
# 粘貼 Account ID

# 3. SaleSmartly Security Code (Staging)
git secret set SALESMARTLY_SECURITY_STAGING
# 粘貼: jsUJNQBR4Ao1XfG

# 4. SaleSmartly Security Code (Production)
git secret set SALESMARTLY_SECURITY_PROD
# 粘貼: (測試時可以用同一個，正式環境建議不同)

# 5. CloudWapi Key (Staging)
git secret set CLOUDWAPI_KEY_STAGING
# 粘貼: 9QHFyJqc9wRd748jsUJNQBR4Ao1XfG

# 6. CloudWapi Key (Production)
git secret set CLOUDWAPI_KEY_PRODUCTION
# 粘貼: (測試時可以用同一個)

# 7. OpenRouter API Key
git secret set OPENROUTER_API_KEY
# 粘貼你的 OpenRouter Key (從 openrouter.ai 獲取)
```

### 方法 B: GitHub Web 界面

1. 訪問: `https://github.com/YOUR_USERNAME/watson-claw/settings/secrets/actions`
2. 點擊 "New repository secret"
3. 逐一添加以下 secrets:

| Secret Name | Value | 說明 |
|------------|-------|------|
| `CLOUDFLARE_API_TOKEN` | 從 Cloudflare 獲取 | 部署 Worker 用 |
| `CLOUDFLARE_ACCOUNT_ID` | 從 Cloudflare 獲取 | 賬戶識別 |
| `SALESMARTLY_SECURITY_STAGING` | jsUJNQBR4Ao1XfG | 測試環境安全碼 |
| `SALESMARTLY_SECURITY_PROD` | jsUJNQBR4Ao1XfG | 生產環境安全碼 |
| `CLOUDWAPI_KEY_STAGING` | 9QHFyJqc9wRd748jsUJNQBR4Ao1XfG | 測試環境發送 |
| `CLOUDWAPI_KEY_PRODUCTION` | 9QHFyJqc9wRd748jsUJNQBR4Ao1XfG | 生產環境發送 |
| `OPENROUTER_API_KEY` | 從 openrouter.ai 獲取 | LLM API |

---

## 步驟 3: 獲取 Cloudflare API Token

### 創建 Token 步驟：

1. 登錄 https://dash.cloudflare.com
2. 點擊右上角頭像 → "My Profile"
3. 左側菜單 → "API Tokens"
4. 點擊 "Create Token"
5. 選擇 "Custom token"
6. 配置權限：
   ```
   Token name: Watson Claw CI/CD
   
   Permissions:
   - Cloudflare Workers Scripts: Edit
   - Account: Read
   - User: Read
   
   Account Resources: Include - Your Account
   ```
7. 點擊 "Continue to summary" → "Create Token"
8. **立即複製 Token** (只顯示一次！)

### 獲取 Account ID：

1. 在 Cloudflare Dashboard 右側欄
2. 找到 "Account ID" 並複製

---

## 步驟 4: 獲取 OpenRouter API Key

1. 訪問 https://openrouter.ai
2. 註冊/登錄賬號
3. 進入 Settings → API Keys
4. 創建新的 API Key
5. 複製保存

---

## 步驟 5: 驗證設置

### 測試本地部署

```bash
# 1. 登錄 Wrangler
npx wrangler login

# 2. 測試部署到 Staging
npm run deploy:staging

# 3. 檢查健康狀態
curl https://watson-claw-staging.jimsbond007.workers.dev/health
```

### 測試 GitHub Actions

1. Push 代碼到 develop 分支：
```bash
git checkout -b develop
git add .
git commit -m "Setup CI/CD"
git push origin develop
```

2. 查看 GitHub Actions：
   - 訪問: `https://github.com/YOUR_USERNAME/watson-claw/actions`
   - 應該看到部署流程正在運行

---

## 常見問題

### Q: Token 無效錯誤
```
Error: Authentication error
```
**解決**: 確保 Token 有 Workers Scripts:Edit 權限

### Q: 部署成功但 Worker 無法訪問
```
Error 1034: Disabled
```
**解決**: 在 Cloudflare Dashboard → Workers & Pages → 啟用你的 Worker

### Q: Secrets 未生效
```
Error: Required secret not found
```
**解決**: 檢查 Secret name 是否完全匹配（區分大小寫）

---

## 驗證清單

- [ ] Repository 創建成功
- [ ] 代碼已 push 到 main 分支
- [ ] Cloudflare API Token 已添加
- [ ] Cloudflare Account ID 已添加
- [ ] SaleSmartly Security Codes 已添加
- [ ] CloudWapi Keys 已添加
- [ ] OpenRouter API Key 已添加
- [ ] GitHub Actions 運行正常
- [ ] Staging 部署成功
- [ ] Health check 返回 200

---

完成以上步驟後，CI/CD 就完全配置好了！🎉
