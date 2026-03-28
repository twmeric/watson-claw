/**
 * Security Utilities Tests
 */

import { 
  validateSecurityCode, 
  isValidPhone, 
  normalizePhone,
  sanitizeInput 
} from '../../src/utils/security.js';

describe('Security Utils', () => {
  describe('validateSecurityCode', () => {
    test('returns true for matching codes', () => {
      expect(validateSecurityCode('abc123', 'abc123')).toBe(true);
    });
    
    test('returns false for non-matching codes', () => {
      expect(validateSecurityCode('abc123', 'abc124')).toBe(false);
    });
    
    test('returns false for empty codes', () => {
      expect(validateSecurityCode('', 'abc123')).toBe(false);
      expect(validateSecurityCode('abc123', '')).toBe(false);
    });
    
    test('returns false for null/undefined', () => {
      expect(validateSecurityCode(null, 'abc123')).toBe(false);
      expect(validateSecurityCode('abc123', undefined)).toBe(false);
    });
  });
  
  describe('isValidPhone', () => {
    test('validates correct phone numbers', () => {
      expect(isValidPhone('+85298765432')).toBe(true);
      expect(isValidPhone('85298765432')).toBe(true);
      expect(isValidPhone('+1234567890')).toBe(true);
    });
    
    test('rejects invalid phone numbers', () => {
      expect(isValidPhone('')).toBe(false);
      expect(isValidPhone('abc')).toBe(false);
      expect(isValidPhone('123')).toBe(false);
      expect(isValidPhone(null)).toBe(false);
    });
    
    test('handles phone with spaces and dashes', () => {
      expect(isValidPhone('+852 9876 5432')).toBe(true);
      expect(isValidPhone('852-9876-5432')).toBe(true);
    });
  });
  
  describe('normalizePhone', () => {
    test('normalizes phone numbers', () => {
      expect(normalizePhone('85298765432')).toBe('+85298765432');
      expect(normalizePhone('+85298765432')).toBe('+85298765432');
    });
    
    test('removes spaces and dashes', () => {
      expect(normalizePhone('+852 9876-5432')).toBe('+85298765432');
    });
  });
  
  describe('sanitizeInput', () => {
    test('removes HTML tags', () => {
      expect(sanitizeInput('<script>alert("xss")</script>')).toBe('scriptalert("xss")/script');
    });
    
    test('trims whitespace', () => {
      expect(sanitizeInput('  hello  ')).toBe('hello');
    });
    
    test('limits length', () => {
      const longInput = 'a'.repeat(2000);
      expect(sanitizeInput(longInput).length).toBe(1000);
    });
  });
});
