/**
 * Vowza Centralized Validation Utilities
 * Single source of truth for form validation across the entire application.
 * Rules: non-empty ≠ valid. Every field must pass semantic validation.
 */

// ─── Garbage/Nonsense Detection ──────────────────────────────────────────────

/** Keyboard patterns that indicate random typing */
const KEYBOARD_PATTERNS = [
  'qwerty', 'asdfgh', 'zxcvbn', 'qazwsx', 'poiuyt',
  'lkjhgf', 'mnbvcx', 'abcdef', 'zyxwvu',
];

/** Detect if text is likely nonsense/garbage */
export function isGarbageText(value: string): boolean {
  if (!value || value.length < 2) return false;
  const lower = value.toLowerCase().replace(/\s/g, '');

  // Check keyboard patterns
  if (KEYBOARD_PATTERNS.some(p => lower.includes(p))) return true;

  // Check for excessive repeated characters (aaaa, xxxx)
  if (/(.)\1{3,}/.test(lower)) return true;

  // Check for no vowels in a word > 4 chars (unlikely real word)
  const words = lower.split(/\s+/);
  for (const w of words) {
    if (w.length > 4 && !/[aeiou]/.test(w)) return true;
  }

  // Check consonant-only strings > 4 chars
  if (lower.length > 4 && /^[^aeiou\s\d]+$/.test(lower)) return true;

  // Check for random-looking strings (too many rare bigrams)
  if (lower.length > 6) {
    const rareBigrams = ['xz', 'qx', 'zx', 'jq', 'qj', 'vx', 'xv', 'bx', 'xb', 'px', 'xp'];
    const bigramCount = rareBigrams.filter(b => lower.includes(b)).length;
    if (bigramCount >= 2) return true;
  }

  return false;
}

// ─── Name Validation ─────────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateFullName(value: string): ValidationResult {
  const trimmed = value.trim();
  if (!trimmed) return { valid: false, error: 'Full name is required' };
  if (trimmed.length < 2) return { valid: false, error: 'Name must be at least 2 characters' };
  if (trimmed.length > 100) return { valid: false, error: 'Name is too long' };
  if (/^\d+$/.test(trimmed)) return { valid: false, error: 'Name cannot be only numbers' };
  if (/^[^a-zA-Z\u0900-\u097F\u0C00-\u0C7F\u0B80-\u0BFF]+$/.test(trimmed)) return { valid: false, error: 'Please enter a valid name' };
  if (isGarbageText(trimmed)) return { valid: false, error: 'Please enter a valid name' };
  return { valid: true };
}

// ─── Phone Validation ────────────────────────────────────────────────────────

export function validateIndianPhone(value: string): ValidationResult {
  if (!value.trim()) return { valid: false, error: 'Phone number is required' };
  const clean = value.trim().replace(/[\s\-()]/g, '');
  const digits = clean.replace(/^\+91/, '').replace(/^91/, '').replace(/^0/, '');
  if (digits.length !== 10) return { valid: false, error: 'Phone must be a valid 10-digit Indian number' };
  if (!/^\d{10}$/.test(digits)) return { valid: false, error: 'Phone must contain only digits' };
  if (/^(\d)\1{9}$/.test(digits)) return { valid: false, error: 'Please enter a valid phone number' };
  // Indian mobile numbers start with 6-9
  if (!/^[6-9]/.test(digits)) return { valid: false, error: 'Indian mobile numbers start with 6, 7, 8, or 9' };
  return { valid: true };
}

// ─── Email Validation ────────────────────────────────────────────────────────

export function validateEmail(value: string): ValidationResult {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return { valid: false, error: 'Email is required' };
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(trimmed)) return { valid: false, error: 'Please enter a valid email address' };
  if (trimmed.length > 254) return { valid: false, error: 'Email address is too long' };
  return { valid: true };
}

// ─── Pincode Validation ──────────────────────────────────────────────────────

export function validatePincode(value: string): ValidationResult {
  const trimmed = value.trim();
  if (!trimmed) return { valid: false, error: 'Pincode is required' };
  if (!/^\d{6}$/.test(trimmed)) return { valid: false, error: 'Pincode must be exactly 6 digits' };
  // Indian pincodes start with 1-8
  if (!/^[1-8]/.test(trimmed)) return { valid: false, error: 'Please enter a valid Indian pincode' };
  // Reject all-same digits
  if (/^(\d)\1{5}$/.test(trimmed)) return { valid: false, error: 'Please enter a valid pincode' };
  return { valid: true };
}

// ─── Location/Area Validation ────────────────────────────────────────────────

export function validateArea(value: string): ValidationResult {
  const trimmed = value.trim();
  if (!trimmed) return { valid: false, error: 'Area/Locality is required' };
  if (trimmed.length < 3) return { valid: false, error: 'Area name must be at least 3 characters' };
  if (trimmed.length > 100) return { valid: false, error: 'Area name is too long' };
  if (/^\d+$/.test(trimmed)) return { valid: false, error: 'Area cannot be only numbers' };
  if (isGarbageText(trimmed)) return { valid: false, error: 'Please enter a valid area/locality name' };
  return { valid: true };
}

export function validateTownCity(value: string): ValidationResult {
  const trimmed = value.trim();
  if (!trimmed) return { valid: false, error: 'Town/City is required' };
  if (trimmed.length < 2) return { valid: false, error: 'Town/City name must be at least 2 characters' };
  if (trimmed.length > 80) return { valid: false, error: 'Town/City name is too long' };
  if (/^\d+$/.test(trimmed)) return { valid: false, error: 'Town/City cannot be only numbers' };
  if (isGarbageText(trimmed)) return { valid: false, error: 'Please enter a valid town/city name' };
  return { valid: true };
}

export function validateAddress(value: string): ValidationResult {
  const trimmed = value.trim();
  if (!trimmed) return { valid: true }; // Optional field — empty is OK
  if (trimmed.length < 5) return { valid: false, error: 'Address must be at least 5 characters' };
  if (trimmed.length > 200) return { valid: false, error: 'Address is too long' };
  if (isGarbageText(trimmed)) return { valid: false, error: 'Please enter a valid address' };
  return { valid: true };
}

// ─── Text/Description Validation ─────────────────────────────────────────────

export function validateDescription(value: string, minLength = 30, fieldName = 'Description'): ValidationResult {
  const trimmed = value.trim();
  if (!trimmed) return { valid: false, error: `${fieldName} is required` };
  if (trimmed.length < minLength) return { valid: false, error: `${fieldName} must be at least ${minLength} characters` };
  if (isGarbageText(trimmed)) return { valid: false, error: `Please enter a meaningful ${fieldName.toLowerCase()}` };
  return { valid: true };
}

// ─── Date Validation ─────────────────────────────────────────────────────────

export function validateFutureDate(value: string): ValidationResult {
  if (!value) return { valid: false, error: 'Date is required' };
  const date = new Date(value);
  if (isNaN(date.getTime())) return { valid: false, error: 'Please enter a valid date' };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (date < today) return { valid: false, error: 'Date must be in the future' };
  return { valid: true };
}

// ─── Number Validation ───────────────────────────────────────────────────────

export function validatePositiveNumber(value: string | number, fieldName = 'Value'): ValidationResult {
  const num = typeof value === 'string' ? Number(value) : value;
  if (isNaN(num)) return { valid: false, error: `${fieldName} must be a valid number` };
  if (num < 0) return { valid: false, error: `${fieldName} cannot be negative` };
  return { valid: true };
}

// ─── Experience Validation ───────────────────────────────────────────────────

export function validateExperience(value: string): ValidationResult {
  if (!value) return { valid: false, error: 'Experience is required' };
  return { valid: true };
}

// ─── Dropdown/Select Validation ──────────────────────────────────────────────

export function validateRequired(value: string, fieldName = 'Field'): ValidationResult {
  if (!value || !value.trim()) return { valid: false, error: `${fieldName} is required` };
  return { valid: true };
}

export function validateMinSelection(values: string[], min = 1, fieldName = 'Selection'): ValidationResult {
  if (!values || values.length < min) return { valid: false, error: `Please select at least ${min} ${fieldName}` };
  return { valid: true };
}
