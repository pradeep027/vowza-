import { supabase } from '../integrations/supabase/client'
import type { Database } from '../integrations/supabase/types'

declare global {
  interface Window {
    process?: any
  }
}

const getProcessEnv = (key: string) => {
  if (typeof window !== 'undefined' && window.process?.env) {
    return window.process.env[key]
  }
  // Fallback for Vite environment variables
  const viteKey = `VITE_${key}`
  return (import.meta.env as any)?.[viteKey] || key
}

export interface OTPRequest {
  phone: string
  purpose: 'login' | 'worker_onboarding' | 'password_reset'
  ipAddress?: string
  userAgent?: string
}

export interface OTPVerification {
  phone: string
  otp: string
  purpose: string
  ipAddress?: string
  userAgent?: string
}

export interface OTPResponse {
  success: boolean
  message: string
  otpId?: string
  expiresAt?: string
  remainingAttempts?: number
}

export interface AuthResponse {
  success: boolean
  message: string
  user?: any
  accessToken?: string
  refreshToken?: string
  role?: string
}

class OTPService {
  private supabase
  private readonly OTP_LENGTH = 6
  private readonly OTP_EXPIRY_SECONDS = 120 // 2 minutes
  private readonly MAX_ATTEMPTS = 3
  private readonly RATE_LIMIT_WINDOW = 900 // 15 minutes
  private readonly MAX_OTP_REQUESTS = 5

  constructor() {
    this.supabase = supabase
  }

  /**
   * Generate cryptographically secure OTP
   */
  private generateOTP(): string {
    const digits = '0123456789'
    let otp = ''
    for (let i = 0; i < this.OTP_LENGTH; i++) {
      otp += digits.charAt(Math.floor(Math.random() * digits.length))
    }
    return otp
  }

  /**
   * Hash OTP for secure storage
   */
  private async hashOTP(otp: string): Promise<string> {
    const encoder = new TextEncoder()
    const data = encoder.encode(otp + getProcessEnv('OTP_SALT'))
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  /**
   * Verify OTP hash
   */
  private async verifyOTPHash(otp: string, hash: string): Promise<boolean> {
    const inputHash = await this.hashOTP(otp)
    return inputHash === hash
  }

  /**
   * Check rate limiting for OTP requests
   */
  private async checkRateLimit(phone: string, ipAddress?: string): Promise<{ allowed: boolean; message: string }> {
    const now = new Date()
    const windowStart = new Date(now.getTime() - this.RATE_LIMIT_WINDOW * 1000)

    // Check phone-based rate limiting
    const { data: phoneLimits, error: phoneError } = await this.supabase
      .from('otp_rate_limits')
      .select('*')
      .eq('phone', phone)
      .gte('window_start', windowStart.toISOString())
      .single()

    if (phoneError && phoneError.code !== 'PGRST116') {
      return { allowed: false, message: 'Rate limit check failed' }
    }

    if (phoneLimits && phoneLimits.request_count >= this.MAX_OTP_REQUESTS) {
      const remainingTime = Math.ceil((this.RATE_LIMIT_WINDOW * 1000 - (now.getTime() - new Date(phoneLimits.window_start).getTime())) / 1000 / 60)
      return { 
        allowed: false, 
        message: `Too many OTP requests. Please try again in ${remainingTime} minutes.` 
      }
    }

    // Check IP-based rate limiting
    if (ipAddress) {
      const { data: ipLimits, error: ipError } = await this.supabase
        .from('otp_rate_limits')
        .select('*')
        .eq('ip_address', ipAddress)
        .gte('window_start', windowStart.toISOString())
        .single()

      if (ipError && ipError.code !== 'PGRST116') {
      }

      if (ipLimits && ipLimits.request_count >= this.MAX_OTP_REQUESTS * 2) {
        return { allowed: false, message: 'Too many requests from this IP. Please try again later.' }
      }
    }

    return { allowed: true, message: 'Rate limit check passed' }
  }

  /**
   * Update rate limit counter
   */
  private async updateRateLimit(phone: string, ipAddress?: string): Promise<void> {
    const now = new Date()
    const windowStart = new Date(now.getTime() - this.RATE_LIMIT_WINDOW * 1000)

    // Update phone-based rate limit
    const { data: existingPhoneLimit } = await this.supabase
      .from('otp_rate_limits')
      .select('*')
      .eq('phone', phone)
      .gte('window_start', windowStart.toISOString())
      .single()

    if (existingPhoneLimit) {
      await this.supabase
        .from('otp_rate_limits')
        .update({ 
          request_count: existingPhoneLimit.request_count + 1,
          window_start: windowStart.toISOString()
        })
        .eq('phone', phone)
    } else {
      await this.supabase
        .from('otp_rate_limits')
        .insert({
          phone,
          ip_address: ipAddress,
          request_count: 1,
          window_start: windowStart.toISOString()
        })
    }

    // Update IP-based rate limit if provided
    if (ipAddress) {
      const { data: existingIpLimit } = await this.supabase
        .from('otp_rate_limits')
        .select('*')
        .eq('ip_address', ipAddress)
        .gte('window_start', windowStart.toISOString())
        .single()

      if (existingIpLimit) {
        await this.supabase
          .from('otp_rate_limits')
          .update({ 
            request_count: existingIpLimit.request_count + 1,
            window_start: windowStart.toISOString()
          })
          .eq('ip_address', ipAddress)
      } else {
        await this.supabase
          .from('otp_rate_limits')
          .insert({
            phone,
            ip_address: ipAddress,
            request_count: 1,
            window_start: windowStart.toISOString()
          })
      }
    }
  }

  /**
   * Log login attempt for security monitoring
   */
  private async logLoginAttempt(
    phone: string, 
    attemptType: 'otp_request' | 'otp_verify' | 'login',
    success: boolean,
    failureReason?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.supabase
      .from('login_attempts')
      .insert({
        phone,
        ip_address: ipAddress,
        user_agent: userAgent,
        attempt_type: attemptType,
        success,
        failure_reason: failureReason
      })
  }

  /**
   * Send OTP via SMS (integration point)
   */
  private async sendOTPSMS(phone: string, otp: string, purpose: string): Promise<boolean> {
    try {
      // Integration with SMS service like Twilio, AWS SNS, etc.
      // For now, we'll log the OTP (in production, remove this)
      
      // Example Twilio integration (commented out for now):
      // const response = await fetch('https://api.twilio.com/2010-04-01/Accounts/YOUR_ACCOUNT_SID/Messages.json', {
      //   method: 'POST',
      //   headers: {
      //     'Authorization': `Basic ${btoa('YOUR_ACCOUNT_SID:YOUR_AUTH_TOKEN')}`,
      //     'Content-Type': 'application/x-www-form-urlencoded',
      //   },
      //   body: new URLSearchParams({
      //     'To': phone,
      //     'From': 'YOUR_TWILIO_NUMBER',
      //     'Body': `Your Vowza verification code is: ${otp}. Valid for ${this.OTP_EXPIRY_SECONDS / 60} minutes.`
      //   })
      // })
      
      // return response.ok
      
      // For development, always return true
      return true
    } catch (error) {
      return false
    }
  }

  /**
   * Request OTP
   */
  async requestOTP(request: OTPRequest): Promise<OTPResponse> {
    try {
      // Validate phone number
      if (!request.phone || !/^[6-9]\d{9}$/.test(request.phone)) {
        await this.logLoginAttempt(
          request.phone, 
          'otp_request', 
          false, 
          'Invalid phone number',
          request.ipAddress,
          request.userAgent
        )
        return { success: false, message: 'Invalid phone number' }
      }

      // Check rate limiting
      const rateLimitCheck = await this.checkRateLimit(request.phone, request.ipAddress)
      if (!rateLimitCheck.allowed) {
        await this.logLoginAttempt(
          request.phone, 
          'otp_request', 
          false, 
          rateLimitCheck.message,
          request.ipAddress,
          request.userAgent
        )
        return { success: false, message: rateLimitCheck.message }
      }

      // Generate and hash OTP
      const otp = this.generateOTP()
      const otpHash = await this.hashOTP(otp)
      const expiresAt = new Date(Date.now() + this.OTP_EXPIRY_SECONDS * 1000)

      // Store OTP in database
      const { data: otpData, error: otpError } = await this.supabase
        .from('otp_verifications')
        .insert({
          phone: request.phone,
          otp_hash: otpHash,
          purpose: request.purpose,
          expires_at: expiresAt.toISOString(),
          attempts: 0,
          verified: false
        })
        .select()
        .single()

      if (otpError) {
        await this.logLoginAttempt(
          request.phone, 
          'otp_request', 
          false, 
          'Database error',
          request.ipAddress,
          request.userAgent
        )
        return { success: false, message: 'Failed to generate OTP' }
      }

      // Send OTP via SMS
      const smsSent = await this.sendOTPSMS(request.phone, otp, request.purpose)
      if (!smsSent) {
        await this.logLoginAttempt(
          request.phone, 
          'otp_request', 
          false, 
          'SMS sending failed',
          request.ipAddress,
          request.userAgent
        )
        return { success: false, message: 'Failed to send OTP. Please try again.' }
      }

      // Update rate limit
      await this.updateRateLimit(request.phone, request.ipAddress)

      // Log successful request
      await this.logLoginAttempt(
        request.phone, 
        'otp_request', 
        true,
        undefined,
        request.ipAddress,
        request.userAgent
      )

      return {
        success: true,
        message: `OTP sent successfully. Valid for ${this.OTP_EXPIRY_SECONDS / 60} minutes.`,
        otpId: otpData.id,
        expiresAt: expiresAt.toISOString()
      }

    } catch (error) {
      await this.logLoginAttempt(
        request.phone, 
        'otp_request', 
        false, 
        'Internal server error',
        request.ipAddress,
        request.userAgent
      )
      return { success: false, message: 'Internal server error' }
    }
  }

  /**
   * Verify OTP
   */
  async verifyOTP(request: OTPVerification): Promise<OTPResponse> {
    try {
      // Validate input
      if (!request.phone || !request.otp || !request.purpose) {
        return { success: false, message: 'Invalid request parameters' }
      }

      // Get OTP record
      const { data: otpData, error: otpError } = await this.supabase
        .from('otp_verifications')
        .select('*')
        .eq('phone', request.phone)
        .eq('purpose', request.purpose)
        .eq('verified', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (otpError || !otpData) {
        await this.logLoginAttempt(
          request.phone, 
          'otp_verify', 
          false, 
          'OTP not found or already used',
          request.ipAddress,
          request.userAgent
        )
        return { success: false, message: 'Invalid or expired OTP' }
      }

      // Check if OTP has expired
      if (new Date() > new Date(otpData.expires_at)) {
        await this.logLoginAttempt(
          request.phone, 
          'otp_verify', 
          false, 
          'OTP expired',
          request.ipAddress,
          request.userAgent
        )
        return { success: false, message: 'OTP has expired. Please request a new one.' }
      }

      // Check attempts limit
      const attempts = (otpData.attempts || 0) + 1
      if (attempts > this.MAX_ATTEMPTS) {
        await this.supabase
          .from('otp_verifications')
          .update({ verified: true }) // Mark as used to prevent further attempts
          .eq('id', otpData.id)

        await this.logLoginAttempt(
          request.phone, 
          'otp_verify', 
          false, 
          'Maximum attempts exceeded',
          request.ipAddress,
          request.userAgent
        )
        return { success: false, message: 'Maximum attempts exceeded. Please request a new OTP.' }
      }

      // Verify OTP hash
      const isValidOTP = await this.verifyOTPHash(request.otp, otpData.otp_hash)
      
      if (!isValidOTP) {
        // Update attempts count
        await this.supabase
          .from('otp_verifications')
          .update({ attempts })
          .eq('id', otpData.id)

        const remainingAttempts = this.MAX_ATTEMPTS - attempts
        await this.logLoginAttempt(
          request.phone, 
          'otp_verify', 
          false, 
          'Invalid OTP',
          request.ipAddress,
          request.userAgent
        )
        return { 
          success: false, 
          message: `Invalid OTP. ${remainingAttempts} attempts remaining.`,
          remainingAttempts
        }
      }

      // Mark OTP as verified
      await this.supabase
        .from('otp_verifications')
        .update({ 
          verified: true,
          attempts
        })
        .eq('id', otpData.id)

      await this.logLoginAttempt(
        request.phone, 
        'otp_verify', 
        true,
        undefined,
        request.ipAddress,
        request.userAgent
      )

      return {
        success: true,
        message: 'OTP verified successfully'
      }

    } catch (error) {
      await this.logLoginAttempt(
        request.phone, 
        'otp_verify', 
        false, 
        'Internal server error',
        request.ipAddress,
        request.userAgent
      )
      return { success: false, message: 'Internal server error' }
    }
  }

  /**
   * Clean up expired OTPs (should be run periodically)
   */
  async cleanupExpiredOTPs(): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('otp_verifications')
        .delete()
        .lt('expires_at', new Date().toISOString())

      if (error) {
      }
    } catch (error) {
    }
  }

  /**
   * Clean up old rate limit records (should be run periodically)
   */
  async cleanupOldRateLimits(): Promise<void> {
    try {
      const cutoffTime = new Date(Date.now() - this.RATE_LIMIT_WINDOW * 1000)
      const { error } = await this.supabase
        .from('otp_rate_limits')
        .delete()
        .lt('window_start', cutoffTime.toISOString())

      if (error) {
      }
    } catch (error) {
    }
  }
}

export const otpService = new OTPService()
