/**
 * Security Utilities
 * Validation and security helpers
 */

/**
 * Validate SaleSmartly security code
 */
export function validateSecurityCode(receivedCode, expectedCode) {
  if (!receivedCode || !expectedCode) {
    return false;
  }
  
  // Constant-time comparison to prevent timing attacks
  const received = String(receivedCode);
  const expected = String(expectedCode);
  
  if (received.length !== expected.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < received.length; i++) {
    result |= received.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  
  return result === 0;
}

/**
 * Validate phone number format
 */
export function isValidPhone(phone) {
  if (!phone || typeof phone !== 'string') {
    return false;
  }
  
  // Remove common separators
  const cleaned = phone.replace(/[\s\-\.\(\)]/g, '');
  
  // Check if it's a reasonable phone number
  const phoneRegex = /^\+?[1-9]\d{7,14}$/;
  return phoneRegex.test(cleaned);
}

/**
 * Normalize phone number
 */
export function normalizePhone(phone) {
  if (!phone) return '';
  
  // Remove all non-digit characters except +
  let cleaned = phone.replace(/[^\d+]/g, '');
  
  // Ensure it starts with +
  if (!cleaned.startsWith('+')) {
    if (cleaned.match(/^[1-9]\d{7,14}$/)) {
      cleaned = '+' + cleaned;
    }
  }
  
  return cleaned;
}

/**
 * Sanitize user input
 */
export function sanitizeInput(input) {
  if (!input || typeof input !== 'string') {
    return '';
  }
  
  return input
    .replace(/[<>]/g, '')
    .trim()
    .substring(0, 1000);
}

/**
 * Generate secure random token
 */
export function generateToken(length = 32) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const randomValues = new Uint8Array(length);
    crypto.getRandomValues(randomValues);
    
    for (let i = 0; i < length; i++) {
      result += chars[randomValues[i] % chars.length];
    }
  } else {
    for (let i = 0; i < length; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
  }
  
  return result;
}

/**
 * Hash sensitive data
 */
export async function simpleHash(data) {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
