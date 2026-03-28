/**
 * WhatsApp Service
 * CloudWapi integration for sending messages
 * 
 * API Endpoint: https://unofficial.cloudwapi.in/send-message
 * Method: POST | GET
 * 
 * Parameters:
 * - api_key: API Key
 * - sender: Your WhatsApp number (85262322466)
 * - number: Recipient number(s)
 * - message: Message text
 */

const CLOUDWAPI_URL = 'https://unofficial.cloudwapi.in/send-message';
const CLOUDWAPI_SENDER = '85262322466';

/**
 * Send WhatsApp message via CloudWapi
 */
export async function sendWhatsAppMessage(env, phone, message) {
  // Support both new and old API key names
  const apiKey = env.CLOUDWAPI_KEY || env.CLOUDWAPI_KEY_PRODUCTION || env.CLOUDWAPI_KEY_STAGING;
  
  if (!apiKey) {
    console.error('CloudWapi key not configured');
    return { success: false, error: 'API key not configured' };
  }
  
  // Format phone number (remove any non-digit characters and +)
  let formattedPhone = phone.replace(/\D/g, '');
  // Remove leading 0 if present (for HK numbers)
  if (formattedPhone.startsWith('0')) {
    formattedPhone = formattedPhone.substring(1);
  }
  // Add country code if not present (assume HK +852)
  if (!formattedPhone.startsWith('852') && formattedPhone.length === 8) {
    formattedPhone = '852' + formattedPhone;
  }
  
  try {
    // Build URL with query parameters (GET method)
    const url = new URL(CLOUDWAPI_URL);
    url.searchParams.append('api_key', apiKey);
    url.searchParams.append('sender', CLOUDWAPI_SENDER);
    url.searchParams.append('number', formattedPhone);
    url.searchParams.append('message', message);
    
    console.log('Sending WhatsApp message to:', formattedPhone);
    
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('CloudWapi error:', response.status, errorText);
      return { 
        success: false, 
        error: `HTTP ${response.status}`,
        details: errorText 
      };
    }
    
    // Try to parse JSON response, fallback to text
    let data;
    const responseText = await response.text();
    try {
      data = JSON.parse(responseText);
    } catch {
      data = { raw: responseText };
    }
    
    console.log('Message sent successfully:', data);
    
    return { 
      success: true, 
      data,
      recipient: formattedPhone
    };
    
  } catch (error) {
    console.error('Failed to send WhatsApp message:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send message using POST method (alternative)
 */
export async function sendWhatsAppMessagePOST(env, phone, message) {
  const apiKey = env.CLOUDWAPI_KEY || env.CLOUDWAPI_KEY_PRODUCTION || env.CLOUDWAPI_KEY_STAGING;
  
  if (!apiKey) {
    console.error('CloudWapi key not configured');
    return { success: false, error: 'API key not configured' };
  }
  
  // Format phone number
  let formattedPhone = phone.replace(/\D/g, '');
  if (formattedPhone.startsWith('0')) {
    formattedPhone = formattedPhone.substring(1);
  }
  if (!formattedPhone.startsWith('852') && formattedPhone.length === 8) {
    formattedPhone = '852' + formattedPhone;
  }
  
  try {
    const response = await fetch(CLOUDWAPI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        api_key: apiKey,
        sender: CLOUDWAPI_SENDER,
        number: formattedPhone,
        message: message
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('CloudWapi POST error:', response.status, errorText);
      return { 
        success: false, 
        error: `HTTP ${response.status}`,
        details: errorText 
      };
    }
    
    let data;
    const responseText = await response.text();
    try {
      data = JSON.parse(responseText);
    } catch {
      data = { raw: responseText };
    }
    
    console.log('Message sent via POST:', data);
    
    return { 
      success: true, 
      data,
      recipient: formattedPhone
    };
    
  } catch (error) {
    console.error('Failed to send WhatsApp message (POST):', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send message with quick reply buttons (if supported)
 */
export async function sendMessageWithButtons(env, phone, message, buttons) {
  // CloudWapi unofficial API may not support interactive buttons
  // Fallback to plain text with button descriptions
  
  let buttonText = message + '\n\n';
  buttons.forEach((btn, idx) => {
    buttonText += `${idx + 1}. ${btn.title}\n`;
  });
  
  return sendWhatsAppMessage(env, phone, buttonText);
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
  
  if (typeof data === 'object' && data.task && data.time) {
    return templates[type](data.task, data.time);
  }
  
  return templates[type]?.() || data;
}
