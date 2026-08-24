# Vowza Event Community Platform - Authentication & Worker Onboarding System

A comprehensive, enterprise-level authentication and worker onboarding system built for Vowza Event Community Platform. This system provides secure OTP-based authentication, multi-step worker verification, admin approval workflows, and robust security features.

## 🚀 Features

### 🔐 Authentication System
- **OTP-based Login**: Secure mobile-first authentication with time-bound OTPs
- **JWT Tokens**: Access and refresh token rotation for enhanced security
- **Role-based Access**: Customer, Worker (Provider), and Admin roles
- **Multi-device Support**: Secure login across multiple devices with token management

### 👷 Worker Onboarding
- **Multi-step Process**: 5-step guided onboarding workflow
- **Document Verification**: Secure upload and verification of government IDs, address proof, and bank details
- **Portfolio Management**: Upload and manage work samples
- **Service Categories**: Support for photographers, decorators, DJs, caterers, makeup artists, and more

### 🛡️ Security Features
- **Rate Limiting**: Prevent OTP abuse and API spam
- **IP Blocking**: Automatic and manual IP blocking for suspicious activity
- **Input Validation**: Comprehensive validation and sanitization
- **Audit Logging**: Complete audit trail for compliance
- **Brute Force Protection**: Automatic lockout after failed attempts

### 📢 Notification System
- **Multi-channel**: SMS, Email, and Push notifications
- **Template System**: Customizable notification templates
- **User Preferences**: Granular control over notification types
- **Real-time Updates**: Instant notifications for important events

### 👨‍💼 Admin Dashboard
- **Worker Verification**: Manual review and approval workflow
- **Bulk Operations**: Mass approval/rejection capabilities
- **Analytics**: Comprehensive verification statistics
- **Export Tools**: Data export for reporting

## 📋 System Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend    │    │   Backend API   │    │   Database      │
│   (React)     │◄──►│   (Node.js)     │◄──►│  (Supabase)    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         │              ┌──────────────┐            │
         └──────────────►│  SMS/Email  │◄───────────┘
                        │  Services   │
                        └──────────────┘
```

## 🗄️ Database Schema

### Core Tables
- **profiles**: User profile information
- **user_roles**: Role assignments (customer, provider, admin)
- **worker_profiles**: Worker onboarding and verification data
- **worker_documents**: Document management and verification
- **otp_verifications**: OTP generation and verification tracking
- **refresh_tokens**: JWT refresh token management
- **notifications**: In-app notification system
- **audit_log**: Security and compliance logging

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- Supabase account
- Twilio account (for SMS)
- SendGrid account (for email)

### Installation

1. **Clone repository**
   ```bash
   git clone https://github.com/vowza/event-platform.git
   cd vowza-event-connections-main
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Run database migrations**
   ```bash
   npm run migrate
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

### Environment Variables

```bash
# JWT Configuration
VITE_JWT_SECRET=your-super-secret-jwt-key-min-32-chars
VITE_REFRESH_JWT_SECRET=your-super-secret-refresh-key-min-32-chars

# Supabase Configuration
VITE_SUPABASE_URL=your-supabase-project-url
VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-anon-key

# SMS Configuration (Twilio)
VITE_TWILIO_ACCOUNT_SID=your-twilio-account-sid
VITE_TWILIO_AUTH_TOKEN=your-twilio-auth-token
VITE_TWILIO_PHONE_NUMBER=your-twilio-phone-number

# Email Configuration (SendGrid)
VITE_SENDGRID_API_KEY=your-sendgrid-api-key
VITE_FROM_EMAIL=noreply@vowza.com

# Security Configuration
VITE_OTP_SALT=your-otp-salt-min-16-chars
```

## 📱 User Flows

### Customer Login Flow
1. **Enter Phone Number**: User enters mobile number
2. **Request OTP**: System generates and sends 6-digit OTP
3. **Verify OTP**: User enters OTP for verification
4. **Generate Tokens**: System creates JWT access and refresh tokens
5. **Login Success**: User is authenticated with customer role

### Worker Onboarding Flow
1. **Start Process**: Click "Join Vowza Community"
2. **Phone Verification**: OTP verification for mobile number
3. **Basic Details**: Name, email, gender, profile photo
4. **Service Information**: Service type, experience, location, portfolio
5. **Document Upload**: Government ID, address proof, bank details
6. **Admin Review**: Manual verification by admin team
7. **Approval**: Worker can login and receive bookings

## 🔧 API Usage

### Authentication
```typescript
import { authAPI } from './api/auth'

// Request OTP
const otpResult = await authAPI.requestLoginOTP({
  phone: '9876543210',
  purpose: 'login'
})

// Verify and login
const loginResult = await authAPI.verifyAndLogin({
  phone: '9876543210',
  otp: '123456',
  purpose: 'login'
})
```

### Worker Onboarding
```typescript
import { workerOnboardingService } from './services/workerOnboarding'

// Start onboarding
const startResult = await workerOnboardingService.startOnboarding('9876543210', '123456')

// Update basic details
const basicResult = await workerOnboardingService.updateBasicDetails(userId, {
  fullName: 'Jane Smith',
  email: 'jane@example.com'
})
```

### Admin Verification
```typescript
import { adminVerificationService } from './services/adminVerification'

// Get pending workers
const pendingResult = await adminVerificationService.getPendingWorkers()

// Approve worker
const approveResult = await adminVerificationService.updateWorkerVerification({
  workerId: 'worker-123',
  status: 'approved',
  verifiedBy: 'admin-123'
})
```

## 🧪 Testing

### Run Tests
```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

### Test Coverage
- Unit tests for all services
- Integration tests for complete flows
- Security tests for authentication
- API endpoint tests

## 🔒 Security Features

### Rate Limiting
- **OTP Requests**: 5 per 15 minutes per phone
- **API Requests**: 100 per minute per user
- **IP-based Limits**: Additional protection per IP address

### Input Validation
- **Phone Numbers**: Indian mobile format validation
- **Email**: RFC-compliant email validation
- **XSS Protection**: HTML sanitization
- **SQL Injection**: Parameterized queries

### Authentication Security
- **OTP Expiry**: 2-minute validity window
- **Max Attempts**: 3 failed attempts before lockout
- **Token Rotation**: Refresh token mechanism
- **Device Tracking**: Monitor login devices

## 📊 Monitoring & Analytics

### Security Monitoring
- Failed login attempts
- Suspicious IP addresses
- Rate limit violations
- Audit log entries

### Business Analytics
- Worker verification rates
- Service type distribution
- Geographic distribution
- Onboarding completion rates

## 🚀 Deployment

### Production Deployment
1. **Environment Setup**: Configure production environment variables
2. **Database Migration**: Run migrations on production database
3. **Build Application**: `npm run build`
4. **Deploy**: Use your preferred deployment method

### Docker Deployment
```bash
# Build Docker image
docker build -t vowza-auth .

# Run container
docker run -p 3000:3000 --env-file .env vowza-auth
```

## 📚 API Documentation

Complete API documentation is available at:
- **Development**: http://localhost:3000/api/docs
- **Production**: https://api.vowza.com/docs

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- **Email**: support@vowza.com
- **Documentation**: https://docs.vowza.com
- **Issues**: https://github.com/vowza/event-platform/issues

## 🗺️ Roadmap

### Phase 1 (Current)
- ✅ OTP-based authentication
- ✅ Worker onboarding
- ✅ Admin verification
- ✅ Security middleware
- ✅ Notification system

### Phase 2 (Upcoming)
- 🔄 Biometric authentication
- 🔄 Advanced fraud detection
- 🔄 Multi-language support
- 🔄 Analytics dashboard

### Phase 3 (Future)
- 📋 AI-powered worker matching
- 📋 Video verification
- 📋 Blockchain credentials
- 📋 International expansion

---

**Built with ❤️ for Vowza Event Community**
