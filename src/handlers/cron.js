/**
 * Cron Job Handler
 * Periodic tasks like checking and sending reminders
 */

import { getPendingReminders, markReminderSent } from '../services/db.js';
import { sendWhatsAppMessage } from '../services/whatsapp.js';

/**
 * Handle scheduled cron execution
 */
export async function handleCron(env) {
  console.log(`[Cron] Starting reminder check at ${new Date().toISOString()}`);
  
  // Check if we have the necessary environment variables
  if (!env.CLOUDWAPI_KEY_STAGING && !env.CLOUDWAPI_KEY_PRODUCTION) {
    console.log('[Cron] No CloudWapi key configured, skipping reminder send');
    return;
  }
  
  try {
    // Get all pending reminders that are due
    const dueReminders = await getPendingReminders(env.DB);
    console.log(`[Cron] Found ${dueReminders.length} due reminders`);
    
    if (dueReminders.length === 0) {
      console.log('[Cron] No reminders to send');
      return;
    }
    
    // Send reminders
    let sentCount = 0;
    let failedCount = 0;
    
    for (const reminder of dueReminders) {
      try {
        // Build and send reminder message
        const message = buildReminderMessage(reminder);
        
        const result = await sendWhatsAppMessage(env, reminder.user_phone || reminder.userPhone, message);
        
        if (result.success) {
          // Mark as sent
          await markReminderSent(env.DB, reminder.id);
          console.log(`[Cron] ✓ Sent reminder #${reminder.id} to ${reminder.user_phone || reminder.userPhone}`);
          sentCount++;
        } else {
          console.error(`[Cron] ✗ Failed to send reminder #${reminder.id}:`, result.error);
          failedCount++;
        }
        
        // Small delay to avoid rate limiting
        await sleep(100);
        
      } catch (error) {
        console.error(`[Cron] ✗ Error processing reminder #${reminder.id}:`, error);
        failedCount++;
      }
    }
    
    console.log(`[Cron] Complete. Sent: ${sentCount}, Failed: ${failedCount}`);
    
  } catch (error) {
    console.error('[Cron] Fatal error:', error);
  }
}

/**
 * Build reminder message based on reminder data
 */
function buildReminderMessage(reminder) {
  const eventTime = new Date(reminder.original_time || reminder.originalTime);
  const timeStr = formatTime(eventTime);
  const task = reminder.task_content || reminder.taskContent;
  
  // Calculate time remaining
  const now = new Date();
  const diffMs = eventTime - now;
  const diffMins = Math.round(diffMs / 60000);
  
  let timeContext = '';
  if (diffMins > 0 && diffMins < 60) {
    timeContext = `（還有${diffMins}分鐘）`;
  }
  
  const messages = [
`⏰ 提醒

📋 ${task}
⏰ ${timeStr} ${timeContext}

準備好出發了嗎？💪`,

`⏰ 別忘了！

📋 ${task}
⏰ ${timeStr} ${timeContext}

加油！🔥`,

`⏰ 提醒時間

📋 ${task}
⏰ ${timeStr} ${timeContext}

祝你順利！✨`
  ];
  
  // Randomly select a message variant
  return messages[Math.floor(Math.random() * messages.length)];
}

/**
 * Format time for display
 */
function formatTime(date) {
  const d = new Date(date);
  const hour = d.getHours().toString().padStart(2, '0');
  const minute = d.getMinutes().toString().padStart(2, '0');
  
  return `${hour}:${minute}`;
}

/**
 * Sleep utility
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
