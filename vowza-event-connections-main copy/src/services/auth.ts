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

export interface JWTPayload {
  userId: string
  phone?: string
  role: string[]
  iat: number
  exp: number
  type: 'access' | 'refresh'
}

export interface AuthUser {
  id: string
  phone?: string
  email?: string
  fullName?: string
  roles: string[]
  avatarUrl?: string
  isVerified: boolean
}

export interface TokenPair {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

class AuthService {
  private supabase
  private readonly ACCESS_TOKEN_EXPIRY = 60 * 15 // 15 minutes
  private readonly REFRESH_TOKEN_EXPIRY = 60 * 60 * 24 * 7 // 7 days
  private readonly JWT_SECRET = getProcessEnv('JWT_SECRET') || 'your-super-secret-jwt-key-change-in-production'
  private readonly REFRESH_JWT_SECRET = getProcessEnv('REFRESH_JWT_SECRET') || 'your-super-secret-refresh-key-change-in-production'

  constructor() {
    this.supabase = supabase
  }

  /**
   * Import JWT key for crypto operations
   */
  private async importKey(secret: string): Promise<CryptoKey> {
    const encoder = new TextEncoder()
    const keyData = encoder.encode(secret)
    return await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify']
    )
  }
  /**
   * Generate JWT token
   */
  private async generateToken(
    payload: Omit<JWTPayload, 'iat' | 'exp'>,
    secret: string,
    expiresIn: number
  ): Promise<string> {
    const header = { alg: 'HS256', typ: 'JWT' }
    const now = Math.floor(Date.now() / 1000)
    const tokenPayload = {
      ...payload,
      iat: now,
      exp: now + expiresIn
    }

    const encoder = new TextEncoder()
    
    // Encode header
    const headerEncoded = btoa(JSON.stringify(header))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '')

    // Encode payload
    const payloadEncoded = btoa(JSON.stringify(tokenPayload))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '')

    // Create signature
    const key = await this.importKey(secret)
    const data = encoder.encode(`${headerEncoded}.${payloadEncoded}`)
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, data)
    const signature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => String.fromCharCode(b))
      .join('')
    
    const signatureEncoded = btoa(signature)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '')

    return `${headerEncoded}.${payloadEncoded}.${signatureEncoded}`
  }

  /**
   * Verify JWT token
   */
  private async verifyToken(token: string, secret: string): Promise<JWTPayload | null> {
    try {
      const parts = token.split('.')
      if (parts.length !== 3) {
        return null
      }

      const [headerEncoded, payloadEncoded, signatureEncoded] = parts
      
      // Decode payload
      const payload = JSON.parse(atob(payloadEncoded.replace(/-/g, '+').replace(/_/g, '/')))
      
      // Check expiration
      if (payload.exp && Math.floor(Date.now() / 1000) >= payload.exp) {
        return null
      }

      // Verify signature
      const encoder = new TextEncoder()
      const data = encoder.encode(`${headerEncoded}.${payloadEncoded}`)
      const key = await this.importKey(secret)
      
      // Decode signature
      const signature = atob(signatureEncoded.replace(/-/g, '+').replace(/_/g, '/'))
      const signatureBuffer = new Uint8Array(Array.from(signature).map(char => char.charCodeAt(0)))
      
      const isValid = await crypto.subtle.verify('HMAC', key, signatureBuffer, data)
      
      if (!isValid) {
        return null
      }

      return payload as JWTPayload
    } catch (error) {
      console.error('Token verification error:', error)
      return null
    }
  }

  /**
   * Get user from database
   */
  private async getUserFromDB(userId: string): Promise<AuthUser | null> {
    try {
      // Get profile
      const { data: profile, error: profileError } = await this.supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (profileError) {
        console.error('Profile fetch error:', profileError)
        return null
      }

      // Get user roles
      const { data: roles, error: rolesError } = await this.supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)

      if (rolesError) {
        console.error('Roles fetch error:', rolesError)
        return null
      }

      // Check if user is a verified worker
      const { data: workerProfile } = await this.supabase
        .from('worker_profiles')
        .select('verification_status')
        .eq('user_id', userId)
        .single()

      const isVerified = workerProfile?.verification_status === 'approved'

      return {
        id: profile.id,
        phone: profile.phone,
        email: profile.email,
        fullName: profile.full_name,
        roles: roles.map(r => r.role),
        avatarUrl: profile.avatar_url,
        isVerified
      }
    } catch (error) {
      console.error('User fetch error:', error)
      return null
    }
  }

  /**
   * Create user in Supabase Auth
   */
  private async createSupabaseUser(phone: string, email?: string, fullName?: string): Promise<string | null> {
    try {
      // Generate a random email for Supabase Auth if not provided
      const authEmail = email || `${phone}@vowza.local`
      
      const { data, error } = await this.supabase.auth.admin.createUser({
        email: authEmail,
        phone: phone.startsWith('+') ? phone : `+91${phone}`,
        email_confirm: true,
        phone_confirm: true,
        user_metadata: {
          full_name: fullName,
          phone: phone
        }
      })

      if (error) {
        console.error('Supabase user creation error:', error)
        return null
      }

      // Create profile
      const { error: profileError } = await this.supabase
        .from('profiles')
        .insert({
          id: data.user.id,
          full_name: fullName || '',
          phone: phone,
          email: email
        })

      if (profileError) {
        console.error('Profile creation error:', profileError)
        return null
      }

      // Assign default customer role
      const { error: roleError } = await this.supabase
        .from('user_roles')
        .insert({
          user_id: data.user.id,
          role: 'customer'
        })

      if (roleError) {
        console.error('Role assignment error:', roleError)
        return null
      }

      return data.user.id
    } catch (error) {
      console.error('User creation error:', error)
      return null
    }
  }

  /**
   * Authenticate user with OTP and generate tokens
   */
  async authenticateWithOTP(
    phone: string, 
    purpose: 'login' | 'worker_onboarding',
    deviceInfo?: any,
    ipAddress?: string
  ): Promise<{ success: boolean; message: string; tokens?: TokenPair; user?: AuthUser }> {
    try {
      // Find verified OTP
      const { data: otpData, error: otpError } = await this.supabase
        .from('otp_verifications')
        .select('*')
        .eq('phone', phone)
        .eq('purpose', purpose)
        .eq('verified', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (otpError || !otpData) {
        return { success: false, message: 'OTP not verified. Please verify OTP first.' }
      }

      // Check if OTP is still valid (within 5 minutes of verification)
      const verificationTime = new Date(otpData.created_at)
      const now = new Date()
      const timeDiff = (now.getTime() - verificationTime.getTime()) / 1000 / 60 // minutes

      if (timeDiff > 5) {
        return { success: false, message: 'OTP verification expired. Please request a new OTP.' }
      }

      // Find or create user
      let userId: string | null = null
      
      const { data: existingProfile } = await this.supabase
        .from('profiles')
        .select('id')
        .eq('phone', phone)
        .single()

      if (existingProfile) {
        userId = existingProfile.id
      } else {
        // Create new user
        userId = await this.createSupabaseUser(phone)
        if (!userId) {
          return { success: false, message: 'Failed to create user account' }
        }
      }

      // Get user data
      const user = await this.getUserFromDB(userId)
      if (!user) {
        return { success: false, message: 'User not found' }
      }

      // For worker onboarding, check if user is already a worker
      if (purpose === 'worker_onboarding') {
        const { data: workerProfile } = await this.supabase
          .from('worker_profiles')
          .select('id')
          .eq('user_id', userId)
          .single()

        if (workerProfile) {
          return { success: false, message: 'You have already started the worker onboarding process.' }
        }
      }

      // Generate tokens
      const accessToken = await this.generateToken(
        {
          userId: user.id,
          phone: user.phone,
          role: user.roles,
          type: 'access'
        },
        this.JWT_SECRET,
        this.ACCESS_TOKEN_EXPIRY
      )

      const refreshToken = await this.generateToken(
        {
          userId: user.id,
          phone: user.phone,
          role: user.roles,
          type: 'refresh'
        },
        this.REFRESH_JWT_SECRET,
        this.REFRESH_TOKEN_EXPIRY
      )

      // Store refresh token
      const refreshTokenHash = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(refreshToken)
      )
      
      const refreshTokenHashString = Array.from(new Uint8Array(refreshTokenHash))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')

      await this.supabase
        .from('refresh_tokens')
        .insert({
          user_id: user.id,
          token_hash: refreshTokenHashString,
          device_info: deviceInfo,
          ip_address: ipAddress,
          expires_at: new Date(Date.now() + this.REFRESH_TOKEN_EXPIRY * 1000).toISOString()
        })

      // Mark OTP as used
      await this.supabase
        .from('otp_verifications')
        .update({ verified: true })
        .eq('id', otpData.id)

      return {
        success: true,
        message: 'Authentication successful',
        tokens: {
          accessToken,
          refreshToken,
          expiresIn: this.ACCESS_TOKEN_EXPIRY
        },
        user
      }

    } catch (error) {
      console.error('Authentication error:', error)
      return { success: false, message: 'Authentication failed' }
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<{ success: boolean; message: string; accessToken?: string }> {
    try {
      // Verify refresh token
      const payload = await this.verifyToken(refreshToken, this.REFRESH_JWT_SECRET)
      if (!payload || payload.type !== 'refresh') {
        return { success: false, message: 'Invalid refresh token' }
      }

      // Check if refresh token exists and is not revoked
      const refreshTokenHash = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(refreshToken)
      )
      
      const refreshTokenHashString = Array.from(new Uint8Array(refreshTokenHash))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')

      const { data: tokenData, error: tokenError } = await this.supabase
        .from('refresh_tokens')
        .select('*')
        .eq('token_hash', refreshTokenHashString)
        .eq('user_id', payload.userId)
        .eq('is_revoked', false)
        .single()

      if (tokenError || !tokenData) {
        return { success: false, message: 'Refresh token not found or revoked' }
      }

      // Check if refresh token has expired
      if (new Date() > new Date(tokenData.expires_at)) {
        await this.supabase
          .from('refresh_tokens')
          .update({ is_revoked: true })
          .eq('id', tokenData.id)
        return { success: false, message: 'Refresh token expired' }
      }

      // Get updated user data
      const user = await this.getUserFromDB(payload.userId)
      if (!user) {
        return { success: false, message: 'User not found' }
      }

      // Generate new access token
      const accessToken = await this.generateToken(
        {
          userId: user.id,
          phone: user.phone,
          role: user.roles,
          type: 'access'
        },
        this.JWT_SECRET,
        this.ACCESS_TOKEN_EXPIRY
      )

      // Update last used timestamp
      await this.supabase
        .from('refresh_tokens')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', tokenData.id)

      return {
        success: true,
        message: 'Token refreshed successfully',
        accessToken
      }

    } catch (error) {
      console.error('Token refresh error:', error)
      return { success: false, message: 'Token refresh failed' }
    }
  }

  /**
   * Logout user (revoke refresh token)
   */
  async logout(refreshToken: string): Promise<{ success: boolean; message: string }> {
    try {
      const payload = await this.verifyToken(refreshToken, this.REFRESH_JWT_SECRET)
      if (!payload) {
        return { success: false, message: 'Invalid token' }
      }

      const refreshTokenHash = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(refreshToken)
      )
      
      const refreshTokenHashString = Array.from(new Uint8Array(refreshTokenHash))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')

      await this.supabase
        .from('refresh_tokens')
        .update({ is_revoked: true })
        .eq('token_hash', refreshTokenHashString)
        .eq('user_id', payload.userId)

      return { success: true, message: 'Logged out successfully' }
    } catch (error) {
      console.error('Logout error:', error)
      return { success: false, message: 'Logout failed' }
    }
  }

  /**
   * Verify access token and get user
   */
  async verifyAccessToken(token: string): Promise<{ success: boolean; user?: AuthUser; message: string }> {
    try {
      const payload = await this.verifyToken(token, this.JWT_SECRET)
      if (!payload || payload.type !== 'access') {
        return { success: false, message: 'Invalid access token' }
      }

      const user = await this.getUserFromDB(payload.userId)
      if (!user) {
        return { success: false, message: 'User not found' }
      }

      return { success: true, user, message: 'Token valid' }
    } catch (error) {
      console.error('Access token verification error:', error)
      return { success: false, message: 'Token verification failed' }
    }
  }

  /**
   * Check if user has required role
   */
  hasRole(user: AuthUser, requiredRole: string): boolean {
    return user.roles.includes(requiredRole)
  }

  /**
   * Check if user has any of the required roles
   */
  hasAnyRole(user: AuthUser, requiredRoles: string[]): boolean {
    return requiredRoles.some(role => user.roles.includes(role))
  }

  /**
   * Check if user is admin
   */
  isAdmin(user: AuthUser): boolean {
    return this.hasRole(user, 'admin')
  }

  /**
   * Check if user is worker (provider)
   */
  isWorker(user: AuthUser): boolean {
    return this.hasRole(user, 'provider')
  }

  /**
   * Check if user is customer
   */
  isCustomer(user: AuthUser): boolean {
    return this.hasRole(user, 'customer')
  }
}

export const authService = new AuthService()
