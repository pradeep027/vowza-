/**
 * Vowza Security Logging Service
 * Logs unauthorized access attempts and suspicious behavior to security_events table.
 * All entries are admin-read-only. Users can only insert events tied to their own user_id.
 * NEVER expose secrets, tokens, passwords, or private keys through this service.
 */
import { supabase } from '@/integrations/supabase/client';

export type SecuritySeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export interface SecurityEventPayload {
  event_type: string;
  severity: SecuritySeverity;
  endpoint?: string;
  resource_type?: string;
  resource_id?: string;
  action?: string;
  result?: string;
  http_status?: number;
  reason?: string;
  risk_score?: number;
  metadata?: Record<string, unknown>;
}

/** Sanitize a string to remove any potential secrets or tokens */
function sanitize(val: unknown): string {
  if (!val) return '';
  const s = String(val);
  // Redact anything that looks like a JWT or bearer token
  return s.replace(/Bearer\s+[A-Za-z0-9\-_\.]{20,}/gi, 'Bearer [REDACTED]')
          .replace(/eyJ[A-Za-z0-9\-_]{20,}\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]*/g, '[JWT_REDACTED]')
          .slice(0, 500); // cap length
}

/** Log a security event. Safe to call from any context. Never throws. */
export async function logSecurityEvent(payload: SecurityEventPayload): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id ?? null;
    const userEmail = session?.user?.email ?? null;
    const isAuthenticated = !!session?.user;

    const event = {
      event_type:       payload.event_type,
      severity:         payload.severity,
      user_id:          userId,
      user_email:       userEmail,        // only from trusted session, never from request body
      endpoint:         sanitize(payload.endpoint),
      resource_type:    sanitize(payload.resource_type),
      resource_id:      sanitize(payload.resource_id),
      action:           sanitize(payload.action),
      result:           sanitize(payload.result),
      http_status:      payload.http_status ?? null,
      reason:           sanitize(payload.reason),
      risk_score:       Math.min(100, Math.max(0, payload.risk_score ?? 0)),
      user_agent:       sanitize(navigator?.userAgent),
      is_authenticated: isAuthenticated,
      metadata:         payload.metadata ?? {},
    };

    await supabase.from('security_events' as any).insert(event);
  } catch {
    // Silently fail — security logging must never crash the app
    // In production, this would also write to a fallback log
  }
}

/** Convenience: log an unauthorized access attempt */
export function logUnauthorizedAccess(opts: {
  resource_type: string;
  resource_id?: string;
  endpoint?: string;
  reason?: string;
}) {
  return logSecurityEvent({
    event_type:    'UNAUTHORIZED_ACCESS_ATTEMPT',
    severity:      'high',
    risk_score:    75,
    http_status:   403,
    result:        'BLOCKED',
    action:        'Access denied — authorization check failed',
    ...opts,
  });
}

/** Convenience: log an IDOR attempt (user tried to access another user's resource) */
export function logIDORAttempt(opts: {
  resource_type: string;
  resource_id?: string;
  endpoint?: string;
}) {
  return logSecurityEvent({
    event_type:    'IDOR_ATTEMPT',
    severity:      'high',
    risk_score:    85,
    http_status:   403,
    result:        'BLOCKED',
    action:        'User attempted to access resource belonging to another user',
    reason:        'Resource owner mismatch — access denied',
    ...opts,
  });
}

/** Convenience: log an admin access attempt by a non-admin */
export function logAdminAccessAttempt(opts: { endpoint?: string; resource_type?: string }) {
  return logSecurityEvent({
    event_type:    'ADMIN_ACCESS_ATTEMPT',
    severity:      'critical',
    risk_score:    92,
    http_status:   403,
    result:        'BLOCKED',
    action:        'Non-admin user attempted to access admin-only resource',
    reason:        'Insufficient privileges',
    ...opts,
  });
}

/** Convenience: log a privilege escalation attempt */
export function logPrivilegeEscalation(opts: { endpoint?: string; reason?: string }) {
  return logSecurityEvent({
    event_type:    'PRIVILEGE_ESCALATION_ATTEMPT',
    severity:      'critical',
    risk_score:    95,
    http_status:   403,
    result:        'BLOCKED',
    action:        'Privilege escalation blocked',
    ...opts,
  });
}
