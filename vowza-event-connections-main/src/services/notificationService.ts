import { supabase } from '@/integrations/supabase/client';

export type NotificationType = 
  | 'booking_received'
  | 'booking_accepted'
  | 'booking_rejected'
  | 'artist_approved'
  | 'artist_rejected'
  | 'email_verification'
  | 'password_reset';

interface NotificationData {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  metadata?: Record<string, any>;
}

export const NotificationService = {
  // Create in-app notification
  async createNotification(data: NotificationData) {
    try {
      const { error } = await supabase
        .from('notifications')
        .insert({
          user_id: data.userId,
          type: data.type,
          title: data.title,
          message: data.message,
          reference_id: data.metadata?.bookingId || null,
          is_read: false
        } as any);

      if (error) throw error;
    } catch (error) {
    }
  },

  // Get unread notifications count
  async getUnreadCount(userId: string): Promise<number> {
    try {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) throw error;
      return count || 0;
    } catch (error) {
      return 0;
    }
  },

  // Mark notification as read
  async markAsRead(notificationId: string) {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (error) throw error;
    } catch (error) {
    }
  },

  // Mark all notifications as read
  async markAllAsRead(userId: string) {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) throw error;
    } catch (error) {
    }
  },

  // Send email notification (using Supabase Auth email templates)
  async sendEmailNotification(email: string, type: NotificationType, data: any) {
    // Note: This would typically use Supabase Edge Functions or a third-party service
    // For now, we'll create an in-app notification
  },

  // Booking notifications
  async notifyBookingReceived(customerId: string, providerId: string, bookingId: string) {
    // Notify provider
    await this.createNotification({
      userId: providerId,
      type: 'booking_received',
      title: 'New Booking Request',
      message: 'You have received a new booking request. Check your dashboard for details.',
      metadata: { bookingId }
    });

    // Notify customer
    await this.createNotification({
      userId: customerId,
      type: 'booking_received',
      title: 'Booking Request Sent',
      message: 'Your booking request has been sent successfully. You will be notified when the provider responds.',
      metadata: { bookingId }
    });
  },

  async notifyBookingAccepted(customerId: string, providerId: string, bookingId: string) {
    await this.createNotification({
      userId: customerId,
      type: 'booking_accepted',
      title: 'Booking Accepted!',
      message: 'Your booking has been accepted by the provider. Check your dashboard for details.',
      metadata: { bookingId }
    });
  },

  async notifyBookingRejected(customerId: string, providerId: string, bookingId: string, reason?: string) {
    await this.createNotification({
      userId: customerId,
      type: 'booking_rejected',
      title: 'Booking Rejected',
      message: `Your booking request has been rejected${reason ? `: ${reason}` : ''}. Please try booking with another provider.`,
      metadata: { bookingId, reason }
    });
  },

  // Artist verification notifications
  async notifyArtistApproved(artistId: string) {
    await this.createNotification({
      userId: artistId,
      type: 'artist_approved',
      title: 'Congratulations! You are Verified',
      message: 'Your artist account has been approved. You can now start receiving bookings.',
      metadata: {}
    });
  },

  async notifyArtistRejected(artistId: string, reason?: string) {
    await this.createNotification({
      userId: artistId,
      type: 'artist_rejected',
      title: 'Verification Rejected',
      message: `Your artist verification has been rejected${reason ? `: ${reason}` : ''}. Please update your documents and try again.`,
      metadata: { reason }
    });
  },

  // Email verification notification
  async notifyEmailVerification(userId: string) {
    await this.createNotification({
      userId,
      type: 'email_verification',
      title: 'Email Verification Required',
      message: 'Please verify your email address to continue using the platform.',
      metadata: {}
    });
  },

  // Password reset notification
  async notifyPasswordReset(userId: string) {
    await this.createNotification({
      userId,
      type: 'password_reset',
      title: 'Password Reset',
      message: 'Your password has been reset successfully.',
      metadata: {}
    });
  }
};
