import { supabase } from '@/integrations/supabase/client';

export type NotificationType = 
  | 'booking_received'
  | 'booking_accepted'
  | 'booking_rejected'
  | 'booking_cancelled'
  | 'booking_completed'
  | 'advance_payment_required'
  | 'advance_payment_successful'
  | 'booking_confirmed'
  | 'payment_expired'
  | 'artist_approved'
  | 'artist_rejected'
  | 'new_review'
  | 'profile_updated'
  | 'admin_announcement'
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
    // Look up provider's auth user_id from provider_profiles
    const { data: providerProfile } = await supabase
      .from('provider_profiles')
      .select('user_id')
      .eq('id', providerId)
      .single();
    const providerUserId = providerProfile?.user_id;

    // Notify provider (using their auth user_id, not provider_profiles.id)
    if (providerUserId) {
      await this.createNotification({
        userId: providerUserId,
        type: 'booking_received',
        title: 'New Booking Request',
        message: 'You have received a new booking request. Check your dashboard for details.',
        metadata: { bookingId }
      });
    }

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
  },

  // Booking cancelled
  async notifyBookingCancelled(customerId: string, providerId: string, bookingId: string, cancelledBy?: string) {
    const cancellerLabel = cancelledBy === 'provider' ? 'The provider' : 'The customer';
    await this.createNotification({
      userId: customerId,
      type: 'booking_cancelled',
      title: 'Booking Cancelled',
      message: `${cancellerLabel} has cancelled the booking. Please check your bookings for details.`,
      metadata: { bookingId }
    });
    await this.createNotification({
      userId: providerId,
      type: 'booking_cancelled',
      title: 'Booking Cancelled',
      message: `${cancellerLabel} has cancelled the booking.`,
      metadata: { bookingId }
    });
  },

  // Booking completed
  async notifyBookingCompleted(customerId: string, providerId: string, bookingId: string) {
    await this.createNotification({
      userId: customerId,
      type: 'booking_completed',
      title: 'Booking Completed',
      message: 'Your event is complete! We hope you had a wonderful experience. Please leave a review.',
      metadata: { bookingId }
    });
    await this.createNotification({
      userId: providerId,
      type: 'booking_completed',
      title: 'Booking Completed',
      message: 'Great work! The booking has been marked as completed. Payment will be processed shortly.',
      metadata: { bookingId }
    });
  },

  // New review
  async notifyNewReview(providerId: string, customerName: string, rating: number, bookingId: string) {
    await this.createNotification({
      userId: providerId,
      type: 'new_review',
      title: 'New Review Received',
      message: `${customerName} gave you a ${rating}-star review. Check your profile to see the feedback.`,
      metadata: { bookingId, rating }
    });
  },

  // Profile updated
  async notifyProfileUpdated(userId: string) {
    await this.createNotification({
      userId,
      type: 'profile_updated',
      title: 'Profile Updated',
      message: 'Your profile has been updated successfully.',
      metadata: {}
    });
  },

  // Admin announcement
  async sendAdminAnnouncement(userIds: string[], title: string, message: string) {
    for (const userId of userIds) {
      await this.createNotification({
        userId,
        type: 'admin_announcement',
        title,
        message,
        metadata: {}
      });
    }
  },

  // Delete a notification
  async deleteNotification(notificationId: string) {
    try {
      await supabase.from('notifications').delete().eq('id', notificationId);
    } catch { /* ignore */ }
  },

  // Get notifications for a user
  async getNotifications(userId: string, limit = 30) {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    return data ?? [];
  },

  // ─── New Payment Architecture Notifications ─────────────────────────────────

  // Advance payment required (after artist accepts)
  async notifyAdvancePaymentRequired(customerId: string, bookingId: string, advanceAmount: number) {
    await this.createNotification({
      userId: customerId,
      type: 'advance_payment_required',
      title: 'Pay Advance to Confirm',
      message: `Your booking has been accepted! Please pay ₹${advanceAmount.toLocaleString('en-IN')} (30% advance) within 24 hours to confirm.`,
      metadata: { bookingId, advanceAmount }
    });
  },

  // Advance payment successful
  async notifyAdvancePaymentSuccess(customerId: string, providerId: string, bookingId: string, advanceAmount: number) {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    await this.createNotification({
      userId: customerId,
      type: 'advance_payment_successful',
      title: 'Booking Confirmed!',
      message: `Your advance payment of ₹${advanceAmount.toLocaleString('en-IN')} is received on ${dateStr} at ${timeStr}. Your booking is now confirmed!`,
      metadata: { bookingId, advanceAmount, paidAt: now.toISOString() }
    });
    // Look up provider's auth user_id
    const { data: providerProfile } = await supabase.from('provider_profiles').select('user_id').eq('id', providerId).single();
    if (providerProfile?.user_id) {
      await this.createNotification({
        userId: providerProfile.user_id,
        type: 'booking_confirmed',
        title: 'Advance Payment Received — ₹' + advanceAmount.toLocaleString('en-IN'),
        message: `Customer paid ₹${advanceAmount.toLocaleString('en-IN')} advance on ${dateStr} at ${timeStr}. Booking is now confirmed!`,
        metadata: { bookingId, advanceAmount, paidAt: now.toISOString() }
      });
    }
  },

  // Payment expired
  async notifyPaymentExpired(customerId: string, providerId: string, bookingId: string) {
    await this.createNotification({
      userId: customerId,
      type: 'payment_expired',
      title: 'Payment Window Expired',
      message: 'Your advance payment was not completed within 24 hours. The booking has been cancelled.',
      metadata: { bookingId }
    });
    const { data: providerProfile } = await supabase.from('provider_profiles').select('user_id').eq('id', providerId).single();
    if (providerProfile?.user_id) {
      await this.createNotification({
        userId: providerProfile.user_id,
        type: 'payment_expired',
        title: 'Customer Payment Expired',
        message: 'The customer did not complete the advance payment. The booking has been cancelled and your availability is restored.',
        metadata: { bookingId }
      });
    }
  },
};
