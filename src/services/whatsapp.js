/**
 * WhatsApp Service
 * CloudWapi integration for sending messages
 */

const CLOUDWAPI_URL = 'https://api.cloudwapi.com/v1/messages';

/**
 * Send WhatsApp message via CloudWapi
 */
export async function sendWhatsAppMessage(env, phone, message) {
  const apiKey = env.CLOUDWAPI_KEY;
  
  if (!apiKey) {
    console.error('CloudWapi key not configured');
    return { success: false, error: 'API key not configured' };
  }
  
  // Format phone number (remove any non-digit characters)
  const formattedPhone = phone.replace(/\D/g, '');
  
  try {
    const response = await fetch(CLOUDWAPI_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        to: formattedPhone,
        type: 'text',
        text: {
          body: message
        }
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('CloudWapi error:', response.status, errorData);
      return { 
        success: false, 
        error: `HTTP ${response.status}`,
        details: errorData 
      };
    }
    
    const data = await response.json();
    console.log('Message sent:', data);
    
    return { success: true, messageId: data.message_id || data.id };
    
  } catch (error) {
    console.error('Failed to send WhatsApp message:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send message with quick reply buttons (if supported)
 */
export async function sendMessageWithButtons(env, phone, message, buttons) {
  const apiKey = env.CLOUDWAPI_KEY;
  
  if (!apiKey) {
    return { success: false, error: 'API key not configured' };
  }
  
  const formattedPhone = phone.replace(/\D/g, '');
  
  try {
    const response = await fetch(CLOUDWAPI_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        to: formattedPhone,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: {
            text: message
          },
          action: {
            buttons: buttons.map((btn, idx) => ({
              type: 'reply',
              reply: {
                id: btn.id || `btn_${idx}`,
                title: btn.title
              }
            }))
          }
        }
      })
    });
    
    if (!response.ok) {
      // Fallback to plain text if interactive fails
      return sendWhatsAppMessage(env, phone, message);
    }
    
    return { success: true };
    
  } catch (error) {
    // Fallback to plain text
    return sendWhatsAppMessage(env, phone, message);
  }
}

/**
 * Send template message (for notifications)
 */
export async function sendTemplateMessage(env, phone, templateName, language = 'zh_HK') {
  const apiKey = env.CLOUDWAPI_KEY;
  
  if (!apiKey) {
    return { success: false, error: 'API key not configured' };
  }
  
  const formattedPhone = phone.replace(/\D/g, '');
  
  try {
    const response = await fetch(CLOUDWAPI_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        to: formattedPhone,
        type: 'template',
        template: {
          name: templateName,
          language: {
            code: language
          }
        }
      })
    });
    
    if (!response.ok) {
      console.error('Template message error:', response.status);
      return { success: false, error: `HTTP ${response.status}` };
    }
    
    return { success: true };
    
  } catch (error) {
    console.error('Failed to send template message:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Format message with emojis and styling
 */
export function formatMessage(type, data) {
  const templates = {
    reminder: (task, time) => `⏰ 提醒\n\n📋 ${task}\n⏰ ${time}\n\n準備好出發了嗎？💪`,
    
    confirmation: (task, time) => `✅ 已為你設置提醒！\n\n📋 ${task}\n⏰ 時間：${time}\n\n我會準時通知你 👍`,
    
    greeting: () => `🦞 嗨！我是 Watson，你的大學生活指揮官。\n\n試試對我說：\n• "明天下午3點有組會"\n• "記得周五交作業"`,
    
    noReminders: () => `📭 沒有安排！\n\n可以對我說 "明天下午3點有組會" 來創建提醒 😊`,
    
    help: () => `🦞 Watson 使用幫助\n\n你可以對我說：\n• "明天3點有組會" - 創建提醒\n• "我今天有什麼安排" - 查看日程\n• "取消組會提醒" - 取消提醒`
  };
  
  return templates[type]?.(data) || data;
}
