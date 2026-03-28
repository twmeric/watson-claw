/**
 * Parser Utilities
 * Time and content parsing helpers
 */

/**
 * Parse time expressions in Chinese
 * Supports: 明天, 後天, 今天, 下週一, 3點, 15:00, etc.
 */
export function parseTimeExpression(text) {
  const now = new Date();
  let targetDate = new Date(now);
  let hour = null;
  let minute = 0;
  let hasTime = false;
  
  // Parse date expressions
  if (text.includes('明天')) {
    targetDate.setDate(targetDate.getDate() + 1);
  } else if (text.includes('後天')) {
    targetDate.setDate(targetDate.getDate() + 2);
  } else if (text.includes('大後天')) {
    targetDate.setDate(targetDate.getDate() + 3);
  } else if (text.includes('今天')) {
    // Keep today
  } else if (text.includes('下週') || text.includes('下周')) {
    const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
    for (let i = 0; i < 7; i++) {
      if (text.includes('下週' + weekDays[i]) || text.includes('下周' + weekDays[i])) {
        const currentDay = now.getDay();
        const daysUntil = (i - currentDay + 7) % 7 || 7;
        targetDate.setDate(targetDate.getDate() + daysUntil + 7);
        break;
      }
    }
  } else if (text.includes('週') || text.includes('周')) {
    const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
    for (let i = 0; i < 7; i++) {
      if (text.includes('週' + weekDays[i]) || text.includes('周' + weekDays[i])) {
        const currentDay = now.getDay();
        const daysUntil = (i - currentDay + 7) % 7;
        targetDate.setDate(targetDate.getDate() + daysUntil);
        break;
      }
    }
  }
  
  // Parse time expressions
  // Match patterns like "3點", "15點", "3:30", "15:30"
  const timeMatch = text.match(/(\d{1,2})[:：]?(\d{2})?\s*[點點]/);
  if (timeMatch) {
    hour = parseInt(timeMatch[1]);
    if (timeMatch[2]) {
      minute = parseInt(timeMatch[2]);
    }
    hasTime = true;
  }
  
  // Match 24-hour format like "15:30"
  const time24Match = text.match(/(\d{1,2}):(\d{2})/);
  if (time24Match && !hasTime) {
    hour = parseInt(time24Match[1]);
    minute = parseInt(time24Match[2]);
    hasTime = true;
  }
  
  // Handle AM/PM indicators
  if (hour !== null) {
    if (text.includes('下午') || text.includes('晚上')) {
      if (hour < 12) hour += 12;
    } else if (text.includes('早上') || text.includes('上午')) {
      if (hour === 12) hour = 0;
    } else if (text.includes('中午')) {
      hour = 12;
    }
  }
  
  // Default times based on context
  if (hour === null) {
    if (text.includes('早上')) hour = 9;
    else if (text.includes('上午')) hour = 10;
    else if (text.includes('中午')) hour = 12;
    else if (text.includes('下午')) hour = 15;
    else if (text.includes('晚上')) hour = 19;
  }
  
  // Set time if found
  if (hour !== null) {
    targetDate.setHours(hour, minute, 0, 0);
  } else {
    // Default to current time if no time specified
    targetDate.setHours(now.getHours(), now.getMinutes(), 0, 0);
  }
  
  return {
    date: targetDate,
    isoString: targetDate.toISOString(),
    hasTime,
    hour,
    minute
  };
}

/**
 * Extract task content from reminder message
 */
export function extractTaskContent(text, timeMatch) {
  // Remove time expressions to get task content
  let task = text
    .replace(/明天|後天|大後天|今天/g, '')
    .replace(/下?[週周][一二三四五六日]/g, '')
    .replace(/\d{1,2}[:：]\d{2}/g, '')
    .replace(/\d{1,2}\s*[點點](\s*\d{2}\s*[分])?/g, '')
    .replace(/早上|上午|中午|下午|晚上/g, '')
    .replace(/提醒|記得|別忘記|別忘了/g, '')
    .replace(/我有|要|需要/g, '')
    .replace(/[，。？！,.?!]/g, ' ')
    .trim();
  
  // Clean up extra spaces
  task = task.replace(/\s+/g, ' ').trim();
  
  return task || '未命名提醒';
}

/**
 * Format date for display in Chinese
 */
export function formatDateTime(date) {
  const d = new Date(date);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const isTomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toDateString() === d.toDateString();
  
  let dateStr = '';
  if (isToday) {
    dateStr = '今天';
  } else if (isTomorrow) {
    dateStr = '明天';
  } else {
    dateStr = `${d.getMonth() + 1}月${d.getDate()}日`;
  }
  
  const hour = d.getHours().toString().padStart(2, '0');
  const minute = d.getMinutes().toString().padStart(2, '0');
  
  return `${dateStr} ${hour}:${minute}`;
}

/**
 * Calculate reminder time (default 15 minutes before)
 */
export function calculateReminderTime(eventTime, offsetMinutes = 15) {
  const event = new Date(eventTime);
  return new Date(event.getTime() - offsetMinutes * 60000);
}

/**
 * Check if a message is asking for help
 */
export function isHelpRequest(text) {
  const helpKeywords = ['幫助', 'help', '怎麼用', '使用說明', '功能', '你能做什麼', '做什麼'];
  return helpKeywords.some(keyword => text.toLowerCase().includes(keyword));
}

/**
 * Check if a message is a greeting
 */
export function isGreeting(text) {
  const greetings = ['你好', '嗨', 'hello', 'hi', 'hey', '在嗎', 'watson', '華生', '在不在'];
  return greetings.some(g => text.toLowerCase().includes(g));
}

/**
 * Check if a message is asking to list reminders
 */
export function isListRequest(text) {
  const listKeywords = ['什麼安排', '有什麼', '日程', '列表', '查看', '看看', '有什麼事'];
  return listKeywords.some(keyword => text.includes(keyword));
}

/**
 * Check if a message is asking to cancel/delete
 */
export function isCancelRequest(text) {
  const cancelKeywords = ['取消', '刪除', '不要提醒', '移除', 'delete', 'cancel'];
  return cancelKeywords.some(keyword => text.toLowerCase().includes(keyword.toLowerCase()));
}
