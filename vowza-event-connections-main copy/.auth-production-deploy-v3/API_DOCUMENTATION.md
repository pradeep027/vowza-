# Vowza Event Community Platform - Authentication & Worker Onboarding API Documentation

## Overview

This document describes the comprehensive authentication and worker onboarding system for the Vowza Event Community Platform. The system includes:

- **User Authentication**: OTP-based login for customers
- **Worker Onboarding**: Multi-step verification process for service providers
- **Admin Verification**: Manual approval system for worker profiles
- **Security Features**: Rate limiting, IP blocking, and audit logging
- **Notification System**: SMS, Email, and Push notifications

## Base URL

```
https://api.vowza.com/v1
```

## Authentication

The API uses JWT tokens for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <access_token>
```

## API Endpoints

### 1. User Authentication

#### Request OTP

```http
POST /auth/otp/request
Content-Type: application/json

{
  "phone": "9876543210",
  "purpose": "login|worker_onboarding",
  "ipAddress": "192.168.1.1",
  "userAgent": "Mozilla/5.0..."
}
```

**Response:**
```json
{
  "success": true,
  "message": "OTP sent successfully. Valid for 2 minutes.",
  "otpId": "uuid-here",
  "expiresAt": "2024-01-01T12:02:00Z"
}
```

#### Verify OTP & Login

```http
POST /auth/verify
Content-Type: application/json

{
  "phone": "9876543210",
  "otp": "123456",
  "purpose": "login",
  "deviceInfo": {
    "platform": "web",
    "browser": "Chrome"
  },
  "ipAddress": "192.168.1.1"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Authentication successful",
  "user": {
    "id": "user-uuid",
    "phone": "9876543210",
    "fullName": "John Doe",
    "roles": ["customer"],
    "avatarUrl": "https://...",
    "isVerified": true
  },
  "tokens": {
    "accessToken": "jwt-access-token",
    "refreshToken": "jwt-refresh-token",
    "expiresIn": 900
  },
  "requiresOnboarding": false
}
```

#### Refresh Token

```http
POST /auth/refresh
Content-Type: application/json

{
  "refreshToken": "jwt-refresh-token"
}
```

#### Logout

```http
POST /auth/logout
Content-Type: application/json

{
  "refreshToken": "jwt-refresh-token"
}
```

### 2. Worker Onboarding

#### Start Onboarding

```http
POST /worker/onboarding/start
Content-Type: application/json
Authorization: Bearer <token>

{
  "phone": "9876543210",
  "otp": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Onboarding started successfully",
  "currentStep": 2,
  "workerProfile": {
    "id": "worker-uuid",
    "verificationStatus": "pending"
  },
  "nextStep": 2
}
```

#### Update Basic Details (Step 2)

```http
PUT /worker/onboarding/basic-details
Content-Type: application/json
Authorization: Bearer <token>

{
  "fullName": "Jane Smith",
  "email": "jane@example.com",
  "gender": "female",
  "dateOfBirth": "1990-01-01",
  "profilePhotoUrl": "https://..."
}
```

#### Update Service Information (Step 3)

```http
PUT /worker/onboarding/service-info
Content-Type: application/json
Authorization: Bearer <token>

{
  "serviceType": "photographer",
  "experienceYears": 5,
  "serviceCity": "Mumbai",
  "serviceArea": "Andheri",
  "specialties": ["wedding", "portrait"],
  "bio": "Professional photographer with 5+ years experience",
  "portfolioUrls": ["https://portfolio1.jpg", "https://portfolio2.jpg"]
}
```

#### Upload Documents (Step 4)

```http
PUT /worker/onboarding/documents
Content-Type: application/json
Authorization: Bearer <token>

{
  "governmentIdType": "aadhaar",
  "governmentIdUrl": "https://...",
  "governmentIdNumber": "1234-5678-9012",
  "addressProofUrl": "https://...",
  "bankAccountHolder": "Jane Smith",
  "bankAccountNumber": "1234567890",
  "bankName": "State Bank of India",
  "bankIfsc": "SBIN0001234",
  "bankBranchName": "Andheri Branch",
  "portfolioUrls": ["https://work1.jpg", "https://work2.jpg"]
}
```

#### Submit for Review

```http
POST /worker/onboarding/submit
Content-Type: application/json
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "Application submitted for review. You will be notified once approved.",
  "currentStep": 5
}
```

### 3. Admin Verification

#### Get Pending Workers

```http
GET /admin/workers/pending?status=under_review&limit=20&offset=0
Authorization: Bearer <admin-token>
```

**Response:**
```json
{
  "success": true,
  "message": "Pending workers fetched successfully",
  "workers": [
    {
      "id": "worker-uuid",
      "userId": "user-uuid",
      "fullName": "Jane Smith",
      "phone": "9876543210",
      "email": "jane@example.com",
      "serviceType": "photographer",
      "experienceYears": 5,
      "verificationStatus": "under_review",
      "createdAt": "2024-01-01T10:00:00Z",
      "documents": [
        {
          "id": "doc-uuid",
          "documentType": "government_id",
          "documentUrl": "https://...",
          "verificationStatus": "pending"
        }
      ]
    }
  ],
  "totalCount": 15
}
```

#### Approve/Reject Worker

```http
PUT /admin/workers/{workerId}/verify
Content-Type: application/json
Authorization: Bearer <admin-token>

{
  "status": "approved",
  "rejectionReason": "",
  "adminNotes": "All documents verified successfully",
  "verifiedBy": "admin-uuid"
}
```

#### Get Worker Details

```http
GET /admin/workers/{workerId}
Authorization: Bearer <admin-token>
```

#### Get Verification Statistics

```http
GET /admin/stats/verification
Authorization: Bearer <admin-token>
```

**Response:**
```json
{
  "success": true,
  "stats": {
    "total": 150,
    "pending": 25,
    "underReview": 30,
    "approved": 85,
    "rejected": 10,
    "byServiceType": {
      "photographer": 45,
      "decorator": 30,
      "dj": 25
    },
    "byCity": {
      "Mumbai": 60,
      "Delhi": 40,
      "Bangalore": 30
    }
  }
}
```

### 4. User Profile

#### Get Current User

```http
GET /user/profile
Authorization: Bearer <token>
```

#### Update Profile

```http
PUT /user/profile
Content-Type: application/json
Authorization: Bearer <token>

{
  "fullName": "John Doe",
  "email": "john@example.com",
  "avatarUrl": "https://...",
  "city": "Mumbai",
  "area": "Andheri"
}
```

#### Get User Permissions

```http
GET /user/permissions
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "permissions": [
    "book:read",
    "book:create",
    "booking:read",
    "booking:create",
    "profile:read_own",
    "profile:update_own"
  ]
}
```

### 5. Notifications

#### Get Notifications

```http
GET /notifications?type=booking&read=false&limit=20
Authorization: Bearer <token>
```

#### Mark as Read

```http
PUT /notifications/{notificationId}/read
Authorization: Bearer <token>
```

#### Get Notification Settings

```http
GET /notifications/settings
Authorization: Bearer <token>
```

#### Update Notification Settings

```http
PUT /notifications/settings
Content-Type: application/json
Authorization: Bearer <token>

{
  "smsEnabled": true,
  "emailEnabled": true,
  "pushEnabled": false,
  "bookingNotifications": true,
  "paymentNotifications": true,
  "marketingNotifications": false
}
```

## Error Responses

All endpoints return consistent error responses:

```json
{
  "success": false,
  "message": "Error description",
  "error": {
    "code": "ERROR_CODE",
    "details": "Additional error details"
  }
}
```

### Common Error Codes

- `INVALID_PHONE`: Invalid phone number format
- `OTP_EXPIRED`: OTP has expired
- `OTP_INVALID`: Invalid OTP
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `UNAUTHORIZED`: Invalid or expired token
- `FORBIDDEN`: Insufficient permissions
- `NOT_FOUND`: Resource not found
- `VALIDATION_ERROR`: Invalid input data

## Rate Limiting

### OTP Requests
- **Limit**: 5 requests per 15 minutes per phone number
- **IP Limit**: 10 requests per 15 minutes per IP

### General API
- **Limit**: 100 requests per minute per authenticated user
- **IP Limit**: 200 requests per minute per IP

### Authentication
- **Max Attempts**: 3 failed OTP attempts
- **Lockout**: 15 minutes after max attempts

## Security Features

### Input Validation
- All inputs are validated and sanitized
- SQL injection and XSS protection
- Phone number format validation
- Email format validation

### Audit Logging
- All admin actions are logged
- Authentication attempts are tracked
- Profile changes are recorded

### IP Blocking
- Suspicious IPs are automatically blocked
- Manual IP blocking available to admins
- Temporary blocks with configurable duration

## Testing

### Environment Setup

1. **Development Environment**:
   ```
   https://dev-api.vowza.com/v1
   ```

2. **Test Credentials**:
   ```
   Phone: 9876543210
   OTP: 123456 (for testing)
   ```

### Test Cases

#### 1. User Login Flow
```bash
# Request OTP
curl -X POST https://dev-api.vowza.com/v1/auth/otp/request \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "9876543210",
    "purpose": "login"
  }'

# Verify OTP and login
curl -X POST https://dev-api.vowza.com/v1/auth/verify \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "9876543210",
    "otp": "123456",
    "purpose": "login"
  }'
```

#### 2. Worker Onboarding Flow
```bash
# Start onboarding
curl -X POST https://dev-api.vowza.com/v1/worker/onboarding/start \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "phone": "9876543210",
    "otp": "123456"
  }'

# Update basic details
curl -X PUT https://dev-api.vowza.com/v1/worker/onboarding/basic-details \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "fullName": "Test Worker",
    "email": "worker@test.com"
  }'
```

#### 3. Admin Verification
```bash
# Get pending workers
curl -X GET https://dev-api.vowza.com/v1/admin/workers/pending \
  -H "Authorization: Bearer <admin-token>"

# Approve worker
curl -X PUT https://dev-api.vowza.com/v1/admin/workers/{workerId}/verify \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin-token>" \
  -d '{
    "status": "approved",
    "verifiedBy": "admin-uuid"
  }'
```

## SDK Examples

### JavaScript/TypeScript

```typescript
import { authAPI } from './api/auth'
import { workerOnboardingService } from './services/workerOnboarding'

// User login
const loginResult = await authAPI.verifyAndLogin({
  phone: '9876543210',
  otp: '123456',
  purpose: 'login'
})

if (loginResult.success) {
  const { tokens, user } = loginResult
  // Store tokens and user data
}

// Worker onboarding
const onboardingResult = await workerOnboardingService.updateBasicDetails(userId, {
  fullName: 'Jane Smith',
  email: 'jane@example.com',
  serviceType: 'photographer'
})
```

### React Hook Example

```typescript
import { useState } from 'react'
import { authAPI } from '../api/auth'

export const useAuth = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const login = async (phone: string, otp: string) => {
    setLoading(true)
    setError(null)
    
    try {
      const result = await authAPI.verifyAndLogin({
        phone,
        otp,
        purpose: 'login'
      })
      
      if (result.success) {
        // Handle successful login
        localStorage.setItem('accessToken', result.tokens!.accessToken)
        localStorage.setItem('refreshToken', result.tokens!.refreshToken)
      } else {
        setError(result.message)
      }
    } catch (err) {
      setError('Login failed')
    } finally {
      setLoading(false)
    }
  }

  return { login, loading, error }
}
```

## Deployment

### Environment Variables

```bash
# JWT Secrets
VITE_JWT_SECRET=your-super-secret-jwt-key
VITE_REFRESH_JWT_SECRET=your-super-secret-refresh-key

# OTP Settings
VITE_OTP_SALT=your-otp-salt
VITE_SMS_PROVIDER=twilio
VITE_TWILIO_ACCOUNT_SID=your-twilio-sid
VITE_TWILIO_AUTH_TOKEN=your-twilio-token
VITE_TWILIO_PHONE_NUMBER=your-twilio-number

# Email Settings
VITE_EMAIL_PROVIDER=sendgrid
VITE_SENDGRID_API_KEY=your-sendgrid-key
VITE_FROM_EMAIL=noreply@vowza.com

# Database
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-key
```

### Database Migration

Run the migration files in order:

```sql
-- 1. Enhanced auth schema
-- File: 20250107000001_enhanced_auth_schema.sql

-- 2. Existing migrations should already be applied
```

## Support

For API support and questions:
- **Email**: api-support@vowza.com
- **Documentation**: https://docs.vowza.com
- **Status Page**: https://status.vowza.com

---

*Last Updated: January 7, 2026*
