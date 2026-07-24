import { supabase } from '../integrations/supabase/client'
import type { Database } from '../integrations/supabase/types'

export interface WorkerOnboardingStep1 {
  phone: string
  otp: string
}

export interface WorkerOnboardingStep2 {
  fullName: string
  email?: string
  gender?: 'male' | 'female' | 'other'
  dateOfBirth?: string
  profilePhotoUrl?: string
}

export interface WorkerOnboardingStep3 {
  serviceType: string
  experienceYears: number
  serviceCity: string
  serviceArea?: string
  specialties?: string[]
  bio?: string
  portfolioUrls?: string[]
}

export interface WorkerOnboardingStep4 {
  governmentIdType: 'aadhaar' | 'pan' | 'driving_license' | 'passport'
  governmentIdUrl: string
  governmentIdNumber?: string
  addressProofUrl?: string
  bankAccountHolder: string
  bankAccountNumber: string
  bankName: string
  bankIfsc: string
  bankBranchName?: string
  portfolioUrls?: string[]
}

export interface WorkerOnboardingResponse {
  success: boolean
  message: string
  currentStep?: number
  workerProfile?: any
  nextStep?: number
}

class WorkerOnboardingService {
  private readonly SERVICE_TYPES = [
    'photographer',
    'videographer', 
    'dj',
    'decorator',
    'caterer',
    'makeup_artist',
    'mehandi_artist',
    'live_band',
    'classical_dancer',
    'western_dancer',
    'event_support',
    'transportation'
  ]

  /**
   * Start worker onboarding process (Step 1)
   */
  async startOnboarding(phone: string, otp: string): Promise<WorkerOnboardingResponse> {
    try {
      // Verify OTP first
      const { data: otpData, error: otpError } = await supabase
        .from('otp_verifications')
        .select('*')
        .eq('phone', phone)
        .eq('purpose', 'worker_onboarding')
        .eq('verified', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (otpError || !otpData) {
        return { success: false, message: 'Please verify OTP first' }
      }

      // Check if user exists
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('phone', phone)
        .single()

      if (profileError || !profile) {
        return { success: false, message: 'User profile not found' }
      }

      // Check if worker profile already exists
      const { data: existingWorker, error: workerError } = await supabase
        .from('worker_profiles')
        .select('*')
        .eq('user_id', profile.id)
        .single()

      if (existingWorker) {
        return { 
          success: false, 
          message: 'Worker onboarding already started or completed',
          currentStep: this.getCurrentStep(existingWorker)
        }
      }

      // Create initial worker profile
      const { data: workerProfile, error: createError } = await supabase
        .from('worker_profiles')
        .insert({
          user_id: profile.id,
          phone: phone,
          verification_status: 'pending',
          full_name: '',
          service_type: ''
        })
        .select()
        .single()

      if (createError || !workerProfile) {
        console.error('Worker profile creation error:', createError)
        return { success: false, message: 'Failed to start onboarding' }
      }

      return {
        success: true,
        message: 'Onboarding started successfully',
        currentStep: 2,
        workerProfile,
        nextStep: 2
      }
    } catch (error) {
      console.error('Start onboarding error:', error)
      return { success: false, message: 'Failed to start onboarding' }
    }
  }

  /**
   * Update basic profile details (Step 2)
   */
  async updateBasicDetails(
    userId: string,
    details: WorkerOnboardingStep2
  ): Promise<WorkerOnboardingResponse> {
    try {
      // Update worker profile
      const { data: workerProfile, error: updateError } = await supabase
        .from('worker_profiles')
        .update({
          full_name: details.fullName,
          email: details.email,
          gender: details.gender,
          profile_photo_url: details.profilePhotoUrl,
          date_of_birth: details.dateOfBirth,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .select()
        .single()

      if (updateError) {
        console.error('Basic details update error:', updateError)
        return { success: false, message: 'Failed to update basic details' }
      }

      // Update main profile too
      await supabase
        .from('profiles')
        .update({
          full_name: details.fullName,
          email: details.email,
          avatar_url: details.profilePhotoUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)

      return {
        success: true,
        message: 'Basic details updated successfully',
        currentStep: 3,
        workerProfile,
        nextStep: 3
      }
    } catch (error) {
      console.error('Basic details update error:', error)
      return { success: false, message: 'Failed to update basic details' }
    }
  }

  /**
   * Update service information (Step 3)
   */
  async updateServiceInformation(
    userId: string,
    serviceInfo: WorkerOnboardingStep3
  ): Promise<WorkerOnboardingResponse> {
    try {
      // Validate service type
      if (!this.SERVICE_TYPES.includes(serviceInfo.serviceType)) {
        return { success: false, message: 'Invalid service type' }
      }

      // Update worker profile
      const { data: workerProfile, error: updateError } = await supabase
        .from('worker_profiles')
        .update({
          service_type: serviceInfo.serviceType,
          experience_years: serviceInfo.experienceYears,
          service_city: serviceInfo.serviceCity,
          service_area: serviceInfo.serviceArea,
          portfolio_urls: serviceInfo.portfolioUrls || [],
          bio: serviceInfo.bio,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .select()
        .single()

      if (updateError) {
        console.error('Service information update error:', updateError)
        return { success: false, message: 'Failed to update service information' }
      }

      return {
        success: true,
        message: 'Service information updated successfully',
        currentStep: 4,
        workerProfile,
        nextStep: 4
      }
    } catch (error) {
      console.error('Service information update error:', error)
      return { success: false, message: 'Failed to update service information' }
    }
  }

  /**
   * Upload and verify documents (Step 4)
   */
  async uploadDocuments(
    userId: string,
    documents: WorkerOnboardingStep4
  ): Promise<WorkerOnboardingResponse> {
    try {
      // Get worker profile
      const { data: workerProfile, error: workerError } = await supabase
        .from('worker_profiles')
        .select('id')
        .eq('user_id', userId)
        .single()

      if (workerError || !workerProfile) {
        return { success: false, message: 'Worker profile not found' }
      }

      // Update worker profile with basic document info
      await supabase
        .from('worker_profiles')
        .update({
          government_id_type: documents.governmentIdType,
          government_id_url: documents.governmentIdUrl,
          government_id_number: documents.governmentIdNumber,
          address_proof_url: documents.addressProofUrl,
          bank_account_holder: documents.bankAccountHolder,
          bank_account_number: documents.bankAccountNumber,
          bank_name: documents.bankName,
          bank_ifsc: documents.bankIfsc,
          bank_branch_name: documents.bankBranchName,
          portfolio_urls: documents.portfolioUrls || [],
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)

      // Upload documents to worker_documents table for detailed tracking
      const documentTypes = [
        { type: 'government_id', url: documents.governmentIdUrl, number: documents.governmentIdNumber },
        { type: 'address_proof', url: documents.addressProofUrl },
        { type: 'bank_details', url: '', number: documents.bankAccountNumber }
      ]

      for (const doc of documentTypes) {
        if (doc.url) {
          await supabase
            .from('worker_documents')
            .insert({
              worker_id: userId,
              document_type: doc.type,
              document_url: doc.url,
              document_number: doc.number,
              verification_status: 'pending'
            })
        }
      }

      // Upload portfolio items
      if (documents.portfolioUrls && documents.portfolioUrls.length > 0) {
        for (let i = 0; i < documents.portfolioUrls.length; i++) {
          await supabase
            .from('worker_documents')
            .insert({
              worker_id: userId,
              document_type: 'portfolio',
              document_url: documents.portfolioUrls[i],
              verification_status: 'pending'
            })
        }
      }

      // Update verification status to under_review
      const { data: updatedProfile, error: statusError } = await supabase
        .from('worker_profiles')
        .update({
          verification_status: 'under_review',
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .select()
        .single()

      if (statusError) {
        console.error('Status update error:', statusError)
        return { success: false, message: 'Failed to update verification status' }
      }

      return {
        success: true,
        message: 'Documents uploaded successfully. Your application is now under review.',
        currentStep: 5,
        workerProfile: updatedProfile,
        nextStep: 5
      }
    } catch (error) {
      console.error('Document upload error:', error)
      return { success: false, message: 'Failed to upload documents' }
    }
  }

  /**
   * Get current onboarding step for a worker
   */
  async getCurrentOnboardingStep(userId: string): Promise<{ success: boolean; step: number; message: string }> {
    try {
      const { data: workerProfile, error } = await supabase
        .from('worker_profiles')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (error || !workerProfile) {
        return { success: false, step: 1, message: 'Worker profile not found' }
      }

      const step = this.getCurrentStep(workerProfile)
      return { success: true, step, message: `Current step: ${step}` }
    } catch (error) {
      console.error('Get current step error:', error)
      return { success: false, step: 1, message: 'Failed to get current step' }
    }
  }

  /**
   * Get worker profile details
   */
  async getWorkerProfile(userId: string): Promise<{ success: boolean; profile?: any; message: string }> {
    try {
      const { data: workerProfile, error } = await supabase
        .from('worker_profiles')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (error || !workerProfile) {
        return { success: false, message: 'Worker profile not found' }
      }

      // Get documents
      const { data: documents } = await supabase
        .from('worker_documents')
        .select('*')
        .eq('worker_id', userId)

      return {
        success: true,
        profile: { ...workerProfile, documents },
        message: 'Worker profile found'
      }
    } catch (error) {
      console.error('Get worker profile error:', error)
      return { success: false, message: 'Failed to get worker profile' }
    }
  }

  /**
   * Get available service types
   */
  getServiceTypes(): string[] {
    return this.SERVICE_TYPES
  }

  /**
   * Determine current step based on profile completion
   */
  private getCurrentStep(workerProfile: any): number {
    if (!workerProfile.full_name && !workerProfile.email) {
      return 2 // Basic details needed
    }
    
    if (!workerProfile.service_type || !workerProfile.experience_years) {
      return 3 // Service information needed
    }
    
    if (!workerProfile.government_id_url || !workerProfile.bank_account_number) {
      return 4 // Documents needed
    }
    
    if (workerProfile.verification_status === 'pending') {
      return 5 // Under review
    }
    
    if (workerProfile.verification_status === 'approved') {
      return 6 // Completed
    }
    
    return 5 // Default to under review
  }

  /**
   * Check if worker can login (approved status)
   */
  async canWorkerLogin(userId: string): Promise<{ success: boolean; canLogin: boolean; message: string }> {
    try {
      const { data: workerProfile, error } = await supabase
        .from('worker_profiles')
        .select('verification_status')
        .eq('user_id', userId)
        .single()

      if (error || !workerProfile) {
        return { success: false, canLogin: false, message: 'Worker profile not found' }
      }

      const canLogin = workerProfile.verification_status === 'approved'
      const message = canLogin ? 'Worker can login' : 'Worker account not approved yet'

      return { success: true, canLogin, message }
    } catch (error) {
      console.error('Check worker login error:', error)
      return { success: false, canLogin: false, message: 'Failed to check worker login status' }
    }
  }

  /**
   * Submit onboarding for review
   */
  async submitForReview(userId: string): Promise<WorkerOnboardingResponse> {
    try {
      const { data: workerProfile, error } = await supabase
        .from('worker_profiles')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (error || !workerProfile) {
        return { success: false, message: 'Worker profile not found' }
      }

      // Check if all required fields are filled
      const requiredFields = [
        workerProfile.full_name,
        workerProfile.service_type,
        workerProfile.experience_years,
        workerProfile.government_id_url,
        workerProfile.bank_account_number
      ]

      if (requiredFields.some(field => !field)) {
        return { success: false, message: 'Please complete all required fields before submitting' }
      }

      // Update status to under_review
      const { data: updatedProfile, error: updateError } = await supabase
        .from('worker_profiles')
        .update({
          verification_status: 'under_review',
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .select()
        .single()

      if (updateError) {
        console.error('Submit for review error:', updateError)
        return { success: false, message: 'Failed to submit for review' }
      }

      return {
        success: true,
        message: 'Application submitted for review. You will be notified once approved.',
        currentStep: 5,
        workerProfile: updatedProfile
      }
    } catch (error) {
      console.error('Submit for review error:', error)
      return { success: false, message: 'Failed to submit for review' }
    }
  }
}

export const workerOnboardingService = new WorkerOnboardingService()
