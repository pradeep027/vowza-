import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { otpService } from '../services/otp'
import { authService } from '../services/auth'
import { authAPI } from '../api/auth'
import { workerOnboardingService } from '../services/workerOnboarding'
import { adminVerificationService } from '../services/adminVerification'
import { securityMiddleware } from '../middleware/security'

// Mock Supabase client
jest.mock('../integrations/supabase/client', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(),
          order: jest.fn(() => ({
            limit: jest.fn()
          }))
        })),
        order: jest.fn(),
        limit: jest.fn(),
        insert: jest.fn(),
        update: jest.fn(),
        delete: jest.fn()
      }))
    })),
    auth: {
      admin: {
        createUser: jest.fn(),
        deleteUser: jest.fn()
      }
    }
  }
}))

describe('Authentication System', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('OTP Service', () => {
    it('should generate 6-digit OTP', () => {
      const otp = (otpService as any).generateOTP()
      expect(otp).toMatch(/^\d{6}$/)
      expect(otp.length).toBe(6)
    })

    it('should hash OTP consistently', async () => {
      const otp = '123456'
      const hash1 = await (otpService as any).hashOTP(otp)
      const hash2 = await (otpService as any).hashOTP(otp)
      expect(hash1).toBe(hash2)
      expect(hash1).toMatch(/^[a-f0-9]{64}$/) // SHA-256 hash
    })

    it('should verify correct OTP hash', async () => {
      const otp = '123456'
      const hash = await (otpService as any).hashOTP(otp)
      const isValid = await (otpService as any).verifyOTPHash(otp, hash)
      expect(isValid).toBe(true)
    })

    it('should reject incorrect OTP hash', async () => {
      const otp1 = '123456'
      const otp2 = '654321'
      const hash = await (otpService as any).hashOTP(otp1)
      const isValid = await (otpService as any).verifyOTPHash(otp2, hash)
      expect(isValid).toBe(false)
    })

    it('should validate phone number format', async () => {
      const invalidPhone = '123456'
      const result = await otpService.requestOTP({
        phone: invalidPhone,
        purpose: 'login'
      })
      expect(result.success).toBe(false)
      expect(result.message).toContain('Invalid phone number')
    })

    it('should handle rate limiting', async () => {
      const phone = '9876543210'
      
      // Make multiple requests quickly
      const requests = Array(6).fill(null).map(() => 
        otpService.requestOTP({ phone, purpose: 'login' })
      )
      
      const results = await Promise.all(requests)
      
      // First 5 should succeed, 6th should fail
      expect(results.slice(0, 5).every(r => r.success)).toBe(true)
      expect(results[5].success).toBe(false)
      expect(results[5].message).toContain('Too many OTP requests')
    })
  })

  describe('Auth Service', () => {
    it('should generate valid JWT token', async () => {
      const payload = {
        userId: 'user-123',
        phone: '9876543210',
        role: ['customer'],
        type: 'access' as const
      }
      
      const token = await (authService as any).generateToken(
        payload,
        'test-secret',
        900
      )
      
      expect(token).toMatch(/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/)
    })

    it('should verify valid JWT token', async () => {
      const payload = {
        userId: 'user-123',
        phone: '9876543210',
        role: ['customer'],
        type: 'access' as const
      }
      
      const token = await (authService as any).generateToken(
        payload,
        'test-secret',
        900
      )
      
      const verified = await (authService as any).verifyToken(token, 'test-secret')
      
      expect(verified).toBeTruthy()
      expect(verified.userId).toBe(payload.userId)
      expect(verified.phone).toBe(payload.phone)
      expect(verified.role).toEqual(payload.role)
    })

    it('should reject invalid JWT token', async () => {
      const invalidToken = 'invalid.token.here'
      const verified = await (authService as any).verifyToken(invalidToken, 'test-secret')
      expect(verified).toBeNull()
    })

    it('should check user roles correctly', () => {
      const user = {
        id: 'user-123',
        roles: ['customer', 'provider']
      }
      
      expect((authService as any).hasRole(user, 'customer')).toBe(true)
      expect((authService as any).hasRole(user, 'admin')).toBe(false)
      expect((authService as any).hasAnyRole(user, ['customer', 'admin'])).toBe(true)
      expect((authService as any).isWorker(user)).toBe(true)
      expect((authService as any).isCustomer(user)).toBe(true)
      expect((authService as any).isAdmin(user)).toBe(false)
    })
  })

  describe('Auth API', () => {
    it('should handle login request correctly', async () => {
      const mockResponse = {
        success: true,
        message: 'OTP sent successfully',
        otpId: 'test-otp-id'
      }
      
      jest.spyOn(otpService, 'requestOTP').mockResolvedValue(mockResponse)
      
      const result = await authAPI.requestLoginOTP({
        phone: '9876543210',
        purpose: 'login'
      })
      
      expect(result.success).toBe(true)
      expect(result.otpId).toBe('test-otp-id')
    })

    it('should handle login verification correctly', async () => {
      const mockAuthResult = {
        success: true,
        message: 'Authentication successful',
        user: {
          id: 'user-123',
          phone: '9876543210',
          roles: ['customer']
        },
        tokens: {
          accessToken: 'test-access-token',
          refreshToken: 'test-refresh-token',
          expiresIn: 900
        }
      }
      
      jest.spyOn(authService, 'authenticateWithOTP').mockResolvedValue(mockAuthResult)
      jest.spyOn(otpService, 'verifyOTP').mockResolvedValue({ success: true })
      
      const result = await authAPI.verifyAndLogin({
        phone: '9876543210',
        otp: '123456',
        purpose: 'login'
      })
      
      expect(result.success).toBe(true)
      expect(result.user).toBeTruthy()
      expect(result.tokens).toBeTruthy()
    })
  })
})

describe('Worker Onboarding System', () => {
  const mockUserId = 'worker-123'
  const mockPhone = '9876543210'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Worker Onboarding Service', () => {
    it('should start onboarding process', async () => {
      const mockOTPData = {
        id: 'otp-123',
        verified: true,
        created_at: new Date().toISOString()
      }
      
      const mockProfile = {
        id: mockUserId
      }
      
      const mockWorkerProfile = {
        id: 'worker-123',
        user_id: mockUserId,
        verification_status: 'pending'
      }
      
      // Mock OTP verification
      const { supabase } = require('../integrations/supabase/client')
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({ data: mockOTPData, error: null })
            })
          })
        })
      })
      
      // Mock profile lookup
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: mockProfile, error: null })
        })
      })
      
      // Mock worker profile creation
      supabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockWorkerProfile, error: null })
          })
        })
      })
      
      const result = await workerOnboardingService.startOnboarding(mockPhone, '123456')
      
      expect(result.success).toBe(true)
      expect(result.currentStep).toBe(2)
      expect(result.workerProfile).toBeTruthy()
    })

    it('should update basic details', async () => {
      const basicDetails = {
        fullName: 'Jane Smith',
        email: 'jane@example.com',
        gender: 'female' as const,
        profilePhotoUrl: 'https://example.com/photo.jpg'
      }
      
      const mockUpdatedProfile = {
        id: 'worker-123',
        full_name: 'Jane Smith',
        email: 'jane@example.com'
      }
      
      const { supabase } = require('../integrations/supabase/client')
      supabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: mockUpdatedProfile, error: null })
            })
          })
        })
      })
      
      const result = await workerOnboardingService.updateBasicDetails(mockUserId, basicDetails)
      
      expect(result.success).toBe(true)
      expect(result.currentStep).toBe(3)
    })

    it('should validate service type', async () => {
      const serviceInfo = {
        serviceType: 'invalid-service',
        experienceYears: 5,
        serviceCity: 'Mumbai'
      }
      
      const result = await workerOnboardingService.updateServiceInformation(mockUserId, serviceInfo)
      
      expect(result.success).toBe(false)
      expect(result.message).toContain('Invalid service type')
    })

    it('should get current onboarding step', async () => {
      const mockWorkerProfile = {
        full_name: 'Jane Smith',
        service_type: 'photographer',
        experience_years: 5,
        government_id_url: 'https://example.com/id.jpg',
        bank_account_number: '1234567890',
        verification_status: 'under_review'
      }
      
      const { supabase } = require('../integrations/supabase/client')
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: mockWorkerProfile, error: null })
        })
      })
      
      const result = await workerOnboardingService.getCurrentOnboardingStep(mockUserId)
      
      expect(result.success).toBe(true)
      expect(result.step).toBe(5) // Under review
    })
  })
})

describe('Admin Verification System', () => {
  const mockWorkerId = 'worker-123'
  const mockAdminId = 'admin-123'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Admin Verification Service', () => {
    it('should get pending workers', async () => {
      const mockWorkers = [
        {
          id: mockWorkerId,
          full_name: 'Jane Smith',
          phone: '9876543210',
          verification_status: 'pending'
        }
      ]
      
      const { supabase } = require('../integrations/supabase/client')
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          in: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue({ data: mockWorkers, error: null })
              })
            })
          })
        })
      })
      
      const result = await adminVerificationService.getPendingWorkers()
      
      expect(result.success).toBe(true)
      expect(result.workers).toHaveLength(1)
      expect(result.workers[0].full_name).toBe('Jane Smith')
    })

    it('should approve worker verification', async () => {
      const approvalRequest = {
        workerId: mockWorkerId,
        status: 'approved' as const,
        verifiedBy: mockAdminId
      }
      
      const mockUpdatedProfile = {
        id: mockWorkerId,
        verification_status: 'approved',
        verified_at: new Date().toISOString()
      }
      
      const { supabase } = require('../integrations/supabase/client')
      supabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: mockUpdatedProfile, error: null })
            })
          })
        })
      })
      
      const result = await adminVerificationService.updateWorkerVerification(approvalRequest)
      
      expect(result.success).toBe(true)
      expect(result.message).toContain('approved successfully')
    })

    it('should reject worker verification with reason', async () => {
      const rejectionRequest = {
        workerId: mockWorkerId,
        status: 'rejected' as const,
        rejectionReason: 'Incomplete documentation',
        verifiedBy: mockAdminId
      }
      
      const mockUpdatedProfile = {
        id: mockWorkerId,
        verification_status: 'rejected',
        rejection_reason: 'Incomplete documentation'
      }
      
      const { supabase } = require('../integrations/supabase/client')
      supabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: mockUpdatedProfile, error: null })
            })
          })
        })
      })
      
      const result = await adminVerificationService.updateWorkerVerification(rejectionRequest)
      
      expect(result.success).toBe(true)
      expect(result.message).toContain('rejected successfully')
    })

    it('should get verification statistics', async () => {
      const mockWorkers = [
        { verification_status: 'pending', service_type: 'photographer', service_city: 'Mumbai' },
        { verification_status: 'approved', service_type: 'photographer', service_city: 'Mumbai' },
        { verification_status: 'rejected', service_type: 'decorator', service_city: 'Delhi' }
      ]
      
      const { supabase } = require('../integrations/supabase/client')
      supabase.from.mockReturnValue({
        select: jest.fn().mockResolvedValue({ data: mockWorkers, error: null })
      })
      
      const result = await adminVerificationService.getVerificationStats()
      
      expect(result.success).toBe(true)
      expect(result.stats.total).toBe(3)
      expect(result.stats.pending).toBe(1)
      expect(result.stats.approved).toBe(1)
      expect(result.stats.rejected).toBe(1)
      expect(result.stats.byServiceType.photographer).toBe(2)
      expect(result.stats.byServiceType.decorator).toBe(1)
    })
  })
})

describe('Security Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Rate Limiting', () => {
    it('should allow requests within limit', async () => {
      const rateLimiter = await securityMiddleware.rateLimit({
        windowMs: 60000, // 1 minute
        maxRequests: 5
      })
      
      const mockRequest = {
        ip: '192.168.1.1',
        path: '/api/test',
        headers: { 'user-agent': 'test-agent' }
      }
      
      const result1 = await rateLimiter(mockRequest)
      const result2 = await rateLimiter(mockRequest)
      
      expect(result1.allowed).toBe(true)
      expect(result1.remaining).toBe(4)
      expect(result2.allowed).toBe(true)
      expect(result2.remaining).toBe(3)
    })

    it('should block requests exceeding limit', async () => {
      const rateLimiter = await securityMiddleware.rateLimit({
        windowMs: 60000,
        maxRequests: 2
      })
      
      const mockRequest = {
        ip: '192.168.1.1',
        path: '/api/test',
        headers: { 'user-agent': 'test-agent' }
      }
      
      await rateLimiter(mockRequest)
      await rateLimiter(mockRequest)
      const result = await rateLimiter(mockRequest)
      
      expect(result.allowed).toBe(false)
      expect(result.retryAfter).toBeGreaterThan(0)
    })
  })

  describe('Input Validation', () => {
    it('should validate email correctly', () => {
      const result1 = securityMiddleware.validateAndSanitize('test@example.com', {
        type: 'email',
        required: true
      })
      
      const result2 = securityMiddleware.validateAndSanitize('invalid-email', {
        type: 'email',
        required: true
      })
      
      expect(result1.valid).toBe(true)
      expect(result2.valid).toBe(false)
      expect(result2.errors).toContain('Must be a valid email address')
    })

    it('should validate phone number correctly', () => {
      const result1 = securityMiddleware.validateAndSanitize('9876543210', {
        type: 'phone',
        required: true
      })
      
      const result2 = securityMiddleware.validateAndSanitize('123456', {
        type: 'phone',
        required: true
      })
      
      expect(result1.valid).toBe(true)
      expect(result2.valid).toBe(false)
      expect(result2.errors).toContain('Must be a valid phone number')
    })

    it('should sanitize string input', () => {
      const input = '<script>alert("xss")</script>Hello'
      const result = securityMiddleware.validateAndSanitize(input, {
        type: 'string',
        sanitize: true
      })
      
      expect(result.valid).toBe(true)
      expect(result.sanitized).not.toContain('<script>')
      expect(result.sanitized).toContain('Hello')
    })

    it('should validate string length', () => {
      const result1 = securityMiddleware.validateAndSanitize('Hello', {
        type: 'string',
        minLength: 3,
        maxLength: 10
      })
      
      const result2 = securityMiddleware.validateAndSanitize('Hi', {
        type: 'string',
        minLength: 3
      })
      
      const result3 = securityMiddleware.validateAndSanitize('This is a very long string', {
        type: 'string',
        maxLength: 10
      })
      
      expect(result1.valid).toBe(true)
      expect(result2.valid).toBe(false)
      expect(result2.errors).toContain('Must be at least 3 characters long')
      expect(result3.valid).toBe(false)
      expect(result3.errors).toContain('Must be no more than 10 characters long')
    })
  })

  describe('Security Check', () => {
    it('should detect suspicious patterns', async () => {
      const mockRequest = {
        ip: '192.168.1.1',
        path: '/api/login',
        method: 'POST',
        body: { username: "admin'; DROP TABLE users; --" },
        headers: { 'user-agent': 'test-agent' }
      }
      
      const result = await securityMiddleware.securityCheck(mockRequest)
      
      expect(result.allowed).toBe(false)
      expect(result.riskScore).toBeGreaterThan(50)
      expect(result.recommendations).toContain('Suspicious pattern detected: drop table')
    })

    it('should block IP after too many attempts', async () => {
      const mockRequest = {
        ip: '192.168.1.1',
        path: '/api/login',
        method: 'POST'
      }
      
      // Make multiple requests quickly
      for (let i = 0; i < 6; i++) {
        await securityMiddleware.securityCheck(mockRequest)
      }
      
      const result = await securityMiddleware.securityCheck(mockRequest)
      
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('IP is temporarily blocked')
    })
  })
})

describe('Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should complete full user login flow', async () => {
    // 1. Request OTP
    jest.spyOn(otpService, 'requestOTP').mockResolvedValue({
      success: true,
      message: 'OTP sent successfully',
      otpId: 'test-otp-id'
    })
    
    const otpRequest = await authAPI.requestLoginOTP({
      phone: '9876543210',
      purpose: 'login'
    })
    
    expect(otpRequest.success).toBe(true)
    
    // 2. Verify OTP and login
    jest.spyOn(otpService, 'verifyOTP').mockResolvedValue({
      success: true
    })
    
    jest.spyOn(authService, 'authenticateWithOTP').mockResolvedValue({
      success: true,
      message: 'Authentication successful',
      user: {
        id: 'user-123',
        phone: '9876543210',
        roles: ['customer']
      },
      tokens: {
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresIn: 900
      }
    })
    
    const loginResult = await authAPI.verifyAndLogin({
      phone: '9876543210',
      otp: '123456',
      purpose: 'login'
    })
    
    expect(loginResult.success).toBe(true)
    expect(loginResult.user).toBeTruthy()
    expect(loginResult.tokens).toBeTruthy()
  })

  it('should complete full worker onboarding flow', async () => {
    const userId = 'worker-123'
    
    // Step 1: Start onboarding
    jest.spyOn(otpService, 'verifyOTP').mockResolvedValue({
      success: true
    })
    
    const startResult = await workerOnboardingService.startOnboarding('9876543210', '123456')
    expect(startResult.success).toBe(true)
    
    // Step 2: Update basic details
    const basicDetails = {
      fullName: 'Jane Smith',
      email: 'jane@example.com'
    }
    
    const basicResult = await workerOnboardingService.updateBasicDetails(userId, basicDetails)
    expect(basicResult.success).toBe(true)
    
    // Step 3: Update service information
    const serviceInfo = {
      serviceType: 'photographer',
      experienceYears: 5,
      serviceCity: 'Mumbai'
    }
    
    const serviceResult = await workerOnboardingService.updateServiceInformation(userId, serviceInfo)
    expect(serviceResult.success).toBe(true)
    
    // Step 4: Upload documents
    const documents = {
      governmentIdType: 'aadhaar' as const,
      governmentIdUrl: 'https://example.com/aadhaar.jpg',
      bankAccountHolder: 'Jane Smith',
      bankAccountNumber: '1234567890',
      bankName: 'State Bank of India',
      bankIfsc: 'SBIN0001234'
    }
    
    const docResult = await workerOnboardingService.uploadDocuments(userId, documents)
    expect(docResult.success).toBe(true)
    expect(docResult.currentStep).toBe(5)
  })
})
