import { otpService, type OTPRequest, type OTPVerification } from '../services/otp'
import { authService, type AuthUser, type TokenPair } from '../services/auth'

export interface LoginRequest {
  phone: string
  purpose: 'login' | 'worker_onboarding'
  deviceInfo?: any
  ipAddress?: string
  userAgent?: string
}

export interface RegisterRequest {
  phone: string
  fullName?: string
  email?: string
  deviceInfo?: any
  ipAddress?: string
  userAgent?: string
}

export interface AuthResponse {
  success: boolean
  message: string
  user?: AuthUser
  tokens?: TokenPair
  requiresOnboarding?: boolean
}

class AuthAPI {
  /**
   * Request OTP for login
   */
  async requestLoginOTP(request: OTPRequest): Promise<{ success: boolean; message: string; otpId?: string; expiresAt?: string }> {
    try {
      const result = await otpService.requestOTP({
        phone: request.phone,
        purpose: request.purpose,
        ipAddress: request.ipAddress,
        userAgent: request.userAgent
      })

      return {
        success: result.success,
        message: result.message,
        otpId: result.otpId,
        expiresAt: result.expiresAt
      }
    } catch (error) {
      console.error('Login OTP request error:', error)
      return { success: false, message: 'Failed to send OTP' }
    }
  }

  /**
   * Verify OTP and login user
   */
  async verifyAndLogin(request: LoginRequest & { otp: string }): Promise<AuthResponse> {
    try {
      // First verify OTP
      const otpResult = await otpService.verifyOTP({
        phone: request.phone,
        otp: request.otp,
        purpose: request.purpose,
        ipAddress: request.ipAddress,
        userAgent: request.userAgent
      })

      if (!otpResult.success) {
        return {
          success: false,
          message: otpResult.message
        }
      }

      // Authenticate user and generate tokens
      const authResult = await authService.authenticateWithOTP(
        request.phone,
        request.purpose,
        request.deviceInfo,
        request.ipAddress
      )

      if (!authResult.success) {
        return {
          success: false,
          message: authResult.message
        }
      }

      // Check if user needs onboarding (for workers)
      const requiresOnboarding = request.purpose === 'worker_onboarding'

      return {
        success: true,
        message: authResult.message,
        user: authResult.user,
        tokens: authResult.tokens,
        requiresOnboarding
      }
    } catch (error) {
      console.error('Login verification error:', error)
      return { success: false, message: 'Login failed' }
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<{ success: boolean; message: string; accessToken?: string }> {
    try {
      const result = await authService.refreshToken(refreshToken)
      return result
    } catch (error) {
      console.error('Token refresh error:', error)
      return { success: false, message: 'Token refresh failed' }
    }
  }

  /**
   * Logout user
   */
  async logout(refreshToken: string): Promise<{ success: boolean; message: string }> {
    try {
      const result = await authService.logout(refreshToken)
      return result
    } catch (error) {
      console.error('Logout error:', error)
      return { success: false, message: 'Logout failed' }
    }
  }

  /**
   * Verify access token (for middleware)
   */
  async verifyAccessToken(token: string): Promise<{ success: boolean; user?: AuthUser; message: string }> {
    try {
      const result = await authService.verifyAccessToken(token)
      return result
    } catch (error) {
      console.error('Token verification error:', error)
      return { success: false, message: 'Token verification failed' }
    }
  }

  /**
   * Get current user profile
   */
  async getCurrentUser(userId: string): Promise<{ success: boolean; user?: AuthUser; message: string }> {
    try {
      const user = await authService['getUserFromDB'](userId)
      if (!user) {
        return { success: false, message: 'User not found' }
      }

      return { success: true, user, message: 'User found' }
    } catch (error) {
      console.error('Get current user error:', error)
      return { success: false, message: 'Failed to get user' }
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(
    userId: string,
    updates: {
      fullName?: string
      email?: string
      avatarUrl?: string
      city?: string
      area?: string
    }
  ): Promise<{ success: boolean; message: string; user?: AuthUser }> {
    try {
      const { supabase } = await import('../integrations/supabase/client')
      
      // Update profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          full_name: updates.fullName,
          email: updates.email,
          avatar_url: updates.avatarUrl,
          city: updates.city,
          area: updates.area,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)

      if (updateError) {
        console.error('Profile update error:', updateError)
        return { success: false, message: 'Failed to update profile' }
      }

      // Get updated user
      const userResult = await this.getCurrentUser(userId)
      if (!userResult.success) {
        return { success: false, message: 'Profile updated but failed to fetch user data' }
      }

      return { success: true, message: 'Profile updated successfully', user: userResult.user }
    } catch (error) {
      console.error('Update profile error:', error)
      return { success: false, message: 'Failed to update profile' }
    }
  }

  /**
   * Check if user has specific role
   */
  async checkUserRole(userId: string, role: string): Promise<{ success: boolean; hasRole: boolean; message: string }> {
    try {
      const { supabase } = await import('../integrations/supabase/client')
      
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', role)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.error('Role check error:', error)
        return { success: false, hasRole: false, message: 'Failed to check user role' }
      }

      return { 
        success: true, 
        hasRole: !!data, 
        message: data ? 'User has the role' : 'User does not have the role' 
      }
    } catch (error) {
      console.error('Role check error:', error)
      return { success: false, hasRole: false, message: 'Failed to check user role' }
    }
  }

  /**
   * Get user permissions based on roles
   */
  async getUserPermissions(userId: string): Promise<{ success: boolean; permissions: string[]; message: string }> {
    try {
      const { supabase } = await import('../integrations/supabase/client')
      
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)

      if (rolesError) {
        console.error('Roles fetch error:', rolesError)
        return { success: false, permissions: [], message: 'Failed to fetch user roles' }
      }

      const permissions: string[] = []
      
      for (const roleData of roles) {
        switch (roleData.role) {
          case 'customer':
            permissions.push(
              'book:read',
              'book:create',
              'booking:read',
              'booking:create',
              'booking:update_own',
              'payment:read_own',
              'review:create',
              'profile:read_own',
              'profile:update_own'
            )
            break
          case 'provider':
            permissions.push(
              'booking:read',
              'booking:update',
              'profile:read_own',
              'profile:update_own',
              'portfolio:read_own',
              'portfolio:create',
              'portfolio:update_own',
              'portfolio:delete_own',
              'availability:read_own',
              'availability:create',
              'availability:update_own',
              'availability:delete_own',
              'payment:read_own',
              'review:read',
              'earnings:read_own'
            )
            break
          case 'admin':
            permissions.push(
              'user:read',
              'user:update',
              'user:delete',
              'worker:read',
              'worker:update',
              'worker:verify',
              'booking:read',
              'booking:update',
              'payment:read',
              'payment:update',
              'review:read',
              'review:update',
              'review:delete',
              'system:read',
              'system:update',
              'analytics:read'
            )
            break
        }
      }

      return { success: true, permissions: [...new Set(permissions)], message: 'Permissions fetched successfully' }
    } catch (error) {
      console.error('Permissions fetch error:', error)
      return { success: false, permissions: [], message: 'Failed to fetch permissions' }
    }
  }

  /**
   * Change user password (if password-based login is added later)
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; message: string }> {
    // This would be implemented if we add password-based login
    // For now, return not implemented
    return { success: false, message: 'Password change not implemented for OTP-based authentication' }
  }

  /**
   * Delete user account
   */
  async deleteAccount(userId: string, password?: string): Promise<{ success: boolean; message: string }> {
    try {
      const { supabase } = await import('../integrations/supabase/client')
      
      // Start a transaction by deleting related data first
      // Delete user roles
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)

      // Delete refresh tokens
      await supabase
        .from('refresh_tokens')
        .delete()
        .eq('user_id', userId)

      // Delete notification settings
      await supabase
        .from('notification_settings')
        .delete()
        .eq('user_id', userId)

      // Delete profile
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId)

      if (profileError) {
        console.error('Profile deletion error:', profileError)
        return { success: false, message: 'Failed to delete profile' }
      }

      // Delete auth user
      const { error: authError } = await supabase.auth.admin.deleteUser(userId)

      if (authError) {
        console.error('Auth user deletion error:', authError)
        return { success: false, message: 'Failed to delete auth user' }
      }

      return { success: true, message: 'Account deleted successfully' }
    } catch (error) {
      console.error('Account deletion error:', error)
      return { success: false, message: 'Failed to delete account' }
    }
  }
}

export const authAPI = new AuthAPI()
