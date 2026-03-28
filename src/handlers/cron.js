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
  console.log('[Cron] Starting reminder check...');
  
  // Get all pending reminders that are due
  const dueReminders = await getPendingReminders(env.DB);
  console.log(`[Cron] Found ${dueReminders.length} due reminders`);
  
  // Send reminders
  for (const reminder of dueReminders) {
    try {
      await sendReminder(env, reminder);
      await markReminderSent(env.DB, reminder.id);
      console.log(`[Cron] Sent reminder #${reminder.id} to ${reminder.user_phone}`);
    } catch (error) {
      console.error(`[Cron] Failed to send reminder #${reminder.id}:`, error);
    }
  }
  
  console.log('[Cron] Reminder check complete');
}

/**
 * Send a single reminder
 */
async function sendReminder(env, reminder) {
  const message = buildReminderMessage(reminder);
  await sendWhatsAppMessage(env, reminder.user_phone, message);
}

/**
 * Build reminder message based on reminder type
 */
function buildReminderMessage(reminder) {
  const eventTime = new Date(reminder.original_time);
  const timeStr = eventTime.toLocaleString('zh-HK', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  
  return `⏰ 提醒

📋 ${reminder.task_content}
⏰ ${timeStr}

準備好出發了嗎？💪`;
}
