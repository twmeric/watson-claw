/**
 * LLM Service
 * Deepseek API integration for natural language understanding (MVP Stage)
 * 
 * Note: Using Deepseek instead of OpenRouter for cost optimization
 * Can be easily switched to OpenRouter or other providers later
 */

// Deepseek API Configuration
const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';
const DEEPSEEK_MODEL = 'deepseek-chat'; // Using V3 model

/**
 * Parse user intent from natural language message
 */
export async function parseUserIntent(message, apiKey) {
  if (!apiKey) {
    // Fallback to simple parsing if no API key
    return simpleParseIntent(message);
  }
  
  const prompt = buildIntentPrompt(message);
  
  try {
    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [
          {
            role: 'system',
            content: `You are an intent parser for a WhatsApp AI assistant called Watson. Parse the user's message and return ONLY a JSON object with no markdown formatting. Be precise with time parsing. Current time: ${new Date().toISOString()}`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 500,
        response_format: { type: 'json_object' }
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Deepseek API error:', response.status, errorData);
      throw new Error(`Deepseek API error: ${response.status}`);
    }
    
    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // Parse JSON from LLM response
    const intent = JSON.parse(content.trim());
    return intent;
    
  } catch (error) {
    console.error('LLM parsing error:', error);
    // Fallback to simple parsing
    return simpleParseIntent(message);
  }
}

/**
 * Build prompt for intent parsing
 */
function buildIntentPrompt(message) {
  return `Parse the following user message and return a JSON object.

User message: "${message}"

Return JSON in this exact format:
{
  "type": "create_reminder|query_reminders|cancel_reminder|greeting|help|unknown",
  "confidence": 0.0-1.0,
  "data": {
    // For create_reminder:
    "task": "task description",
    "datetime": "ISO 8601 datetime",
    "reminderOffset": number of minutes before (default 15)
    
    // For query_reminders:
    "period": "today|tomorrow|week|all"
    
    // For cancel_reminder:
    "taskKeyword": "keyword to identify which reminder"
  }
}

Intent definitions:
- create_reminder: User wants to set a reminder (e.g., "明天3點有組會", "記得周五交作業")
- query_reminders: User wants to check their schedule (e.g., "我今天有什麼安排")
- cancel_reminder: User wants to cancel a reminder (e.g., "取消組會")
- greeting: User is greeting or starting conversation (e.g., "你好", "嗨", "Watson")
- help: User wants help (e.g., "幫助", "怎麼用")
- unknown: Cannot determine intent

Current time: ${new Date().toISOString()}
Timezone: Asia/Hong_Kong

Return only the JSON object, no other text.`;
}

/**
 * Generate conversational response using Deepseek
 */
export async function generateResponse(messages, apiKey) {
  if (!apiKey) {
    return null;
  }
  
  try {
    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are Watson (華生), a friendly AI assistant for Hong Kong university students. Be concise, helpful, and use casual Cantonese/Chinese. Use emojis appropriately. Keep responses under 200 words.'
          },
          ...messages
        ],
        temperature: 0.7,
        max_tokens: 300
      })
    });
    
    if (!response.ok) {
      throw new Error(`Deepseek API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.choices[0].message.content;
    
  } catch (error) {
    console.error('Response generation error:', error);
    return null;
  }
}

/**
 * Simple rule-based intent parsing (fallback when API fails)
 */
function simpleParseIntent(message) {
  const lowerMessage = message.toLowerCase();
  
  // Greeting patterns
  const greetings = ['你好', '嗨', 'hello', 'hi', 'hey', '在嗎', 'watson', '華生'];
  if (greetings.some(g => lowerMessage.includes(g))) {
    return { type: 'greeting', confidence: 0.8, data: {} };
  }
  
  // Help patterns
  const helpPatterns = ['幫助', 'help', '怎麼用', '做什麼', '能做', '功能', '使用'];
  if (helpPatterns.some(h => lowerMessage.includes(h))) {
    return { type: 'help', confidence: 0.8, data: {} };
  }
  
  // Query patterns
  const queryPatterns = ['什麼安排', '有什麼', '日程', '列表', '查看'];
  if (queryPatterns.some(q => lowerMessage.includes(q))) {
    return { 
      type: 'query_reminders', 
      confidence: 0.7, 
      data: { period: 'today' } 
    };
  }
  
  // Cancel patterns
  const cancelPatterns = ['取消', '刪除', '不要提醒', '移除'];
  if (cancelPatterns.some(c => lowerMessage.includes(c))) {
    return { 
      type: 'cancel_reminder', 
      confidence: 0.7, 
      data: { taskKeyword: extractTaskKeyword(message) } 
    };
  }
  
  // Create reminder patterns (contains time indicators)
  const timeIndicators = ['點', '分', '明天', '後天', '今天', '後天', '提醒', '記得', '截止', '交'];
  if (timeIndicators.some(t => lowerMessage.includes(t))) {
    return {
      type: 'create_reminder',
      confidence: 0.6,
      data: {
        task: message,
        datetime: parseSimpleTime(message),
        reminderOffset: 15
      }
    };
  }
  
  return { type: 'unknown', confidence: 0.5, data: {} };
}

/**
 * Extract task keyword from cancel message
 */
function extractTaskKeyword(message) {
  // Remove cancel keywords
  return message.replace(/取消|刪除|不要提醒|移除/g, '').trim();
}

/**
 * Parse simple time from message (fallback)
 */
function parseSimpleTime(message) {
  const now = new Date();
  
  // Check for relative dates
  if (message.includes('明天')) {
    now.setDate(now.getDate() + 1);
  } else if (message.includes('後天')) {
    now.setDate(now.getDate() + 2);
  } else if (message.includes('今天')) {
    // Keep today
  }
  
  // Try to extract hour
  const hourMatch = message.match(/(\d+)[點:：]/);
  if (hourMatch) {
    let hour = parseInt(hourMatch[1]);
    // Handle 12-hour format hints
    if (message.includes('下午') || message.includes('晚上') && hour < 12) {
      hour += 12;
    }
    now.setHours(hour, 0, 0, 0);
  }
  
  // Try to extract minutes
  const minuteMatch = message.match(/[:：](\d+)/);
  if (minuteMatch) {
    now.setMinutes(parseInt(minuteMatch[1]));
  }
  
  return now.toISOString();
}
