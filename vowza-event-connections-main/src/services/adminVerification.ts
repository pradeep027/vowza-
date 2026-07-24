import { supabase } from '../integrations/supabase/client'
import type { Database } from '../integrations/supabase/types'

export interface WorkerVerificationRequest {
  workerId: string
  status: 'approved' | 'rejected'
  rejectionReason?: string
  adminNotes?: string
  verifiedBy: string
}

export interface WorkerListFilters {
  status?: 'pending' | 'under_review' | 'approved' | 'rejected'
  serviceType?: string
  city?: string
  limit?: number
  offset?: number
  search?: string
}

export interface WorkerVerificationResponse {
  success: boolean
  message: string
  workerProfile?: any
}

export interface WorkerListResponse {
  success: boolean
  message: string
  workers?: any[]
  totalCount?: number
}

class AdminVerificationService {
  /**
   * Get all workers pending verification
   */
  async getPendingWorkers(filters: WorkerListFilters = {}): Promise<WorkerListResponse> {
    try {
      let query = supabase
        .from('worker_profiles')
        .select(`
          *,
          profiles!inner(
            id,
            full_name,
            phone,
            email,
            avatar_url,
            city,
            area
          ),
          worker_documents(
            id,
            document_type,
            document_url,
            verification_status,
            uploaded_at
          )
        `)
        .in('verification_status', ['pending', 'under_review'])

      // Apply filters
      if (filters.status) {
        query = query.eq('verification_status', filters.status)
      }

      if (filters.serviceType) {
        query = query.eq('service_type', filters.serviceType)
      }

      if (filters.city) {
        query = query.eq('service_city', filters.city)
      }

      if (filters.search) {
        query = query.or(`full_name.ilike.%${filters.search}%,phone.ilike.%${filters.search}%,email.ilike.%${filters.search}%`)
      }

      // Get total count
      const { count } = await query

      // Apply pagination
      if (filters.limit) {
        query = query.limit(filters.limit)
      }

      if (filters.offset) {
        query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1)
      }

      // Order by creation date
      query = query.order('created_at', { ascending: false })

      const { data: workers, error } = await query

      if (error) {
        console.error('Get pending workers error:', error)
        return { success: false, message: 'Failed to fetch pending workers' }
      }

      return {
        success: true,
        message: 'Pending workers fetched successfully',
        workers: workers || [],
        totalCount: count || 0
      }
    } catch (error) {
      console.error('Get pending workers error:', error)
      return { success: false, message: 'Failed to fetch pending workers' }
    }
  }

  /**
   * Get all workers with filters
   */
  async getAllWorkers(filters: WorkerListFilters = {}): Promise<WorkerListResponse> {
    try {
      let query = supabase
        .from('worker_profiles')
        .select(`
          *,
          profiles!inner(
            id,
            full_name,
            phone,
            email,
            avatar_url,
            city,
            area
          ),
          worker_documents(
            id,
            document_type,
            document_url,
            verification_status,
            uploaded_at
          )
        `)

      // Apply filters
      if (filters.status) {
        query = query.eq('verification_status', filters.status)
      }

      if (filters.serviceType) {
        query = query.eq('service_type', filters.serviceType)
      }

      if (filters.city) {
        query = query.eq('service_city', filters.city)
      }

      if (filters.search) {
        query = query.or(`full_name.ilike.%${filters.search}%,phone.ilike.%${filters.search}%,email.ilike.%${filters.search}%`)
      }

      // Get total count
      const { count } = await query

      // Apply pagination
      if (filters.limit) {
        query = query.limit(filters.limit)
      }

      if (filters.offset) {
        query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1)
      }

      // Order by creation date
      query = query.order('created_at', { ascending: false })

      const { data: workers, error } = await query

      if (error) {
        console.error('Get all workers error:', error)
        return { success: false, message: 'Failed to fetch workers' }
      }

      return {
        success: true,
        message: 'Workers fetched successfully',
        workers: workers || [],
        totalCount: count || 0
      }
    } catch (error) {
      console.error('Get all workers error:', error)
      return { success: false, message: 'Failed to fetch workers' }
    }
  }

  /**
   * Get worker details by ID
   */
  async getWorkerDetails(workerId: string): Promise<{ success: boolean; worker?: any; message: string }> {
    try {
      const { data: worker, error } = await supabase
        .from('worker_profiles')
        .select(`
          *,
          profiles!inner(
            id,
            full_name,
            phone,
            email,
            avatar_url,
            city,
            area,
            created_at
          ),
          worker_documents(
            id,
            document_type,
            document_url,
            document_number,
            verification_status,
            uploaded_at,
            verified_at,
            verified_by
          )
        `)
        .eq('user_id', workerId)
        .single()

      if (error || !worker) {
        return { success: false, message: 'Worker not found' }
      }

      return {
        success: true,
        worker,
        message: 'Worker details fetched successfully'
      }
    } catch (error) {
      console.error('Get worker details error:', error)
      return { success: false, message: 'Failed to fetch worker details' }
    }
  }

  /**
   * Approve or reject worker verification
   */
  async updateWorkerVerification(request: WorkerVerificationRequest): Promise<WorkerVerificationResponse> {
    try {
      const now = new Date().toISOString()

      // Update worker profile
      const { data: workerProfile, error: updateError } = await supabase
        .from('worker_profiles')
        .update({
          verification_status: request.status,
          rejection_reason: request.rejectionReason,
          verified_at: request.status === 'approved' ? now : null,
          verified_by: request.verifiedBy,
          updated_at: now
        })
        .eq('user_id', request.workerId)
        .select()
        .single()

      if (updateError) {
        console.error('Worker verification update error:', updateError)
        return { success: false, message: 'Failed to update worker verification' }
      }

      // If approved, assign provider role
      if (request.status === 'approved') {
        const { error: roleError } = await supabase
          .from('user_roles')
          .upsert({
            user_id: request.workerId,
            role: 'provider'
          }, {
            onConflict: 'user_id,role'
          })

        if (roleError) {
          console.error('Role assignment error:', roleError)
          return { success: false, message: 'Failed to assign provider role' }
        }

        // Create provider profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, phone, email, avatar_url, city, area')
          .eq('id', request.workerId)
          .single()

        if (profile) {
          await supabase
            .from('provider_profiles')
            .insert({
              user_id: request.workerId,
              profession: workerProfile.service_type as any,
              experience_years: workerProfile.experience_years || 0,
              bio: workerProfile.bio,
              is_verified: true,
              is_available: true,
              specialties: workerProfile.specialties || [],
              onboarding_completed: true
            })
        }
      }

      // Update all documents verification status
      if (request.status === 'approved') {
        await supabase
          .from('worker_documents')
          .update({
            verification_status: 'verified',
            verified_at: now,
            verified_by: request.verifiedBy
          })
          .eq('worker_id', request.workerId)
      } else if (request.status === 'rejected') {
        await supabase
          .from('worker_documents')
          .update({
            verification_status: 'rejected',
            rejection_reason: request.rejectionReason
          })
          .eq('worker_id', request.workerId)
      }

      // Log the action
      await supabase
        .from('audit_log')
        .insert({
          user_id: request.verifiedBy,
          action: `WORKER_VERIFICATION_${request.status.toUpperCase()}`,
          table_name: 'worker_profiles',
          record_id: workerProfile.id,
          new_values: {
            verification_status: request.status,
            rejection_reason: request.rejectionReason,
            verified_by: request.verifiedBy
          }
        })

      return {
        success: true,
        message: `Worker ${request.status} successfully`,
        workerProfile
      }
    } catch (error) {
      console.error('Worker verification error:', error)
      return { success: false, message: 'Failed to update worker verification' }
    }
  }

  /**
   * Verify individual document
   */
  async verifyDocument(
    documentId: string,
    verifiedBy: string,
    status: 'verified' | 'rejected',
    rejectionReason?: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const { error } = await supabase
        .from('worker_documents')
        .update({
          verification_status: status,
          rejection_reason: rejectionReason,
          verified_at: status === 'verified' ? new Date().toISOString() : null,
          verified_by: verifiedBy
        })
        .eq('id', documentId)

      if (error) {
        console.error('Document verification error:', error)
        return { success: false, message: 'Failed to verify document' }
      }

      return {
        success: true,
        message: `Document ${status} successfully`
      }
    } catch (error) {
      console.error('Document verification error:', error)
      return { success: false, message: 'Failed to verify document' }
    }
  }

  /**
   * Get verification statistics
   */
  async getVerificationStats(): Promise<{
    success: boolean
    stats?: {
      total: number
      pending: number
      underReview: number
      approved: number
      rejected: number
      byServiceType: Record<string, number>
      byCity: Record<string, number>
    }
    message: string
  }> {
    try {
      // Get overall stats
      const { data: workers, error } = await supabase
        .from('worker_profiles')
        .select('verification_status, service_type, service_city')

      if (error) {
        console.error('Get verification stats error:', error)
        return { success: false, message: 'Failed to fetch verification stats' }
      }

      const stats = {
        total: workers?.length || 0,
        pending: 0,
        underReview: 0,
        approved: 0,
        rejected: 0,
        byServiceType: {} as Record<string, number>,
        byCity: {} as Record<string, number>
      }

      workers?.forEach(worker => {
        // Count by status
        switch (worker.verification_status) {
          case 'pending':
            stats.pending++
            break
          case 'under_review':
            stats.underReview++
            break
          case 'approved':
            stats.approved++
            break
          case 'rejected':
            stats.rejected++
            break
        }

        // Count by service type
        if (worker.service_type) {
          stats.byServiceType[worker.service_type] = (stats.byServiceType[worker.service_type] || 0) + 1
        }

        // Count by city
        if (worker.service_city) {
          stats.byCity[worker.service_city] = (stats.byCity[worker.service_city] || 0) + 1
        }
      })

      return {
        success: true,
        stats,
        message: 'Verification stats fetched successfully'
      }
    } catch (error) {
      console.error('Get verification stats error:', error)
      return { success: false, message: 'Failed to fetch verification stats' }
    }
  }

  /**
   * Get recent verification activities
   */
  async getRecentActivities(limit: number = 20): Promise<{
    success: boolean
    activities?: any[]
    message: string
  }> {
    try {
      const { data: activities, error } = await supabase
        .from('audit_log')
        .select(`
          *,
          profiles(
            full_name,
            email
          )
        `)
        .or('action.eq.WORKER_VERIFICATION_APPROVED,action.eq.WORKER_VERIFICATION_REJECTED')
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) {
        console.error('Get recent activities error:', error)
        return { success: false, message: 'Failed to fetch recent activities' }
      }

      return {
        success: true,
        activities: activities || [],
        message: 'Recent activities fetched successfully'
      }
    } catch (error) {
      console.error('Get recent activities error:', error)
      return { success: false, message: 'Failed to fetch recent activities' }
    }
  }

  /**
   * Export workers data
   */
  async exportWorkers(filters: WorkerListFilters = {}): Promise<{
    success: boolean
    data?: any[]
    message: string
  }> {
    try {
      const result = await this.getAllWorkers({ ...filters, limit: 1000 })
      
      if (!result.success) {
        return { success: false, message: result.message }
      }

      // Transform data for export
      const exportData = result.workers?.map(worker => ({
        'Worker ID': worker.user_id,
        'Name': worker.full_name,
        'Phone': worker.phone,
        'Email': worker.email,
        'Service Type': worker.service_type,
        'Experience Years': worker.experience_years,
        'Service City': worker.service_city,
        'Service Area': worker.service_area,
        'Verification Status': worker.verification_status,
        'Applied Date': worker.created_at,
        'Verified Date': worker.verified_at,
        'Rejection Reason': worker.rejection_reason
      }))

      return {
        success: true,
        data: exportData,
        message: 'Workers data exported successfully'
      }
    } catch (error) {
      console.error('Export workers error:', error)
      return { success: false, message: 'Failed to export workers data' }
    }
  }

  /**
   * Bulk update worker verification status
   */
  async bulkUpdateVerification(
    workerIds: string[],
    verifiedBy: string,
    status: 'approved' | 'rejected',
    rejectionReason?: string
  ): Promise<{ success: boolean; message: string; updatedCount?: number }> {
    try {
      let updatedCount = 0

      for (const workerId of workerIds) {
        const result = await this.updateWorkerVerification({
          workerId,
          status,
          rejectionReason,
          verifiedBy
        })

        if (result.success) {
          updatedCount++
        }
      }

      return {
        success: true,
        message: `Bulk update completed. ${updatedCount} out of ${workerIds.length} workers updated.`,
        updatedCount
      }
    } catch (error) {
      console.error('Bulk update verification error:', error)
      return { success: false, message: 'Failed to bulk update verification' }
    }
  }
}

export const adminVerificationService = new AdminVerificationService()
