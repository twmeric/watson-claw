/**
 * LLM Service
 * OpenRouter API integration for natural language understanding
 */

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

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
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://watson-claw.jkdcoding.com',
        'X-Title': 'Watson Claw'
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an intent parser for a WhatsApp AI assistant.
Parse the user's message and return ONLY a JSON object with no markdown formatting.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 500
      })
    });
    
    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status}`);
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
- create_reminder: User wants to set a reminder (e.g., "明天3點有組會")
- query_reminders: User wants to check their schedule (e.g., "我今天有什麼安排")
- cancel_reminder: User wants to cancel a reminder (e.g., "取消組會")
- greeting: User is greeting or starting conversation (e.g., "你好", "嗨")
- help: User wants help (e.g., "幫助", "怎麼用")
- unknown: Cannot determine intent

Current time: ${new Date().toISOString()}

Return only the JSON object, no other text.`;
}

/**
 * Simple rule-based intent parsing (fallback)
 */
function simpleParseIntent(message) {
  const lowerMessage = message.toLowerCase();
  
  // Greeting patterns
  const greetings = ['你好', '嗨', 'hello', 'hi', 'hey', '在嗎', 'watson'];
  if (greetings.some(g => lowerMessage.includes(g))) {
    return { type: 'greeting', confidence: 0.8, data: {} };
  }
  
  // Help patterns
  const helpPatterns = ['幫助', 'help', '怎麼用', '做什麼', '能做', '功能'];
  if (helpPatterns.some(h => lowerMessage.includes(h))) {
    return { type: 'help', confidence: 0.8, data: {} };
  }
  
  // Query patterns
  const queryPatterns = ['什麼安排', '有什麼', '日程', '今天', '明天', '列表'];
  if (queryPatterns.some(q => lowerMessage.includes(q))) {
    return { 
      type: 'query_reminders', 
      confidence: 0.7, 
      data: { period: 'today' } 
    };
  }
  
  // Cancel patterns
  const cancelPatterns = ['取消', '刪除', '不要提醒'];
  if (cancelPatterns.some(c => lowerMessage.includes(c))) {
    return { 
      type: 'cancel_reminder', 
      confidence: 0.7, 
      data: { taskKeyword: extractTaskKeyword(message) } 
    };
  }
  
  // Create reminder patterns (contains time indicators)
  const timeIndicators = ['點', '分', '明天', '後天', '今天', '提醒', '記得'];
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
  // Simple extraction - remove cancel keywords
  return message.replace(/取消|刪除|不要提醒/g, '').trim();
}

/**
 * Parse simple time from message (fallback)
 */
function parseSimpleTime(message) {
  const now = new Date();
  
  // Check for "明天"
  if (message.includes('明天')) {
    now.setDate(now.getDate() + 1);
  }
  // Check for "後天"
  else if (message.includes('後天')) {
    now.setDate(now.getDate() + 2);
  }
  
  // Try to extract hour
  const hourMatch = message.match(/(\d+)[點:：]/);
  if (hourMatch) {
    now.setHours(parseInt(hourMatch[1]), 0, 0, 0);
  }
  
  return now.toISOString();
}

/**
 * Generate conversational response
 */
export async function generateResponse(context, apiKey) {
  if (!apiKey) {
    return null; // Use default responses
  }
  
  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are Watson, a friendly AI assistant for university students. Be concise, helpful, and use casual Cantonese/Chinese.'
          },
          ...context
        ],
        temperature: 0.7,
        max_tokens: 300
      })
    });
    
    const data = await response.json();
    return data.choices[0].message.content;
    
  } catch (error) {
    console.error('Response generation error:', error);
    return null;
  }
}
