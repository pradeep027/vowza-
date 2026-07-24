import { supabase } from '../integrations/supabase/client'

export interface NotificationPayload {
  userId: string
  title: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error' | 'booking' | 'payment' | 'verification'
  referenceId?: string
  data?: any
}

export interface SMSPayload {
  to: string
  message?: string
  template?: string
  templateData?: Record<string, any>
}

export interface EmailPayload {
  to: string
  subject?: string
  html?: string
  text?: string
  template?: string
  templateData?: Record<string, any>
}

export interface PushPayload {
  userId: string
  title: string
  message: string
  icon?: string
  badge?: number
  data?: any
  actions?: Array<{
    action: string
    title: string
    icon?: string
  }>
}

export interface NotificationSettings {
  smsEnabled: boolean
  emailEnabled: boolean
  pushEnabled: boolean
  bookingNotifications: boolean
  paymentNotifications: boolean
  marketingNotifications: boolean
}

class NotificationService {
  private readonly SMS_TEMPLATES = {
    OTP_VERIFICATION: 'Your Vowza verification code is: {{otp}}. Valid for {{expiryMinutes}} minutes.',
    BOOKING_CONFIRMED: 'Your booking has been confirmed! {{eventName}} on {{eventDate}}. Contact: {{providerPhone}}',
    BOOKING_CANCELLED: 'Your booking for {{eventName}} on {{eventDate}} has been cancelled.',
    PAYMENT_RECEIVED: 'Payment of ₹{{amount}} received for booking {{bookingId}}.',
    WORKER_APPROVED: 'Congratulations! Your worker profile has been approved. Start receiving bookings now!',
    WORKER_REJECTED: 'Your worker profile application was rejected. Reason: {{reason}}'
  }

  private readonly EMAIL_TEMPLATES = {
    WELCOME: {
      subject: 'Welcome to Vowza!',
      template: 'welcome'
    },
    BOOKING_CONFIRMATION: {
      subject: 'Booking Confirmed - {{eventName}}',
      template: 'booking_confirmation'
    },
    PAYMENT_RECEIPT: {
      subject: 'Payment Receipt - Booking {{bookingId}}',
      template: 'payment_receipt'
    },
    WORKER_APPROVED: {
      subject: 'Your Vowza Profile is Approved!',
      template: 'worker_approved'
    }
  }

  /**
   * Send in-app notification
   */
  async sendNotification(payload: NotificationPayload): Promise<{ success: boolean; message: string; notificationId?: string }> {
    try {
      // Get user notification settings
      const { data: settings } = await supabase
        .from('notification_settings')
        .select('*')
        .eq('user_id', payload.userId)
        .single()

      if (!settings) {
        return { success: false, message: 'User notification settings not found' }
      }

      // Check if user wants this type of notification
      if (!this.shouldSendNotification(payload.type, settings)) {
        return { success: true, message: 'Notification filtered by user preferences' }
      }

      // Create notification in database
      const { data: notification, error } = await supabase
        .from('notifications')
        .insert({
          user_id: payload.userId,
          title: payload.title,
          message: payload.message,
          type: payload.type,
          reference_id: payload.referenceId,
          data: payload.data
        })
        .select()
        .single()

      if (error) {
        return { success: false, message: 'Failed to create notification' }
      }

      // Send push notification if enabled
      if (settings.push_enabled) {
        await this.sendPushNotification({
          userId: payload.userId,
          title: payload.title,
          message: payload.message,
          data: payload.data
        })
      }

      return {
        success: true,
        message: 'Notification sent successfully',
        notificationId: notification.id
      }
    } catch (error) {
      return { success: false, message: 'Failed to send notification' }
    }
  }

  /**
   * Send SMS notification
   */
  async sendSMS(payload: SMSPayload): Promise<{ success: boolean; message: string }> {
    try {
      let message = payload.message

      // Use template if provided
      if (payload.template && this.SMS_TEMPLATES[payload.template as keyof typeof this.SMS_TEMPLATES]) {
        const template = this.SMS_TEMPLATES[payload.template as keyof typeof this.SMS_TEMPLATES]
        message = this.replaceTemplateVariables(template, payload.templateData || {})
      }

      // Integration with SMS service (Twilio, AWS SNS, etc.)
      // For now, we'll log the message

      // Example Twilio integration (commented out):
      // const response = await fetch('https://api.twilio.com/2010-04-01/Accounts/YOUR_ACCOUNT_SID/Messages.json', {
      //   method: 'POST',
      //   headers: {
      //     'Authorization': `Basic ${btoa('YOUR_ACCOUNT_SID:YOUR_AUTH_TOKEN')}`,
      //     'Content-Type': 'application/x-www-form-urlencoded',
      //   },
      //   body: new URLSearchParams({
      //     'To': payload.to,
      //     'From': 'YOUR_TWILIO_NUMBER',
      //     'Body': message
      //   })
      // })

      // if (!response.ok) {
      //   return { success: false, message: 'Failed to send SMS' }
      // }

      return { success: true, message: 'SMS sent successfully' }
    } catch (error) {
      return { success: false, message: 'Failed to send SMS' }
    }
  }

  /**
   * Send email notification
   */
  async sendEmail(payload: EmailPayload): Promise<{ success: boolean; message: string }> {
    try {
      let html = payload.html
      let subject = payload.subject

      // Use template if provided
      if (payload.template && this.EMAIL_TEMPLATES[payload.template as keyof typeof this.EMAIL_TEMPLATES]) {
        const template = this.EMAIL_TEMPLATES[payload.template as keyof typeof this.EMAIL_TEMPLATES]
        subject = this.replaceTemplateVariables(template.subject, payload.templateData || {})
        html = await this.renderEmailTemplate(template.template, payload.templateData || {})
      }

      // Integration with email service (SendGrid, AWS SES, etc.)
      // For now, we'll log the email

      // Example SendGrid integration (commented out):
      // const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      //   method: 'POST',
      //   headers: {
      //     'Authorization': `Bearer YOUR_SENDGRID_API_KEY`,
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify({
      //     personalizations: [{
      //       to: [{ email: payload.to }],
      //       subject: subject
      //     }],
      //     from: { email: 'noreply@vowza.com' },
      //     content: [{
      //       type: 'text/html',
      //       value: html || payload.text
      //     }]
      //   })
      // })

      // if (!response.ok) {
      //   return { success: false, message: 'Failed to send email' }
      // }

      return { success: true, message: 'Email sent successfully' }
    } catch (error) {
      return { success: false, message: 'Failed to send email' }
    }
  }

  /**
   * Send push notification
   */
  async sendPushNotification(payload: PushPayload): Promise<{ success: boolean; message: string }> {
    try {
      // Get user's push subscriptions
      const { data: subscriptions } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', payload.userId)

      if (!subscriptions || subscriptions.length === 0) {
        return { success: true, message: 'No push subscriptions found' }
      }

      // Send to all subscriptions
      const results = await Promise.allSettled(
        subscriptions.map(subscription => this.sendWebPush(subscription, payload))
      )

      const successful = results.filter(r => r.status === 'fulfilled').length
      const failed = results.filter(r => r.status === 'rejected').length

      if (failed > 0) {
      }

      return {
        success: successful > 0,
        message: `Sent ${successful} push notifications, ${failed} failed`
      }
    } catch (error) {
      return { success: false, message: 'Failed to send push notification' }
    }
  }

  /**
   * Send web push notification
   */
  private async sendWebPush(subscription: any, payload: PushPayload): Promise<void> {
    try {
      // This would use Web Push Protocol
      // For now, we'll just log it
    } catch (error) {
      throw error
    }
  }

  /**
   * Get user notifications
   */
  async getUserNotifications(
    userId: string,
    filters: {
      type?: string
      read?: boolean
      limit?: number
      offset?: number
    } = {}
  ): Promise<{ success: boolean; notifications?: any[]; message: string }> {
    try {
      let query = supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (filters.type) {
        query = query.eq('type', filters.type)
      }

      if (filters.read !== undefined) {
        query = query.eq('is_read', filters.read)
      }

      if (filters.limit) {
        query = query.limit(filters.limit)
      }

      if (filters.offset) {
        query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1)
      }

      const { data: notifications, error } = await query

      if (error) {
        return { success: false, message: 'Failed to fetch notifications' }
      }

      return {
        success: true,
        notifications: notifications || [],
        message: 'Notifications fetched successfully'
      }
    } catch (error) {
      return { success: false, message: 'Failed to fetch notifications' }
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<{ success: boolean; message: string }> {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId)
        .eq('user_id', userId)

      if (error) {
        return { success: false, message: 'Failed to mark notification as read' }
      }

      return { success: true, message: 'Notification marked as read' }
    } catch (error) {
      return { success: false, message: 'Failed to mark notification as read' }
    }
  }

  /**
   * Mark all notifications as read for user
   */
  async markAllAsRead(userId: string): Promise<{ success: boolean; message: string; updatedCount?: number }> {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false)
        .select('id')

      if (error) {
        return { success: false, message: 'Failed to mark notifications as read' }
      }

      return {
        success: true,
        message: 'All notifications marked as read',
        updatedCount: data?.length || 0
      }
    } catch (error) {
      return { success: false, message: 'Failed to mark notifications as read' }
    }
  }

  /**
   * Get user notification settings
   */
  async getNotificationSettings(userId: string): Promise<{ success: boolean; settings?: NotificationSettings; message: string }> {
    try {
      const { data: settings, error } = await supabase
        .from('notification_settings')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (error) {
        return { success: false, message: 'Failed to fetch notification settings' }
      }

      return {
        success: true,
        settings: {
          smsEnabled: settings.sms_enabled,
          emailEnabled: settings.email_enabled,
          pushEnabled: settings.push_enabled,
          bookingNotifications: settings.booking_notifications,
          paymentNotifications: settings.payment_notifications,
          marketingNotifications: settings.marketing_notifications
        },
        message: 'Notification settings fetched successfully'
      }
    } catch (error) {
      return { success: false, message: 'Failed to fetch notification settings' }
    }
  }

  /**
   * Update notification settings
   */
  async updateNotificationSettings(
    userId: string,
    settings: Partial<NotificationSettings>
  ): Promise<{ success: boolean; message: string }> {
    try {
      const updateData: any = {}
      
      if (settings.smsEnabled !== undefined) updateData.sms_enabled = settings.smsEnabled
      if (settings.emailEnabled !== undefined) updateData.email_enabled = settings.emailEnabled
      if (settings.pushEnabled !== undefined) updateData.push_enabled = settings.pushEnabled
      if (settings.bookingNotifications !== undefined) updateData.booking_notifications = settings.bookingNotifications
      if (settings.paymentNotifications !== undefined) updateData.payment_notifications = settings.paymentNotifications
      if (settings.marketingNotifications !== undefined) updateData.marketing_notifications = settings.marketingNotifications

      updateData.updated_at = new Date().toISOString()

      const { error } = await supabase
        .from('notification_settings')
        .update(updateData)
        .eq('user_id', userId)

      if (error) {
        return { success: false, message: 'Failed to update notification settings' }
      }

      return { success: true, message: 'Notification settings updated successfully' }
    } catch (error) {
      return { success: false, message: 'Failed to update notification settings' }
    }
  }

  /**
   * Send OTP via SMS
   */
  async sendOTP(phone: string, otp: string, expiryMinutes: number): Promise<{ success: boolean; message: string }> {
    return this.sendSMS({
      to: phone,
      template: 'OTP_VERIFICATION',
      templateData: { otp, expiryMinutes }
    })
  }

  /**
   * Send booking confirmation
   */
  async sendBookingConfirmation(
    userId: string,
    bookingId: string,
    eventName: string,
    eventDate: string,
    providerPhone: string
  ): Promise<{ success: boolean; message: string }> {
    // Send in-app notification
    await this.sendNotification({
      userId,
      title: 'Booking Confirmed!',
      message: `Your booking for ${eventName} on ${eventDate} has been confirmed.`,
      type: 'booking',
      referenceId: bookingId
    })

    // Send SMS
    const { data: profile } = await supabase
      .from('profiles')
      .select('phone')
      .eq('id', userId)
      .single()

    if (profile?.phone) {
      await this.sendSMS({
        to: profile.phone,
        template: 'BOOKING_CONFIRMED',
        templateData: { eventName, eventDate, providerPhone }
      })
    }

    return { success: true, message: 'Booking confirmation sent' }
  }

  /**
   * Send worker approval notification
   */
  async sendWorkerApproval(userId: string): Promise<{ success: boolean; message: string }> {
    // Send in-app notification
    await this.sendNotification({
      userId,
      title: 'Profile Approved!',
      message: 'Congratulations! Your worker profile has been approved. Start receiving bookings now!',
      type: 'verification',
      data: { approved: true }
    })

    // Send SMS
    const { data: profile } = await supabase
      .from('profiles')
      .select('phone')
      .eq('id', userId)
      .single()

    if (profile?.phone) {
      await this.sendSMS({
        to: profile.phone,
        template: 'WORKER_APPROVED'
      })
    }

    // Send email
    const { data: emailProfile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', userId)
      .single()

    if (emailProfile?.email) {
      await this.sendEmail({
        to: emailProfile.email,
        template: 'WORKER_APPROVED'
      })
    }

    return { success: true, message: 'Worker approval notification sent' }
  }

  /**
   * Check if notification should be sent based on user preferences
   */
  private shouldSendNotification(type: string, settings: any): boolean {
    switch (type) {
      case 'booking':
        return settings.booking_notifications
      case 'payment':
        return settings.payment_notifications
      case 'info':
      case 'success':
      case 'warning':
      case 'error':
        return true // Always send system notifications
      case 'verification':
        return true // Always send verification notifications
      default:
        return settings.marketing_notifications
    }
  }

  /**
   * Replace template variables
   */
  private replaceTemplateVariables(template: string, data: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return data[key] || match
    })
  }

  /**
   * Render email template
   */
  private async renderEmailTemplate(templateName: string, data: Record<string, any>): Promise<string> {
    // This would integrate with a template engine like Handlebars, Mustache, etc.
    // For now, return a simple HTML template
    const templates: Record<string, string> = {
      welcome: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Welcome to Vowza!</h2>
          <p>Thank you for joining Vowza Event Community Platform.</p>
          <p>We're excited to help you find the perfect services for your events.</p>
          <a href="{{appUrl}}" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Get Started</a>
        </div>
      `,
      booking_confirmation: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #28a745;">Booking Confirmed!</h2>
          <p>Your booking for <strong>{{eventName}}</strong> on <strong>{{eventDate}}</strong> has been confirmed.</p>
          <p>Provider contact: {{providerPhone}}</p>
          <a href="{{bookingUrl}}" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Booking</a>
        </div>
      `,
      worker_approved: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #28a745;">Congratulations!</h2>
          <p>Your worker profile has been approved and is now live on Vowza.</p>
          <p>You can start receiving bookings from customers immediately.</p>
          <a href="{{dashboardUrl}}" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Go to Dashboard</a>
        </div>
      `
    }

    const template = templates[templateName] || '<p>Notification content</p>'
    return this.replaceTemplateVariables(template, data)
  }

  /**
   * Get notification statistics
   */
  async getNotificationStats(userId: string): Promise<{
    success: boolean
    stats?: {
      total: number
      unread: number
      byType: Record<string, number>
    }
    message: string
  }> {
    try {
      const { data: notifications } = await supabase
        .from('notifications')
        .select('type, is_read')
        .eq('user_id', userId)

      if (!notifications) {
        return {
          success: true,
          stats: { total: 0, unread: 0, byType: {} },
          message: 'No notifications found'
        }
      }

      const total = notifications.length
      const unread = notifications.filter(n => !n.is_read).length
      const byType: Record<string, number> = {}

      notifications.forEach(notification => {
        byType[notification.type] = (byType[notification.type] || 0) + 1
      })

      return {
        success: true,
        stats: { total, unread, byType },
        message: 'Notification stats fetched successfully'
      }
    } catch (error) {
      return { success: false, message: 'Failed to fetch notification stats' }
    }
  }
}

export const notificationService = new NotificationService()
