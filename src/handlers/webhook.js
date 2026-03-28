/**
 * SaleSmartly Webhook Handler
 * Processes incoming WhatsApp messages
 */

import { parseUserIntent } from '../services/llm.js';
import { getOrCreateUser, createReminder, getUserReminders, cancelReminder, updateUserLastActive } from '../services/db.js';
import { sendWhatsAppMessage } from '../services/whatsapp.js';
import { validateSecurityCode } from '../utils/security.js';
import { parseTimeExpression, extractTaskContent, formatDateTime, calculateReminderTime, isHelpRequest, isGreeting, isListRequest, isCancelRequest } from '../utils/parser.js';

/**
 * Handle SaleSmartly webhook
 */
export async function handleWebhook(request, env, corsHeaders) {
  // Validate security code
  const securityCode = request.headers.get('X-Security-Code');
  const expectedCode = env.SALESMARTLY_SECURITY_PROD || env.SALESMARTLY_SECURITY_CODE || env.SALESMARTLY_SECURITY_STAGING;
  
  // Validate security code
  if (!securityCode || securityCode !== expectedCode) {
    console.warn('Invalid security code received');
    return jsonResponse({ error: 'Unauthorized' }, 401, corsHeaders);
  }
  
  try {
    const data = await request.json();
    console.log('Webhook received:', JSON.stringify(data, null, 2));
    
    // Extract message data
    const message = extractMessageData(data);
    if (!message || !message.phone || !message.text) {
      return jsonResponse({ status: 'ignored', reason: 'no_message' }, 200, corsHeaders);
    }
    
    const { phone, text, timestamp } = message;
    
    // Get or create user (auto-onboarding)
    const user = await getOrCreateUser(env.DB, phone);
    
    // Update last active time
    await updateUserLastActive(env.DB, phone);
    
    // Process message and generate response
    const response = await processMessage(text, user, env);
    
    // Send response back to user
    if (response) {
      await sendWhatsAppMessage(env, phone, response);
    }
    
    return jsonResponse({ 
      status: 'success',
      user: user.phone,
      isNewUser: user.isNew
    }, 200, corsHeaders);
    
  } catch (error) {
    console.error('Webhook processing error:', error);
    return jsonResponse({ 
      error: 'Processing failed',
      details: env.ENVIRONMENT === 'development' ? error.message : undefined
    }, 500, corsHeaders);
  }
}

/**
 * Process user message and generate response
 */
async function processMessage(text, user, env) {
  const lowerText = text.toLowerCase();
  
  // Handle greetings for new users
  if (user.isNew || isGreeting(text)) {
    return getGreetingResponse(user);
  }
  
  // Handle help requests
  if (isHelpRequest(text)) {
    return getHelpResponse();
  }
  
  // Handle list requests
  if (isListRequest(text)) {
    return await handleListReminders(user, env);
  }
  
  // Handle cancel requests
  if (isCancelRequest(text)) {
    return await handleCancelReminder(text, user, env);
  }
  
  // Try to create a reminder
  return await handleCreateReminder(text, user, env);
}

/**
 * Handle create reminder intent
 */
async function handleCreateReminder(text, user, env) {
  try {
    // Try to use LLM for parsing
    let intent = null;
    if (env.DEEPSEEK_API_KEY) {
      intent = await parseUserIntent(text, env.DEEPSEEK_API_KEY);
    }
    
    let eventTime;
    let taskContent;
    let reminderOffset = user.default_reminder_minutes || 15;
    
    if (intent && intent.type === 'create_reminder' && intent.data) {
      // Use LLM parsed data
      eventTime = new Date(intent.data.datetime);
      taskContent = intent.data.task;
      if (intent.data.reminderOffset) {
        reminderOffset = intent.data.reminderOffset;
      }
    } else {
      // Fallback to rule-based parsing
      const timeParse = parseTimeExpression(text);
      eventTime = timeParse.date;
      taskContent = extractTaskContent(text);
    }
    
    // Validate the time is in the future
    const now = new Date();
    if (eventTime < now) {
      return `⚠️ 提醒時間已過去，請檢查時間是否正確。\n\n例如："明天下午3點有組會"`;
    }
    
    // Calculate reminder time
    const reminderTime = calculateReminderTime(eventTime, reminderOffset);
    
    // Save to database
    await createReminder(env.DB, {
      userPhone: user.phone,
      taskContent: taskContent,
      reminderTime: reminderTime.toISOString(),
      originalTime: eventTime.toISOString(),
      status: 'pending'
    });
    
    // Format response
    const timeStr = formatDateTime(eventTime);
    const reminderStr = formatDateTime(reminderTime);
    
    return `✅ 已為你設置提醒！

📋 ${taskContent}
⏰ 時間：${timeStr}
🔔 提醒：${reminderStr}

我會準時通知你 👍`;
    
  } catch (error) {
    console.error('Create reminder error:', error);
    return `抱歉，我無法理解你的意思 😅

試試說：
• "明天下午3點有組會"
• "後天中午和朋友吃飯"
• "週五晚上8點交作業"`;
  }
}

/**
 * Handle list reminders request
 */
async function handleListReminders(user, env) {
  try {
    const reminders = await getUserReminders(env.DB, user.phone, 'today');
    
    if (reminders.length === 0) {
      return `📭 今天沒有安排！

可以對我說 "明天下午3點有組會" 來創建提醒 😊`;
    }
    
    let response = `📅 今天的安排：\n\n`;
    reminders.forEach((reminder, index) => {
      const time = formatDateTime(reminder.original_time);
      const status = reminder.status === 'sent' ? '✅' : '⏳';
      response += `${status} ${time} - ${reminder.task_content}\n`;
    });
    
    response += `\n加油！💪`;
    return response;
    
  } catch (error) {
    console.error('List reminders error:', error);
    return `抱歉，查詢時出現問題 😅 請稍後再試`;
  }
}

/**
 * Handle cancel reminder request
 */
async function handleCancelReminder(text, user, env) {
  try {
    // Extract keyword to identify which reminder to cancel
    const keyword = text.replace(/取消|刪除|不要提醒|移除|cancel|delete/gi, '').trim();
    
    if (!keyword) {
      return `請告訴我要取消哪個提醒，例如：\n"取消組會提醒"`;
    }
    
    // Get user's pending reminders
    const reminders = await getUserReminders(env.DB, user.phone, 'all');
    
    // Find matching reminder
    const matching = reminders.filter(r => 
      r.task_content.toLowerCase().includes(keyword.toLowerCase())
    );
    
    if (matching.length === 0) {
      return `找不到包含「${keyword}」的提醒 😅\n\n可以說「查看日程」看看有哪些提醒`;
    }
    
    if (matching.length === 1) {
      // Cancel the matching reminder
      await cancelReminder(env.DB, matching[0].id, user.phone);
      return `✅ 已取消提醒：${matching[0].task_content}`;
    }
    
    // Multiple matches
    let response = `找到多個匹配，請告訴我具體是哪個：\n\n`;
    matching.forEach((r, i) => {
      response += `${i + 1}. ${r.task_content} (${formatDateTime(r.original_time)})\n`;
    });
    return response;
    
  } catch (error) {
    console.error('Cancel reminder error:', error);
    return `抱歉，取消時出現問題 😅 請稍後再試`;
  }
}

/**
 * Extract message data from SaleSmartly payload
 */
function extractMessageData(data) {
  try {
    // Handle different SaleSmartly webhook formats
    const phone = data.from || data.phone || data.sender || data.wa_id;
    const text = data.text || data.message || data.body || data.content;
    const timestamp = data.timestamp || data.created_at || new Date().toISOString();
    const messageId = data.message_id || data.id || data.wamid;
    
    if (!phone || !text) {
      console.log('Missing phone or text in payload:', data);
      return null;
    }
    
    return {
      phone: phone.toString(),
      text: text.toString(),
      timestamp,
      messageId
    };
  } catch (error) {
    console.error('Failed to extract message data:', error);
    return null;
  }
}

/**
 * Get greeting response for new users
 */
function getGreetingResponse(user) {
  if (user.isNew) {
    return `🦞 嗨！我是 Watson，你的大學生活指揮官。

我可以幫你：
📅 管理課表和作業截止日期
⏰ 設置提醒和待辦事項
👥 記住朋友和社團聚會
📝 記錄靈感和想法

試試對我說：
• "明天下午3點有組會"
• "記得周五交線性代數作業"
• "提醒我明天買牛奶"

你想先試哪個？`;
  }
  
  const greetings = [
    `🦞 嗨 ${user.name || ''}！有什麼我可以幫忙的嗎？`,
    `🦞 你好！今天有什麼安排？`,
    `🦞 嗨！需要我記住什麼事情嗎？`
  ];
  
  return greetings[Math.floor(Math.random() * greetings.length)];
}

/**
 * Get help response
 */
function getHelpResponse() {
  return `🦞 Watson 使用幫助

你可以對我說：
• "明天下午3點有組會" - 創建提醒
• "我今天有什麼安排" - 查看日程
• "取消組會提醒" - 取消提醒
• "記得周五交作業" - 記錄待辦

其他問題隨時問我！`;
}

function jsonResponse(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  });
}
