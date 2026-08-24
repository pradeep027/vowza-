import { supabase } from '../integrations/supabase/client'
import type { Database } from '../integrations/supabase/types'

declare global {
  interface Window {
    process?: any
  }
}

const getProcessEnv = (key: string): string | undefined => {
  if (typeof window !== 'undefined' && window.process?.env) {
    return window.process.env[key]
  }
  // Fallback for Vite environment variables
  const viteKey = `VITE_${key}`
  return (import.meta.env as any)?.[viteKey] || undefined
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
  private readonly JWT_SECRET = getProcessEnv('JWT_SECRET') || (typeof process !== 'undefined' ? process.env?.JWT_SECRET : undefined) || ''
  private readonly REFRESH_JWT_SECRET = getProcessEnv('REFRESH_JWT_SECRET') || (typeof process !== 'undefined' ? process.env?.REFRESH_JWT_SECRET : undefined) || ''

  constructor() {
    this.supabase = supabase
    // Warn in development if secrets are not configured (never use hardcoded fallbacks)
    if (!this.JWT_SECRET || !this.REFRESH_JWT_SECRET) {
      console.warn('[AuthService] ⚠️ JWT_SECRET and/or REFRESH_JWT_SECRET not configured. Token operations will fail. Set VITE_JWT_SECRET and VITE_REFRESH_JWT_SECRET in .env')
    }
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
   * OTP authentication and new-user creation are owned by the auth-otp Edge
   * Function. The browser adopts only the Supabase session it returns.
   */

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
