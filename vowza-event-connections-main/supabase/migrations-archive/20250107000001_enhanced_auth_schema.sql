-- Enhanced authentication and worker onboarding schema
-- This migration adds the missing pieces for the complete auth system

-- Create refresh tokens table for JWT rotation
CREATE TABLE public.refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  device_info JSONB,
  ip_address INET,
  expires_at TIMESTAMPTZ NOT NULL,
  is_revoked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ DEFAULT now()
);

-- Create login_attempts table for security monitoring
CREATE TABLE public.login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  ip_address INET,
  user_agent TEXT,
  attempt_type TEXT NOT NULL CHECK (attempt_type IN ('otp_request', 'otp_verify', 'login')),
  success BOOLEAN NOT NULL,
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enhance worker_profiles with additional verification fields
ALTER TABLE public.worker_profiles 
ADD COLUMN IF NOT EXISTS date_of_birth DATE,
ADD COLUMN IF NOT EXISTS alternate_phone TEXT,
ADD COLUMN IF NOT EXISTS whatsapp_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS background_check_completed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS training_completed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;

-- Create worker_documents table for document management
CREATE TABLE public.worker_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES public.worker_profiles(user_id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN (
    'government_id', 'address_proof', 'bank_details', 'portfolio', 'certification', 'photo'
  )),
  document_url TEXT NOT NULL,
  document_number TEXT,
  issued_date DATE,
  expiry_date DATE,
  verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected')),
  rejection_reason TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES auth.users(id)
);

-- Create worker_bank_accounts table for secure payout handling
CREATE TABLE public.worker_bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES public.worker_profiles(user_id) ON DELETE CASCADE,
  account_holder_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  ifsc_code TEXT NOT NULL,
  branch_name TEXT,
  is_verified BOOLEAN DEFAULT false,
  verification_ref_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create audit_log table for compliance
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  table_name TEXT,
  record_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create notification_settings table
CREATE TABLE public.notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  sms_enabled BOOLEAN DEFAULT true,
  email_enabled BOOLEAN DEFAULT true,
  push_enabled BOOLEAN DEFAULT true,
  booking_notifications BOOLEAN DEFAULT true,
  payment_notifications BOOLEAN DEFAULT true,
  marketing_notifications BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_refresh_tokens_user_id ON public.refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_expires_at ON public.refresh_tokens(expires_at);
CREATE INDEX idx_login_attempts_phone ON public.login_attempts(phone);
CREATE INDEX idx_login_attempts_created_at ON public.login_attempts(created_at);
CREATE INDEX idx_worker_documents_worker_id ON public.worker_documents(worker_id);
CREATE INDEX idx_worker_documents_status ON public.worker_documents(verification_status);
CREATE INDEX idx_audit_log_user_id ON public.audit_log(user_id);
CREATE INDEX idx_audit_log_created_at ON public.audit_log(created_at);

-- Enable RLS
ALTER TABLE public.refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Refresh tokens: Users can only access their own tokens
CREATE POLICY "Users can view own refresh tokens" ON public.refresh_tokens
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own refresh tokens" ON public.refresh_tokens
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own refresh tokens" ON public.refresh_tokens
FOR UPDATE USING (auth.uid() = user_id);

-- Login attempts: Read-only for users, admins can see all
CREATE POLICY "All users can view login attempts" ON public.login_attempts
FOR SELECT USING (true);

CREATE POLICY "Service can insert login attempts" ON public.login_attempts
FOR INSERT WITH CHECK (true);

-- Worker documents: Workers can view their own, admins can view all
CREATE POLICY "Workers can view own documents" ON public.worker_documents
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.worker_profiles wp 
    WHERE wp.user_id = auth.uid() AND wp.user_id = worker_id
  )
);

CREATE POLICY "Workers can insert own documents" ON public.worker_documents
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.worker_profiles wp 
    WHERE wp.user_id = auth.uid() AND wp.user_id = worker_id
  )
);

CREATE POLICY "Admins can manage all worker documents" ON public.worker_documents
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
  )
);

-- Worker bank accounts: Workers can view own, admins can view all
CREATE POLICY "Workers can view own bank accounts" ON public.worker_bank_accounts
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.worker_profiles wp 
    WHERE wp.user_id = auth.uid() AND wp.user_id = worker_id
  )
);

CREATE POLICY "Workers can insert own bank accounts" ON public.worker_bank_accounts
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.worker_profiles wp 
    WHERE wp.user_id = auth.uid() AND wp.user_id = worker_id
  )
);

CREATE POLICY "Admins can manage all worker bank accounts" ON public.worker_bank_accounts
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
  )
);

-- Audit log: Read-only for users, admins can see all
CREATE POLICY "Users can view own audit logs" ON public.audit_log
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all audit logs" ON public.audit_log
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
  )
);

-- Notification settings: Users can manage own settings
CREATE POLICY "Users can manage own notification settings" ON public.notification_settings
FOR ALL USING (auth.uid() = user_id);

-- Create function to automatically create notification settings for new users
CREATE OR REPLACE FUNCTION public.create_notification_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.notification_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically create notification settings
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_notification_settings();

-- Create function to log changes
CREATE OR REPLACE FUNCTION public.log_audit_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log (user_id, action, table_name, record_id, new_values)
    VALUES (auth.uid(), 'INSERT', TG_TABLE_NAME, NEW.id, row_to_json(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_log (user_id, action, table_name, record_id, old_values, new_values)
    VALUES (auth.uid(), 'UPDATE', TG_TABLE_NAME, NEW.id, row_to_json(OLD), row_to_json(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log (user_id, action, table_name, record_id, old_values)
    VALUES (auth.uid(), 'DELETE', TG_TABLE_NAME, OLD.id, row_to_json(OLD));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for audit logging
CREATE TRIGGER audit_worker_profiles_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.worker_profiles
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_changes();

CREATE TRIGGER audit_worker_documents_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.worker_documents
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_changes();

-- Create function to check if user has specific role
CREATE OR REPLACE FUNCTION public.user_has_role(p_user_id UUID, p_role TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = p_user_id AND ur.role = p_role::public.app_role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get user roles
CREATE OR REPLACE FUNCTION public.get_user_roles(p_user_id UUID)
RETURNS TEXT[] AS $$
BEGIN
  RETURN ARRAY(
    SELECT ur.role::TEXT FROM public.user_roles ur 
    WHERE ur.user_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
