export interface OTPRequest {
  phone: string
  purpose: 'login' | 'worker_onboarding' | 'password_reset'
  /** Deprecated: the server derives these values from the request. */
  ipAddress?: string
  /** Deprecated: the server derives these values from the request. */
  userAgent?: string
}

export interface OTPVerification {
  phone: string
  otp: string
  purpose: string
  /** Deprecated: the server derives these values from the request. */
  ipAddress?: string
  /** Deprecated: the server derives these values from the request. */
  userAgent?: string
}

export interface OTPResponse {
  success: boolean
  message: string
  otpId?: string
  expiresAt?: string
  remainingAttempts?: number
  accessToken?: string
  refreshToken?: string
  expiresIn?: number
  user?: any
  requiresOnboarding?: boolean
}

const functionBaseUrl = (): string | null => {
  const url = String(import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '')
  return url || null
}

const publishableKey = (): string | null => {
  const key = String(
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    '',
  ).trim()
  return key || null
}

async function invokeAuthOtp<T extends OTPResponse>(
  endpoint: 'request' | 'verify',
  body: Record<string, unknown>,
): Promise<T> {
  const baseUrl = functionBaseUrl()
  const key = publishableKey()
  if (!baseUrl || !key) {
    return { success: false, message: 'Authentication service is not configured.' } as T
  }

  try {
    const response = await fetch(`${baseUrl}/functions/v1/auth-otp/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
    })
    const payload = await response.json().catch(() => null) as T | null
    if (!response.ok || !payload) {
      return {
        success: false,
        message: payload?.message || 'Authentication service unavailable.',
      } as T
    }
    return payload
  } catch {
    return { success: false, message: 'Authentication service unavailable.' } as T
  }
}

class OTPService {
  /**
   * Request OTP. Generation, HMAC storage, SMS delivery, and rate limiting
   * happen inside the auth-otp Edge Function; no OTP secret is present here.
   */
  async requestOTP(request: OTPRequest): Promise<OTPResponse> {
    if (!request.phone || !request.purpose) {
      return { success: false, message: 'Invalid request parameters' }
    }
    return invokeAuthOtp('request', {
      phone: request.phone,
      purpose: request.purpose,
    })
  }

  /**
   * Verify OTP. The Edge Function verifies the code and mints the Supabase
   * session server-side. The browser only adopts the returned session.
   */
  async verifyOTP(request: OTPVerification): Promise<OTPResponse> {
    if (!request.phone || !request.otp || !request.purpose) {
      return { success: false, message: 'Invalid request parameters' }
    }
    return invokeAuthOtp('verify', {
      phone: request.phone,
      otp: request.otp,
      purpose: request.purpose,
    })
  }

  /** Expired OTP cleanup is owned by the server-side auth-otp flow. */
  async cleanupExpiredOTPs(): Promise<void> {
    return Promise.resolve()
  }

  /** Rate-limit cleanup is owned by the server-side auth-otp flow. */
  async cleanupOldRateLimits(): Promise<void> {
    return Promise.resolve()
  }
}

export const otpService = new OTPService()
