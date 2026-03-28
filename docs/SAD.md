# Watson Claw - System Architecture & Design (SA&D)

> **技術架構設計 - 石破天驚的龍蝦模式**

**版本**: 1.0.0  
**日期**: 2026-03-28  
**作者**: Jim's Bond + 母機團隊  
**狀態**: Draft

---

## 📋 目錄

1. [架構概述](#1-架構概述)
2. [系統組件](#2-系統組件)
3. [數據流](#3-數據流)
4. [數據庫設計](#4-數據庫設計)
5. [API 設計](#5-api-設計)
6. [安全設計](#6-安全設計)
7. [部署架構](#7-部署架構)
8. [擴展性設計](#8-擴展性設計)

---

## 1. 架構概述

### 1.1 架構原則

```
🦞 龍蝦模式 (Lobster Mode):
- 低調: 寄生於現有平台 (WhatsApp)，不引人注目
- 精準: 專注核心功能，不做大而全
- 靈活: 隨時可以遷移，不依賴單一平台
- 共生: 與平台互利，不違規對抗
```

### 1.2 整體架構圖

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                   用戶層                                     │
│  ┌─────────────┐                                                            │
│  │  WhatsApp   │  ← 用戶發送/接收消息                                       │
│  │   Client    │                                                            │
│  └──────┬──────┘                                                            │
└─────────┼───────────────────────────────────────────────────────────────────┘
          │
          │ Meta WhatsApp Business API
          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                                接入層 (SaaS)                                 │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                         SaleSmartly                                   │  │
│  │  • 接收 WhatsApp 消息                                                  │  │
│  │  • 轉發到 Webhook URL                                                  │  │
│  │  • 添加 Security Code 驗證                                             │  │
│  └───────────────────────────┬──────────────────────────────────────────┘  │
└──────────────────────────────┼──────────────────────────────────────────────┘
                               │ POST /webhook/salesmartly
                               │ X-Security-Code: xxx
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              處理層 (Edge)                                   │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                    Cloudflare Worker                                 │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │  │
│  │  │   Router    │  │   Handler   │  │   Service   │                  │  │
│  │  │             │→ │             │→ │             │                  │  │
│  │  │ /webhook    │  │ webhook.js  │  │ db.js       │                  │  │
│  │  │ /health     │  │ cron.js     │  │ llm.js      │                  │  │
│  │  │ /           │  │ health.js   │  │ whatsapp.js │                  │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                  │  │
│  └───────────────────────────┬──────────────────────────────────────────┘  │
└──────────────────────────────┼──────────────────────────────────────────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
          ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   D1 Database   │  │  Deepseek API   │  │  CloudWapi API  │
│   (SQLite)      │  │   (LLM)         │  │  (WhatsApp發送) │
│                 │  │                 │  │                 │
│ • users         │  │ • 意圖解析      │  │ • 發送消息      │
│ • reminders     │  │ • 對話生成      │  │ • 模板消息      │
│ • conversations │  │ • 智能建議      │  │                 │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

### 1.3 技術棧

| 層級 | 技術 | 選擇原因 |
|-----|------|---------|
| **接入層** | SaleSmartly | 避免 WhatsApp 封號，合規穩定 |
| **計算層** | Cloudflare Workers | Edge 部署，全球低延遲，Serverless |
| **數據層** | Cloudflare D1 | SQLite，零配置，免費額度大 |
| **緩存層** | Cloudflare KV | 低延遲，適合配置存儲 |
| **AI 層** | Deepseek API | 成本低，效果好，中文強 |
| **發送層** | CloudWapi | 穩定，價格合理 |

---

## 2. 系統組件

### 2.1 Worker 架構

```
┌─────────────────────────────────────────────────────────────┐
│                    Worker Entry (index.js)                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │   Router    │    │   Router    │    │   Router    │     │
│  │   /webhook  │    │   /health   │    │      /      │     │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘     │
│         │                  │                  │            │
│         ▼                  ▼                  ▼            │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │   Handler   │    │   Handler   │    │   Handler   │     │
│  │  webhook.js │    │  health.js  │    │   info      │     │
│  └──────┬──────┘    └─────────────┘    └─────────────┘     │
│         │                                                  │
│         ▼                                                  │
│  ┌─────────────────────────────────────────────┐          │
│  │              Service Layer                   │          │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐       │          │
│  │  │   db    │ │   llm   │ │whatsapp │       │          │
│  │  │  .js    │ │  .js    │ │  .js    │       │          │
│  │  └─────────┘ └─────────┘ └─────────┘       │          │
│  └─────────────────────────────────────────────┘          │
│                           │                                │
│                           ▼                                │
│  ┌─────────────────────────────────────────────┐          │
│  │              Utils Layer                     │          │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐       │          │
│  │  │security │ │ parser  │ │  time   │       │          │
│  │  │  .js    │ │  .js    │ │  .js    │       │          │
│  │  └─────────┘ └─────────┘ └─────────┘       │          │
│  └─────────────────────────────────────────────┘          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 組件職責

| 組件 | 職責 | 輸入 | 輸出 |
|-----|------|------|------|
| **Router** | 請求路由分發 | HTTP Request | Handler 函數 |
| **Webhook Handler** | 處理 SaleSmartly 消息 | Webhook Payload | WhatsApp 回覆 |
| **Cron Handler** | 定時檢查提醒 | Cron Trigger | 提醒發送 |
| **DB Service** | 數據庫操作 | SQL/參數 | 查詢結果 |
| **LLM Service** | AI 意圖解析 | 用戶消息 | 結構化意圖 |
| **WhatsApp Service** | 發送消息 | 手機號/內容 | 發送結果 |

### 2.3 調用鏈

```
用戶發送消息
    ↓
SaleSmartly → Webhook POST
    ↓
Worker Router → webhook handler
    ↓
1. validateSecurityCode()
    ↓
2. getOrCreateUser() → D1
    ↓
3. parseUserIntent() → Deepseek API
    ↓
4. handleIntent()
    ↓
   ├─ createReminder() → D1
   ├─ getUserReminders() → D1
   └─ cancelReminder() → D1
    ↓
5. sendWhatsAppMessage() → CloudWapi
    ↓
用戶收到回覆
```

---

## 3. 數據流

### 3.1 創建提醒流程

```
用戶 → WhatsApp: 明天3點有組會
WhatsApp → SaleSmartly: 消息
SaleSmartly → Worker: POST /webhook
    Note right of Worker: 1. 驗證 Security Code
Worker → D1: SELECT user
    Note right of D1: 2. 獲取/創建用戶
D1 --> Worker: user data
Worker → Deepseek: parseIntent()
    Note right of Deepseek: 3. AI 解析
Deepseek --> Worker: {intent, task, time}
Worker → D1: INSERT reminder
    Note right of D1: 4. 保存提醒
D1 --> Worker: success
Worker → CloudWapi: sendMessage()
    Note right of CloudWapi: 5. 發送確認
CloudWapi --> WhatsApp: ✅ 已設置
WhatsApp → 用戶: 顯示消息
```

### 3.2 定時提醒流程

```
Cron → Worker: 每小時觸發
    Note right of Worker: 1. Cron Trigger
Worker → D1: SELECT pending reminders
    Note right of D1: WHERE time <= now
D1 --> Worker: [reminder1, reminder2, ...]
loop 每個提醒
    Worker → CloudWapi: sendMessage(phone, content)
        Note right of CloudWapi: 發送提醒
    CloudWapi --> WhatsApp: ⏰ 提醒消息
    WhatsApp → 用戶: 顯示通知
    Worker → D1: UPDATE status='sent'
end
```

### 3.3 數據流圖

```
┌─────────────────────────────────────────────────────────────────┐
│                        數據流向                                  │
└─────────────────────────────────────────────────────────────────┘

【寫入流向】
用戶消息 → SaleSmartly → Worker → 解析 → D1 (users, reminders, conversations)
                                    ↓
                              Deepseek API (意圖解析)
                                    ↓
                              CloudWapi → 用戶 (回覆)

【讀取流向】
Cron Trigger → Worker → D1 (查詢到期提醒) → CloudWapi → 用戶 (通知)

用戶查詢 → Worker → D1 (查詢日程) → CloudWapi → 用戶 (回覆)
```

---

## 4. 數據庫設計

### 4.1 ER 圖

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│    users    │       │  reminders  │       │conversations│
├─────────────┤       ├─────────────┤       ├─────────────┤
│ phone (PK)  │◄──────┤ user_phone  │       │ id (PK)     │
│ name        │       │ id (PK)     │       │ user_phone  │◄──┐
│ university  │       │ task_content│       │ message     │   │
│ status      │       │ reminder_time      │ direction   │   │
│ created_at  │       │ status      │       │ intent      │   │
│ preferences │       │ created_at  │       │ created_at  │   │
└─────────────┘       └─────────────┘       └─────────────┘   │
                                                              │
┌─────────────┐                                              │
│    events   │                                              │
├─────────────┤                                              │
│ id (PK)     │                                              │
│ user_phone  │◄─────────────────────────────────────────────┘
│ event_type  │
│ event_data  │
│ created_at  │
└─────────────┘
```

### 4.2 表結構

**users 表**
```sql
CREATE TABLE users (
    phone TEXT PRIMARY KEY,              -- WhatsApp 手機號
    name TEXT,                           -- 用戶名字
    university TEXT,                     -- 學校
    major TEXT,                          -- 專業
    year_of_study INTEGER,               -- 年級
    timezone TEXT DEFAULT 'Asia/Hong_Kong',
    language TEXT DEFAULT 'zh-HK',
    status TEXT DEFAULT 'active',        -- active/inactive/blocked
    onboarding_step TEXT DEFAULT 'new',
    default_reminder_minutes INTEGER DEFAULT 15,
    preferences TEXT,                    -- JSON 格式
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_active_at DATETIME
);

-- 索引
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_last_active ON users(last_active_at);
```

**reminders 表**
```sql
CREATE TABLE reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_phone TEXT NOT NULL,
    task_content TEXT NOT NULL,
    reminder_time DATETIME NOT NULL,     -- 提醒時間
    original_time DATETIME,              -- 原始事件時間
    status TEXT DEFAULT 'pending',       -- pending/sent/cancelled/snoozed
    priority TEXT DEFAULT 'normal',      -- low/normal/high/urgent
    category TEXT,                       -- class/meeting/assignment/personal
    recurring_pattern TEXT,              -- daily/weekly/monthly/null
    metadata TEXT,                       -- JSON 擴展
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME,
    sent_at DATETIME,
    
    FOREIGN KEY (user_phone) REFERENCES users(phone)
);

-- 索引
CREATE INDEX idx_reminders_user ON reminders(user_phone);
CREATE INDEX idx_reminders_status ON reminders(status);
CREATE INDEX idx_reminders_time ON reminders(reminder_time);
CREATE INDEX idx_reminders_status_time ON reminders(status, reminder_time);
```

**conversations 表**
```sql
CREATE TABLE conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_phone TEXT NOT NULL,
    message TEXT NOT NULL,
    direction TEXT NOT NULL,             -- incoming/outgoing
    intent TEXT,                         -- AI 解析的意圖
    sentiment TEXT,                      -- positive/neutral/negative
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_phone) REFERENCES users(phone)
);

CREATE INDEX idx_conversations_user ON conversations(user_phone);
CREATE INDEX idx_conversations_created ON conversations(created_at);
```

### 4.3 關鍵查詢

**查詢到期提醒 (Cron 使用)**
```sql
SELECT * FROM reminders 
WHERE status = 'pending' 
  AND reminder_time <= datetime('now')
ORDER BY reminder_time ASC;
```

**查詢用戶今日日程**
```sql
SELECT * FROM reminders 
WHERE user_phone = ? 
  AND status = 'pending'
  AND date(original_time) = date('now')
ORDER BY original_time ASC;
```

**統計用戶活躍度**
```sql
SELECT 
    date(created_at) as date,
    COUNT(DISTINCT user_phone) as active_users
FROM conversations 
WHERE created_at >= date('now', '-30 days')
GROUP BY date(created_at);
```

---

## 5. API 設計

### 5.1 內部 API

**Webhook 接收**
```http
POST /webhook/salesmartly
Content-Type: application/json
X-Security-Code: {secret}

{
  "from": "85298765432",
  "text": "明天下午3點有組會",
  "timestamp": "2026-03-28T09:30:00Z",
  "message_id": "wamid.xxx"
}

Response: 200 OK
{
  "status": "success",
  "intent": "create_reminder"
}
```

**健康檢查**
```http
GET /health

Response: 200 OK
{
  "status": "healthy",
  "version": "1.0.0",
  "environment": "staging",
  "timestamp": "2026-03-28T14:22:16Z",
  "services": {
    "database": {"status": "ok"}
  }
}
```

### 5.2 外部 API 集成

**Deepseek API**
```http
POST https://api.deepseek.com/chat/completions
Authorization: Bearer {api_key}
Content-Type: application/json

{
  "model": "deepseek-chat",
  "messages": [
    {"role": "system", "content": "你是意圖解析器..."},
    {"role": "user", "content": "明天下午3點有組會"}
  ],
  "temperature": 0.1,
  "response_format": {"type": "json_object"}
}

Response:
{
  "choices": [{
    "message": {
      "content": "{\"type\":\"create_reminder\",\"task\":\"有組會\",...}"
    }
  }]
}
```

**CloudWapi 發送消息**
```http
POST https://api.cloudwapi.com/v1/messages
Authorization: Bearer {api_key}
Content-Type: application/json

{
  "to": "85298765432",
  "type": "text",
  "text": {"body": "✅ 已設置提醒！"}
}
```

---

## 6. 安全設計

### 6.1 安全架構

```
┌─────────────────────────────────────────────────────────────┐
│                       安全層次                                │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Layer 1: 傳輸安全                                           │
│  ─────────────────                                           │
│  • HTTPS 強制                                                 │
│  • TLS 1.3                                                   │
│                                                              │
│  Layer 2: Webhook 驗證                                        │
│  ────────────────────                                        │
│  • Security Code 驗證                                         │
│  • Constant-time comparison                                  │
│  • IP 限制 (可選)                                            │
│                                                              │
│  Layer 3: API 安全                                           │
│  ────────────────                                            │
│  • API Keys 存環境變量                                       │
│  • 不在代碼中硬編碼                                          │
│  • 定期輪換                                                  │
│                                                              │
│  Layer 4: 數據安全                                           │
│  ────────────────                                            │
│  • 用戶數據隔離                                               │
│  • 手機號格式化存儲                                          │
│  • 對話歷史 90 天清理                                        │
│                                                              │
│  Layer 5: 應用安全                                           │
│  ────────────────                                            │
│  • 輸入驗證和消毒                                             │
│  • 速率限制                                                   │
│  • SQL 注入防護 (參數化查詢)                                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 威脅模型

| 威脅 | 風險 | 對策 |
|-----|------|------|
| Webhook 偽造 | 高 | Security Code 驗證 |
| API Key 洩露 | 高 | 環境變量 + 定期輪換 |
| 數據洩露 | 中 | 用戶隔離 + 加密傳輸 |
| 速率攻擊 | 中 | 速率限制 |
| 注入攻擊 | 低 | 參數化查詢 |

### 6.3 隱私設計

```
隱私原則:
1. 最小數據收集: 只收集必需信息
2. 數據本地化: 用戶數據存在其賬戶下
3. 透明性: 用戶知道數據如何使用
4. 可刪除: 用戶可以刪除所有數據

實現:
- 手機號格式化 (去除特殊字符)
- 對話歷史 90 天自動清理
- 用戶可以隨時導出/刪除數據
```

---

## 7. 部署架構

### 7.1 環境分離

```
┌─────────────────────────────────────────────────────────────────┐
│                      多環境架構                                  │
└─────────────────────────────────────────────────────────────────┘

【Development】
┌─────────────────────────────────────────┐
│ Local: wrangler dev                    │
│ URL: http://localhost:8787              │
│ DB: 本地 SQLite                        │
│ 用途: 本地開發測試                     │
└─────────────────────────────────────────┘
                    ↓ git push origin develop
【Staging】
┌─────────────────────────────────────────┐
│ Worker: watson-claw-staging            │
│ URL: https://watson-claw-staging...     │
│ DB: watson-claw-staging-db             │
│ 用途: 集成測試，QA                     │
└─────────────────────────────────────────┘
                    ↓ git merge main
【Production】
┌─────────────────────────────────────────┐
│ Worker: watson-claw                    │
│ URL: https://watson-claw...             │
│ DB: watson-claw-db                     │
│ 用途: 真實用戶                         │
└─────────────────────────────────────────┘
```

### 7.2 CI/CD 流程

```
Developer
    ↓ git push origin feature/xxx
GitHub Actions
    ↓ Create PR
PR Preview Deploy
    ↓ Code Review
Merge to develop
    ↓ GitHub Actions
Auto Deploy to Staging
    ↓ Tests Pass
Merge to main
    ↓ GitHub Actions
Manual Approval
    ↓ Approved
Deploy to Production
    ↓ Health Check
Done
```

### 7.3 回滾策略

```
發現問題
    ↓
判斷嚴重性
    ├─ 嚴重 (服務中斷)
    │   ↓ 立即回滾
    │   wrangler rollback
    │
    └─ 輕微 (功能異常)
        ↓ 快速修復
        Hotfix → Deploy
```

---

## 8. 擴展性設計

### 8.1 水平擴展

```
當前架構 (Cloudflare Workers):
- 自動擴展，無需擔心
- 全球 300+ 數據中心
- 無冷啟動問題

限制:
- Worker 執行時間: 50ms CPU time
- 內存: 128MB
- 請求體: 100MB

應對:
- 異步處理 (waitUntil)
- 數據分頁
- 緩存策略
```

### 8.2 數據庫擴展

```
階段 1: D1 SQLite (當前)
- 容量: 500MB - 500GB
- 適合: < 100K 用戶

階段 2: D1 + 分片
- 按用戶 ID 分片
- 適合: 100K - 1M 用戶

階段 3: PostgreSQL (Supabase/Railway)
- 完整 SQL 功能
- 適合: > 1M 用戶
```

### 8.3 功能擴展

```
未來擴展方向:

【AI 能力】
- 當前: Deepseek 基礎對話
- 未來: RAG (知識庫)、多輪對話

【集成】
- 當前: WhatsApp only
- 未來: Telegram, LINE, Email

【平台】
- 當前: Cloudflare only
- 未來: Vercel, AWS Lambda (多雲)

【商業功能】
- 當前: Free only
- 未來: 訂閱、團隊、企業版
```

### 8.4 監控和可觀測性

```
指標收集:
- 請求數量/延遲
- 錯誤率
- AI API 響應時間
- 數據庫查詢時間

日誌:
- 結構化 JSON 日誌
- 分級: ERROR, WARN, INFO, DEBUG
- 保留 7 天

告警:
- 錯誤率 > 5%
- P95 延遲 > 3s
- 服務不可用
```

---

## 附錄

### A. 術語表

| 術語 | 英文 | 定義 |
|-----|------|------|
| Worker | Cloudflare Worker | Edge 計算服務 |
| D1 | Cloudflare D1 | Edge SQLite 數據庫 |
| KV | Cloudflare KV | Key-Value 存儲 |
| Webhook | Webhook | HTTP 回調通知 |
| Cron | Cron Job | 定時任務 |
| LLM | Large Language Model | 大語言模型 |
| RAG | Retrieval Augmented Generation | 檢索增強生成 |

### B. 參考架構

- Cloudflare Workers Patterns: https://developers.cloudflare.com/workers/learning/patterns/
- Serverless Best Practices: https://docs.aws.amazon.com/whitepapers/latest/serverless-architectures-lambda/welcome.html
- WhatsApp Business API: https://business.whatsapp.com/products/business-platform

### C. 決策記錄 (ADR)

| 決策 | 選項 | 原因 |
|-----|------|------|
| 使用 Deepseek 而非 OpenRouter | Deepseek | 成本低，中文好 |
| 使用 D1 而非 PostgreSQL | D1 | 零配置，免費額度 |
| 使用 SaleSmartly 而非自建 | SaleSmartly | 避免封號風險 |
| 使用 WhatsApp 而非獨立 App | WhatsApp | 零下載，用戶習慣 |

---

*SA&D v1.0 - Created by Motherbase Team for Watson Claw Project*
*比龍蝦更石破天驚的架構設計 🦞*
