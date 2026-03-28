/**
 * SaleSmartly Webhook Handler
 * Processes incoming WhatsApp messages
 */

import { parseUserIntent } from '../services/llm.js';
import { createReminder, getUserReminders } from '../services/db.js';
import { sendWhatsAppMessage } from '../services/whatsapp.js';
import { validateSecurityCode, getOrCreateUser } from '../utils/security.js';

/**
 * Handle SaleSmartly webhook
 */
export async function handleWebhook(request, env, corsHeaders) {
  // Validate security code
  const securityCode = request.headers.get('X-Security-Code');
  if (!validateSecurityCode(securityCode, env.SALESMARTLY_SECURITY_CODE)) {
    console.warn('Invalid security code received');
    return jsonResponse({ error: 'Unauthorized' }, 401, corsHeaders);
  }
  
  try {
    const data = await request.json();
    console.log('Webhook received:', JSON.stringify(data, null, 2));
    
    // Extract message data
    const message = extractMessageData(data);
    if (!message) {
      return jsonResponse({ status: 'ignored', reason: 'no_message' }, 200, corsHeaders);
    }
    
    const { phone, text, timestamp } = message;
    
    // Get or create user (auto-onboarding)
    const user = await getOrCreateUser(env.DB, phone);
    
    // Parse user intent using LLM
    const intent = await parseUserIntent(text, env.OPENROUTER_API_KEY);
    console.log('Parsed intent:', intent);
    
    // Handle based on intent
    const response = await handleIntent(intent, user, text, env);
    
    // Send response back to user
    if (response) {
      await sendWhatsAppMessage(env, phone, response);
    }
    
    return jsonResponse({ 
      status: 'success',
      intent: intent.type 
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
 * Extract message data from SaleSmartly payload
 */
function extractMessageData(data) {
  // SaleSmartly webhook format may vary, adjust as needed
  try {
    return {
      phone: data.from || data.phone || data.sender,
      text: data.text || data.message || data.content,
      timestamp: data.timestamp || new Date().toISOString(),
      messageId: data.message_id || data.id
    };
  } catch (error) {
    console.error('Failed to extract message data:', error);
    return null;
  }
}

/**
 * Handle different user intents
 */
async function handleIntent(intent, user, originalText, env) {
  switch (intent.type) {
    case 'create_reminder':
      return await handleCreateReminder(intent, user, env);
      
    case 'query_reminders':
      return await handleQueryReminders(user, intent, env);
      
    case 'cancel_reminder':
      return await handleCancelReminder(intent, user, env);
      
    case 'greeting':
      return getGreetingResponse(user);
      
    case 'help':
      return getHelpResponse();
      
    default:
      return getDefaultResponse();
  }
}

/**
 * Handle create reminder intent
 */
async function handleCreateReminder(intent, user, env) {
  const { task, datetime, reminderOffset = 15 } = intent.data;
  
  // Calculate reminder time (default: 15 minutes before)
  const eventTime = new Date(datetime);
  const reminderTime = new Date(eventTime.getTime() - reminderOffset * 60000);
  
  // Save to database
  await createReminder(env.DB, {
    userPhone: user.phone,
    taskContent: task,
    reminderTime: reminderTime.toISOString(),
    originalTime: eventTime.toISOString(),
    status: 'pending'
  });
  
  // Format response
  const timeStr = formatTime(eventTime);
  const reminderStr = formatTime(reminderTime);
  
  return `✅ 已為你設置提醒！

📋 ${task}
⏰ 時間：${timeStr}
🔔 提醒：${reminderStr}

我會準時通知你 👍`;
}

/**
 * Handle query reminders intent
 */
async function handleQueryReminders(user, intent, env) {
  const { period = 'today' } = intent.data || {};
  
  const reminders = await getUserReminders(env.DB, user.phone, period);
  
  if (reminders.length === 0) {
    return `📭 ${period === 'today' ? '今天' : '這段時間'}沒有安排！

可以對我說 "明天下午3點有組會" 來創建提醒 😊`;
  }
  
  let response = `📅 ${period === 'today' ? '今天' : '即將到來'}的安排：\n\n`;
  reminders.forEach((reminder, index) => {
    const time = formatTime(new Date(reminder.original_time));
    response += `${index + 1}. ${time} - ${reminder.task_content}\n`;
  });
  
  return response;
}

/**
 * Handle cancel reminder intent
 */
async function handleCancelReminder(intent, user, env) {
  // TODO: Implement cancellation logic
  return `✅ 已取消提醒。

需要幫你安排其他事情嗎？`;
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
  
  return `🦞 嗨 ${user.name || ''}！有什麼我可以幫忙的嗎？`;
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

/**
 * Get default response for unknown intents
 */
function getDefaultResponse() {
  return `🤔 我好像沒完全理解你的意思。

試試說：
• "明天下午3點有組會"
• "我今天有什麼安排"

或者輸入 "幫助" 查看我能做什麼 😊`;
}

/**
 * Format time for display
 */
function formatTime(date) {
  return date.toLocaleString('zh-HK', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
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
