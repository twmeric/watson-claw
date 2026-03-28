/**
 * Database Service
 * D1 database operations for Watson Claw
 * 
 * Note: If D1 is not available, falls back to in-memory storage for MVP
 */

// In-memory fallback for MVP (when D1 is not configured)
const memoryStore = {
  users: new Map(),
  reminders: new Map(),
  conversations: new Map(),
  reminderIdCounter: 1
};

/**
 * Check if D1 is available
 */
function hasDB(env) {
  return env && env.DB && typeof env.DB.prepare === 'function';
}

/**
 * Get or create user by phone number
 */
export async function getOrCreateUser(db, phone) {
  // Check if running in memory mode
  if (!db || typeof db.prepare !== 'function') {
    return getOrCreateUserMemory(phone);
  }
  
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
 * In-memory version for MVP fallback
 */
function getOrCreateUserMemory(phone) {
  const existing = memoryStore.users.get(phone);
  
  if (existing) {
    existing.last_active_at = new Date().toISOString();
    return { ...existing, isNew: false };
  }
  
  const newUser = {
    phone,
    name: null,
    university: null,
    status: 'active',
    onboarding_step: 'welcome_sent',
    default_reminder_minutes: 15,
    created_at: new Date().toISOString(),
    last_active_at: new Date().toISOString()
  };
  
  memoryStore.users.set(phone, newUser);
  return { ...newUser, isNew: true };
}

/**
 * Create a new reminder
 */
export async function createReminder(db, reminder) {
  // Check if running in memory mode
  if (!db || typeof db.prepare !== 'function') {
    return createReminderMemory(reminder);
  }
  
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
 * In-memory create reminder
 */
function createReminderMemory(reminder) {
  const id = memoryStore.reminderIdCounter++;
  const newReminder = {
    id,
    user_phone: reminder.userPhone,
    task_content: reminder.taskContent,
    reminder_time: reminder.reminderTime,
    original_time: reminder.originalTime,
    status: reminder.status || 'pending',
    created_at: new Date().toISOString()
  };
  
  if (!memoryStore.reminders.has(reminder.userPhone)) {
    memoryStore.reminders.set(reminder.userPhone, []);
  }
  
  memoryStore.reminders.get(reminder.userPhone).push(newReminder);
  return { success: true, id };
}

/**
 * Get user's reminders
 */
export async function getUserReminders(db, phone, period = 'today') {
  // Check if running in memory mode
  if (!db || typeof db.prepare !== 'function') {
    return getUserRemindersMemory(phone, period);
  }
  
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
 * In-memory get reminders
 */
function getUserRemindersMemory(phone, period) {
  const userReminders = memoryStore.reminders.get(phone) || [];
  const now = new Date();
  
  return userReminders.filter(r => {
    if (r.status !== 'pending') return false;
    
    const reminderDate = new Date(r.original_time);
    
    switch (period) {
      case 'today':
        return reminderDate.toDateString() === now.toDateString();
      case 'tomorrow':
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        return reminderDate.toDateString() === tomorrow.toDateString();
      case 'all':
      default:
        return true;
    }
  }).sort((a, b) => new Date(a.original_time) - new Date(b.original_time));
}

/**
 * Get pending reminders that are due
 */
export async function getPendingReminders(db) {
  // Check if running in memory mode
  if (!db || typeof db.prepare !== 'function') {
    return getPendingRemindersMemory();
  }
  
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
 * In-memory get pending reminders
 */
function getPendingRemindersMemory() {
  const now = new Date();
  const dueReminders = [];
  
  for (const userReminders of memoryStore.reminders.values()) {
    for (const reminder of userReminders) {
      if (reminder.status === 'pending' && new Date(reminder.reminder_time) <= now) {
        dueReminders.push(reminder);
      }
    }
  }
  
  return dueReminders.sort((a, b) => new Date(a.reminder_time) - new Date(b.reminder_time));
}

/**
 * Mark reminder as sent
 */
export async function markReminderSent(db, reminderId) {
  // Check if running in memory mode
  if (!db || typeof db.prepare !== 'function') {
    return markReminderSentMemory(reminderId);
  }
  
  await db.prepare(`
    UPDATE reminders 
    SET status = 'sent', sent_at = ?
    WHERE id = ?
  `).bind(new Date().toISOString(), reminderId).run();
}

/**
 * In-memory mark as sent
 */
function markReminderSentMemory(reminderId) {
  for (const userReminders of memoryStore.reminders.values()) {
    const reminder = userReminders.find(r => r.id === reminderId);
    if (reminder) {
      reminder.status = 'sent';
      reminder.sent_at = new Date().toISOString();
      return;
    }
  }
}

/**
 * Cancel a reminder
 */
export async function cancelReminder(db, reminderId, phone) {
  // Check if running in memory mode
  if (!db || typeof db.prepare !== 'function') {
    return cancelReminderMemory(reminderId, phone);
  }
  
  const result = await db.prepare(`
    UPDATE reminders 
    SET status = 'cancelled', updated_at = ?
    WHERE id = ? AND user_phone = ?
  `).bind(new Date().toISOString(), reminderId, phone).run();
  
  return result.changes > 0;
}

/**
 * In-memory cancel reminder
 */
function cancelReminderMemory(reminderId, phone) {
  const userReminders = memoryStore.reminders.get(phone);
  if (!userReminders) return false;
  
  const reminder = userReminders.find(r => r.id === reminderId);
  if (reminder) {
    reminder.status = 'cancelled';
    reminder.updated_at = new Date().toISOString();
    return true;
  }
  return false;
}

/**
 * Save conversation message
 */
export async function saveMessage(db, phone, message, direction, intent = null) {
  // Skip in-memory for conversations (not critical for MVP)
  if (!db || typeof db.prepare !== 'function') {
    return;
  }
  
  await db.prepare(`
    INSERT INTO conversations (user_phone, message, direction, intent, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).bind(phone, message, direction, intent, new Date().toISOString()).run();
}

/**
 * Update user's last active time
 */
export async function updateUserLastActive(db, phone) {
  if (!db || typeof db.prepare !== 'function') {
    const user = memoryStore.users.get(phone);
    if (user) {
      user.last_active_at = new Date().toISOString();
    }
    return;
  }
  
  try {
    await db.prepare(
      'UPDATE users SET last_active_at = ? WHERE phone = ?'
    ).bind(new Date().toISOString(), phone).run();
  } catch (error) {
    console.error('Failed to update last active:', error);
  }
}

/**
 * Get user by phone
 */
export async function getUser(db, phone) {
  if (!db || typeof db.prepare !== 'function') {
    return memoryStore.users.get(phone);
  }
  
  return await db.prepare(
    'SELECT * FROM users WHERE phone = ?'
  ).bind(phone).first();
}

/**
 * Get user stats
 */
export async function getUserStats(db, phone) {
  const reminders = await getUserReminders(db, phone, 'all');
  
  return {
    total: reminders.length,
    pending: reminders.filter(r => r.status === 'pending').length,
    completed: reminders.filter(r => r.status === 'sent').length
  };
}

/**
 * Update user profile
 */
export async function updateUser(db, phone, updates) {
  if (!db || typeof db.prepare !== 'function') {
    const user = memoryStore.users.get(phone);
    if (user) {
      Object.assign(user, updates);
      user.last_active_at = new Date().toISOString();
    }
    return true;
  }
  
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
  
  values.push(new Date().toISOString());
  values.push(phone);
  
  const query = `
    UPDATE users 
    SET ${fields.join(', ')}, last_active_at = ?
    WHERE phone = ?
  `;
  
  const result = await db.prepare(query).bind(...values).run();
  return result.changes > 0;
}
