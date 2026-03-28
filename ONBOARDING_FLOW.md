# Watson 無感知開戶流程設計

> **「最好的開戶流程，是讓用戶感覺不到自己在開戶」**

---

## 🎯 核心原則

```
❌ 傳統 App 開戶：
   下載 → 註冊郵箱 → 驗證郵箱 → 設置密碼 → 填寫資料 → 才能使用
   （15分鐘，流失率80%）

✅ Watson 開戶：
   點擊連結 → 進入 WhatsApp → 說第一句話 → 自動創建賬戶
   （30秒，流失率<10%）
```

---

## 📱 完整開戶流程

### 入口設計（多種選擇）

```
┌─────────────────────────────────────────────────────────────┐
│                    用戶首次接觸 Watson                        │
└─────────────────────────────────────────────────────────────┘

場景 A: 朋友推薦
小明：「這個 Watson 挺方便的，你試試」
        ↓
發送連結：https://watson-claw.jkdcoding.com/start?ref=friend

場景 B: 社交媒體
Instagram/Twitter 帖子：
「🦞 大學生都在用的 AI 助手，無需下載 App
   👇 點擊開始使用（30秒搞定）」
        ↓
點擊連結

場景 C: 掃描 QR Code
海報/傳單上的 QR Code
        ↓
手機掃描
```

### Step 1: Landing Page（5秒）

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                    🦞 Watson Claw                           │
│                                                             │
│              你的大學生活指揮官                               │
│                                                             │
│     ┌─────────────────────────────────────────────────┐    │
│     │                                                 │    │
│     │   無需下載 App，無需註冊賬號                      │    │
│     │   在 WhatsApp 裡說話就能安排一切                  │    │
│     │                                                 │    │
│     │   ┌─────────────────────────────────────────┐  │    │
│     │   │      🚀 30秒開始使用（免費）            │  │    │
│     │   └─────────────────────────────────────────┘  │    │
│     │                                                 │    │
│     │   已有 1,000+ 大學生在使用                      │    │
│     │   ⭐⭐⭐⭐⭐ "比我自己記靠譜多了" - 香港大學學生  │    │
│     │                                                 │    │
│     └─────────────────────────────────────────────────┘    │
│                                                             │
│   支持：管理課表 • 設置提醒 • 記錄待辦 • 同步日曆           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**設計要點：**
- 只有一個按鈕，沒有其他選擇
- 強調「免費」「無需註冊」降低心理門檻
- 社交證明（1,000+用戶、評價）建立信任

### Step 2: WhatsApp 一鍵連接（10秒）

```
點擊按鈕後 →

方式 A: 手機端
┌─────────────────────────────────────┐
│                                     │
│   即將打開 WhatsApp                  │
│                                     │
│   [自動顯示用戶手機上的 WhatsApp]     │
│                                     │
│   預填消息："你好 Watson，我想開始使用" │
│                                     │
│   [發送] 按鈕                        │
│                                     │
└─────────────────────────────────────┘

方式 B: 電腦端
┌─────────────────────────────────────┐
│                                     │
│   📱 掃描 QR Code 開始使用           │
│                                     │
│   ┌─────────────┐                   │
│   │ ▄▄▄▄▄ ▄▄▄▄▄ │  ← WhatsApp Web  │
│   │ █   █ █   █ │    QR Code       │
│   │ ▀▀▀▀▀ ▀▀▀▀▀ │                   │
│   └─────────────┘                   │
│                                     │
│   或使用：輸入手機號碼                │
│   ┌─────────────────┐               │
│   │ +852 ___-____-__ │               │
│   └─────────────────┘               │
│                                     │
└─────────────────────────────────────┘
```

### Step 3: 首次對話（15秒）

```
用戶點擊發送預填消息："你好 Watson，我想開始使用"

Watson 回覆：
═══════════════════════════════════════
🦞 嗨！我是 Watson，你的大學生活指揮官。

我可以幫你：
📅 管理課表和作業截止日期
⏰ 設置提醒和待辦事項
👥 記住朋友和社團聚會
📝 記錄靈感和想法

試試對我說：
• "明天下午3點有組會"
• "記得周五交線性代數作業"
• "提醒我明天買牛奶"

你想先試哪個？👇
═══════════════════════════════════════
```

**關鍵：這時候賬戶已經自動創建了！**

---

## ⚙️ 背後發生的事（技術實現）

### 自動開戶流程

```javascript
// Worker 收到第一條消息時
async function handleFirstMessage(userPhone, message) {
  const db = env.DB;
  
  // 1. 檢查用戶是否已存在
  const existingUser = await db.prepare(
    'SELECT * FROM users WHERE phone = ?'
  ).bind(userPhone).first();
  
  if (existingUser) {
    // 老用戶，正常處理
    return handleRegularMessage(userPhone, message);
  }
  
  // 2. 新用戶 → 自動創建賬戶
  await db.prepare(`
    INSERT INTO users (
      phone, 
      created_at, 
      status,
      onboarding_step
    ) VALUES (?, ?, ?, ?)
  `).bind(
    userPhone,
    new Date().toISOString(),
    'active',
    'welcome_sent'
  ).run();
  
  // 3. 發送歡迎消息
  await sendWelcomeMessage(userPhone);
  
  // 4. 記錄轉化（用於分析）
  await logEvent('new_user_signup', { phone: userPhone });
}
```

### 數據庫設計

```sql
-- 用戶表
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT UNIQUE NOT NULL,        -- WhatsApp 手機號（主鍵）
  name TEXT,                          -- 用戶名字（後續詢問）
  university TEXT,                    -- 學校（後續詢問）
  timezone TEXT DEFAULT 'Asia/Hong_Kong',
  language TEXT DEFAULT 'zh-HK',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_active_at DATETIME,
  status TEXT DEFAULT 'active',       -- active/inactive/blocked
  onboarding_step TEXT DEFAULT 'new', -- 引導進度
  
  -- 用戶偏好（漸進式收集）
  default_reminder_minutes INTEGER DEFAULT 15,  -- 默認提前提醒時間
  morning_summary BOOLEAN DEFAULT true,         -- 是否發送晨間摘要
  weekend_quiet BOOLEAN DEFAULT false           -- 週末靜音
);

-- 開戶時只需要 phone，其他都是後續慢慢收集
```

---

## 🎪 漸進式信息收集

**核心策略：不要在開戶時問任何問題，先讓用戶用起來！**

### 信息收集時機表

| 信息 | 收集時機 | 方式 |
|-----|---------|------|
| **手機號** | 自動 | 從 WhatsApp 獲取 |
| **名字** | 第3-5次對話時 | Watson: "對了，我該怎麼稱呼你？" |
| **學校** | 提到課表/作業時 | Watson: "你是哪個學校的？我可以幫你更好地管理學業" |
| **時區** | 自動 | 根據手機號前綴推斷 |
| **語言** | 自動 | 根據對話語言自動設定 |
| **提醒偏好** | 設置第3個提醒時 | Watson: "你通常想提前多久收到提醒？" |

### 實際對話示例

**第一次對話（開戶）：**
```
用戶：明天下午3點有組會
Watson：✅ 已設置！我會在 14:45 提醒你。
       （完全沒問任何個人信息）
```

**第三次對話（收集名字）：**
```
Watson：對了，我該怎麼稱呼你？這樣我們的對話會更親切 😊

用戶：叫我小明就好

Watson：好的小明！以後我就這樣叫你了。
       記得明天 15:00 的組會哦！
```

**第五次對話（收集學校）：**
```
用戶：幫我記一下，下周三交論文

Watson：沒問題！對了小明，你是哪個學校的？
       這樣我可以幫你更好地管理學業安排。

用戶：香港大學

Watson：🎓 港大的學業壓力不小吧！
       我會特別幫你留意考試季和交作業的時間。
```

---

## 🔄 多種開戶場景處理

### 場景 A: 直接 WhatsApp（無 Landing Page）

```
用戶直接添加 Watson 號碼到通訊錄

Watson：🦞 嗨！我是 Watson。
       看來你是直接找到我的 😊

       試試對我說 "明天下午3點有組會"
       我會幫你記住並準時提醒！
```

**處理：** 檢測到沒有 referer，標記為「自然流量」

### 場景 B: 朋友邀請（帶推薦碼）

```
連結：https://watson-claw.jkdcoding.com/start?ref=85291234567

Watson：🦞 歡迎！
       看來是小明推薦你來的 👋
       
       你們是朋友，我可以幫你們協調聚會時間哦！
       
       試試說 "明天下午3點有組會"
```

**處理：** 記錄推薦關係，未來可做社交功能

### 場景 C: 活動/海報 QR Code

```
連結：https://watson-claw.jkdcoding.com/start?src=poster_cuhk

Watson：🦞 歡迎！
       看到 CUHK 的海報找到我的吧？
       
       很多中大學生都用我來管理課表和作業
       你有什麼需要幫忙的嗎？
```

**處理：** 標記來源渠道，用於分析哪個渠道效果好

---

## 🛡️ 風險控制

### 防止濫用

```javascript
// 限制同一號碼頻繁開戶
async function checkAbuse(phone) {
  // 檢查這個號碼最近是否創建過賬戶
  const recentSignup = await db.prepare(`
    SELECT * FROM users 
    WHERE phone = ? 
    AND created_at > datetime('now', '-1 hour')
  `).bind(phone).first();
  
  if (recentSignup) {
    // 可能是重複操作，直接返回現有賬戶
    return { status: 'existing_user' };
  }
}
```

### 垃圾信息過濾

```javascript
// 第一條消息檢測
async function validateFirstMessage(message) {
  // 如果是純廣告/垃圾信息，標記為 suspicious
  const spamKeywords = ['賺錢', '投資', '點擊連結', '加群'];
  
  if (spamKeywords.some(kw => message.includes(kw))) {
    await flagUser(phone, 'suspicious');
    return { action: 'ignore' };
  }
}
```

---

## 📊 開戶數據追蹤

### 需要追蹤的指標

```sql
-- 開戶漏斗
CREATE TABLE signup_funnel (
  date DATE,
  landing_page_view INTEGER,    -- 訪問 landing page
  click_start INTEGER,          -- 點擊開始按鈕
  whatsapp_open INTEGER,        -- 打開 WhatsApp
  first_message_sent INTEGER,   -- 發送第一條消息
  account_created INTEGER,      -- 成功創建賬戶
  first_task_created INTEGER    -- 創建第一個任務
);

-- 典型轉化率目標
-- 100% → 80% → 70% → 60% → 50% → 40%
```

### 分析維度

| 維度 | 用途 |
|-----|------|
| 來源渠道 (referer) | 哪個推廣方式最有效 |
| 設備類型 | 手機 vs 電腦用戶比例 |
| 時間段 | 用戶習慣什麼時候註冊 |
| 地理位置 | 哪些學校/地區用戶多 |

---

## 🎁 首次使用引導

### Aha Moment 設計

**目標：讓用戶在第一次對話就感受到價值**

```
用戶：明天下午3點有組會

Watson：✅ 已為你設置明天 15:00 的提醒！

📋 會議：組會
⏰ 時間：明天 15:00  
🔔 提醒：14:45

💡 小提示：
你可以隨時說 "我今天有什麼安排" 來查看日程

有任何問題直接問我就好！
```

**為什麼這樣設計？**
- 用戶立刻看到「它真的有用」
- 展示了核心價值（記憶+提醒）
- 簡單明確，沒有學習成本

---

## 🚀 總結

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   傳統開戶：                                                     │
│   用戶感知：「又要註冊一個賬號...好煩」                            │
│   實際操作：填寫 10+ 個字段，等待驗證郵件                          │
│                                                                 │
│   Watson 開戶：                                                  │
│   用戶感知：「點一下就能用了，好簡單！」                           │
│   實際操作：點擊 → 掃碼 → 說話 → 自動完成                         │
│                                                                 │
│   關鍵：用戶的手機號 = 賬號                                       │
│        第一次對話 = 開戶完成                                      │
│        後續對話 = 漸進式完善資料                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

*開戶流程設計 v1.0*  
*目標：30秒內完成開戶，零感知*
