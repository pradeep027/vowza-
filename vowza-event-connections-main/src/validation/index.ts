/**
 * VOWZA GLOBAL VALIDATION SYSTEM
 * 
 * Centralized, reusable validators for all forms across the application.
 * Used to prevent junk/invalid data from being entered throughout the system.
 * 
 * Core principle: Invalid data = User cannot continue
 * 
 * STRUCTURE:
 * - Common validators (name, email, phone, text)
 * - Location validators (state, district, city, pincode, area)
 * - Contact validators
 * - Business validators (price, duration, experience)
 * - Date/Time validators
 * - Document validators
 * - Form-level validators
 */

// ─────────────────────────────────────────────────────────────────────────
// COMMON VALIDATORS
// ─────────────────────────────────────────────────────────────────────────

/**
 * Full Name Validation
 * 
 * Accepts legitimate names like: "Pradeep", "Pradeep Kumar", "K. Pradeep", "O'Connor"
 * Rejects junk like: "02z8v7k9", "qwerty", "aaaaaaa", "!!!!", "123456"
 */
export function validateName(
  value: string,
  fieldName: string = 'Full Name'
): { valid: boolean; error?: string } {
  if (!value) {
    return { valid: false, error: `${fieldName} is required` };
  }

  const trimmed = value.trim();

  // Length check
  if (trimmed.length < 2) {
    return { valid: false, error: `${fieldName} must be at least 2 characters` };
  }
  if (trimmed.length > 100) {
    return { valid: false, error: `${fieldName} must be 100 characters or less` };
  }

  // Must contain mostly letters
  const letterCount = (trimmed.match(/\p{L}/gu) || []).length;
  const totalChars = trimmed.length;
  if (letterCount / totalChars < 0.5) {
    return { valid: false, error: `${fieldName} must contain mostly letters` };
  }

  // Reject keyboard patterns (qwerty, asdfgh, etc)
  if (/^(qwerty|asdfgh|zxcvbn|123456|abcdef|aaaaaa|xxxxxx|zzzzz|!+|@+|#+|\$+)$/i.test(trimmed)) {
    return { valid: false, error: `${fieldName} contains invalid pattern` };
  }

  // Reject repeated characters (aaaa, xxxx, etc)
  if (/(.)\\1{5,}/.test(trimmed)) {
    return { valid: false, error: `${fieldName} contains too many repeated characters` };
  }

  // Reject if too many digits
  const digitCount = (trimmed.match(/\d/g) || []).length;
  if (digitCount / totalChars > 0.3) {
    return { valid: false, error: `${fieldName} contains too many numbers` };
  }

  // Reject if mostly special characters
  const specialCount = (trimmed.match(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/g) || []).length;
  if (specialCount / totalChars > 0.2) {
    return { valid: false, error: `${fieldName} contains invalid characters` };
  }

  return { valid: true };
}

/**
 * Email Validation
 */
export function validateEmail(value: string): { valid: boolean; error?: string } {
  if (!value) {
    return { valid: false, error: 'Email is required' };
  }

  const trimmed = value.trim();

  // Simple email regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    return { valid: false, error: 'Enter a valid email address' };
  }

  // Must not contain spaces
  if (/\s/.test(trimmed)) {
    return { valid: false, error: 'Email must not contain spaces' };
  }

  return { valid: true };
}

/**
 * Mobile Number Validation (India)
 * 
 * Accepts: 9876543210, +91 9876543210, 98765 43210
 * Rejects: 1234567890, 0000000000, 12345
 */
export function validateMobile(value: string): { valid: boolean; error?: string } {
  if (!value) {
    return { valid: false, error: 'Mobile number is required' };
  }

  // Remove formatting characters
  const cleaned = value.replace(/[\s\-+]/g, '');

  // Remove country code if present
  let digitsOnly = cleaned;
  if (digitsOnly.startsWith('91')) {
    digitsOnly = digitsOnly.substring(2);
  }

  // Must be exactly 10 digits
  if (!/^\d{10}$/.test(digitsOnly)) {
    return { valid: false, error: 'Enter a valid 10-digit mobile number' };
  }

  // First digit must be 6-9 (valid Indian mobile start)
  if (!/^[6-9]/.test(digitsOnly)) {
    return { valid: false, error: 'Enter a valid Indian mobile number' };
  }

  // Reject all same digits (0000000000, 1111111111, etc)
  if (/^(\d)\1{9}$/.test(digitsOnly)) {
    return { valid: false, error: 'Enter a valid mobile number' };
  }

  return { valid: true };
}

/**
 * Text Validation for descriptions, bio, messages
 */
export function validateText(
  value: string,
  fieldName: string = 'Text',
  minLength: number = 10,
  maxLength: number = 1000
): { valid: boolean; error?: string } {
  if (!value) {
    return { valid: false, error: `${fieldName} is required` };
  }

  const trimmed = value.trim();

  if (trimmed.length < minLength) {
    return { valid: false, error: `${fieldName} must be at least ${minLength} characters` };
  }

  if (trimmed.length > maxLength) {
    return { valid: false, error: `${fieldName} must be ${maxLength} characters or less` };
  }

  return { valid: true };
}

/**
 * Check if text is garbage (spam, keyboard mashing, etc)
 */
export function isGarbageText(value: string): boolean {
  if (!value) return false;

  const trimmed = value.toLowerCase().trim();

  // Keyboard patterns
  const keyboardPatterns = [
    /^(qwerty|asdfgh|zxcvbn|qweasd|123456|abcdef)$/,
    /(.)\\1{5,}/, // repeated chars
    /^[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]{3,}$/, // only special chars
  ];

  for (const pattern of keyboardPatterns) {
    if (pattern.test(trimmed)) {
      return true;
    }
  }

  return false;
}

// ─────────────────────────────────────────────────────────────────────────
// LOCATION VALIDATORS
// ─────────────────────────────────────────────────────────────────────────

/**
 * State Validation (India)
 */
const INDIAN_STATES = [
  'Andaman and Nicobar Islands',
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chandigarh',
  'Chhattisgarh',
  'Dadra and Nagar Haveli',
  'Daman and Diu',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Ladakh',
  'Lakshadweep',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Puducherry',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
];

export function validateState(value: string): { valid: boolean; error?: string } {
  if (!value) {
    return { valid: false, error: 'State is required' };
  }

  const trimmed = value.trim();

  if (!INDIAN_STATES.includes(trimmed)) {
    return { valid: false, error: 'Select a valid Indian state' };
  }

  return { valid: true };
}

/**
 * District Validation
 * 
 * Accepts: Sangareddy, Hyderabad, Pune
 * Rejects: xy, 123, !!, sri (generic/junk)
 */
export function validateDistrict(value: string): { valid: boolean; error?: string } {
  if (!value) {
    return { valid: false, error: 'District is required' };
  }

  const trimmed = value.trim();

  if (trimmed.length < 2) {
    return { valid: false, error: 'District must be at least 2 characters' };
  }

  if (trimmed.length > 100) {
    return { valid: false, error: 'District must be 100 characters or less' };
  }

  // Must contain mostly letters
  const letterCount = (trimmed.match(/\p{L}/gu) || []).length;
  if (letterCount / trimmed.length < 0.6) {
    return { valid: false, error: 'District must contain mostly letters' };
  }

  // Reject generic/junk terms
  const junkTerms = ['sri', 'abc', 'xyz', 'test', 'name', 'value', 'please', 'select'];
  if (junkTerms.includes(trimmed.toLowerCase())) {
    return { valid: false, error: 'Please enter a valid district name' };
  }

  return { valid: true };
}

/**
 * City/Town Validation
 * 
 * Accepts: Patelguda, Hyderabad, Bangalore
 * Rejects: xy, 123, sri, abc, Other (unless custom text provided)
 */
export function validateCity(value: string): { valid: boolean; error?: string } {
  if (!value) {
    return { valid: false, error: 'City / Town is required' };
  }

  const trimmed = value.trim();

  if (trimmed.length < 2) {
    return { valid: false, error: 'City / Town must be at least 2 characters' };
  }

  if (trimmed.length > 100) {
    return { valid: false, error: 'City / Town must be 100 characters or less' };
  }

  // Must contain mostly letters
  const letterCount = (trimmed.match(/\p{L}/gu) || []).length;
  if (letterCount / trimmed.length < 0.6) {
    return { valid: false, error: 'City / Town must contain mostly letters' };
  }

  // Reject generic terms
  if (/^(other|select|please|choose|name|value)$/i.test(trimmed)) {
    return { valid: false, error: 'Please enter a valid city or town name' };
  }

  return { valid: true };
}

/**
 * Pincode Validation (India)
 * 
 * Accepts: 502319, 500009
 * Rejects: 50231, 5023199, 000000, abcdef
 */
export function validatePincode(value: string): { valid: boolean; error?: string } {
  if (!value) {
    return { valid: false, error: 'Pincode is required' };
  }

  const cleaned = value.replace(/\s/g, '');

  if (!/^\d{6}$/.test(cleaned)) {
    return { valid: false, error: 'Enter a valid 6-digit pincode' };
  }

  // Reject all same digits (000000, 111111, etc)
  if (/^(\d)\1{5}$/.test(cleaned)) {
    return { valid: false, error: 'Enter a valid pincode' };
  }

  return { valid: true };
}

/**
 * Area / Locality Validation
 * 
 * Accepts: Banjara Hills, Patelguda, Madhapur
 * Rejects: sri, abc, xyz, 197, aaaa, !!, qwerty
 */
export function validateArea(value: string): { valid: boolean; error?: string } {
  if (!value) {
    return { valid: false, error: 'Area / Locality is required' };
  }

  const trimmed = value.trim();

  if (trimmed.length < 2) {
    return { valid: false, error: 'Area / Locality must be at least 2 characters' };
  }

  if (trimmed.length > 100) {
    return { valid: false, error: 'Area / Locality must be 100 characters or less' };
  }

  // Must contain mostly letters
  const letterCount = (trimmed.match(/\p{L}/gu) || []).length;
  if (letterCount / trimmed.length < 0.5) {
    return { valid: false, error: 'Area / Locality must contain mostly letters' };
  }

  // Reject repeated characters
  if (/(.)\\1{4,}/.test(trimmed)) {
    return { valid: false, error: 'Area / Locality appears to be invalid' };
  }

  // Reject common junk terms
  const junkTerms = [
    'sri',
    'abc',
    'xyz',
    'test',
    'area',
    'locality',
    'place',
    'select',
    'name',
    'value',
    'qwerty',
    'asdf',
    'aaaa',
    'xxxx',
    'zzzz',
    'please',
  ];
  if (junkTerms.includes(trimmed.toLowerCase())) {
    return { valid: false, error: 'Please enter a valid area or locality name' };
  }

  return { valid: true };
}

/**
 * Full Address Validation
 * 
 * Used for "Additional Address" or address detail fields
 * Optional if not required
 */
export function validateAddress(
  value: string,
  fieldName: string = 'Address',
  required: boolean = false
): { valid: boolean; error?: string } {
  if (!value && !required) {
    return { valid: true }; // Optional field, can be empty
  }

  if (!value && required) {
    return { valid: false, error: `${fieldName} is required` };
  }

  const trimmed = value.trim();

  if (trimmed.length < 3) {
    return { valid: false, error: `${fieldName} must be at least 3 characters` };
  }

  if (trimmed.length > 200) {
    return { valid: false, error: `${fieldName} must be 200 characters or less` };
  }

  // Must contain some letters
  if (!/\p{L}/u.test(trimmed)) {
    return { valid: false, error: `${fieldName} must contain letters` };
  }

  return { valid: true };
}

/**
 * House/Shop Number Validation
 * 
 * Accepts: 12, 12A, 12-3, H.No. 12-3-45, Plot 17, Shop 4, Flat 302
 * Rejects: !!!!, aaaa, qwerty
 */
export function validateHouseNumber(value: string): { valid: boolean; error?: string } {
  if (!value) {
    return { valid: false, error: 'House / Shop Number is required' };
  }

  const trimmed = value.trim();

  if (trimmed.length < 1) {
    return { valid: false, error: 'House / Shop Number is required' };
  }

  if (trimmed.length > 50) {
    return { valid: false, error: 'House / Shop Number must be 50 characters or less' };
  }

  // Reject repeated special characters only
  if (/^[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]{2,}$/.test(trimmed)) {
    return { valid: false, error: 'Enter a valid house or shop number' };
  }

  // Reject obvious keyboard patterns
  if (/^(qwerty|asdfgh|zxcvbn|aaaa|xxxx|!!!!)$/i.test(trimmed)) {
    return { valid: false, error: 'Enter a valid house or shop number' };
  }

  return { valid: true };
}

// ─────────────────────────────────────────────────────────────────────────
// BUSINESS VALIDATORS
// ─────────────────────────────────────────────────────────────────────────

/**
 * Price/Amount Validation
 * 
 * Validates numeric pricing values
 */
export function validatePrice(
  value: string | number,
  fieldName: string = 'Price',
  min: number = 0,
  max: number = 10000000
): { valid: boolean; error?: string } {
  if (value === '' || value === null || value === undefined) {
    return { valid: false, error: `${fieldName} is required` };
  }

  const num = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(num)) {
    return { valid: false, error: `${fieldName} must be a valid number` };
  }

  if (num < min) {
    return { valid: false, error: `${fieldName} must be at least ${min}` };
  }

  if (num > max) {
    return { valid: false, error: `${fieldName} cannot exceed ${max}` };
  }

  return { valid: true };
}

/**
 * Duration Validation (hours, days, etc)
 */
export function validateDuration(
  value: string | number,
  fieldName: string = 'Duration',
  min: number = 1,
  max: number = 365
): { valid: boolean; error?: string } {
  if (value === '' || value === null || value === undefined) {
    return { valid: false, error: `${fieldName} is required` };
  }

  const num = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(num)) {
    return { valid: false, error: `${fieldName} must be a valid number` };
  }

  if (num < min) {
    return { valid: false, error: `${fieldName} must be at least ${min}` };
  }

  if (num > max) {
    return { valid: false, error: `${fieldName} cannot exceed ${max}` };
  }

  return { valid: true };
}

/**
 * Experience Validation
 */
export function validateExperience(value: string): { valid: boolean; error?: string } {
  if (!value) {
    return { valid: false, error: 'Experience level is required' };
  }

  const validExperience = [
    'fresher',
    '1-2_years',
    '3-5_years',
    '5-10_years',
    '10+_years',
    'student',
    'hobbyist',
  ];

  if (!validExperience.includes(value.toLowerCase())) {
    return { valid: false, error: 'Select a valid experience level' };
  }

  return { valid: true };
}

// ─────────────────────────────────────────────────────────────────────────
// DATE/TIME VALIDATORS
// ─────────────────────────────────────────────────────────────────────────

/**
 * Date Validation
 * 
 * For booking/event dates: must be in future
 * For DOB: must be in past
 */
export function validateDate(
  value: string,
  fieldName: string = 'Date',
  pastOrFuture: 'future' | 'past' = 'future'
): { valid: boolean; error?: string } {
  if (!value) {
    return { valid: false, error: `${fieldName} is required` };
  }

  const date = new Date(value);
  if (isNaN(date.getTime())) {
    return { valid: false, error: `${fieldName} must be a valid date` };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dateOnly = new Date(date);
  dateOnly.setHours(0, 0, 0, 0);

  if (pastOrFuture === 'future' && dateOnly <= today) {
    return { valid: false, error: `${fieldName} must be in the future` };
  }

  if (pastOrFuture === 'past' && dateOnly >= today) {
    return { valid: false, error: `${fieldName} must be in the past` };
  }

  return { valid: true };
}

/**
 * Time Validation
 * 
 * Format: HH:MM (24-hour)
 */
export function validateTime(value: string): { valid: boolean; error?: string } {
  if (!value) {
    return { valid: false, error: 'Time is required' };
  }

  const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
  if (!timeRegex.test(value)) {
    return { valid: false, error: 'Enter a valid time (HH:MM)' };
  }

  return { valid: true };
}

// ─────────────────────────────────────────────────────────────────────────
// FORM-LEVEL VALIDATORS
// ─────────────────────────────────────────────────────────────────────────

/**
 * Location Data Validator (full location object)
 * 
 * Used in booking and checkout forms
 */
interface LocationData {
  state?: string;
  district?: string;
  city?: string;
  pincode?: string;
  area?: string;
  address?: string;
  houseNumber?: string;
}

export function validateLocation(
  location: LocationData,
  requiredFields: (keyof LocationData)[] = ['state', 'district', 'city', 'pincode']
): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  // Check required fields
  for (const field of requiredFields) {
    if (!location[field]) {
      if (field === 'state') errors.state = 'State is required';
      if (field === 'district') errors.district = 'District is required';
      if (field === 'city') errors.city = 'City / Town is required';
      if (field === 'pincode') errors.pincode = 'Pincode is required';
      if (field === 'area') errors.area = 'Area / Locality is required';
      if (field === 'address') errors.address = 'Address is required';
    }
  }

  // Validate each present field
  if (location.state) {
    const stateVal = validateState(location.state);
    if (!stateVal.valid) errors.state = stateVal.error || 'Invalid state';
  }

  if (location.district) {
    const districtVal = validateDistrict(location.district);
    if (!districtVal.valid) errors.district = districtVal.error || 'Invalid district';
  }

  if (location.city) {
    const cityVal = validateCity(location.city);
    if (!cityVal.valid) errors.city = cityVal.error || 'Invalid city';
  }

  if (location.pincode) {
    const pincodeVal = validatePincode(location.pincode);
    if (!pincodeVal.valid) errors.pincode = pincodeVal.error || 'Invalid pincode';
  }

  if (location.area) {
    const areaVal = validateArea(location.area);
    if (!areaVal.valid) errors.area = areaVal.error || 'Invalid area';
  }

  if (location.address) {
    const addressVal = validateAddress(location.address, 'Address', !!location.address);
    if (!addressVal.valid) errors.address = addressVal.error || 'Invalid address';
  }

  if (location.houseNumber) {
    const houseVal = validateHouseNumber(location.houseNumber);
    if (!houseVal.valid) errors.houseNumber = houseVal.error || 'Invalid house number';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Check if all form fields are valid
 * 
 * Returns true only if ALL required fields have valid values
 */
export function areAllFieldsValid(
  fields: Record<string, { valid: boolean; value: any }>
): boolean {
  for (const field of Object.values(fields)) {
    if (!field.valid) return false;
  }
  return true;
}
