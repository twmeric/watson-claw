/**
 * Database Service
 * D1 database operations for Watson Claw
 */

/**
 * Get or create user by phone number
 */
export async function getOrCreateUser(db, phone) {
  // Try to get existing user
  let user = await db.prepare(
    'SELECT * FROM users WHERE phone = ? AND status = ?'
  ).bind(phone, 'active').first();
  
  if (user) {
    // Update last active time
    await db.prepare(
      'UPDATE users SET last_active_at = ? WHERE phone = ?'
    ).bind(new Date().toISOString(), phone).run();
    
    return { ...user, isNew: false };
  }
  
  // Create new user
  await db.prepare(`
    INSERT INTO users (phone, status, onboarding_step, created_at, last_active_at)
    VALUES (?, ?, ?, ?, ?)
  `).bind(phone, 'active', 'welcome_sent', new Date().toISOString(), new Date().toISOString()).run();
  
  user = await db.prepare('SELECT * FROM users WHERE phone = ?').bind(phone).first();
  
  return { ...user, isNew: true };
}

/**
 * Create a new reminder
 */
export async function createReminder(db, reminder) {
  const result = await db.prepare(`
    INSERT INTO reminders (
      user_phone, task_content, reminder_time, original_time,
      status, priority, category, source, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    reminder.userPhone,
    reminder.taskContent,
    reminder.reminderTime,
    reminder.originalTime,
    reminder.status || 'pending',
    reminder.priority || 'normal',
    reminder.category || null,
    reminder.source || 'whatsapp',
    new Date().toISOString()
  ).run();
  
  return result;
}

/**
 * Get user's reminders
 */
export async function getUserReminders(db, phone, period = 'today') {
  let query = `
    SELECT * FROM reminders 
    WHERE user_phone = ? AND status = 'pending'
  `;
  
  const now = new Date().toISOString();
  
  switch (period) {
    case 'today':
      query += ` AND DATE(original_time) = DATE('now')`;
      break;
    case 'tomorrow':
      query += ` AND DATE(original_time) = DATE('now', '+1 day')`;
      break;
    case 'week':
      query += ` AND original_time >= ? AND original_time <= datetime('now', '+7 days')`;
      break;
    case 'all':
    default:
      // No additional filter
      break;
  }
  
  query += ` ORDER BY original_time ASC`;
  
  const result = await db.prepare(query).bind(phone).all();
  return result.results || [];
}

/**
 * Get pending reminders that are due
 */
export async function getPendingReminders(db) {
  const now = new Date().toISOString();
  
  const result = await db.prepare(`
    SELECT * FROM reminders 
    WHERE status = 'pending' 
    AND reminder_time <= ?
    ORDER BY reminder_time ASC
  `).bind(now).all();
  
  return result.results || [];
}

/**
 * Mark reminder as sent
 */
export async function markReminderSent(db, reminderId) {
  await db.prepare(`
    UPDATE reminders 
    SET status = 'sent', sent_at = ?
    WHERE id = ?
  `).bind(new Date().toISOString(), reminderId).run();
}

/**
 * Cancel a reminder
 */
export async function cancelReminder(db, reminderId, phone) {
  const result = await db.prepare(`
    UPDATE reminders 
    SET status = 'cancelled', updated_at = ?
    WHERE id = ? AND user_phone = ?
  `).bind(new Date().toISOString(), reminderId, phone).run();
  
  return result.changes > 0;
}

/**
 * Save conversation message
 */
export async function saveMessage(db, phone, message, direction, intent = null) {
  await db.prepare(`
    INSERT INTO conversations (user_phone, message, direction, intent, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).bind(phone, message, direction, intent, new Date().toISOString()).run();
}

/**
 * Update user profile
 */
export async function updateUser(db, phone, updates) {
  const allowedFields = ['name', 'university', 'major', 'year_of_study', 
                         'timezone', 'language', 'default_reminder_minutes',
                         'morning_summary', 'weekend_quiet', 'onboarding_step'];
  
  const fields = [];
  const values = [];
  
  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key)) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }
  
  if (fields.length === 0) return false;
  
  values.push(new Date().toISOString()); // updated_at
  values.push(phone);
  
  const query = `
    UPDATE users 
    SET ${fields.join(', ')}, last_active_at = ?
    WHERE phone = ?
  `;
  
  const result = await db.prepare(query).bind(...values).run();
  return result.changes > 0;
}

/**
 * Get user by phone
 */
export async function getUser(db, phone) {
  return await db.prepare(
    'SELECT * FROM users WHERE phone = ?'
  ).bind(phone).first();
}

/**
 * Get user stats
 */
export async function getUserStats(db, phone) {
  const totalReminders = await db.prepare(`
    SELECT COUNT(*) as count FROM reminders WHERE user_phone = ?
  `).bind(phone).first();
  
  const pendingReminders = await db.prepare(`
    SELECT COUNT(*) as count FROM reminders 
    WHERE user_phone = ? AND status = 'pending'
  `).bind(phone).first();
  
  const sentReminders = await db.prepare(`
    SELECT COUNT(*) as count FROM reminders 
    WHERE user_phone = ? AND status = 'sent'
  `).bind(phone).first();
  
  return {
    total: totalReminders?.count || 0,
    pending: pendingReminders?.count || 0,
    completed: sentReminders?.count || 0
  };
}
