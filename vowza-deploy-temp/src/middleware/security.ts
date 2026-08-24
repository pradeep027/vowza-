import { supabase } from '../integrations/supabase/client'

export interface RateLimitConfig {
  windowMs: number // Time window in milliseconds
  maxRequests: number // Maximum requests per window
  keyGenerator?: (req: any) => string // Custom key generator
  skipSuccessfulRequests?: boolean // Don't count successful requests
  skipFailedRequests?: boolean // Don't count failed requests
}

export interface SecurityConfig {
  enableRateLimit: boolean
  enableIPBlocking: boolean
  enableRequestLogging: boolean
  maxLoginAttempts: number
  lockoutDuration: number // in minutes
  suspiciousPatterns: string[]
}

export interface RateLimitResult {
  allowed: boolean
  limit: number
  remaining: number
  resetTime: Date
  retryAfter?: number
}

export interface SecurityCheckResult {
  allowed: boolean
  reason?: string
  riskScore: number
  recommendations?: string[]
}

class SecurityMiddleware {
  private rateLimitStore = new Map<string, { count: number; resetTime: Date }>()
  private blockedIPs = new Map<string, { blockedUntil: Date; reason: string }>()
  private suspiciousAttempts = new Map<string, { count: number; lastAttempt: Date }>()

  private readonly defaultConfig: SecurityConfig = {
    enableRateLimit: true,
    enableIPBlocking: true,
    enableRequestLogging: true,
    maxLoginAttempts: 5,
    lockoutDuration: 15,
    suspiciousPatterns: [
      'sql injection',
      'xss',
      'script',
      'drop table',
      'union select',
      'javascript:',
      '<script',
      'eval('
    ]
  }

  /**
   * Rate limiting middleware
   */
  async rateLimit(config: RateLimitConfig): Promise<(req: any) => Promise<RateLimitResult>> {
    return async (req: any): Promise<RateLimitResult> => {
      const key = config.keyGenerator ? config.keyGenerator(req) : this.generateDefaultKey(req)
      const now = new Date()

      // Clean up expired entries
      this.cleanupExpiredEntries()

      // Get current rate limit data
      let rateLimitData = this.rateLimitStore.get(key)
      
      if (!rateLimitData || now > rateLimitData.resetTime) {
        // Create new window
        rateLimitData = {
          count: 0,
          resetTime: new Date(now.getTime() + config.windowMs)
        }
        this.rateLimitStore.set(key, rateLimitData)
      }

      // Check if limit exceeded
      const allowed = rateLimitData.count < config.maxRequests
      
      if (allowed) {
        rateLimitData.count++
      }

      // Calculate retry after time
      const retryAfter = allowed ? undefined : Math.ceil((rateLimitData.resetTime.getTime() - now.getTime()) / 1000)

      // Log to database for persistence across restarts
      await this.logRateLimitToDatabase(key, rateLimitData.count, config.maxRequests, rateLimitData.resetTime)

      return {
        allowed,
        limit: config.maxRequests,
        remaining: Math.max(0, config.maxRequests - rateLimitData.count),
        resetTime: rateLimitData.resetTime,
        retryAfter
      }
    }
  }

  /**
   * Security check middleware
   */
  async securityCheck(req: any, config: Partial<SecurityConfig> = {}): Promise<SecurityCheckResult> {
    const securityConfig = { ...this.defaultConfig, ...config }
    let riskScore = 0
    const recommendations: string[] = []

    // Check IP blocking
    if (securityConfig.enableIPBlocking) {
      const ipBlockResult = await this.checkIPBlock(req.ip)
      if (!ipBlockResult.allowed) {
        return {
          allowed: false,
          reason: ipBlockResult.reason,
          riskScore: 100,
          recommendations: ['IP is temporarily blocked due to suspicious activity']
        }
      }
    }

    // Check for suspicious patterns
    const patternCheck = this.checkSuspiciousPatterns(req, securityConfig.suspiciousPatterns)
    riskScore += patternCheck.riskScore
    recommendations.push(...patternCheck.recommendations)

    // Check for brute force attempts
    const bruteForceCheck = await this.checkBruteForce(req, securityConfig)
    riskScore += bruteForceCheck.riskScore
    recommendations.push(...bruteForceCheck.recommendations)

    // Check request frequency
    const frequencyCheck = await this.checkRequestFrequency(req)
    riskScore += frequencyCheck.riskScore
    recommendations.push(...frequencyCheck.recommendations)

    // Determine if request should be allowed
    const allowed = riskScore < 75 // Allow requests with risk score below 75

    if (securityConfig.enableRequestLogging) {
      await this.logSecurityEvent(req, {
        riskScore,
        allowed,
        reasons: recommendations
      })
    }

    return {
      allowed,
      reason: allowed ? undefined : `High risk score: ${riskScore}`,
      riskScore,
      recommendations: allowed ? undefined : recommendations
    }
  }

  /**
   * Input validation and sanitization
   */
  validateAndSanitize(input: any, rules: {
    required?: boolean
    type?: 'string' | 'number' | 'email' | 'phone' | 'url'
    minLength?: number
    maxLength?: number
    pattern?: RegExp
    sanitize?: boolean
  } = {}): { valid: boolean; sanitized?: any; errors: string[] } {
    const errors: string[] = []

    // Check required
    if (rules.required && (input === null || input === undefined || input === '')) {
      errors.push('Field is required')
      return { valid: false, errors }
    }

    // If not required and empty, return valid
    if (!rules.required && (input === null || input === undefined || input === '')) {
      return { valid: true, sanitized: input, errors }
    }

    // Type validation
    if (rules.type) {
      switch (rules.type) {
        case 'string':
          if (typeof input !== 'string') {
            errors.push('Must be a string')
          }
          break
        case 'number':
          if (isNaN(Number(input))) {
            errors.push('Must be a number')
          }
          break
        case 'email':
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
          if (!emailRegex.test(input)) {
            errors.push('Must be a valid email address')
          }
          break
        case 'phone':
          const phoneRegex = /^[6-9]\d{9}$/
          if (!phoneRegex.test(input.toString().replace(/\D/g, ''))) {
            errors.push('Must be a valid phone number')
          }
          break
        case 'url':
          try {
            new URL(input)
          } catch {
            errors.push('Must be a valid URL')
          }
          break
      }
    }

    // Length validation
    if (typeof input === 'string') {
      if (rules.minLength && input.length < rules.minLength) {
        errors.push(`Must be at least ${rules.minLength} characters long`)
      }
      if (rules.maxLength && input.length > rules.maxLength) {
        errors.push(`Must be no more than ${rules.maxLength} characters long`)
      }
    }

    // Pattern validation
    if (rules.pattern && typeof input === 'string') {
      if (!rules.pattern.test(input)) {
        errors.push('Invalid format')
      }
    }

    // Sanitization
    let sanitized = input
    if (rules.sanitize && typeof input === 'string') {
      sanitized = this.sanitizeString(input)
    }

    return {
      valid: errors.length === 0,
      sanitized,
      errors
    }
  }

  /**
   * Generate default rate limit key
   */
  private generateDefaultKey(req: any): string {
    const ip = req.ip || req.connection?.remoteAddress || 'unknown'
    const userAgent = req.headers['user-agent'] || 'unknown'
    const endpoint = req.path || req.url || 'unknown'
    return `${ip}:${userAgent}:${endpoint}`
  }

  /**
   * Clean up expired rate limit entries
   */
  private cleanupExpiredEntries(): void {
    const now = new Date()
    
    // Clean rate limits
    for (const [key, data] of this.rateLimitStore.entries()) {
      if (now > data.resetTime) {
        this.rateLimitStore.delete(key)
      }
    }

    // Clean blocked IPs
    for (const [ip, data] of this.blockedIPs.entries()) {
      if (now > data.blockedUntil) {
        this.blockedIPs.delete(ip)
      }
    }

    // Clean suspicious attempts
    for (const [key, data] of this.suspiciousAttempts.entries()) {
      const hoursSinceLastAttempt = (now.getTime() - data.lastAttempt.getTime()) / (1000 * 60 * 60)
      if (hoursSinceLastAttempt > 24) {
        this.suspiciousAttempts.delete(key)
      }
    }
  }

  /**
   * Log rate limit to database
   */
  private async logRateLimitToDatabase(
    key: string, 
    count: number, 
    limit: number, 
    resetTime: Date
  ): Promise<void> {
    try {
      // This would log to a rate_limits table for persistence
      // For now, we'll just log to console
    } catch (error) {
      console.error('Failed to log rate limit to database:', error)
    }
  }

  /**
   * Check if IP is blocked
   */
  private async checkIPBlock(ip: string): Promise<{ allowed: boolean; reason?: string }> {
    const blockedData = this.blockedIPs.get(ip)
    
    if (blockedData) {
      if (new Date() > blockedData.blockedUntil) {
        this.blockedIPs.delete(ip)
        return { allowed: true }
      }
      return {
        allowed: false,
        reason: `IP blocked until ${blockedData.blockedUntil.toISOString()}. Reason: ${blockedData.reason}`
      }
    }

    return { allowed: true }
  }

  /**
   * Check for suspicious patterns in request
   */
  private checkSuspiciousPatterns(req: any, patterns: string[]): { riskScore: number; recommendations: string[] } {
    let riskScore = 0
    const recommendations: string[] = []

    const checkString = (str: string) => {
      const lowerStr = str.toLowerCase()
      patterns.forEach(pattern => {
        if (lowerStr.includes(pattern)) {
          riskScore += 20
          recommendations.push(`Suspicious pattern detected: ${pattern}`)
        }
      })
    }

    // Check common request fields
    const fieldsToCheck = [
      req.body,
      req.query,
      req.params,
      req.headers['user-agent'],
      req.headers.referer
    ]

    fieldsToCheck.forEach(field => {
      if (field && typeof field === 'string') {
        checkString(field)
      } else if (field && typeof field === 'object') {
        checkString(JSON.stringify(field))
      }
    })

    return { riskScore, recommendations }
  }

  /**
   * Check for brute force attempts
   */
  private async checkBruteForce(req: any, config: SecurityConfig): Promise<{ riskScore: number; recommendations: string[] }> {
    let riskScore = 0
    const recommendations: string[] = []

    const key = `${req.ip}:${req.path}`
    const now = new Date()
    let attemptData = this.suspiciousAttempts.get(key)

    if (!attemptData) {
      attemptData = { count: 0, lastAttempt: now }
      this.suspiciousAttempts.set(key, attemptData)
    }

    // Check if too many attempts in short time
    const minutesSinceLastAttempt = (now.getTime() - attemptData.lastAttempt.getTime()) / (1000 * 60)
    
    if (minutesSinceLastAttempt < 1) {
      attemptData.count++
      if (attemptData.count > config.maxLoginAttempts) {
        riskScore += 50
        recommendations.push('Too many requests in short time period')
        
        // Block IP temporarily
        if (config.enableIPBlocking) {
          this.blockedIPs.set(req.ip, {
            blockedUntil: new Date(now.getTime() + config.lockoutDuration * 60 * 1000),
            reason: 'Too many requests in short time period'
          })
        }
      }
    } else {
      // Reset count if enough time has passed
      attemptData.count = 1
    }

    attemptData.lastAttempt = now

    return { riskScore, recommendations }
  }

  /**
   * Check request frequency
   */
  private async checkRequestFrequency(req: any): Promise<{ riskScore: number; recommendations: string[] }> {
    let riskScore = 0
    const recommendations: string[] = []

    // This would check database for request patterns
    // For now, return low risk
    return { riskScore, recommendations }
  }

  /**
   * Log security event
   */
  private async logSecurityEvent(req: any, event: {
    riskScore: number
    allowed: boolean
    reasons: string[]
  }): Promise<void> {
    try {
      await supabase
        .from('security_events')
        .insert({
          ip_address: req.ip,
          user_agent: req.headers['user-agent'],
          path: req.path,
          method: req.method,
          risk_score: event.riskScore,
          allowed: event.allowed,
          reasons: event.reasons,
          created_at: new Date().toISOString()
        })
    } catch (error) {
      console.error('Failed to log security event:', error)
    }
  }

  /**
   * Sanitize string to prevent XSS
   */
  private sanitizeString(str: string): string {
    return str
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .replace(/javascript:/gi, '') // Remove javascript protocol
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .trim()
  }

  /**
   * Block IP manually
   */
  blockIP(ip: string, duration: number, reason: string): void {
    const blockedUntil = new Date(Date.now() + duration * 60 * 1000)
    this.blockedIPs.set(ip, { blockedUntil, reason })
  }

  /**
   * Unblock IP
   */
  unblockIP(ip: string): void {
    this.blockedIPs.delete(ip)
  }

  /**
   * Get blocked IPs
   */
  getBlockedIPs(): Array<{ ip: string; blockedUntil: Date; reason: string }> {
    const now = new Date()
    const blocked: Array<{ ip: string; blockedUntil: Date; reason: string }> = []

    for (const [ip, data] of this.blockedIPs.entries()) {
      if (now <= data.blockedUntil) {
        blocked.push({ ip, blockedUntil: data.blockedUntil, reason: data.reason })
      }
    }

    return blocked
  }

  /**
   * Get security statistics
   */
  async getSecurityStats(): Promise<{
    totalRequests: number
    blockedRequests: number
    suspiciousIPs: number
    topRiskFactors: Array<{ factor: string; count: number }>
  }> {
    try {
      const { data: events } = await supabase
        .from('security_events')
        .select('*')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

      const totalRequests = events?.length || 0
      const blockedRequests = events?.filter(e => !e.allowed).length || 0
      const suspiciousIPs = new Set(events?.filter(e => e.riskScore > 50).map(e => e.ip_address)).size

      // Analyze top risk factors
      const riskFactors: Record<string, number> = {}
      events?.forEach(event => {
        event.reasons?.forEach((reason: string) => {
          riskFactors[reason] = (riskFactors[reason] || 0) + 1
        })
      })

      const topRiskFactors = Object.entries(riskFactors)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([factor, count]) => ({ factor, count }))

      return {
        totalRequests,
        blockedRequests,
        suspiciousIPs,
        topRiskFactors
      }
    } catch (error) {
      console.error('Failed to get security stats:', error)
      return {
        totalRequests: 0,
        blockedRequests: 0,
        suspiciousIPs: 0,
        topRiskFactors: []
      }
    }
  }
}

export const securityMiddleware = new SecurityMiddleware()
