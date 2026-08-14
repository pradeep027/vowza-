export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      bookings: {
        Row: {
          amount: number
          created_at: string
          customer_id: string
          customer_notes: string | null
          event_date: string
          event_duration_hours: number | null
          event_time: string | null
          event_type_id: string | null
          id: string
          platform_fee: number | null
          provider_id: string
          provider_notes: string | null
          requirements: string | null
          status: Database["public"]["Enums"]["booking_status"]
          updated_at: string
          venue_address: string
          venue_area: string | null
          venue_city: string
        }
        Insert: {
          amount: number
          created_at?: string
          customer_id: string
          customer_notes?: string | null
          event_date: string
          event_duration_hours?: number | null
          event_time?: string | null
          event_type_id?: string | null
          id?: string
          platform_fee?: number | null
          provider_id: string
          provider_notes?: string | null
          requirements?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
          venue_address: string
          venue_area?: string | null
          venue_city: string
        }
        Update: {
          amount?: number
          created_at?: string
          customer_id?: string
          customer_notes?: string | null
          event_date?: string
          event_duration_hours?: number | null
          event_time?: string | null
          event_type_id?: string | null
          id?: string
          platform_fee?: number | null
          provider_id?: string
          provider_notes?: string | null
          requirements?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
          venue_address?: string
          venue_area?: string | null
          venue_city?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_event_type_id_fkey"
            columns: ["event_type_id"]
            isOneToOne: false
            referencedRelation: "event_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_types: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          booking_id: string
          content: string
          created_at: string
          id: string
          is_read: boolean | null
          sender_id: string
        }
        Insert: {
          booking_id: string
          content: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          sender_id: string
        }
        Update: {
          booking_id?: string
          content?: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean | null
          message: string
          reference_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean | null
          message: string
          reference_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean | null
          message?: string
          reference_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      otp_rate_limits: {
        Row: {
          created_at: string
          id: string
          ip_address: string | null
          phone: string
          request_count: number | null
          window_start: string
        }
        Insert: {
          created_at?: string
          id?: string
          ip_address?: string | null
          phone: string
          request_count?: number | null
          window_start?: string
        }
        Update: {
          created_at?: string
          id?: string
          ip_address?: string | null
          phone?: string
          request_count?: number | null
          window_start?: string
        }
        Relationships: []
      }
      otp_verifications: {
        Row: {
          attempts: number | null
          created_at: string
          expires_at: string
          id: string
          otp_hash: string
          phone: string
          purpose: string
          verified: boolean | null
        }
        Insert: {
          attempts?: number | null
          created_at?: string
          expires_at: string
          id?: string
          otp_hash: string
          phone: string
          purpose: string
          verified?: boolean | null
        }
        Update: {
          attempts?: number | null
          created_at?: string
          expires_at?: string
          id?: string
          otp_hash?: string
          phone?: string
          purpose?: string
          verified?: boolean | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          booking_id: string
          created_at: string
          id: string
          paid_at: string | null
          payment_method: string | null
          platform_fee: number | null
          provider_amount: number
          status: Database["public"]["Enums"]["payment_status"]
          transaction_id: string | null
        }
        Insert: {
          amount: number
          booking_id: string
          created_at?: string
          id?: string
          paid_at?: string | null
          payment_method?: string | null
          platform_fee?: number | null
          provider_amount: number
          status?: Database["public"]["Enums"]["payment_status"]
          transaction_id?: string | null
        }
        Update: {
          amount?: number
          booking_id?: string
          created_at?: string
          id?: string
          paid_at?: string | null
          payment_method?: string | null
          platform_fee?: number | null
          provider_amount?: number
          status?: Database["public"]["Enums"]["payment_status"]
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_items: {
        Row: {
          created_at: string
          description: string | null
          id: string
          media_type: string
          media_url: string
          provider_id: string
          title: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          media_type: string
          media_url: string
          provider_id: string
          title?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          media_type?: string
          media_url?: string
          provider_id?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_items_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          area: string | null
          avatar_url: string | null
          city: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          phone: string | null
          state: string | null
          updated_at: string
        }
        Insert: {
          area?: string | null
          avatar_url?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id: string
          phone?: string | null
          state?: string | null
          updated_at?: string
        }
        Update: {
          area?: string | null
          avatar_url?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          state?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      provider_availability: {
        Row: {
          id: string
          provider_id: string
          reason: string | null
          unavailable_date: string
        }
        Insert: {
          id?: string
          provider_id: string
          reason?: string | null
          unavailable_date: string
        }
        Update: {
          id?: string
          provider_id?: string
          reason?: string | null
          unavailable_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_availability_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_profiles: {
        Row: {
          average_rating: number | null
          bio: string | null
          category_details: Json | null
          cover_image_url: string | null
          created_at: string
          experience_years: number | null
          id: string
          is_available: boolean | null
          is_verified: boolean | null
          languages: string[] | null
          onboarding_completed: boolean | null
          performance_type: string | null
          price_max: number | null
          price_min: number | null
          pricing_type: string | null
          profession: Database["public"]["Enums"]["profession_type"]
          specialties: string[] | null
          stage_name: string | null
          total_bookings: number | null
          total_reviews: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          average_rating?: number | null
          bio?: string | null
          category_details?: Json | null
          cover_image_url?: string | null
          created_at?: string
          experience_years?: number | null
          id?: string
          is_available?: boolean | null
          is_verified?: boolean | null
          languages?: string[] | null
          onboarding_completed?: boolean | null
          performance_type?: string | null
          price_max?: number | null
          price_min?: number | null
          pricing_type?: string | null
          profession: Database["public"]["Enums"]["profession_type"]
          specialties?: string[] | null
          stage_name?: string | null
          total_bookings?: number | null
          total_reviews?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          average_rating?: number | null
          bio?: string | null
          category_details?: Json | null
          cover_image_url?: string | null
          created_at?: string
          experience_years?: number | null
          id?: string
          is_available?: boolean | null
          is_verified?: boolean | null
          languages?: string[] | null
          onboarding_completed?: boolean | null
          performance_type?: string | null
          price_max?: number | null
          price_min?: number | null
          pricing_type?: string | null
          profession?: Database["public"]["Enums"]["profession_type"]
          specialties?: string[] | null
          stage_name?: string | null
          total_bookings?: number | null
          total_reviews?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          booking_id: string
          created_at: string
          customer_id: string
          id: string
          provider_id: string
          rating: number
          review_text: string | null
        }
        Insert: {
          booking_id: string
          created_at?: string
          customer_id: string
          id?: string
          provider_id: string
          rating: number
          review_text?: string | null
        }
        Update: {
          booking_id?: string
          created_at?: string
          customer_id?: string
          id?: string
          provider_id?: string
          rating?: number
          review_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      auth_promotional_config: {
        Row: {
          admin_id: string
          created_at: string
          current_image_url: string | null
          id: string
          image_storage_path: string | null
          is_active: boolean
          overlay_color: string
          overlay_opacity: number
          updated_at: string
        }
        Insert: {
          admin_id?: string
          created_at?: string
          current_image_url?: string | null
          id?: string
          image_storage_path?: string | null
          is_active?: boolean
          overlay_color?: string
          overlay_opacity?: number
          updated_at?: string
        }
        Update: {
          admin_id?: string
          created_at?: string
          current_image_url?: string | null
          id?: string
          image_storage_path?: string | null
          is_active?: boolean
          overlay_color?: string
          overlay_opacity?: number
          updated_at?: string
        }
        Relationships: []
      }
      worker_profiles: {
        Row: {
          address_proof_url: string | null
          bank_account_holder: string | null
          bank_account_number: string | null
          bank_ifsc: string | null
          created_at: string
          email: string | null
          experience_years: number | null
          full_name: string
          gender: string | null
          government_id_type: string | null
          government_id_url: string | null
          id: string
          phone: string
          portfolio_urls: string[] | null
          profile_photo_url: string | null
          rejection_reason: string | null
          service_area: string | null
          service_city: string | null
          service_type: string
          updated_at: string
          user_id: string
          verification_status:
            | Database["public"]["Enums"]["verification_status"]
            | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          address_proof_url?: string | null
          bank_account_holder?: string | null
          bank_account_number?: string | null
          bank_ifsc?: string | null
          created_at?: string
          email?: string | null
          experience_years?: number | null
          full_name: string
          gender?: string | null
          government_id_type?: string | null
          government_id_url?: string | null
          id?: string
          phone: string
          portfolio_urls?: string[] | null
          profile_photo_url?: string | null
          rejection_reason?: string | null
          service_area?: string | null
          service_city?: string | null
          service_type: string
          updated_at?: string
          user_id: string
          verification_status?:
            | Database["public"]["Enums"]["verification_status"]
            | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          address_proof_url?: string | null
          bank_account_holder?: string | null
          bank_account_number?: string | null
          bank_ifsc?: string | null
          created_at?: string
          email?: string | null
          experience_years?: number | null
          full_name?: string
          gender?: string | null
          government_id_type?: string | null
          government_id_url?: string | null
          id?: string
          phone?: string
          portfolio_urls?: string[] | null
          profile_photo_url?: string | null
          rejection_reason?: string | null
          service_area?: string | null
          service_city?: string | null
          service_type?: string
          updated_at?: string
          user_id?: string
          verification_status?:
            | Database["public"]["Enums"]["verification_status"]
            | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "customer" | "provider" | "admin" | "super_admin"
      booking_status:
        | "requested"
        | "accepted"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "rejected"
      payment_status: "pending" | "paid" | "refunded" | "failed"
      profession_type:
        | "normal_band"
        | "maharashtra_band"
        | "musician"
        | "dj"
        | "photographer"
        | "videographer"
        | "decorator"
        | "kuchipudi_dancer"
        | "classical_dancer"
        | "western_dancer"
        | "event_support"
        | "music_band"
        | "traditional_band"
        | "singer"
        | "instrumental_artist"
        | "classical_musician"
        | "cinematographer"
        | "drone_operator"
        | "dancer"
        | "choreographer"
        | "wedding_decorator"
        | "stage_decorator"
        | "event_decorator"
        | "makeup_artist"
        | "mehendi_artist"
        | "anchor"
        | "host"
        | "magician"
        | "stand_up_comedian"
        | "celebrity_artist"
        | "live_performer"
        | "folk_artist"
        | "lighting_services"
        | "sound_services"
        | "event_planner"
        | "wedding_planner"
        | "catering_services"
        | "event_support_staff"
      verification_status: "pending" | "under_review" | "approved" | "rejected"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["customer", "provider", "admin", "super_admin"],
      booking_status: [
        "requested",
        "accepted",
        "in_progress",
        "completed",
        "cancelled",
        "rejected",
      ],
      payment_status: ["pending", "paid", "refunded", "failed"],
      profession_type: [
        "normal_band",
        "maharashtra_band",
        "musician",
        "dj",
        "photographer",
        "videographer",
        "decorator",
        "kuchipudi_dancer",
        "classical_dancer",
        "western_dancer",
        "event_support",
      ],
      verification_status: ["pending", "under_review", "approved", "rejected"],
    },
  },
} as const
