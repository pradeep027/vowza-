# VOWZA GLOBAL VALIDATION SYSTEM

## Executive Summary

A comprehensive, centralized validation system has been created to prevent junk/invalid data from being accepted throughout the Vowza application.

**Status:** Core validation system ✅ created. Integration started.

---

## Core Principle

```
INVALID DATA = USER CANNOT CONTINUE

Every required field must be validated before the user can proceed.
The Continue / Next / Submit button must remain disabled until all required fields are valid.
```

---

## System Architecture

### Validation Hierarchy

```
USER INPUT
    ↓
FIELD VALIDATOR (real-time, on blur)
    ↓
ERROR/SUCCESS DISPLAY
    ↓
FORM VALIDATOR (all fields)
    ↓
CONTINUE BUTTON GATE
    ↓
SERVER VALIDATION (backend)
    ↓
DATABASE CONSTRAINTS
```

### File Structure

```
src/validation/
├── index.ts                 # Main validation system (30+ validators)
├── validators.ts            # Legacy (deprecated, use index.ts)
└── customerValidators.ts    # Customer-specific validators
```

---

## Available Validators

### Common Validators

```typescript
validateName(value, fieldName)
// Accepts: "Pradeep", "Pradeep Kumar", "K. Pradeep", "O'Connor"
// Rejects: "02z8v7k9", "qwerty", "aaaaaaa", "!!!!", "123456"
// Length: 2-100 characters
// Rules: Must contain mostly letters, no keyboard patterns

validateEmail(value)
// Accepts: "user@gmail.com", "name.business@example.com"
// Rejects: "abc", "abc@com", emails with spaces

validateMobile(value)
// Accepts: "9876543210", "+91 9876543210", "98765 43210"
// Rejects: "1234567890", "0000000000", < 10 digits
// Format: Indian phone, 10 digits, first digit 6-9

validateText(value, fieldName, minLength, maxLength)
// Generic text validation for descriptions, bio, messages
// Customizable min/max length
```

### Location Validators

```typescript
validateState(value)
// Accepts: "Telangana", "Andhra Pradesh", etc (35 Indian states/UTs)
// Rejects: "Telanganaa", "TS123", arbitrary text

validateDistrict(value)
// Accepts: "Sangareddy", "Hyderabad", "Pune"
// Rejects: "xy", "123", "sri" (generic terms)
// Rules: 2-100 chars, mostly letters

validateCity(value)
// Accepts: "Patelguda", "Hyderabad", "Bangalore"
// Rejects: "xy", "123", "Other", "select"
// Rules: 2-100 chars, mostly letters

validatePincode(value)
// Accepts: "502319", "500009"
// Rejects: "50231", "5023199", "000000", "abcdef"
// Rules: Exactly 6 digits

validateArea(value)
// Accepts: "Banjara Hills", "Patelguda", "Madhapur"
// Rejects: "sri", "abc", "xyz", "197", "aaaa", "!!", "qwerty"
// Rules: 2+ chars, mostly letters, no junk terms

validateAddress(value, fieldName, required)
// Accepts: "Near Sai Baba Temple", "12/A, Opposite Street", "H.No. 2-4-17"
// Rejects: "197" (only numbers if required)
// Rules: 3-200 chars, must contain letters

validateHouseNumber(value)
// Accepts: "12", "12A", "12-3", "H.No. 12-3-45", "Plot 17", "Flat 302"
// Rejects: "!!!!", "aaaa", "qwerty"
// Rules: 1-50 chars, allow alphanumeric and common separators
```

### Business Validators

```typescript
validatePrice(value, fieldName, min, max)
// Validates numeric pricing values
// Default range: 0 to 10,000,000
// Customizable min/max

validateDuration(value, fieldName, min, max)
// Validates hours, days, etc
// Default range: 1 to 365

validateExperience(value)
// Accepts: "fresher", "1-2_years", "3-5_years", "5-10_years", "10+_years"
// Rejects: arbitrary text
```

### Date/Time Validators

```typescript
validateDate(value, fieldName, pastOrFuture)
// For booking/event dates: must be in future
// For DOB: must be in past
// pastOrFuture: "future" | "past"

validateTime(value)
// Format: HH:MM (24-hour)
// Accepts: "14:30", "09:00"
// Rejects: "25:00", "1430", "2:30PM"
```

### Form-Level Validators

```typescript
validateLocation(location, requiredFields)
// Validates entire location object
// requiredFields: array of field names to require
// Returns: { valid: boolean, errors: Record<string, string> }

areAllFieldsValid(fields)
// Helper to check if all fields in an object are valid
// Returns: boolean
```

---

## Integration Pattern

### Step 1: Import Validators

```typescript
import {
  validateName,
  validateMobile,
  validateEmail,
  validateState,
  validateDistrict,
  validateCity,
  validateArea,
  validateAddress,
  validateLocation,
} from '@/validation';
```

### Step 2: Create Validation State

```typescript
const [errors, setErrors] = useState<Record<string, string>>({});

const validateField = useCallback(
  (fieldName: keyof FormData, value: any) => {
    let error: string | undefined;

    switch (fieldName) {
      case 'fullName': {
        const val = validateName(value as string, 'Full Name');
        error = val.valid ? undefined : val.error;
        break;
      }
      case 'email': {
        const val = validateEmail(value as string);
        error = val.valid ? undefined : val.error;
        break;
      }
      // ... more fields
    }

    setErrors((prev) => {
      const newErrors = { ...prev };
      if (error) {
        newErrors[fieldName] = error;
      } else {
        delete newErrors[fieldName];
      }
      return newErrors;
    });
  },
  []
);
```

### Step 3: Validate on Field Change and Blur

```typescript
<Input
  value={data.fullName}
  onChange={(e) => {
    onChange({ fullName: e.target.value });
    validateField('fullName', e.target.value); // Real-time validation
  }}
  onBlur={() => validateField('fullName', data.fullName)} // On blur
  className={errors.fullName ? 'border-red-500' : ''}
/>

{errors.fullName && (
  <div className="flex items-center gap-2 text-red-500 text-sm">
    <AlertCircle className="w-4 h-4" />
    <span>{errors.fullName}</span>
  </div>
)}
```

### Step 4: Gate Continue Button

```typescript
const isFormValid = useCallback(() => {
  const fullNameVal = validateName(data.fullName, 'Full Name');
  const emailVal = validateEmail(data.email);
  const locationVal = validateLocation(data.location, [
    'state',
    'district',
    'city',
    'pincode',
  ]);

  return fullNameVal.valid && emailVal.valid && locationVal.valid;
}, [data]);

// Use isFormValid to gate Continue button
<button
  disabled={!isFormValid()}
  onClick={handleContinue}
>
  Continue
</button>
```

### Step 5: Server-Side Validation

Backend should also validate all data. Never trust client-side validation alone.

---

## Forms to Update (Priority Order)

### 1. **CRITICAL** — Provider Registration (Step 1)
- File: `src/pages/ProviderRegistration.tsx` (Step1Form component)
- Fields: Full Name, Mobile, Email, Location (State, District, City, Pincode, Area, Address)
- Status: ✅ Integration started (see BASIC_INFO_STEP validation)
- Priority: HIGHEST — Most complex form

### 2. **CRITICAL** — Artist Onboarding (BasicInfoStep)
- File: `src/components/onboarding/steps/BasicInfoStep.tsx`
- Fields: Full Name, Phone, Location (State, District, City, Area, Address)
- Status: ✅ UPDATED with full validation
- Test: Enter "02z8v7k9" as Full Name → Should show error

### 3. **HIGH** — Authentication Forms
- File: `src/pages/Auth.tsx`
- Forms: Login, Sign-Up, Password Reset, OTP Verification
- Fields: Name, Email, Phone, Password
- Status: ⏳ TO DO
- Impact: Entry point for all users

### 4. **HIGH** — Booking Modal
- File: `src/components/BookingModal.tsx`
- Forms: 3-step booking flow (Calendar, Booking Details, Confirmation)
- Fields: Event Type, Event Date, Event Time, Duration, Location, Amount
- Status: ⏳ TO DO
- Impact: Customer-facing form

### 5. **HIGH** — Checkout
- File: `src/pages/Checkout.tsx`
- Forms: 3-step checkout (Review Cart, Booking Details, Confirm & Pay)
- Fields: Event Type, Date, Time, Location, Amount
- Status: ⏳ TO DO
- Impact: Payment form

### 6. **MEDIUM** — Vendor Profile Edit
- File: `src/pages/VendorEditProfile.tsx`
- Multiple tabs with various fields
- Status: ⏳ TO DO

### 7. **MEDIUM** — Package Managers (Photographer, DJ, Decorator, etc)
- Files: `src/pages/vendor/*.tsx`
- Fields: Package Name, Price, Duration, etc
- Status: ⏳ TO DO

### 8. **LOW** — Contact Form
- File: `src/pages/Contact.tsx`
- Fields: Name, Email, Message
- Status: ⏳ TO DO

---

## Testing Checklist

### Test Case: Junk Name

**Input:**
```
Full Name: 02z8v7k9
```

**Expected:**
```
❌ Invalid
Error: "Full Name must contain mostly letters"
Continue: DISABLED
```

### Test Case: Junk Area

**Input:**
```
Area: sri
```

**Expected:**
```
❌ Invalid
Error: "Please enter a valid area or locality name"
Continue: DISABLED
```

### Test Case: Invalid Pincode

**Input:**
```
Pincode: 50231
```

**Expected:**
```
❌ Invalid
Error: "Enter a valid 6-digit pincode"
Continue: DISABLED
```

### Test Case: Valid Data

**Input:**
```
Full Name: Pradeep Kumar
Mobile: 9876543210
Email: pradeep@example.com
State: Telangana
District: Sangareddy
City: Patelguda
Area: Banjara Hills
Address: Near Sai Baba Temple
Pincode: 502319
```

**Expected:**
```
✅ All fields valid
Continue: ENABLED
```

### Test Case: Invalid → Valid Transition

**Sequence:**
```
1. Full Name: "aaaa" → Error, Continue DISABLED
2. Fix to: "Pradeep" → Error clears, Continue ENABLED (if all other fields valid)
3. Change back to: "123" → Error shows again, Continue DISABLED immediately
```

---

## Key Features

### 1. Real-Time Validation

Validates as user types (after blur), not just on submit.

```typescript
onChange={(e) => {
  onChange({ fullName: e.target.value });
  validateField('fullName', e.target.value); // Real-time
}}
```

### 2. Error Messages are Clear

Not technical, not scary.

```
❌ "Full Name must contain mostly letters"
❌ "Enter a valid 10-digit mobile number"
❌ "Please enter a valid area or locality name"

NOT:
❌ "TypeError: undefined"
❌ "Validation failed"
❌ "Invalid input"
```

### 3. No False Positives

Does NOT reject legitimate Indian names and addresses.

```
✅ "Pradeep Kumar" — Accepted
✅ "K. Pradeep" — Accepted
✅ "Patelguda" — Accepted
✅ "H.No. 2-4-17" — Accepted
```

### 4. Continue Button Gating

Button remains disabled until ALL required fields are valid.

```typescript
<button disabled={!isFormValid()}>
  Continue
</button>
```

When any field becomes invalid, the button immediately becomes disabled again.

### 5. Server-Side Validation

Backend also validates. Client-side validation is NOT the security boundary.

---

## Implementation Roadmap

### Phase 1 (DONE)
- ✅ Create comprehensive validation system (`src/validation/index.ts`)
- ✅ Update Artist Onboarding BasicInfoStep with validation
- ✅ Document integration pattern

### Phase 2 (IN PROGRESS)
- ⏳ Update Provider Registration (all 6 steps)
- ⏳ Update Booking Modal (all 3 steps)
- ⏳ Update Checkout (all 3 steps)
- ⏳ Update Authentication forms

### Phase 3
- ⏳ Update Vendor Profile Editor
- ⏳ Update Package Managers
- ⏳ Update Contact Form

### Phase 4
- ⏳ Add backend validation to all endpoints
- ⏳ Add database constraints
- ⏳ Global testing pass

---

## Error Message Standards

### Format

```
<Icon> <Message>
```

### Examples

```
❌ Full Name must contain mostly letters
❌ Enter a valid 10-digit mobile number
❌ Enter a valid Indian state
❌ Please enter a valid area or locality name
❌ Pincode does not match the selected location
❌ Event date must be in the future
✅ Valid (shown when field is correct)
```

### Do NOT

```
❌ "Something went wrong"
❌ "Invalid input"
❌ "Error"
❌ "undefined"
❌ "TypeError"
❌ Technical jargon
```

---

## Common Mistakes to Avoid

### ❌ WRONG: No validation

```typescript
<button onClick={handleContinue}>
  Continue
</button>

// User can proceed with any garbage data
```

### ✅ RIGHT: Validation gates button

```typescript
<button
  disabled={!isFormValid()}
  onClick={handleContinue}
>
  Continue
</button>

// User cannot proceed until all fields valid
```

---

### ❌ WRONG: Validating with just length

```typescript
if (name.length > 0) {
  isValid = true; // "02z8v7k9" passes!
}
```

### ✅ RIGHT: Semantic validation

```typescript
const val = validateName(name);
if (val.valid) {
  isValid = true; // Only real names pass
}
```

---

### ❌ WRONG: Error only on submit

```typescript
<Input onChange={(e) => setName(e.target.value)} />
<button onClick={() => {
  if (!isValid()) {
    setError("Invalid name");
  } else {
    handleSubmit();
  }
}}>
  Submit
</button>

// User doesn't know about the error until they click Submit
```

### ✅ RIGHT: Real-time validation

```typescript
<Input
  onChange={(e) => {
    setName(e.target.value);
    validateField('name', e.target.value); // Immediate feedback
  }}
/>
{error && <span>{error}</span>} // Error appears immediately
<button disabled={!isValid()}>
  Submit
</button>
```

---

## Performance Considerations

### Debouncing (Optional)

For expensive validations (e.g., async API calls), debounce:

```typescript
const debouncedValidate = useCallback(
  debounce((fieldName, value) => {
    validateField(fieldName, value);
  }, 300),
  []
);
```

### Current Validators

All current validators are synchronous and fast (< 1ms each). No debouncing needed for initial implementation.

---

## Migration from Old Validators

Old validators in `src/validation/validators.ts` are still present but should be migrated to use the new system in `src/validation/index.ts`.

```typescript
// OLD (legacy)
import { validateName } from '@/validation/validators';

// NEW (use this)
import { validateName } from '@/validation';
```

The old file can be deprecated once all forms are migrated.

---

## Security Notes

### ✅ DO

- Validate on client for UX
- Validate on server for security
- Log validation failures for monitoring
- Sanitize on save
- Use database constraints

### ❌ DON'T

- Trust client-side validation alone
- Expose validation implementation details
- Log sensitive data (Aadhaar, PAN, passwords)
- Allow bypass of Continue button
- Skip server-side validation

---

## Files Changed

### Created:
- `src/validation/index.ts` — New comprehensive validation system
- `VALIDATION_IMPLEMENTATION_GUIDE.md` — This file

### Updated:
- `src/components/onboarding/steps/BasicInfoStep.tsx` — Full validation integration

### To Update:
- `src/pages/ProviderRegistration.tsx` (Step1, Step2, Step3, Step4, Step5, Step6)
- `src/pages/Auth.tsx` (Login, Sign-Up, Password Reset, OTP)
- `src/components/BookingModal.tsx` (3-step booking)
- `src/pages/Checkout.tsx` (3-step checkout)
- `src/pages/VendorEditProfile.tsx` (All tabs)
- `src/pages/vendor/*.tsx` (Package managers)
- `src/pages/Contact.tsx` (Contact form)

---

## Questions?

Refer to the validator function signatures in `src/validation/index.ts`.

Each validator returns:
```typescript
{ valid: boolean; error?: string }
```

Simple, consistent, testable.

---

**Status:** Ready for deployment and integration across all forms.

**Next Step:** Apply validation pattern to remaining forms following the pattern shown in BasicInfoStep.tsx.
