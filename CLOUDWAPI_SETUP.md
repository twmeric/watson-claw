# CloudWapi 設置指南

## 什麼是 CloudWapi？

CloudWapi 是 WhatsApp Business API 的代理服務，讓你可以通過 API 發送 WhatsApp 消息，而無需申請 Meta 的官方 API（申請流程複雜且耗時）。

---

## 🔗 設置步驟

### 第 1 步：註冊 CloudWapi 賬號

1. 訪問 https://cloudwapi.com
2. 點擊 "註冊" 或 "Get Started"
3. 使用郵箱註冊賬號
4. 完成郵箱驗證

---

### 第 2 步：添加 WhatsApp 號碼

1. 登錄 CloudWapi Dashboard
2. 點擊 "新增號碼" 或 "Add Number"
3. 選擇 "WhatsApp Web" 方式
4. 掃描 QR Code 綁定你的 WhatsApp 號碼

```
⚠️ 重要提示：
- 使用專門的 WhatsApp 號碼（不要用個人號碼）
- 確保號碼已完成 WhatsApp Business 驗證
- 號碼需要有一定的活躍度和信譽度
```

---

### 第 3 步：獲取 API Key

1. 在 Dashboard 中，進入 "API 設置" 或 "API Settings"
2. 生成新的 API Key
3. 複製並保存 Key（只顯示一次！）

```
API Key 格式示例：
9QHFyJqc9wRd748jsUJNQBR4Ao1XfG
```

---

### 第 4 步：配置 Watson Claw

已經為你設置好！當前使用的 Key：

```bash
# 已經設置在 Cloudflare Secrets 中：
CLOUDWAPI_KEY_PRODUCTION=9QHFyJqc9wRd748jsUJNQBR4Ao1XfG
```

---

## 📋 發送測試

### 方法 1：通過 Watson（推薦）

配置好 SaleSmartly Webhook 後，直接發送消息給 Watson，它會自動回覆。

### 方法 2：直接調用 API 測試

```bash
curl -X POST https://api.cloudwapi.com/v1/messages \
  -H "Authorization: Bearer 9QHFyJqc9wRd748jsUJNQBR4Ao1XfG" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "85298765432",
    "type": "text",
    "text": {
      "body": "你好！這是測試消息 🦞"
    }
  }'
```

---

## ⚠️ 重要限制

| 限制 | 說明 |
|-----|------|
| **首次消息** | 用戶必須先發送消息給你，你才能回覆 |
| **24小時規則** | 用戶最後一條消息後 24 小時內可以主動發送 |
| **模板消息** | 超過 24 小時需要使用預批模板 |
| **發送限制** | 新號碼有發送頻率限制 |

---

## 🔧 故障排除

### 問題 1：消息發送失敗

```
錯誤：{"error": "invalid_number"}

解決：
- 確保手機號格式正確（包含國家碼，如 85298765432）
- 用戶必須先發送過消息給你
```

### 問題 2：API Key 無效

```
錯誤：{"error": "unauthorized"}

解決：
- 檢查 API Key 是否正確
- 確認 Key 沒有過期
- 在 CloudWapi Dashboard 重新生成 Key
```

### 問題 3：號碼被限流

```
錯誤：{"error": "rate_limited"}

解決：
- 降低發送頻率
- 等待一段時間後再試
- 聯繫 CloudWapi 客服提升限制
```

---

## 📊 費用

CloudWapi 通常是按量計費：

| 項目 | 費用 |
|-----|------|
| 註冊 | 免費 |
| 接收消息 | 免費 |
| 發送消息 | ~HK$0.05-0.10/條 |
| API 調用 | 免費 |

---

## 🔄 替代方案

如果 CloudWapi 不穩定，可以考慮：

1. **WhatsApp Business API (官方)**
   - 優點：官方支持，最穩定
   - 缺點：申請流程複雜，需要 Facebook Business 驗證

2. **其他代理服務**
   - WATI
   - 360dialog
   - Twilio WhatsApp

3. **SaleSmartly 內置發送**
   - 如果 SaleSmartly 支持回覆，可以直接用它發送

---

## 📞 支持

- CloudWapi 文檔：https://cloudwapi.com/docs
- 客服郵箱：support@cloudwapi.com

---

*設置指南 v1.0 - Watson Claw Project*
