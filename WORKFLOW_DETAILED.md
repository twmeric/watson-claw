# Watson 指令執行完整流程

> 從用戶說「明天下午3點提醒我有組會」到真正收到提醒，中間發生了什麼？

---

## 🎯 整體流程圖

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           用戶指令生命週期                                    │
└─────────────────────────────────────────────────────────────────────────────┘

【Step 1】發送指令                        【Step 2】接收 & 驗證
┌─────────────┐                          ┌─────────────┐
│   用戶手機   │  ──WhatsApp訊息──>      │ SaleSmartly │
│             │                          │   後端平台   │
└─────────────┘                          └──────┬──────┘
                                                │
                                                │ 轉發 Webhook
                                                │ (帶 security code)
                                                ▼
                                         ┌─────────────┐
                                         │   Worker    │
                                         │  驗證來源    │
                                         └──────┬──────┘
                                                │
                                                ▼
【Step 3】解析意圖                        【Step 4】執行動作
┌─────────────┐                          ┌─────────────┐
│   OpenRouter │  <───發送 prompt────    │   Worker    │
│   LLM API   │                          │  解析內容    │
│  (GPT-4o)   │  ───返回結構化資料───>   │             │
└─────────────┘                          └──────┬──────┘
                                                │
                    ┌───────────────────────────┼───────────────────────────┐
                    │                           │                           │
                    ▼                           ▼                           ▼
            ┌─────────────┐            ┌─────────────┐            ┌─────────────┐
            │  存入 D1    │            │  設置 Cron  │            │  發送回覆   │
            │  數據庫     │            │   定時器    │            │  給用戶     │
            └─────────────┘            └─────────────┘            └─────────────┘
                                                                           │
                                                                           ▼
                                                                    ┌─────────────┐
                                                                    │ CloudWapi   │
                                                                    │ 發送WhatsApp │
                                                                    └─────────────┘

【Step 5】定時觸發（明天14:45）
┌─────────────┐
│  Worker Cron │  ──檢查到期的提醒──>  發送提醒訊息給用戶
│  (每小時執行) │
└─────────────┘
```

---

## 📱 Step 1: 用戶發送指令

### 用戶視角
```
用戶在 WhatsApp 輸入：
"明天下午3點提醒我有組會"

點擊發送 ✈️
```

### 實際發生的技術細節
```
訊息數據：
{
  "from": "85298765432",        // 用戶手機號
  "text": "明天下午3點提醒我有組會",
  "timestamp": "2026-03-28T09:30:00Z",
  "message_id": "wamid.xxx"
}
```

---

## 🔌 Step 2: SaleSmartly 接收 & 轉發

### SaleSmartly 做了什麼？

```
┌─────────────────────────────────────────────┐
│           SaleSmartly 後端                   │
│                                             │
│  1. 接收 WhatsApp 訊息                       │
│     ↓                                       │
│  2. 查找配置的 Webhook URL                   │
│     → https://watson-claw.xxx.workers.dev   │
│     ↓                                       │
│  3. 添加 security code                      │
│     → Header: X-Security-Code: jsUJNQBR...  │
│     ↓                                       │
│  4. 發送 POST 請求                           │
└─────────────────────────────────────────────┘
```

### 轉發給 Worker 的數據

```json
{
  "event": "message.received",
  "data": {
    "from": "85298765432",
    "text": "明天下午3點提醒我有組會",
    "timestamp": "2026-03-28T09:30:00Z",
    "channel": "whatsapp"
  },
  "security_code": "jsUJNQBR4Ao1XfG"
}
```

---

## ⚙️ Step 3: Worker 接收 & 處理

### 3.1 安全驗證（第一道關卡）

```javascript
// Worker 收到請求後的第一件事
async function handleWebhook(request, env) {
  
  // 檢查 security code
  const securityCode = request.headers.get('X-Security-Code');
  
  if (securityCode !== env.SALESMARTLY_SECURITY_CODE) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  // ✅ 驗證通過，繼續處理
}
```

**為什麼需要這個？**
- 防止別人冒充 SaleSmartly 發送假請求
- 確保只有授權的請求能觸發你的 Worker

### 3.2 解析用戶意圖

```javascript
// 提取關鍵信息
const userMessage = data.text;  // "明天下午3點提醒我有組會"
const userPhone = data.from;    // "85298765432"

// 時間解析（用 chrono-node 庫）
const parsedTime = chrono.parse(userMessage);
// 結果：{ date: 2026-03-29T15:00:00, text: "明天下午3點" }

// 提取任務內容
const taskContent = extractTask(userMessage);  // "有組會"
```

### 3.3 LLM 理解（智能解析）

```javascript
// 構建 prompt 給 OpenRouter
const prompt = `
用戶說："${userMessage}"

請解析並返回 JSON：
{
  "intent": "create_reminder",
  "task": "有組會",
  "datetime": "2026-03-29T15:00:00",
  "reminder_time": "2026-03-29T14:45:00"
}
`;

// 調用 LLM
const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: "openai/gpt-4o-mini",
    messages: [{ role: "user", content: prompt }]
  })
});

const result = await response.json();
const parsedIntent = JSON.parse(result.choices[0].message.content);
```

**為什麼需要 LLM？**
- 用戶說法千變萬化：「明天下午三點」、「後天中午」、「下週一早上」
- LLM 能統一理解成標準格式
- 不只是時間，還能判斷意圖（創建/查詢/修改/刪除）

---

## 💾 Step 4: 數據存儲（D1 數據庫）

### 4.1 創建提醒記錄

```javascript
// 連接 D1 數據庫
const db = env.DB;

// 插入提醒記錄
await db.prepare(`
  INSERT INTO reminders (
    user_phone, 
    task_content, 
    reminder_time, 
    status,
    created_at
  ) VALUES (?, ?, ?, ?, ?)
`).bind(
  userPhone,                          // "85298765432"
  parsedIntent.task,                  // "有組會"
  parsedIntent.reminder_time,         // "2026-03-29T14:45:00"
  'pending',                          // 等待觸發
  new Date().toISOString()
).run();
```

### 4.2 D1 表結構

```sql
CREATE TABLE reminders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_phone TEXT NOT NULL,          -- 用戶手機號
  task_content TEXT NOT NULL,        -- 任務內容
  reminder_time DATETIME NOT NULL,   -- 提醒時間
  status TEXT DEFAULT 'pending',     -- pending/sent/cancelled
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 查詢示例：找出明天要提醒的所有任務
SELECT * FROM reminders 
WHERE status = 'pending' 
  AND reminder_time <= datetime('now', '+1 hour');
```

---

## ⏰ Step 5: 定時檢查（Cron Trigger）

### 5.1 Cron 配置

```toml
# wrangler.toml
triggers = {
  crons = ["0 * * * *"]  # 每小時執行一次
}
```

### 5.2 Cron 執行邏輯

```javascript
export default {
  async scheduled(event, env, ctx) {
    // 每小時執行一次
    await checkAndSendReminders(env);
  }
};

async function checkAndSendReminders(env) {
  const db = env.DB;
  
  // 找出所有到期的提醒
  const reminders = await db.prepare(`
    SELECT * FROM reminders 
    WHERE status = 'pending' 
      AND reminder_time <= datetime('now')
  `).all();
  
  // 逐一發送
  for (const reminder of reminders.results) {
    await sendWhatsAppMessage(
      env,
      reminder.user_phone,
      `⏰ 提醒：${reminder.task_content}`
    );
    
    // 標記為已發送
    await db.prepare(`
      UPDATE reminders 
      SET status = 'sent' 
      WHERE id = ?
    `).bind(reminder.id).run();
  }
}
```

### 5.3 時間線說明

```
3月28日 09:30    用戶創建提醒
       ↓
3月29日 14:45    Cron 檢查到這條提醒到期
       ↓
3月29日 14:45    發送 WhatsApp 訊息給用戶
       ↓
用戶收到：⏰ 提醒：有組會
```

---

## 📤 Step 6: 發送回覆（CloudWapi）

### 6.1 即時確認回覆

```javascript
// 用戶創建提醒後，立即發送確認
async function sendConfirmation(env, userPhone, task, time) {
  const message = `✅ 已設置提醒！

📋 ${task}
⏰ ${formatTime(time)}

我會在 15 分鐘前通知你。`;

  await sendWhatsAppMessage(env, userPhone, message);
}
```

### 6.2 CloudWapi 發送函數

```javascript
async function sendWhatsAppMessage(env, phone, message) {
  const response = await fetch('https://api.cloudwapi.com/v1/messages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.CLOUDWAPI_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      to: phone,
      type: 'text',
      text: { body: message }
    })
  });
  
  return response.ok;
}
```

### 6.3 完整的消息流

```
用戶 → "明天下午3點提醒我有組會"
              ↓
Worker → LLM 解析
              ↓
Worker → 存入 D1
              ↓
Worker → 發送確認："✅ 已設置！"
              ↓
...等待...
              ↓
Cron (明天14:45) → 檢查到期
              ↓
Cron → 發送提醒："⏰ 提醒：有組會"
              ↓
用戶收到提醒
```

---

## 🔄 其他場景流程

### 場景 A：查詢待辦事項

```
用戶："我今天有什麼安排？"
       ↓
LLM 解析意圖 → intent: "query_today"
       ↓
查詢 D1：SELECT * WHERE date = today
       ↓
返回："今天你有：
      1. 15:00 組會
      2. 18:00 健身房"
```

### 場景 B：修改提醒

```
用戶："把組會改到4點"
       ↓
LLM 解析：找到最近的"組會"，修改時間
       ↓
UPDATE D1 SET reminder_time = '16:00'
       ↓
返回："✅ 已修改為下午4點"
```

### 場景 C：取消提醒

```
用戶："取消組會提醒"
       ↓
LLM 解析：找到"組會"，標記取消
       ↓
UPDATE D1 SET status = 'cancelled'
       ↓
返回："✅ 已取消"
```

---

## 🏗️ 系統架構總圖

```
┌────────────────────────────────────────────────────────────────────┐
│                          用戶層                                     │
│  ┌─────────────┐                                                   │
│  │  WhatsApp   │  ← 用戶發送消息                                    │
│  └──────┬──────┘                                                   │
└─────────┼──────────────────────────────────────────────────────────┘
          │
          │ 訊息
          ▼
┌────────────────────────────────────────────────────────────────────┐
│                        SaleSmartly 層                              │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  • 接收 WhatsApp 訊息                                          │ │
│  │  • 轉發到配置的 Webhook URL                                     │ │
│  │  • 添加 security code 驗證                                     │ │
│  └───────────────────────┬───────────────────────────────────────┘ │
└──────────────────────────┼─────────────────────────────────────────┘
                           │ POST /webhook/salesmartly
                           ▼
┌────────────────────────────────────────────────────────────────────┐
│                      Cloudflare Worker 層                          │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  🛡️ 安全層                                                     │ │
│  │     • 驗證 Security Code                                       │ │
│  │     • 檢查請求來源                                             │ │
│  │                                                                │ │
│  │  🧠 處理層                                                     │ │
│  │     • 調用 OpenRouter LLM 解析意圖                             │ │
│  │     • 提取時間、任務內容                                       │ │
│  │     • 決定執行動作                                             │ │
│  │                                                                │ │
│  │  💾 數據層                                                     │ │
│  │     • 讀寫 D1 數據庫                                           │ │
│  │     • 查詢/創建/更新提醒                                       │ │
│  │                                                                │ │
│  │  📤 發送層                                                     │ │
│  │     • 調用 CloudWapi 發送 WhatsApp                             │ │
│  │                                                                │ │
│  │  ⏰ 定時層                                                     │ │
│  │     • Cron Trigger 每小時檢查到期提醒                          │ │
│  │     • 自動發送提醒消息                                         │ │
│  └───────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────┘
          │
          │ API 調用
          ▼
┌────────────────────────────────────────────────────────────────────┐
│                       外部服務層                                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │
│  │ OpenRouter  │  │   D1 DB     │  │ CloudWapi   │                 │
│  │   (LLM)     │  │  (SQLite)   │  │ (WhatsApp)  │                 │
│  └─────────────┘  └─────────────┘  └─────────────┘                 │
└────────────────────────────────────────────────────────────────────┘
```

---

## 💡 關鍵問題解答

### Q1: 如果 Worker 掛了，消息會丟失嗎？

**不會。**
```
SaleSmartly 會重試機制：
- 如果 Worker 返回 5xx 錯誤
- SaleSmartly 會在 1分鐘、5分鐘、15分鐘後重試
- 最多重試 3 次

所以 Worker 短暫下線沒問題
```

### Q2: 如果 LLM 解析錯了怎麼辦？

**有降級方案：**
```javascript
// 方案 A：要求 LLM 返回置信度
if (parsedIntent.confidence < 0.7) {
  // 發送確認消息："你是說明天下午3點有組會嗎？[確認][修改]"
}

// 方案 B：用戶反饋糾正
用戶："不是，是後天"
→ 系統學習並糾正
```

### Q3: 數據存在哪裡？安全嗎？

```
數據存儲：
• D1 (Cloudflare SQLite) - 結構化數據
• KV (Cloudflare KV) - 用戶配置、快取

安全性：
• 數據在 Cloudflare 基礎設施內
• 傳輸加密 (HTTPS)
• 可以開啟 D1 加密
• 用戶數據隔離 (通過 phone number)
```

### Q4: 提醒準時嗎？

```
Cron 每小時執行一次：
• 最壞情況：提前 59 分鐘創建的提醒，可能延遲 59 分鐘
• 可優化：改為每 5 分鐘執行，或設置多個 Cron

更好的方案：
• 使用 Cloudflare Queues (延遲隊列)
• 或 external cron 服務
```

---

## 🎬 總結

```
用戶說一句話
     ↓
SaleSmartly 轉發
     ↓
Worker 驗證 → LLM 解析 → 存 D1
     ↓
發送確認給用戶
     ↓
Cron 定時檢查
     ↓
時間到 → 發送提醒
     ↓
用戶收到通知

整個流程：
• 延遲 < 3 秒（即時回覆）
• 成本：每次調用約 $0.001
• 可靠性：Cloudflare 保證 99.9%+
```

---

*技術流程文檔 v1.0*  
*狀態：可實現，技術成熟*
