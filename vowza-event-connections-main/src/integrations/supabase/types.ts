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
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      about_team_members: {
        Row: {
          bio: string
          created_at: string | null
          display_order: number
          id: string
          is_active: boolean | null
          linkedin_url: string | null
          member_type: string
          name: string
          photo_url: string | null
          role: string
          updated_at: string | null
        }
        Insert: {
          bio?: string
          created_at?: string | null
          display_order?: number
          id?: string
          is_active?: boolean | null
          linkedin_url?: string | null
          member_type: string
          name: string
          photo_url?: string | null
          role: string
          updated_at?: string | null
        }
        Update: {
          bio?: string
          created_at?: string | null
          display_order?: number
          id?: string
          is_active?: boolean | null
          linkedin_url?: string | null
          member_type?: string
          name?: string
          photo_url?: string | null
          role?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      about_us: {
        Row: {
          description: string
          hero_image_url: string | null
          id: string
          mission: string
          title: string
          updated_at: string | null
          updated_by: string | null
          vision: string
        }
        Insert: {
          description?: string
          hero_image_url?: string | null
          id?: string
          mission?: string
          title?: string
          updated_at?: string | null
          updated_by?: string | null
          vision?: string
        }
        Update: {
          description?: string
          hero_image_url?: string | null
          id?: string
          mission?: string
          title?: string
          updated_at?: string | null
          updated_by?: string | null
          vision?: string
        }
        Relationships: [
          {
            foreignKeyName: "about_us_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_event_package_bookings: {
        Row: {
          created_at: string | null
          customer_id: string
          discount_applied: number | null
          event_date: string
          event_location: string | null
          final_price: number
          guest_count: number | null
          id: string
          package_id: string
          package_price: number
          payment_status: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          customer_id: string
          discount_applied?: number | null
          event_date: string
          event_location?: string | null
          final_price: number
          guest_count?: number | null
          id?: string
          package_id: string
          package_price: number
          payment_status?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string
          discount_applied?: number | null
          event_date?: string
          event_location?: string | null
          final_price?: number
          guest_count?: number | null
          id?: string
          package_id?: string
          package_price?: number
          payment_status?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_event_package_bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_event_package_bookings_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "admin_event_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_event_package_discounts: {
        Row: {
          active_from: string
          active_until: string | null
          created_at: string | null
          created_by: string
          discount_percentage: number
          id: string
          package_id: string
          reason: string | null
        }
        Insert: {
          active_from: string
          active_until?: string | null
          created_at?: string | null
          created_by: string
          discount_percentage: number
          id?: string
          package_id: string
          reason?: string | null
        }
        Update: {
          active_from?: string
          active_until?: string | null
          created_at?: string | null
          created_by?: string
          discount_percentage?: number
          id?: string
          package_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_event_package_discounts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_event_package_discounts_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "admin_event_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_event_package_inclusions: {
        Row: {
          category_id: string
          created_at: string | null
          id: string
          is_included: boolean | null
          package_id: string
          sort_order: number | null
        }
        Insert: {
          category_id: string
          created_at?: string | null
          id?: string
          is_included?: boolean | null
          package_id: string
          sort_order?: number | null
        }
        Update: {
          category_id?: string
          created_at?: string | null
          id?: string
          is_included?: boolean | null
          package_id?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_event_package_inclusions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "artist_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_event_package_inclusions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "category_provider_counts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_event_package_inclusions_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "admin_event_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_event_packages: {
        Row: {
          base_price: number
          created_at: string | null
          created_by: string
          description: string | null
          discount_percentage: number | null
          display_name: string
          event_type_id: string
          final_price: number | null
          id: string
          is_active: boolean | null
          max_category_selections: number | null
          max_professionals_per_category: number | null
          sort_order: number | null
          tier: string
          updated_at: string | null
        }
        Insert: {
          base_price: number
          created_at?: string | null
          created_by: string
          description?: string | null
          discount_percentage?: number | null
          display_name: string
          event_type_id: string
          final_price?: number | null
          id?: string
          is_active?: boolean | null
          max_category_selections?: number | null
          max_professionals_per_category?: number | null
          sort_order?: number | null
          tier: string
          updated_at?: string | null
        }
        Update: {
          base_price?: number
          created_at?: string | null
          created_by?: string
          description?: string | null
          discount_percentage?: number | null
          display_name?: string
          event_type_id?: string
          final_price?: number | null
          id?: string
          is_active?: boolean | null
          max_category_selections?: number | null
          max_professionals_per_category?: number | null
          sort_order?: number | null
          tier?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_event_packages_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_event_packages_event_type_id_fkey"
            columns: ["event_type_id"]
            isOneToOne: false
            referencedRelation: "event_types"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_conversations: {
        Row: {
          context_summary: Json | null
          created_at: string
          id: string
          is_archived: boolean
          is_favorite: boolean
          is_pinned: boolean
          last_active_at: string
          title: string
          user_id: string
        }
        Insert: {
          context_summary?: Json | null
          created_at?: string
          id?: string
          is_archived?: boolean
          is_favorite?: boolean
          is_pinned?: boolean
          last_active_at?: string
          title?: string
          user_id: string
        }
        Update: {
          context_summary?: Json | null
          created_at?: string
          id?: string
          is_archived?: boolean
          is_favorite?: boolean
          is_pinned?: boolean
          last_active_at?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_message_feedback: {
        Row: {
          created_at: string
          id: string
          message_id: string
          reaction: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_id: string
          reaction: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message_id?: string
          reaction?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_message_feedback_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "ai_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_messages: {
        Row: {
          ai_response: Json | null
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          ai_response?: Json | null
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          ai_response?: Json | null
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      anchor_addons: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          package_id: string
          price: number
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          package_id: string
          price: number
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          package_id?: string
          price?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "anchor_addons_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "anchor_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      anchor_bookings: {
        Row: {
          accepted_at: string | null
          addons_amount: number
          advance_amount: number | null
          advance_paid_at: string | null
          base_amount: number
          calendar_locked: boolean
          city: string | null
          confirmed_at: string | null
          created_at: string
          customer_id: string
          event_date: string
          event_time: string | null
          event_type: string | null
          expected_audience: string | null
          expired_at: string | null
          id: string
          otp_verified_at: string | null
          package_id: string
          payment_deadline: string | null
          provider_id: string
          remaining_amount: number | null
          selected_addon_ids: string[]
          settlement_status: string | null
          special_requirements: string | null
          start_requested_at: string | null
          status: string
          total_amount: number
          venue: string | null
          work_completed_at: string | null
          work_started_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          addons_amount?: number
          advance_amount?: number | null
          advance_paid_at?: string | null
          base_amount: number
          calendar_locked?: boolean
          city?: string | null
          confirmed_at?: string | null
          created_at?: string
          customer_id: string
          event_date: string
          event_time?: string | null
          event_type?: string | null
          expected_audience?: string | null
          expired_at?: string | null
          id?: string
          otp_verified_at?: string | null
          package_id: string
          payment_deadline?: string | null
          provider_id: string
          remaining_amount?: number | null
          selected_addon_ids?: string[]
          settlement_status?: string | null
          special_requirements?: string | null
          start_requested_at?: string | null
          status?: string
          total_amount: number
          venue?: string | null
          work_completed_at?: string | null
          work_started_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          addons_amount?: number
          advance_amount?: number | null
          advance_paid_at?: string | null
          base_amount?: number
          calendar_locked?: boolean
          city?: string | null
          confirmed_at?: string | null
          created_at?: string
          customer_id?: string
          event_date?: string
          event_time?: string | null
          event_type?: string | null
          expected_audience?: string | null
          expired_at?: string | null
          id?: string
          otp_verified_at?: string | null
          package_id?: string
          payment_deadline?: string | null
          provider_id?: string
          remaining_amount?: number | null
          selected_addon_ids?: string[]
          settlement_status?: string | null
          special_requirements?: string | null
          start_requested_at?: string | null
          status?: string
          total_amount?: number
          venue?: string | null
          work_completed_at?: string | null
          work_started_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "anchor_bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anchor_bookings_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "anchor_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anchor_bookings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "approved_artists_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anchor_bookings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      anchor_gallery: {
        Row: {
          created_at: string
          id: string
          is_cover: boolean
          media_type: string
          package_id: string
          public_url: string
          sort_order: number
          storage_path: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_cover?: boolean
          media_type?: string
          package_id: string
          public_url: string
          sort_order?: number
          storage_path: string
        }
        Update: {
          created_at?: string
          id?: string
          is_cover?: boolean
          media_type?: string
          package_id?: string
          public_url?: string
          sort_order?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "anchor_gallery_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "anchor_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      anchor_packages: {
        Row: {
          advance_percentage: number | null
          assistant: number | null
          audience_capacity: string | null
          co_host: number | null
          created_at: string
          deliverables: string[]
          description: string | null
          event_manager: number | null
          extra_hour_charges: number | null
          hosting_style: string[]
          id: string
          is_featured: boolean
          languages: string[]
          lead_anchor: number | null
          name: string
          outside_city_charges: number | null
          package_price: number | null
          package_type: string
          provider_id: string
          script_writing_charges: number | null
          services_included: string[]
          sound_coordinator: number | null
          stage_coordination_charges: number | null
          stage_coordinator: number | null
          status: string
          travel_charges: number | null
          updated_at: string
          view_count: number
        }
        Insert: {
          advance_percentage?: number | null
          assistant?: number | null
          audience_capacity?: string | null
          co_host?: number | null
          created_at?: string
          deliverables?: string[]
          description?: string | null
          event_manager?: number | null
          extra_hour_charges?: number | null
          hosting_style?: string[]
          id?: string
          is_featured?: boolean
          languages?: string[]
          lead_anchor?: number | null
          name: string
          outside_city_charges?: number | null
          package_price?: number | null
          package_type: string
          provider_id: string
          script_writing_charges?: number | null
          services_included?: string[]
          sound_coordinator?: number | null
          stage_coordination_charges?: number | null
          stage_coordinator?: number | null
          status?: string
          travel_charges?: number | null
          updated_at?: string
          view_count?: number
        }
        Update: {
          advance_percentage?: number | null
          assistant?: number | null
          audience_capacity?: string | null
          co_host?: number | null
          created_at?: string
          deliverables?: string[]
          description?: string | null
          event_manager?: number | null
          extra_hour_charges?: number | null
          hosting_style?: string[]
          id?: string
          is_featured?: boolean
          languages?: string[]
          lead_anchor?: number | null
          name?: string
          outside_city_charges?: number | null
          package_price?: number | null
          package_type?: string
          provider_id?: string
          script_writing_charges?: number | null
          services_included?: string[]
          sound_coordinator?: number | null
          stage_coordination_charges?: number | null
          stage_coordinator?: number | null
          status?: string
          travel_charges?: number | null
          updated_at?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "anchor_packages_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "approved_artists_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anchor_packages_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      artist_bookings: {
        Row: {
          category: string
          created_at: string
          event_id: string
          id: string
          negotiation_message: string | null
          price: number
          provider_id: string
          provider_name: string
          status: string | null
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          event_id: string
          id?: string
          negotiation_message?: string | null
          price: number
          provider_id: string
          provider_name: string
          status?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          event_id?: string
          id?: string
          negotiation_message?: string | null
          price?: number
          provider_id?: string
          provider_name?: string
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "artist_bookings_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artist_bookings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "approved_artists_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artist_bookings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      artist_categories: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          icon_lucide: string | null
          id: string
          is_active: boolean | null
          max_price: number | null
          min_price: number | null
          name: string
          popular_count: number | null
          profession_type: Database["public"]["Enums"]["profession_type"]
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          icon_lucide?: string | null
          id?: string
          is_active?: boolean | null
          max_price?: number | null
          min_price?: number | null
          name: string
          popular_count?: number | null
          profession_type: Database["public"]["Enums"]["profession_type"]
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          icon_lucide?: string | null
          id?: string
          is_active?: boolean | null
          max_price?: number | null
          min_price?: number | null
          name?: string
          popular_count?: number | null
          profession_type?: Database["public"]["Enums"]["profession_type"]
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          id: string
          ip_address: unknown
          new_values: Json | null
          old_values: Json | null
          record_id: string | null
          table_name: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      auth_promotion_media: {
        Row: {
          admin_id: string
          category: string | null
          created_at: string
          destination_type: string | null
          display_order: number
          file_size_bytes: number | null
          id: string
          is_active: boolean
          is_published: boolean | null
          media_type: string
          media_url: string
          package_id: string | null
          package_name: string | null
          package_table: string | null
          provider_id: string | null
          slot_number: number | null
          storage_path: string
          updated_at: string
          vendor_name: string | null
        }
        Insert: {
          admin_id?: string
          category?: string | null
          created_at?: string
          destination_type?: string | null
          display_order?: number
          file_size_bytes?: number | null
          id?: string
          is_active?: boolean
          is_published?: boolean | null
          media_type: string
          media_url: string
          package_id?: string | null
          package_name?: string | null
          package_table?: string | null
          provider_id?: string | null
          slot_number?: number | null
          storage_path: string
          updated_at?: string
          vendor_name?: string | null
        }
        Update: {
          admin_id?: string
          category?: string | null
          created_at?: string
          destination_type?: string | null
          display_order?: number
          file_size_bytes?: number | null
          id?: string
          is_active?: boolean
          is_published?: boolean | null
          media_type?: string
          media_url?: string
          package_id?: string | null
          package_name?: string | null
          package_table?: string | null
          provider_id?: string | null
          slot_number?: number | null
          storage_path?: string
          updated_at?: string
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auth_promotion_media_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "approved_artists_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auth_promotion_media_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      auth_promotion_video_views: {
        Row: {
          id: string
          user_id: string
          video_id: string
          viewed_at: string
          was_closed: boolean
          watch_duration_seconds: number | null
        }
        Insert: {
          id?: string
          user_id: string
          video_id: string
          viewed_at?: string
          was_closed?: boolean
          watch_duration_seconds?: number | null
        }
        Update: {
          id?: string
          user_id?: string
          video_id?: string
          viewed_at?: string
          was_closed?: boolean
          watch_duration_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "auth_promotion_video_views_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "auth_promotion_videos"
            referencedColumns: ["id"]
          },
        ]
      }
      auth_promotion_videos: {
        Row: {
          admin_id: string
          created_at: string
          display_position: string
          id: string
          is_active: boolean
          priority_order: number
          storage_path: string
          unique_users_reached: number
          updated_at: string
          user_limit: number
          video_url: string
        }
        Insert: {
          admin_id: string
          created_at?: string
          display_position?: string
          id?: string
          is_active?: boolean
          priority_order?: number
          storage_path: string
          unique_users_reached?: number
          updated_at?: string
          user_limit?: number
          video_url: string
        }
        Update: {
          admin_id?: string
          created_at?: string
          display_position?: string
          id?: string
          is_active?: boolean
          priority_order?: number
          storage_path?: string
          unique_users_reached?: number
          updated_at?: string
          user_limit?: number
          video_url?: string
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
      band_addons: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          package_id: string
          price: number
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          package_id: string
          price: number
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          package_id?: string
          price?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "band_addons_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "band_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      band_bookings: {
        Row: {
          accepted_at: string | null
          addons_amount: number
          advance_amount: number | null
          advance_paid_at: string | null
          base_amount: number
          calendar_locked: boolean
          city: string | null
          confirmed_at: string | null
          created_at: string
          customer_id: string
          event_date: string
          event_time: string | null
          event_type: string | null
          expired_at: string | null
          id: string
          otp_verified_at: string | null
          package_id: string
          payment_deadline: string | null
          provider_id: string
          remaining_amount: number | null
          selected_addon_ids: string[]
          settlement_status: string | null
          special_requirements: string | null
          start_requested_at: string | null
          status: string
          total_amount: number
          venue: string | null
          work_completed_at: string | null
          work_started_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          addons_amount?: number
          advance_amount?: number | null
          advance_paid_at?: string | null
          base_amount: number
          calendar_locked?: boolean
          city?: string | null
          confirmed_at?: string | null
          created_at?: string
          customer_id: string
          event_date: string
          event_time?: string | null
          event_type?: string | null
          expired_at?: string | null
          id?: string
          otp_verified_at?: string | null
          package_id: string
          payment_deadline?: string | null
          provider_id: string
          remaining_amount?: number | null
          selected_addon_ids?: string[]
          settlement_status?: string | null
          special_requirements?: string | null
          start_requested_at?: string | null
          status?: string
          total_amount: number
          venue?: string | null
          work_completed_at?: string | null
          work_started_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          addons_amount?: number
          advance_amount?: number | null
          advance_paid_at?: string | null
          base_amount?: number
          calendar_locked?: boolean
          city?: string | null
          confirmed_at?: string | null
          created_at?: string
          customer_id?: string
          event_date?: string
          event_time?: string | null
          event_type?: string | null
          expired_at?: string | null
          id?: string
          otp_verified_at?: string | null
          package_id?: string
          payment_deadline?: string | null
          provider_id?: string
          remaining_amount?: number | null
          selected_addon_ids?: string[]
          settlement_status?: string | null
          special_requirements?: string | null
          start_requested_at?: string | null
          status?: string
          total_amount?: number
          venue?: string | null
          work_completed_at?: string | null
          work_started_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "band_bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "band_bookings_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "band_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "band_bookings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "approved_artists_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "band_bookings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      band_categories: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      band_gallery: {
        Row: {
          created_at: string
          id: string
          is_cover: boolean
          media_type: string
          package_id: string
          public_url: string
          sort_order: number
          storage_path: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_cover?: boolean
          media_type?: string
          package_id: string
          public_url: string
          sort_order?: number
          storage_path: string
        }
        Update: {
          created_at?: string
          id?: string
          is_cover?: boolean
          media_type?: string
          package_id?: string
          public_url?: string
          sort_order?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "band_gallery_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "band_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      band_packages: {
        Row: {
          additional_equipment_charges: number | null
          additional_performer_charges: number | null
          advance_percentage: number | null
          band_category: string | null
          band_members: string | null
          created_at: string
          deliverables: string[]
          description: string | null
          drummers: string | null
          equipment_included: string[]
          event_type: string | null
          event_types_supported: string[]
          extra_hour_charges: number | null
          id: string
          instrumentalists: string | null
          instruments: string[]
          is_featured: boolean
          languages: string[]
          lead_performer: string | null
          music_genres: string[]
          name: string
          number_of_performers: string | null
          outside_city_charges: number | null
          package_price: number | null
          performance_duration: string | null
          provider_id: string
          singers: string | null
          sound_engineer: string | null
          status: string
          support_staff: string | null
          travel_charges: number | null
          updated_at: string
          view_count: number
        }
        Insert: {
          additional_equipment_charges?: number | null
          additional_performer_charges?: number | null
          advance_percentage?: number | null
          band_category?: string | null
          band_members?: string | null
          created_at?: string
          deliverables?: string[]
          description?: string | null
          drummers?: string | null
          equipment_included?: string[]
          event_type?: string | null
          event_types_supported?: string[]
          extra_hour_charges?: number | null
          id?: string
          instrumentalists?: string | null
          instruments?: string[]
          is_featured?: boolean
          languages?: string[]
          lead_performer?: string | null
          music_genres?: string[]
          name: string
          number_of_performers?: string | null
          outside_city_charges?: number | null
          package_price?: number | null
          performance_duration?: string | null
          provider_id: string
          singers?: string | null
          sound_engineer?: string | null
          status?: string
          support_staff?: string | null
          travel_charges?: number | null
          updated_at?: string
          view_count?: number
        }
        Update: {
          additional_equipment_charges?: number | null
          additional_performer_charges?: number | null
          advance_percentage?: number | null
          band_category?: string | null
          band_members?: string | null
          created_at?: string
          deliverables?: string[]
          description?: string | null
          drummers?: string | null
          equipment_included?: string[]
          event_type?: string | null
          event_types_supported?: string[]
          extra_hour_charges?: number | null
          id?: string
          instrumentalists?: string | null
          instruments?: string[]
          is_featured?: boolean
          languages?: string[]
          lead_performer?: string | null
          music_genres?: string[]
          name?: string
          number_of_performers?: string | null
          outside_city_charges?: number | null
          package_price?: number | null
          performance_duration?: string | null
          provider_id?: string
          singers?: string | null
          sound_engineer?: string | null
          status?: string
          support_staff?: string | null
          travel_charges?: number | null
          updated_at?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "band_packages_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "approved_artists_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "band_packages_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_details: {
        Row: {
          account_number: string
          bank_name: string
          created_at: string
          id: string
          ifsc_code: string
          provider_id: string
          updated_at: string
          upi_id: string | null
        }
        Insert: {
          account_number: string
          bank_name: string
          created_at?: string
          id?: string
          ifsc_code: string
          provider_id: string
          updated_at?: string
          upi_id?: string | null
        }
        Update: {
          account_number?: string
          bank_name?: string
          created_at?: string
          id?: string
          ifsc_code?: string
          provider_id?: string
          updated_at?: string
          upi_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_details_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "approved_artists_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_details_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      banquet_bookings: {
        Row: {
          accepted_at: string | null
          addons_amount: number
          advance_amount: number | null
          advance_paid_at: string | null
          base_amount: number
          calendar_locked: boolean
          city: string | null
          confirmed_at: string | null
          created_at: string
          customer_id: string
          event_date: string
          event_time: string | null
          event_type: string | null
          expired_at: string | null
          guest_count: string | null
          id: string
          otp_verified_at: string | null
          package_id: string
          payment_deadline: string | null
          provider_id: string
          remaining_amount: number | null
          selected_addon_ids: string[]
          settlement_status: string | null
          special_requirements: string | null
          start_requested_at: string | null
          status: string
          total_amount: number
          venue: string | null
          work_completed_at: string | null
          work_started_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          addons_amount?: number
          advance_amount?: number | null
          advance_paid_at?: string | null
          base_amount: number
          calendar_locked?: boolean
          city?: string | null
          confirmed_at?: string | null
          created_at?: string
          customer_id: string
          event_date: string
          event_time?: string | null
          event_type?: string | null
          expired_at?: string | null
          guest_count?: string | null
          id?: string
          otp_verified_at?: string | null
          package_id: string
          payment_deadline?: string | null
          provider_id: string
          remaining_amount?: number | null
          selected_addon_ids?: string[]
          settlement_status?: string | null
          special_requirements?: string | null
          start_requested_at?: string | null
          status?: string
          total_amount: number
          venue?: string | null
          work_completed_at?: string | null
          work_started_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          addons_amount?: number
          advance_amount?: number | null
          advance_paid_at?: string | null
          base_amount?: number
          calendar_locked?: boolean
          city?: string | null
          confirmed_at?: string | null
          created_at?: string
          customer_id?: string
          event_date?: string
          event_time?: string | null
          event_type?: string | null
          expired_at?: string | null
          guest_count?: string | null
          id?: string
          otp_verified_at?: string | null
          package_id?: string
          payment_deadline?: string | null
          provider_id?: string
          remaining_amount?: number | null
          selected_addon_ids?: string[]
          settlement_status?: string | null
          special_requirements?: string | null
          start_requested_at?: string | null
          status?: string
          total_amount?: number
          venue?: string | null
          work_completed_at?: string | null
          work_started_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "banquet_bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "banquet_bookings_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "banquet_halls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "banquet_bookings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "approved_artists_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "banquet_bookings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      banquet_halls: {
        Row: {
          address: string | null
          advance_percentage: number | null
          advance_refund_policy: string | null
          alcohol_allowed: boolean | null
          allowed_time: string | null
          cancellation_policy: string | null
          city: string | null
          cleaning_charges: number | null
          created_at: string
          decoration_permission_fee: number | null
          description: string | null
          event_types_supported: string[]
          extra_hour_charges: number | null
          facilities_included: string[]
          fireworks_allowed: boolean | null
          generator_charges: number | null
          google_maps_url: string | null
          hall_capacity: string | null
          hall_rental_price: number | null
          id: string
          is_featured: boolean
          name: string
          noise_restrictions: string | null
          outside_catering_allowed: boolean | null
          outside_catering_charges: number | null
          outside_decoration_allowed: boolean | null
          pincode: string | null
          provider_id: string
          seating_styles: string[]
          security_deposit: number | null
          smoking_policy: string | null
          state: string | null
          status: string
          updated_at: string
          venue_features: string[]
          venue_type: string
          view_count: number
          virtual_tour_url: string | null
        }
        Insert: {
          address?: string | null
          advance_percentage?: number | null
          advance_refund_policy?: string | null
          alcohol_allowed?: boolean | null
          allowed_time?: string | null
          cancellation_policy?: string | null
          city?: string | null
          cleaning_charges?: number | null
          created_at?: string
          decoration_permission_fee?: number | null
          description?: string | null
          event_types_supported?: string[]
          extra_hour_charges?: number | null
          facilities_included?: string[]
          fireworks_allowed?: boolean | null
          generator_charges?: number | null
          google_maps_url?: string | null
          hall_capacity?: string | null
          hall_rental_price?: number | null
          id?: string
          is_featured?: boolean
          name: string
          noise_restrictions?: string | null
          outside_catering_allowed?: boolean | null
          outside_catering_charges?: number | null
          outside_decoration_allowed?: boolean | null
          pincode?: string | null
          provider_id: string
          seating_styles?: string[]
          security_deposit?: number | null
          smoking_policy?: string | null
          state?: string | null
          status?: string
          updated_at?: string
          venue_features?: string[]
          venue_type: string
          view_count?: number
          virtual_tour_url?: string | null
        }
        Update: {
          address?: string | null
          advance_percentage?: number | null
          advance_refund_policy?: string | null
          alcohol_allowed?: boolean | null
          allowed_time?: string | null
          cancellation_policy?: string | null
          city?: string | null
          cleaning_charges?: number | null
          created_at?: string
          decoration_permission_fee?: number | null
          description?: string | null
          event_types_supported?: string[]
          extra_hour_charges?: number | null
          facilities_included?: string[]
          fireworks_allowed?: boolean | null
          generator_charges?: number | null
          google_maps_url?: string | null
          hall_capacity?: string | null
          hall_rental_price?: number | null
          id?: string
          is_featured?: boolean
          name?: string
          noise_restrictions?: string | null
          outside_catering_allowed?: boolean | null
          outside_catering_charges?: number | null
          outside_decoration_allowed?: boolean | null
          pincode?: string | null
          provider_id?: string
          seating_styles?: string[]
          security_deposit?: number | null
          smoking_policy?: string | null
          state?: string | null
          status?: string
          updated_at?: string
          venue_features?: string[]
          venue_type?: string
          view_count?: number
          virtual_tour_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "banquet_halls_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "approved_artists_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "banquet_halls_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_cancellations: {
        Row: {
          amount_paid: number
          amount_retained: number
          booking_id: string
          booking_table: string
          cancelled_at: string
          created_at: string
          customer_id: string
          event_date: string
          event_time: string | null
          hours_remaining: number
          id: string
          policy_tier: string
          provider_id: string
          reason: string | null
          refund_amount: number
          refund_completed_at: string | null
          refund_initiated_at: string | null
          refund_percentage: number
          refund_status: string
        }
        Insert: {
          amount_paid?: number
          amount_retained?: number
          booking_id: string
          booking_table: string
          cancelled_at?: string
          created_at?: string
          customer_id: string
          event_date: string
          event_time?: string | null
          hours_remaining?: number
          id?: string
          policy_tier: string
          provider_id: string
          reason?: string | null
          refund_amount?: number
          refund_completed_at?: string | null
          refund_initiated_at?: string | null
          refund_percentage?: number
          refund_status?: string
        }
        Update: {
          amount_paid?: number
          amount_retained?: number
          booking_id?: string
          booking_table?: string
          cancelled_at?: string
          created_at?: string
          customer_id?: string
          event_date?: string
          event_time?: string | null
          hours_remaining?: number
          id?: string
          policy_tier?: string
          provider_id?: string
          reason?: string | null
          refund_amount?: number
          refund_completed_at?: string | null
          refund_initiated_at?: string | null
          refund_percentage?: number
          refund_status?: string
        }
        Relationships: []
      }
      booking_events: {
        Row: {
          actor_id: string | null
          actor_role: string | null
          booking_id: string
          booking_table: string
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
        }
        Insert: {
          actor_id?: string | null
          actor_role?: string | null
          booking_id: string
          booking_table: string
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
        }
        Update: {
          actor_id?: string | null
          actor_role?: string | null
          booking_id?: string
          booking_table?: string
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
        }
        Relationships: []
      }
      booking_locations: {
        Row: {
          booking_id: string
          booking_table: string
          created_at: string
          district: string | null
          exact_address: string | null
          formatted_address: string | null
          id: string
          landmark: string | null
          latitude: number | null
          longitude: number | null
          pincode: string | null
          state: string | null
          town_city: string | null
          updated_at: string
        }
        Insert: {
          booking_id: string
          booking_table: string
          created_at?: string
          district?: string | null
          exact_address?: string | null
          formatted_address?: string | null
          id?: string
          landmark?: string | null
          latitude?: number | null
          longitude?: number | null
          pincode?: string | null
          state?: string | null
          town_city?: string | null
          updated_at?: string
        }
        Update: {
          booking_id?: string
          booking_table?: string
          created_at?: string
          district?: string | null
          exact_address?: string | null
          formatted_address?: string | null
          id?: string
          landmark?: string | null
          latitude?: number | null
          longitude?: number | null
          pincode?: string | null
          state?: string | null
          town_city?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      booking_start_otps: {
        Row: {
          admin_notified: boolean | null
          admin_notified_at: string | null
          attempts: number
          booking_id: string
          booking_table: string
          created_at: string
          customer_id: string
          email_error: string | null
          email_sent: boolean | null
          email_sent_at: string | null
          expires_at: string
          id: string
          invalidated: boolean
          max_attempts: number
          max_resends: number
          otp_hash: string
          purpose: string
          resend_count: number
          sms_sent: boolean | null
          sms_sent_at: string | null
          used_at: string | null
          vendor_id: string
          verified: boolean
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          admin_notified?: boolean | null
          admin_notified_at?: string | null
          attempts?: number
          booking_id: string
          booking_table: string
          created_at?: string
          customer_id: string
          email_error?: string | null
          email_sent?: boolean | null
          email_sent_at?: string | null
          expires_at: string
          id?: string
          invalidated?: boolean
          max_attempts?: number
          max_resends?: number
          otp_hash: string
          purpose?: string
          resend_count?: number
          sms_sent?: boolean | null
          sms_sent_at?: string | null
          used_at?: string | null
          vendor_id: string
          verified?: boolean
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          admin_notified?: boolean | null
          admin_notified_at?: string | null
          attempts?: number
          booking_id?: string
          booking_table?: string
          created_at?: string
          customer_id?: string
          email_error?: string | null
          email_sent?: boolean | null
          email_sent_at?: string | null
          expires_at?: string
          id?: string
          invalidated?: boolean
          max_attempts?: number
          max_resends?: number
          otp_hash?: string
          purpose?: string
          resend_count?: number
          sms_sent?: boolean | null
          sms_sent_at?: string | null
          used_at?: string | null
          vendor_id?: string
          verified?: boolean
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: []
      }
      bookings: {
        Row: {
          accepted_at: string | null
          advance_amount: number | null
          advance_paid_at: string | null
          amount: number
          calendar_locked: boolean
          confirmed_at: string | null
          created_at: string
          customer_id: string
          customer_notes: string | null
          event_date: string
          event_duration_hours: number | null
          event_time: string | null
          event_type_id: string | null
          expired_at: string | null
          id: string
          invoice_generated_at: string | null
          invoice_number: string | null
          invoice_url: string | null
          otp_verified_at: string | null
          payment_deadline: string | null
          platform_fee: number | null
          provider_id: string
          provider_notes: string | null
          remaining_amount: number | null
          requirements: string | null
          settlement_status: string | null
          start_requested_at: string | null
          status: Database["public"]["Enums"]["booking_status"]
          updated_at: string
          venue_address: string
          venue_area: string | null
          venue_city: string
          work_completed_at: string | null
          work_started_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          advance_amount?: number | null
          advance_paid_at?: string | null
          amount: number
          calendar_locked?: boolean
          confirmed_at?: string | null
          created_at?: string
          customer_id: string
          customer_notes?: string | null
          event_date: string
          event_duration_hours?: number | null
          event_time?: string | null
          event_type_id?: string | null
          expired_at?: string | null
          id?: string
          invoice_generated_at?: string | null
          invoice_number?: string | null
          invoice_url?: string | null
          otp_verified_at?: string | null
          payment_deadline?: string | null
          platform_fee?: number | null
          provider_id: string
          provider_notes?: string | null
          remaining_amount?: number | null
          requirements?: string | null
          settlement_status?: string | null
          start_requested_at?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
          venue_address: string
          venue_area?: string | null
          venue_city: string
          work_completed_at?: string | null
          work_started_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          advance_amount?: number | null
          advance_paid_at?: string | null
          amount?: number
          calendar_locked?: boolean
          confirmed_at?: string | null
          created_at?: string
          customer_id?: string
          customer_notes?: string | null
          event_date?: string
          event_duration_hours?: number | null
          event_time?: string | null
          event_type_id?: string | null
          expired_at?: string | null
          id?: string
          invoice_generated_at?: string | null
          invoice_number?: string | null
          invoice_url?: string | null
          otp_verified_at?: string | null
          payment_deadline?: string | null
          platform_fee?: number | null
          provider_id?: string
          provider_notes?: string | null
          remaining_amount?: number | null
          requirements?: string | null
          settlement_status?: string | null
          start_requested_at?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
          venue_address?: string
          venue_area?: string | null
          venue_city?: string
          work_completed_at?: string | null
          work_started_at?: string | null
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
            referencedRelation: "approved_artists_view"
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
      budget_allocations: {
        Row: {
          allocated_budget: number
          budget_percentage: number
          category: string
          created_at: string
          event_id: string
          id: string
          priority: string
          updated_at: string
        }
        Insert: {
          allocated_budget: number
          budget_percentage: number
          category: string
          created_at?: string
          event_id: string
          id?: string
          priority: string
          updated_at?: string
        }
        Update: {
          allocated_budget?: number
          budget_percentage?: number
          category?: string
          created_at?: string
          event_id?: string
          id?: string
          priority?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_allocations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      catering_addons: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          package_id: string
          price: number
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          package_id: string
          price: number
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          package_id?: string
          price?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "catering_addons_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "catering_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      catering_bookings: {
        Row: {
          accepted_at: string | null
          addons_amount: number
          advance_amount: number | null
          advance_paid_at: string | null
          base_amount: number
          calendar_locked: boolean
          city: string | null
          confirmed_at: string | null
          created_at: string
          customer_id: string
          event_date: string
          event_type: string | null
          expired_at: string | null
          guest_count: number
          id: string
          meal_type: string | null
          otp_verified_at: string | null
          package_id: string
          payment_deadline: string | null
          provider_id: string
          remaining_amount: number | null
          selected_addon_ids: string[]
          settlement_status: string | null
          special_requests: string | null
          start_requested_at: string | null
          status: string
          total_amount: number
          venue: string | null
          work_completed_at: string | null
          work_started_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          addons_amount?: number
          advance_amount?: number | null
          advance_paid_at?: string | null
          base_amount: number
          calendar_locked?: boolean
          city?: string | null
          confirmed_at?: string | null
          created_at?: string
          customer_id: string
          event_date: string
          event_type?: string | null
          expired_at?: string | null
          guest_count: number
          id?: string
          meal_type?: string | null
          otp_verified_at?: string | null
          package_id: string
          payment_deadline?: string | null
          provider_id: string
          remaining_amount?: number | null
          selected_addon_ids?: string[]
          settlement_status?: string | null
          special_requests?: string | null
          start_requested_at?: string | null
          status?: string
          total_amount: number
          venue?: string | null
          work_completed_at?: string | null
          work_started_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          addons_amount?: number
          advance_amount?: number | null
          advance_paid_at?: string | null
          base_amount?: number
          calendar_locked?: boolean
          city?: string | null
          confirmed_at?: string | null
          created_at?: string
          customer_id?: string
          event_date?: string
          event_type?: string | null
          expired_at?: string | null
          guest_count?: number
          id?: string
          meal_type?: string | null
          otp_verified_at?: string | null
          package_id?: string
          payment_deadline?: string | null
          provider_id?: string
          remaining_amount?: number | null
          selected_addon_ids?: string[]
          settlement_status?: string | null
          special_requests?: string | null
          start_requested_at?: string | null
          status?: string
          total_amount?: number
          venue?: string | null
          work_completed_at?: string | null
          work_started_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "catering_bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catering_bookings_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "catering_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catering_bookings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "approved_artists_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catering_bookings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      catering_gallery: {
        Row: {
          alt_text: string | null
          created_at: string
          id: string
          is_cover: boolean
          package_id: string
          public_url: string
          sort_order: number
          storage_path: string
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          id?: string
          is_cover?: boolean
          package_id: string
          public_url: string
          sort_order?: number
          storage_path: string
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          id?: string
          is_cover?: boolean
          package_id?: string
          public_url?: string
          sort_order?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "catering_gallery_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "catering_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      catering_menu_items: {
        Row: {
          created_at: string
          description: string | null
          extra_cost: number | null
          id: string
          is_active: boolean
          is_bestseller: boolean
          is_jain: boolean
          is_premium: boolean
          is_unlimited: boolean
          is_veg: boolean
          name: string
          section_id: string
          sort_order: number
          spicy_level: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          extra_cost?: number | null
          id?: string
          is_active?: boolean
          is_bestseller?: boolean
          is_jain?: boolean
          is_premium?: boolean
          is_unlimited?: boolean
          is_veg?: boolean
          name: string
          section_id: string
          sort_order?: number
          spicy_level?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          extra_cost?: number | null
          id?: string
          is_active?: boolean
          is_bestseller?: boolean
          is_jain?: boolean
          is_premium?: boolean
          is_unlimited?: boolean
          is_veg?: boolean
          name?: string
          section_id?: string
          sort_order?: number
          spicy_level?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "catering_menu_items_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "catering_menu_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      catering_menu_sections: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          package_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          package_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          package_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "catering_menu_sections_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "catering_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      catering_packages: {
        Row: {
          advance_percentage: number | null
          cancellation_policy: string | null
          created_at: string
          cuisine_types: string[]
          description: string | null
          id: string
          is_featured: boolean
          is_jain: boolean
          is_nonveg: boolean
          is_veg: boolean
          is_vegan: boolean
          max_guests: number | null
          max_travel_km: number | null
          meal_types: string[]
          min_guests: number
          name: string
          preparation_days: number | null
          price_per_plate: number | null
          provider_id: string
          recommended_guests: number | null
          service_duration: string | null
          service_types: string[]
          serving_styles: string[]
          starting_price: number | null
          status: string
          travel_outside_city: boolean
          travel_within_city: boolean
          updated_at: string
          view_count: number
        }
        Insert: {
          advance_percentage?: number | null
          cancellation_policy?: string | null
          created_at?: string
          cuisine_types?: string[]
          description?: string | null
          id?: string
          is_featured?: boolean
          is_jain?: boolean
          is_nonveg?: boolean
          is_veg?: boolean
          is_vegan?: boolean
          max_guests?: number | null
          max_travel_km?: number | null
          meal_types?: string[]
          min_guests?: number
          name: string
          preparation_days?: number | null
          price_per_plate?: number | null
          provider_id: string
          recommended_guests?: number | null
          service_duration?: string | null
          service_types?: string[]
          serving_styles?: string[]
          starting_price?: number | null
          status?: string
          travel_outside_city?: boolean
          travel_within_city?: boolean
          updated_at?: string
          view_count?: number
        }
        Update: {
          advance_percentage?: number | null
          cancellation_policy?: string | null
          created_at?: string
          cuisine_types?: string[]
          description?: string | null
          id?: string
          is_featured?: boolean
          is_jain?: boolean
          is_nonveg?: boolean
          is_veg?: boolean
          is_vegan?: boolean
          max_guests?: number | null
          max_travel_km?: number | null
          meal_types?: string[]
          min_guests?: number
          name?: string
          preparation_days?: number | null
          price_per_plate?: number | null
          provider_id?: string
          recommended_guests?: number | null
          service_duration?: string | null
          service_types?: string[]
          serving_styles?: string[]
          starting_price?: number | null
          status?: string
          travel_outside_city?: boolean
          travel_within_city?: boolean
          updated_at?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "catering_packages_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "approved_artists_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catering_packages_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_tracking: {
        Row: {
          booking_amount: number
          booking_id: string
          collected_at: string | null
          commission_amount: number
          commission_rate: number
          created_at: string
          id: string
          paid_at: string | null
          provider_id: string
          status: string | null
        }
        Insert: {
          booking_amount: number
          booking_id: string
          collected_at?: string | null
          commission_amount: number
          commission_rate?: number
          created_at?: string
          id?: string
          paid_at?: string | null
          provider_id: string
          status?: string | null
        }
        Update: {
          booking_amount?: number
          booking_id?: string
          collected_at?: string | null
          commission_amount?: number
          commission_rate?: number
          created_at?: string
          id?: string
          paid_at?: string | null
          provider_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commission_tracking_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_tracking_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "approved_artists_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_tracking_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dancer_addons: {
        Row: {
          description: string | null
          id: string
          is_active: boolean
          name: string
          package_id: string
          price: number
          sort_order: number
        }
        Insert: {
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          package_id: string
          price: number
          sort_order?: number
        }
        Update: {
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          package_id?: string
          price?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "dancer_addons_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "dancer_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      dancer_bookings: {
        Row: {
          accepted_at: string | null
          addons_amount: number
          advance_amount: number | null
          advance_paid_at: string | null
          base_amount: number
          calendar_locked: boolean
          city: string | null
          confirmed_at: string | null
          created_at: string
          customer_id: string
          dance_type: string | null
          event_date: string
          event_time: string | null
          event_type: string | null
          expired_at: string | null
          id: string
          number_of_dancers: number | null
          otp_verified_at: string | null
          package_id: string
          payment_deadline: string | null
          performance_duration: string | null
          provider_id: string
          remaining_amount: number | null
          selected_addon_ids: string[]
          settlement_status: string | null
          special_requirements: string | null
          start_requested_at: string | null
          status: string
          total_amount: number
          venue: string | null
          work_completed_at: string | null
          work_started_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          addons_amount?: number
          advance_amount?: number | null
          advance_paid_at?: string | null
          base_amount: number
          calendar_locked?: boolean
          city?: string | null
          confirmed_at?: string | null
          created_at?: string
          customer_id: string
          dance_type?: string | null
          event_date: string
          event_time?: string | null
          event_type?: string | null
          expired_at?: string | null
          id?: string
          number_of_dancers?: number | null
          otp_verified_at?: string | null
          package_id: string
          payment_deadline?: string | null
          performance_duration?: string | null
          provider_id: string
          remaining_amount?: number | null
          selected_addon_ids?: string[]
          settlement_status?: string | null
          special_requirements?: string | null
          start_requested_at?: string | null
          status?: string
          total_amount: number
          venue?: string | null
          work_completed_at?: string | null
          work_started_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          addons_amount?: number
          advance_amount?: number | null
          advance_paid_at?: string | null
          base_amount?: number
          calendar_locked?: boolean
          city?: string | null
          confirmed_at?: string | null
          created_at?: string
          customer_id?: string
          dance_type?: string | null
          event_date?: string
          event_time?: string | null
          event_type?: string | null
          expired_at?: string | null
          id?: string
          number_of_dancers?: number | null
          otp_verified_at?: string | null
          package_id?: string
          payment_deadline?: string | null
          performance_duration?: string | null
          provider_id?: string
          remaining_amount?: number | null
          selected_addon_ids?: string[]
          settlement_status?: string | null
          special_requirements?: string | null
          start_requested_at?: string | null
          status?: string
          total_amount?: number
          venue?: string | null
          work_completed_at?: string | null
          work_started_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dancer_bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dancer_bookings_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "dancer_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dancer_bookings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "approved_artists_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dancer_bookings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dancer_gallery: {
        Row: {
          created_at: string
          dance_type: string | null
          id: string
          is_cover: boolean
          media_type: string
          package_id: string
          public_url: string
          sort_order: number
          title: string | null
        }
        Insert: {
          created_at?: string
          dance_type?: string | null
          id?: string
          is_cover?: boolean
          media_type?: string
          package_id: string
          public_url: string
          sort_order?: number
          title?: string | null
        }
        Update: {
          created_at?: string
          dance_type?: string | null
          id?: string
          is_cover?: boolean
          media_type?: string
          package_id?: string
          public_url?: string
          sort_order?: number
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dancer_gallery_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "dancer_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      dancer_packages: {
        Row: {
          advance_percentage: number
          created_at: string
          dance_type: string | null
          deliverables: string[]
          description: string | null
          duration: string | null
          id: string
          name: string
          package_price: number
          package_type: string | null
          performance_style: string | null
          provider_id: string
          services_included: string[]
          status: string
          team_size: number | null
          updated_at: string
        }
        Insert: {
          advance_percentage?: number
          created_at?: string
          dance_type?: string | null
          deliverables?: string[]
          description?: string | null
          duration?: string | null
          id?: string
          name: string
          package_price: number
          package_type?: string | null
          performance_style?: string | null
          provider_id: string
          services_included?: string[]
          status?: string
          team_size?: number | null
          updated_at?: string
        }
        Update: {
          advance_percentage?: number
          created_at?: string
          dance_type?: string | null
          deliverables?: string[]
          description?: string | null
          duration?: string | null
          id?: string
          name?: string
          package_price?: number
          package_type?: string | null
          performance_style?: string | null
          provider_id?: string
          services_included?: string[]
          status?: string
          team_size?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dancer_packages_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "approved_artists_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dancer_packages_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      decorator_addons: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          package_id: string
          price: number
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          package_id: string
          price: number
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          package_id?: string
          price?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "decorator_addons_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "decorator_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      decorator_bookings: {
        Row: {
          accepted_at: string | null
          addons_amount: number
          advance_amount: number | null
          advance_paid_at: string | null
          base_amount: number
          calendar_locked: boolean
          city: string | null
          confirmed_at: string | null
          created_at: string
          customer_id: string
          event_date: string
          event_time: string | null
          event_type: string | null
          expired_at: string | null
          id: string
          otp_verified_at: string | null
          package_id: string
          payment_deadline: string | null
          provider_id: string
          remaining_amount: number | null
          selected_addon_ids: string[]
          settlement_status: string | null
          special_instructions: string | null
          start_requested_at: string | null
          status: string
          theme_preference: string | null
          total_amount: number
          venue: string | null
          work_completed_at: string | null
          work_started_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          addons_amount?: number
          advance_amount?: number | null
          advance_paid_at?: string | null
          base_amount: number
          calendar_locked?: boolean
          city?: string | null
          confirmed_at?: string | null
          created_at?: string
          customer_id: string
          event_date: string
          event_time?: string | null
          event_type?: string | null
          expired_at?: string | null
          id?: string
          otp_verified_at?: string | null
          package_id: string
          payment_deadline?: string | null
          provider_id: string
          remaining_amount?: number | null
          selected_addon_ids?: string[]
          settlement_status?: string | null
          special_instructions?: string | null
          start_requested_at?: string | null
          status?: string
          theme_preference?: string | null
          total_amount: number
          venue?: string | null
          work_completed_at?: string | null
          work_started_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          addons_amount?: number
          advance_amount?: number | null
          advance_paid_at?: string | null
          base_amount?: number
          calendar_locked?: boolean
          city?: string | null
          confirmed_at?: string | null
          created_at?: string
          customer_id?: string
          event_date?: string
          event_time?: string | null
          event_type?: string | null
          expired_at?: string | null
          id?: string
          otp_verified_at?: string | null
          package_id?: string
          payment_deadline?: string | null
          provider_id?: string
          remaining_amount?: number | null
          selected_addon_ids?: string[]
          settlement_status?: string | null
          special_instructions?: string | null
          start_requested_at?: string | null
          status?: string
          theme_preference?: string | null
          total_amount?: number
          venue?: string | null
          work_completed_at?: string | null
          work_started_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "decorator_bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decorator_bookings_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "decorator_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decorator_bookings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "approved_artists_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decorator_bookings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      decorator_gallery: {
        Row: {
          created_at: string
          id: string
          is_cover: boolean
          media_type: string
          package_id: string
          public_url: string
          sort_order: number
          storage_path: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_cover?: boolean
          media_type?: string
          package_id: string
          public_url: string
          sort_order?: number
          storage_path: string
        }
        Update: {
          created_at?: string
          id?: string
          is_cover?: boolean
          media_type?: string
          package_id?: string
          public_url?: string
          sort_order?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "decorator_gallery_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "decorator_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      decorator_packages: {
        Row: {
          advance_percentage: number | null
          created_at: string
          description: string | null
          id: string
          inclusions: string[]
          is_featured: boolean
          name: string
          package_price: number | null
          package_type: string
          provider_id: string
          setup_charges: number | null
          setup_time: string | null
          status: string
          teardown_included: boolean | null
          teardown_time: string | null
          theme: string | null
          themes_available: string[]
          travel_charges: number | null
          updated_at: string
          venue_types: string[]
          view_count: number
        }
        Insert: {
          advance_percentage?: number | null
          created_at?: string
          description?: string | null
          id?: string
          inclusions?: string[]
          is_featured?: boolean
          name: string
          package_price?: number | null
          package_type: string
          provider_id: string
          setup_charges?: number | null
          setup_time?: string | null
          status?: string
          teardown_included?: boolean | null
          teardown_time?: string | null
          theme?: string | null
          themes_available?: string[]
          travel_charges?: number | null
          updated_at?: string
          venue_types?: string[]
          view_count?: number
        }
        Update: {
          advance_percentage?: number | null
          created_at?: string
          description?: string | null
          id?: string
          inclusions?: string[]
          is_featured?: boolean
          name?: string
          package_price?: number | null
          package_type?: string
          provider_id?: string
          setup_charges?: number | null
          setup_time?: string | null
          status?: string
          teardown_included?: boolean | null
          teardown_time?: string | null
          theme?: string | null
          themes_available?: string[]
          travel_charges?: number | null
          updated_at?: string
          venue_types?: string[]
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "decorator_packages_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "approved_artists_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decorator_packages_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_charges: {
        Row: {
          charge: number
          created_at: string
          distance_km: number
          free_radius_km: number
          id: string
          is_free_delivery: boolean
          order_id: string
        }
        Insert: {
          charge: number
          created_at?: string
          distance_km: number
          free_radius_km: number
          id?: string
          is_free_delivery: boolean
          order_id: string
        }
        Update: {
          charge?: number
          created_at?: string
          distance_km?: number
          free_radius_km?: number
          id?: string
          is_free_delivery?: boolean
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_charges_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "product_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      dj_addons: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          package_id: string
          price: number
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          package_id: string
          price: number
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          package_id?: string
          price?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "dj_addons_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "dj_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      dj_bookings: {
        Row: {
          accepted_at: string | null
          addons_amount: number
          advance_amount: number | null
          advance_paid_at: string | null
          base_amount: number
          calendar_locked: boolean
          city: string | null
          confirmed_at: string | null
          created_at: string
          customer_id: string
          event_date: string
          event_time: string | null
          event_type: string | null
          expected_audience: number | null
          expired_at: string | null
          id: string
          otp_verified_at: string | null
          package_id: string
          payment_deadline: string | null
          provider_id: string
          remaining_amount: number | null
          selected_addon_ids: string[]
          settlement_status: string | null
          song_requests: string | null
          special_instructions: string | null
          start_requested_at: string | null
          status: string
          total_amount: number
          venue: string | null
          work_completed_at: string | null
          work_started_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          addons_amount?: number
          advance_amount?: number | null
          advance_paid_at?: string | null
          base_amount: number
          calendar_locked?: boolean
          city?: string | null
          confirmed_at?: string | null
          created_at?: string
          customer_id: string
          event_date: string
          event_time?: string | null
          event_type?: string | null
          expected_audience?: number | null
          expired_at?: string | null
          id?: string
          otp_verified_at?: string | null
          package_id: string
          payment_deadline?: string | null
          provider_id: string
          remaining_amount?: number | null
          selected_addon_ids?: string[]
          settlement_status?: string | null
          song_requests?: string | null
          special_instructions?: string | null
          start_requested_at?: string | null
          status?: string
          total_amount: number
          venue?: string | null
          work_completed_at?: string | null
          work_started_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          addons_amount?: number
          advance_amount?: number | null
          advance_paid_at?: string | null
          base_amount?: number
          calendar_locked?: boolean
          city?: string | null
          confirmed_at?: string | null
          created_at?: string
          customer_id?: string
          event_date?: string
          event_time?: string | null
          event_type?: string | null
          expected_audience?: number | null
          expired_at?: string | null
          id?: string
          otp_verified_at?: string | null
          package_id?: string
          payment_deadline?: string | null
          provider_id?: string
          remaining_amount?: number | null
          selected_addon_ids?: string[]
          settlement_status?: string | null
          song_requests?: string | null
          special_instructions?: string | null
          start_requested_at?: string | null
          status?: string
          total_amount?: number
          venue?: string | null
          work_completed_at?: string | null
          work_started_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dj_bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dj_bookings_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "dj_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dj_bookings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "approved_artists_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dj_bookings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dj_gallery: {
        Row: {
          created_at: string
          id: string
          is_cover: boolean
          media_type: string
          package_id: string
          public_url: string
          sort_order: number
          storage_path: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_cover?: boolean
          media_type?: string
          package_id: string
          public_url: string
          sort_order?: number
          storage_path: string
        }
        Update: {
          created_at?: string
          id?: string
          is_cover?: boolean
          media_type?: string
          package_id?: string
          public_url?: string
          sort_order?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "dj_gallery_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "dj_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      dj_packages: {
        Row: {
          advance_percentage: number | null
          assistant_djs: number | null
          backup_equipment: boolean | null
          created_at: string
          crowd_capacity: string | null
          deliverables: string[]
          description: string | null
          dj_count: number | null
          equipment: string[]
          equipment_transport_charges: number | null
          event_coverage: string[]
          event_type: string | null
          explicit_songs_allowed: boolean | null
          extra_hour_charges: number | null
          generator_charges: number | null
          id: string
          is_featured: boolean
          languages_supported: string[]
          lighting_operators: number | null
          mc_experience: string | null
          mc_host: boolean | null
          mc_name: string | null
          music_genres: string[]
          name: string
          outside_city_charges: number | null
          package_price: number | null
          performance_duration: string | null
          playlist_requests_allowed: boolean | null
          provider_id: string
          setup_time: string | null
          sound_engineers: number | null
          stage_crew: number | null
          stage_size: string | null
          status: string
          technicians: number | null
          travel_charges: number | null
          updated_at: string
          view_count: number
        }
        Insert: {
          advance_percentage?: number | null
          assistant_djs?: number | null
          backup_equipment?: boolean | null
          created_at?: string
          crowd_capacity?: string | null
          deliverables?: string[]
          description?: string | null
          dj_count?: number | null
          equipment?: string[]
          equipment_transport_charges?: number | null
          event_coverage?: string[]
          event_type?: string | null
          explicit_songs_allowed?: boolean | null
          extra_hour_charges?: number | null
          generator_charges?: number | null
          id?: string
          is_featured?: boolean
          languages_supported?: string[]
          lighting_operators?: number | null
          mc_experience?: string | null
          mc_host?: boolean | null
          mc_name?: string | null
          music_genres?: string[]
          name: string
          outside_city_charges?: number | null
          package_price?: number | null
          performance_duration?: string | null
          playlist_requests_allowed?: boolean | null
          provider_id: string
          setup_time?: string | null
          sound_engineers?: number | null
          stage_crew?: number | null
          stage_size?: string | null
          status?: string
          technicians?: number | null
          travel_charges?: number | null
          updated_at?: string
          view_count?: number
        }
        Update: {
          advance_percentage?: number | null
          assistant_djs?: number | null
          backup_equipment?: boolean | null
          created_at?: string
          crowd_capacity?: string | null
          deliverables?: string[]
          description?: string | null
          dj_count?: number | null
          equipment?: string[]
          equipment_transport_charges?: number | null
          event_coverage?: string[]
          event_type?: string | null
          explicit_songs_allowed?: boolean | null
          extra_hour_charges?: number | null
          generator_charges?: number | null
          id?: string
          is_featured?: boolean
          languages_supported?: string[]
          lighting_operators?: number | null
          mc_experience?: string | null
          mc_host?: boolean | null
          mc_name?: string | null
          music_genres?: string[]
          name?: string
          outside_city_charges?: number | null
          package_price?: number | null
          performance_duration?: string | null
          playlist_requests_allowed?: boolean | null
          provider_id?: string
          setup_time?: string | null
          sound_engineers?: number | null
          stage_crew?: number | null
          stage_size?: string | null
          status?: string
          technicians?: number | null
          travel_charges?: number | null
          updated_at?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "dj_packages_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "approved_artists_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dj_packages_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      drone_addons: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          package_id: string
          price: number
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          package_id: string
          price: number
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          package_id?: string
          price?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "drone_addons_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "drone_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      drone_bookings: {
        Row: {
          accepted_at: string | null
          addons_amount: number
          advance_amount: number | null
          advance_paid_at: string | null
          base_amount: number
          calendar_locked: boolean
          city: string | null
          confirmed_at: string | null
          coverage_duration: string | null
          created_at: string
          customer_id: string
          drone_permission_available: boolean | null
          event_date: string
          event_time: string | null
          event_type: string | null
          expired_at: string | null
          id: string
          indoor_outdoor: string | null
          otp_verified_at: string | null
          package_id: string
          payment_deadline: string | null
          provider_id: string
          remaining_amount: number | null
          restricted_area: boolean | null
          selected_addon_ids: string[]
          settlement_status: string | null
          special_requests: string | null
          start_requested_at: string | null
          status: string
          total_amount: number
          venue: string | null
          work_completed_at: string | null
          work_started_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          addons_amount?: number
          advance_amount?: number | null
          advance_paid_at?: string | null
          base_amount: number
          calendar_locked?: boolean
          city?: string | null
          confirmed_at?: string | null
          coverage_duration?: string | null
          created_at?: string
          customer_id: string
          drone_permission_available?: boolean | null
          event_date: string
          event_time?: string | null
          event_type?: string | null
          expired_at?: string | null
          id?: string
          indoor_outdoor?: string | null
          otp_verified_at?: string | null
          package_id: string
          payment_deadline?: string | null
          provider_id: string
          remaining_amount?: number | null
          restricted_area?: boolean | null
          selected_addon_ids?: string[]
          settlement_status?: string | null
          special_requests?: string | null
          start_requested_at?: string | null
          status?: string
          total_amount: number
          venue?: string | null
          work_completed_at?: string | null
          work_started_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          addons_amount?: number
          advance_amount?: number | null
          advance_paid_at?: string | null
          base_amount?: number
          calendar_locked?: boolean
          city?: string | null
          confirmed_at?: string | null
          coverage_duration?: string | null
          created_at?: string
          customer_id?: string
          drone_permission_available?: boolean | null
          event_date?: string
          event_time?: string | null
          event_type?: string | null
          expired_at?: string | null
          id?: string
          indoor_outdoor?: string | null
          otp_verified_at?: string | null
          package_id?: string
          payment_deadline?: string | null
          provider_id?: string
          remaining_amount?: number | null
          restricted_area?: boolean | null
          selected_addon_ids?: string[]
          settlement_status?: string | null
          special_requests?: string | null
          start_requested_at?: string | null
          status?: string
          total_amount?: number
          venue?: string | null
          work_completed_at?: string | null
          work_started_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drone_bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drone_bookings_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "drone_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drone_bookings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "approved_artists_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drone_bookings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      drone_gallery: {
        Row: {
          alt_text: string | null
          created_at: string
          id: string
          is_cover: boolean
          media_type: string
          package_id: string
          public_url: string
          sort_order: number
          storage_path: string
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          id?: string
          is_cover?: boolean
          media_type?: string
          package_id: string
          public_url: string
          sort_order?: number
          storage_path: string
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          id?: string
          is_cover?: boolean
          media_type?: string
          package_id?: string
          public_url?: string
          sort_order?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "drone_gallery_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "drone_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      drone_packages: {
        Row: {
          advance_percentage: number | null
          battery_count: number | null
          camera_resolution: string | null
          cancellation_policy: string | null
          coverage_durations: string[]
          coverage_includes: string[]
          coverage_indoor: boolean | null
          coverage_outdoor: boolean | null
          coverage_type: string | null
          created_at: string
          deliverables: string[]
          delivery_time: string | null
          description: string | null
          drone_brand: string | null
          drone_features: string[]
          drone_model: string | null
          extra_flight_hour_charges: number | null
          fixed_price: number | null
          flexible_pricing: boolean | null
          flights_included: number | null
          full_day_price: number | null
          half_day_price: number | null
          hourly_price: number | null
          id: string
          is_featured: boolean
          max_flight_time: string | null
          max_travel_km: number | null
          name: string
          package_price: number | null
          provider_id: string
          service_types: string[]
          starting_price: number | null
          status: string
          travel_charges_amount: number | null
          travel_outside_city: boolean
          travel_radius_km: number | null
          travel_within_city: boolean
          updated_at: string
          view_count: number
          weather_policy: string | null
        }
        Insert: {
          advance_percentage?: number | null
          battery_count?: number | null
          camera_resolution?: string | null
          cancellation_policy?: string | null
          coverage_durations?: string[]
          coverage_includes?: string[]
          coverage_indoor?: boolean | null
          coverage_outdoor?: boolean | null
          coverage_type?: string | null
          created_at?: string
          deliverables?: string[]
          delivery_time?: string | null
          description?: string | null
          drone_brand?: string | null
          drone_features?: string[]
          drone_model?: string | null
          extra_flight_hour_charges?: number | null
          fixed_price?: number | null
          flexible_pricing?: boolean | null
          flights_included?: number | null
          full_day_price?: number | null
          half_day_price?: number | null
          hourly_price?: number | null
          id?: string
          is_featured?: boolean
          max_flight_time?: string | null
          max_travel_km?: number | null
          name: string
          package_price?: number | null
          provider_id: string
          service_types?: string[]
          starting_price?: number | null
          status?: string
          travel_charges_amount?: number | null
          travel_outside_city?: boolean
          travel_radius_km?: number | null
          travel_within_city?: boolean
          updated_at?: string
          view_count?: number
          weather_policy?: string | null
        }
        Update: {
          advance_percentage?: number | null
          battery_count?: number | null
          camera_resolution?: string | null
          cancellation_policy?: string | null
          coverage_durations?: string[]
          coverage_includes?: string[]
          coverage_indoor?: boolean | null
          coverage_outdoor?: boolean | null
          coverage_type?: string | null
          created_at?: string
          deliverables?: string[]
          delivery_time?: string | null
          description?: string | null
          drone_brand?: string | null
          drone_features?: string[]
          drone_model?: string | null
          extra_flight_hour_charges?: number | null
          fixed_price?: number | null
          flexible_pricing?: boolean | null
          flights_included?: number | null
          full_day_price?: number | null
          half_day_price?: number | null
          hourly_price?: number | null
          id?: string
          is_featured?: boolean
          max_flight_time?: string | null
          max_travel_km?: number | null
          name?: string
          package_price?: number | null
          provider_id?: string
          service_types?: string[]
          starting_price?: number | null
          status?: string
          travel_charges_amount?: number | null
          travel_outside_city?: boolean
          travel_radius_km?: number | null
          travel_within_city?: boolean
          updated_at?: string
          view_count?: number
          weather_policy?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drone_packages_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "approved_artists_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drone_packages_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_bookings: {
        Row: {
          created_at: string
          customer_id: string
          event_date: string
          event_name: string
          event_type: string
          guest_count: number
          id: string
          location: string
          notes: string | null
          status: string | null
          total_budget: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          event_date: string
          event_name: string
          event_type: string
          guest_count: number
          id?: string
          location: string
          notes?: string | null
          status?: string | null
          total_budget: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          event_date?: string
          event_name?: string
          event_type?: string
          guest_count?: number
          id?: string
          location?: string
          notes?: string | null
          status?: string | null
          total_budget?: number
          updated_at?: string
        }
        Relationships: []
      }
      event_state_versions: {
        Row: {
          conversation_id: string
          created_at: string
          event_state_id: string
          id: string
          state: Json
          user_id: string
          version: number
        }
        Insert: {
          conversation_id: string
          created_at?: string
          event_state_id: string
          id?: string
          state: Json
          user_id: string
          version: number
        }
        Update: {
          conversation_id?: string
          created_at?: string
          event_state_id?: string
          id?: string
          state?: Json
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "event_state_versions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_state_versions_event_state_id_fkey"
            columns: ["event_state_id"]
            isOneToOne: false
            referencedRelation: "event_states"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_state_versions_state_owner_fk"
            columns: ["event_state_id", "user_id"]
            isOneToOne: false
            referencedRelation: "event_states"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      event_states: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          state: Json
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          state?: Json
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          state?: Json
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "event_states_conv_owner_fk"
            columns: ["conversation_id", "user_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "event_states_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: true
            referencedRelation: "ai_conversations"
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
      favorites: {
        Row: {
          created_at: string
          id: string
          provider_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          provider_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          provider_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "approved_artists_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      featured_artists: {
        Row: {
          created_at: string
          expires_at: string
          featured_at: string
          featured_by: string | null
          id: string
          provider_id: string
          reason: string | null
        }
        Insert: {
          created_at?: string
          expires_at: string
          featured_at?: string
          featured_by?: string | null
          id?: string
          provider_id: string
          reason?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          featured_at?: string
          featured_by?: string | null
          id?: string
          provider_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "featured_artists_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "approved_artists_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "featured_artists_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hall_addons: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          package_id: string
          price: number
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          package_id: string
          price: number
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          package_id?: string
          price?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "hall_addons_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "banquet_halls"
            referencedColumns: ["id"]
          },
        ]
      }
      hall_gallery: {
        Row: {
          created_at: string
          id: string
          is_cover: boolean
          media_type: string
          package_id: string
          public_url: string
          sort_order: number
          storage_path: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_cover?: boolean
          media_type?: string
          package_id: string
          public_url: string
          sort_order?: number
          storage_path: string
        }
        Update: {
          created_at?: string
          id?: string
          is_cover?: boolean
          media_type?: string
          package_id?: string
          public_url?: string
          sort_order?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "hall_gallery_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "banquet_halls"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          booking_id: string
          created_at: string
          customer_id: string
          generated_at: string
          id: string
          invoice_number: string
          invoice_url: string | null
          paid_at: string | null
          platform_fee: number
          provider_id: string
          status: string | null
          total_amount: number
        }
        Insert: {
          amount: number
          booking_id: string
          created_at?: string
          customer_id: string
          generated_at?: string
          id?: string
          invoice_number: string
          invoice_url?: string | null
          paid_at?: string | null
          platform_fee: number
          provider_id: string
          status?: string | null
          total_amount: number
        }
        Update: {
          amount?: number
          booking_id?: string
          created_at?: string
          customer_id?: string
          generated_at?: string
          id?: string
          invoice_number?: string
          invoice_url?: string | null
          paid_at?: string | null
          platform_fee?: number
          provider_id?: string
          status?: string | null
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "approved_artists_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      login_attempts: {
        Row: {
          attempt_type: string
          created_at: string
          failure_reason: string | null
          id: string
          ip_address: unknown
          phone: string
          success: boolean
          user_agent: string | null
        }
        Insert: {
          attempt_type: string
          created_at?: string
          failure_reason?: string | null
          id?: string
          ip_address?: unknown
          phone: string
          success: boolean
          user_agent?: string | null
        }
        Update: {
          attempt_type?: string
          created_at?: string
          failure_reason?: string | null
          id?: string
          ip_address?: unknown
          phone?: string
          success?: boolean
          user_agent?: string | null
        }
        Relationships: []
      }
      makeup_addons: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          package_id: string
          price: number
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          package_id: string
          price: number
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          package_id?: string
          price?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "makeup_addons_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "makeup_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      makeup_bookings: {
        Row: {
          accepted_at: string | null
          addons_amount: number
          advance_amount: number | null
          advance_paid_at: string | null
          base_amount: number
          calendar_locked: boolean
          city: string | null
          confirmed_at: string | null
          created_at: string
          customer_id: string
          event_date: string
          event_time: string | null
          event_type: string | null
          expired_at: string | null
          id: string
          otp_verified_at: string | null
          package_id: string
          payment_deadline: string | null
          provider_id: string
          remaining_amount: number | null
          selected_addon_ids: string[]
          settlement_status: string | null
          special_requirements: string | null
          start_requested_at: string | null
          status: string
          total_amount: number
          venue: string | null
          work_completed_at: string | null
          work_started_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          addons_amount?: number
          advance_amount?: number | null
          advance_paid_at?: string | null
          base_amount: number
          calendar_locked?: boolean
          city?: string | null
          confirmed_at?: string | null
          created_at?: string
          customer_id: string
          event_date: string
          event_time?: string | null
          event_type?: string | null
          expired_at?: string | null
          id?: string
          otp_verified_at?: string | null
          package_id: string
          payment_deadline?: string | null
          provider_id: string
          remaining_amount?: number | null
          selected_addon_ids?: string[]
          settlement_status?: string | null
          special_requirements?: string | null
          start_requested_at?: string | null
          status?: string
          total_amount: number
          venue?: string | null
          work_completed_at?: string | null
          work_started_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          addons_amount?: number
          advance_amount?: number | null
          advance_paid_at?: string | null
          base_amount?: number
          calendar_locked?: boolean
          city?: string | null
          confirmed_at?: string | null
          created_at?: string
          customer_id?: string
          event_date?: string
          event_time?: string | null
          event_type?: string | null
          expired_at?: string | null
          id?: string
          otp_verified_at?: string | null
          package_id?: string
          payment_deadline?: string | null
          provider_id?: string
          remaining_amount?: number | null
          selected_addon_ids?: string[]
          settlement_status?: string | null
          special_requirements?: string | null
          start_requested_at?: string | null
          status?: string
          total_amount?: number
          venue?: string | null
          work_completed_at?: string | null
          work_started_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "makeup_bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "makeup_bookings_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "makeup_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "makeup_bookings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "approved_artists_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "makeup_bookings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      makeup_gallery: {
        Row: {
          created_at: string
          id: string
          is_cover: boolean
          media_type: string
          package_id: string
          public_url: string
          sort_order: number
          storage_path: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_cover?: boolean
          media_type?: string
          package_id: string
          public_url: string
          sort_order?: number
          storage_path: string
        }
        Update: {
          created_at?: string
          id?: string
          is_cover?: boolean
          media_type?: string
          package_id?: string
          public_url?: string
          sort_order?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "makeup_gallery_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "makeup_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      makeup_packages: {
        Row: {
          advance_percentage: number | null
          assistant_artists: number | null
          brands_used: string[]
          created_at: string
          deliverables: string[]
          description: string | null
          early_morning_charges: number | null
          hair_stylists: number | null
          id: string
          is_featured: boolean
          late_night_charges: number | null
          lead_artist: number | null
          male_grooming_artist: number | null
          name: string
          outside_city_charges: number | null
          package_price: number | null
          package_type: string
          provider_id: string
          saree_drapers: number | null
          services_included: string[]
          skin_types: string[]
          status: string
          touchup_charges: number | null
          travel_charges: number | null
          updated_at: string
          view_count: number
        }
        Insert: {
          advance_percentage?: number | null
          assistant_artists?: number | null
          brands_used?: string[]
          created_at?: string
          deliverables?: string[]
          description?: string | null
          early_morning_charges?: number | null
          hair_stylists?: number | null
          id?: string
          is_featured?: boolean
          late_night_charges?: number | null
          lead_artist?: number | null
          male_grooming_artist?: number | null
          name: string
          outside_city_charges?: number | null
          package_price?: number | null
          package_type: string
          provider_id: string
          saree_drapers?: number | null
          services_included?: string[]
          skin_types?: string[]
          status?: string
          touchup_charges?: number | null
          travel_charges?: number | null
          updated_at?: string
          view_count?: number
        }
        Update: {
          advance_percentage?: number | null
          assistant_artists?: number | null
          brands_used?: string[]
          created_at?: string
          deliverables?: string[]
          description?: string | null
          early_morning_charges?: number | null
          hair_stylists?: number | null
          id?: string
          is_featured?: boolean
          late_night_charges?: number | null
          lead_artist?: number | null
          male_grooming_artist?: number | null
          name?: string
          outside_city_charges?: number | null
          package_price?: number | null
          package_type?: string
          provider_id?: string
          saree_drapers?: number | null
          services_included?: string[]
          skin_types?: string[]
          status?: string
          touchup_charges?: number | null
          travel_charges?: number | null
          updated_at?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "makeup_packages_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "approved_artists_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "makeup_packages_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mehendi_addons: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          package_id: string
          price: number
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          package_id: string
          price: number
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          package_id?: string
          price?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "mehendi_addons_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "mehendi_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      mehendi_bookings: {
        Row: {
          accepted_at: string | null
          addons_amount: number
          advance_amount: number | null
          advance_paid_at: string | null
          base_amount: number
          calendar_locked: boolean
          city: string | null
          confirmed_at: string | null
          created_at: string
          customer_id: string
          event_date: string
          event_time: string | null
          event_type: string | null
          expired_at: string | null
          id: string
          num_clients: number | null
          otp_verified_at: string | null
          package_id: string
          payment_deadline: string | null
          provider_id: string
          remaining_amount: number | null
          selected_addon_ids: string[]
          settlement_status: string | null
          special_requirements: string | null
          start_requested_at: string | null
          status: string
          total_amount: number
          venue: string | null
          work_completed_at: string | null
          work_started_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          addons_amount?: number
          advance_amount?: number | null
          advance_paid_at?: string | null
          base_amount: number
          calendar_locked?: boolean
          city?: string | null
          confirmed_at?: string | null
          created_at?: string
          customer_id: string
          event_date: string
          event_time?: string | null
          event_type?: string | null
          expired_at?: string | null
          id?: string
          num_clients?: number | null
          otp_verified_at?: string | null
          package_id: string
          payment_deadline?: string | null
          provider_id: string
          remaining_amount?: number | null
          selected_addon_ids?: string[]
          settlement_status?: string | null
          special_requirements?: string | null
          start_requested_at?: string | null
          status?: string
          total_amount: number
          venue?: string | null
          work_completed_at?: string | null
          work_started_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          addons_amount?: number
          advance_amount?: number | null
          advance_paid_at?: string | null
          base_amount?: number
          calendar_locked?: boolean
          city?: string | null
          confirmed_at?: string | null
          created_at?: string
          customer_id?: string
          event_date?: string
          event_time?: string | null
          event_type?: string | null
          expired_at?: string | null
          id?: string
          num_clients?: number | null
          otp_verified_at?: string | null
          package_id?: string
          payment_deadline?: string | null
          provider_id?: string
          remaining_amount?: number | null
          selected_addon_ids?: string[]
          settlement_status?: string | null
          special_requirements?: string | null
          start_requested_at?: string | null
          status?: string
          total_amount?: number
          venue?: string | null
          work_completed_at?: string | null
          work_started_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mehendi_bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mehendi_bookings_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "mehendi_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mehendi_bookings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "approved_artists_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mehendi_bookings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mehendi_gallery: {
        Row: {
          created_at: string
          id: string
          is_cover: boolean
          media_type: string
          package_id: string
          public_url: string
          sort_order: number
          storage_path: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_cover?: boolean
          media_type?: string
          package_id: string
          public_url: string
          sort_order?: number
          storage_path: string
        }
        Update: {
          created_at?: string
          id?: string
          is_cover?: boolean
          media_type?: string
          package_id?: string
          public_url?: string
          sort_order?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "mehendi_gallery_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "mehendi_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      mehendi_packages: {
        Row: {
          advance_percentage: number | null
          assistant_artists: number | null
          bridal_specialist: boolean | null
          clients_included: number | null
          coverage: string[]
          created_at: string
          deliverables: string[]
          description: string | null
          design_styles: string[]
          festival_charges: number | null
          group_discount: number | null
          id: string
          inclusions: string[]
          is_featured: boolean
          lead_artist: number | null
          max_clients: number | null
          name: string
          outside_city_charges: number | null
          package_price: number | null
          package_type: string
          price_per_hand: number | null
          price_per_person: number | null
          provider_id: string
          status: string
          travel_charges: number | null
          updated_at: string
          view_count: number
        }
        Insert: {
          advance_percentage?: number | null
          assistant_artists?: number | null
          bridal_specialist?: boolean | null
          clients_included?: number | null
          coverage?: string[]
          created_at?: string
          deliverables?: string[]
          description?: string | null
          design_styles?: string[]
          festival_charges?: number | null
          group_discount?: number | null
          id?: string
          inclusions?: string[]
          is_featured?: boolean
          lead_artist?: number | null
          max_clients?: number | null
          name: string
          outside_city_charges?: number | null
          package_price?: number | null
          package_type: string
          price_per_hand?: number | null
          price_per_person?: number | null
          provider_id: string
          status?: string
          travel_charges?: number | null
          updated_at?: string
          view_count?: number
        }
        Update: {
          advance_percentage?: number | null
          assistant_artists?: number | null
          bridal_specialist?: boolean | null
          clients_included?: number | null
          coverage?: string[]
          created_at?: string
          deliverables?: string[]
          description?: string | null
          design_styles?: string[]
          festival_charges?: number | null
          group_discount?: number | null
          id?: string
          inclusions?: string[]
          is_featured?: boolean
          lead_artist?: number | null
          max_clients?: number | null
          name?: string
          outside_city_charges?: number | null
          package_price?: number | null
          package_type?: string
          price_per_hand?: number | null
          price_per_person?: number | null
          provider_id?: string
          status?: string
          travel_charges?: number | null
          updated_at?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "mehendi_packages_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "approved_artists_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mehendi_packages_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          dish_name: string
          id: string
          image_url: string | null
          is_available: boolean | null
          max_capacity: number | null
          min_order: number | null
          price_per_plate: number | null
          provider_id: string
          sort_order: number | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          dish_name: string
          id?: string
          image_url?: string | null
          is_available?: boolean | null
          max_capacity?: number | null
          min_order?: number | null
          price_per_plate?: number | null
          provider_id: string
          sort_order?: number | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          dish_name?: string
          id?: string
          image_url?: string | null
          is_available?: boolean | null
          max_capacity?: number | null
          min_order?: number | null
          price_per_plate?: number | null
          provider_id?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "approved_artists_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachment_url: string | null
          booking_id: string
          content: string
          created_at: string
          delivered_at: string | null
          file_name: string | null
          file_size: number | null
          id: string
          is_read: boolean | null
          latitude: number | null
          location_label: string | null
          longitude: number | null
          message_type: string
          mime_type: string | null
          read_at: string | null
          reply_to_id: string | null
          sender_id: string
        }
        Insert: {
          attachment_url?: string | null
          booking_id: string
          content: string
          created_at?: string
          delivered_at?: string | null
          file_name?: string | null
          file_size?: number | null
          id?: string
          is_read?: boolean | null
          latitude?: number | null
          location_label?: string | null
          longitude?: number | null
          message_type?: string
          mime_type?: string | null
          read_at?: string | null
          reply_to_id?: string | null
          sender_id: string
        }
        Update: {
          attachment_url?: string | null
          booking_id?: string
          content?: string
          created_at?: string
          delivered_at?: string | null
          file_name?: string | null
          file_size?: number | null
          id?: string
          is_read?: boolean | null
          latitude?: number | null
          location_label?: string | null
          longitude?: number | null
          message_type?: string
          mime_type?: string | null
          read_at?: string | null
          reply_to_id?: string | null
          sender_id?: string
        }
        Relationships: []
      }
      notification_settings: {
        Row: {
          booking_notifications: boolean | null
          created_at: string
          email_enabled: boolean | null
          id: string
          marketing_notifications: boolean | null
          payment_notifications: boolean | null
          push_enabled: boolean | null
          sms_enabled: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          booking_notifications?: boolean | null
          created_at?: string
          email_enabled?: boolean | null
          id?: string
          marketing_notifications?: boolean | null
          payment_notifications?: boolean | null
          push_enabled?: boolean | null
          sms_enabled?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          booking_notifications?: boolean | null
          created_at?: string
          email_enabled?: boolean | null
          id?: string
          marketing_notifications?: boolean | null
          payment_notifications?: boolean | null
          push_enabled?: boolean | null
          sms_enabled?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      photographer_availability: {
        Row: {
          available_date: string
          id: string
          is_available: boolean
          note: string | null
          photographer_id: string
        }
        Insert: {
          available_date: string
          id?: string
          is_available?: boolean
          note?: string | null
          photographer_id: string
        }
        Update: {
          available_date?: string
          id?: string
          is_available?: boolean
          note?: string | null
          photographer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "photographer_availability_photographer_id_fkey"
            columns: ["photographer_id"]
            isOneToOne: false
            referencedRelation: "approved_artists_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photographer_availability_photographer_id_fkey"
            columns: ["photographer_id"]
            isOneToOne: false
            referencedRelation: "provider_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      photography_albums: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          package_id: string
          pages: number
          price: number
          size: string
          sort_order: number
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          package_id: string
          pages: number
          price: number
          size: string
          sort_order?: number
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          package_id?: string
          pages?: number
          price?: number
          size?: string
          sort_order?: number
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "photography_albums_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "photography_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      photography_booking_timeline: {
        Row: {
          actor_id: string | null
          booking_id: string
          created_at: string
          event_type: string
          id: string
          message: string
        }
        Insert: {
          actor_id?: string | null
          booking_id: string
          created_at?: string
          event_type: string
          id?: string
          message: string
        }
        Update: {
          actor_id?: string | null
          booking_id?: string
          created_at?: string
          event_type?: string
          id?: string
          message?: string
        }
        Relationships: [
          {
            foreignKeyName: "photography_booking_timeline_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photography_booking_timeline_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "photography_package_bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      photography_cart_items: {
        Row: {
          addon_ids: string[]
          album_id: string | null
          cart_id: string
          created_at: string
          id: string
          package_id: string
          quantity: number
        }
        Insert: {
          addon_ids?: string[]
          album_id?: string | null
          cart_id: string
          created_at?: string
          id?: string
          package_id: string
          quantity?: number
        }
        Update: {
          addon_ids?: string[]
          album_id?: string | null
          cart_id?: string
          created_at?: string
          id?: string
          package_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "photography_cart_items_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "photography_albums"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photography_cart_items_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "photography_carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photography_cart_items_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "photography_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      photography_carts: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          photographer_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          photographer_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          photographer_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "photography_carts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photography_carts_photographer_id_fkey"
            columns: ["photographer_id"]
            isOneToOne: false
            referencedRelation: "approved_artists_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photography_carts_photographer_id_fkey"
            columns: ["photographer_id"]
            isOneToOne: false
            referencedRelation: "provider_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      photography_package_addons: {
        Row: {
          description: string | null
          id: string
          is_active: boolean
          name: string
          package_id: string
          price: number
          sort_order: number
        }
        Insert: {
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          package_id: string
          price: number
          sort_order?: number
        }
        Update: {
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          package_id?: string
          price?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "photography_package_addons_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "photography_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      photography_package_bookings: {
        Row: {
          accepted_at: string | null
          addons_amount: number
          advance_amount: number | null
          advance_paid_at: string | null
          album_amount: number
          base_amount: number
          calendar_locked: boolean
          city: string | null
          confirmed_at: string | null
          created_at: string
          customer_id: string
          event_date: string
          event_time: string | null
          expired_at: string | null
          id: string
          notes: string | null
          otp_verified_at: string | null
          package_id: string
          payment_deadline: string | null
          photographer_id: string
          remaining_amount: number | null
          selected_addon_ids: string[]
          selected_album_details: Json | null
          selected_album_id: string | null
          settlement_status: string | null
          start_requested_at: string | null
          status: string
          total_amount: number
          venue: string | null
          work_completed_at: string | null
          work_started_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          addons_amount?: number
          advance_amount?: number | null
          advance_paid_at?: string | null
          album_amount?: number
          base_amount: number
          calendar_locked?: boolean
          city?: string | null
          confirmed_at?: string | null
          created_at?: string
          customer_id: string
          event_date: string
          event_time?: string | null
          expired_at?: string | null
          id?: string
          notes?: string | null
          otp_verified_at?: string | null
          package_id: string
          payment_deadline?: string | null
          photographer_id: string
          remaining_amount?: number | null
          selected_addon_ids?: string[]
          selected_album_details?: Json | null
          selected_album_id?: string | null
          settlement_status?: string | null
          start_requested_at?: string | null
          status?: string
          total_amount: number
          venue?: string | null
          work_completed_at?: string | null
          work_started_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          addons_amount?: number
          advance_amount?: number | null
          advance_paid_at?: string | null
          album_amount?: number
          base_amount?: number
          calendar_locked?: boolean
          city?: string | null
          confirmed_at?: string | null
          created_at?: string
          customer_id?: string
          event_date?: string
          event_time?: string | null
          expired_at?: string | null
          id?: string
          notes?: string | null
          otp_verified_at?: string | null
          package_id?: string
          payment_deadline?: string | null
          photographer_id?: string
          remaining_amount?: number | null
          selected_addon_ids?: string[]
          selected_album_details?: Json | null
          selected_album_id?: string | null
          settlement_status?: string | null
          start_requested_at?: string | null
          status?: string
          total_amount?: number
          venue?: string | null
          work_completed_at?: string | null
          work_started_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "photography_package_bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photography_package_bookings_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "photography_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photography_package_bookings_photographer_id_fkey"
            columns: ["photographer_id"]
            isOneToOne: false
            referencedRelation: "approved_artists_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photography_package_bookings_photographer_id_fkey"
            columns: ["photographer_id"]
            isOneToOne: false
            referencedRelation: "provider_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photography_package_bookings_selected_album_id_fkey"
            columns: ["selected_album_id"]
            isOneToOne: false
            referencedRelation: "photography_albums"
            referencedColumns: ["id"]
          },
        ]
      }
      photography_package_highlights: {
        Row: {
          id: string
          package_id: string
          sort_order: number
          text: string
        }
        Insert: {
          id?: string
          package_id: string
          sort_order?: number
          text: string
        }
        Update: {
          id?: string
          package_id?: string
          sort_order?: number
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "photography_package_highlights_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "photography_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      photography_package_images: {
        Row: {
          alt_text: string | null
          created_at: string
          id: string
          is_cover: boolean
          package_id: string
          public_url: string
          sort_order: number
          storage_path: string
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          id?: string
          is_cover?: boolean
          package_id: string
          public_url: string
          sort_order?: number
          storage_path: string
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          id?: string
          is_cover?: boolean
          package_id?: string
          public_url?: string
          sort_order?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "photography_package_images_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "photography_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      photography_package_invoices: {
        Row: {
          amount: number
          booking_id: string
          created_at: string
          id: string
          invoice_number: string
          status: string
        }
        Insert: {
          amount: number
          booking_id: string
          created_at?: string
          id?: string
          invoice_number: string
          status?: string
        }
        Update: {
          amount?: number
          booking_id?: string
          created_at?: string
          id?: string
          invoice_number?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "photography_package_invoices_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "photography_package_bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      photography_package_payments: {
        Row: {
          amount: number
          booking_id: string
          created_at: string
          id: string
          payment_method: string | null
          status: string
        }
        Insert: {
          amount: number
          booking_id: string
          created_at?: string
          id?: string
          payment_method?: string | null
          status?: string
        }
        Update: {
          amount?: number
          booking_id?: string
          created_at?: string
          id?: string
          payment_method?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "photography_package_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "photography_package_bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      photography_package_reviews: {
        Row: {
          booking_id: string
          created_at: string
          customer_id: string
          id: string
          package_id: string
          rating: number
          review_text: string | null
        }
        Insert: {
          booking_id: string
          created_at?: string
          customer_id: string
          id?: string
          package_id: string
          rating: number
          review_text?: string | null
        }
        Update: {
          booking_id?: string
          created_at?: string
          customer_id?: string
          id?: string
          package_id?: string
          rating?: number
          review_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "photography_package_reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "photography_package_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photography_package_reviews_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photography_package_reviews_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "photography_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      photography_packages: {
        Row: {
          album_details: string | null
          album_included: boolean
          album_pages: number | null
          album_size: string | null
          album_type: string | null
          created_at: string
          delivery_time: string | null
          description: string | null
          duration: string | null
          edited_photos: number | null
          id: string
          is_active: boolean
          is_visible: boolean
          name: string
          package_type: string | null
          photographer_id: string
          photography_type: string | null
          price: number
          raw_photos_included: boolean
          status: string
          team_size: number | null
          team_size_custom: number | null
          travel_details: string | null
          travel_extra_charge: number | null
          travel_included: boolean
          travel_radius_km: number | null
          updated_at: string
          videography_coverage_hours: string | null
          videography_deliverables: string[] | null
          videography_delivery_time: string | null
          videography_editing_options: string[] | null
          videography_equipment: string[] | null
          videography_included: boolean | null
          videography_team_assistants: number | null
          videography_team_drone_operator: boolean | null
          videography_team_videographers: number | null
          view_count: number
        }
        Insert: {
          album_details?: string | null
          album_included?: boolean
          album_pages?: number | null
          album_size?: string | null
          album_type?: string | null
          created_at?: string
          delivery_time?: string | null
          description?: string | null
          duration?: string | null
          edited_photos?: number | null
          id?: string
          is_active?: boolean
          is_visible?: boolean
          name: string
          package_type?: string | null
          photographer_id: string
          photography_type?: string | null
          price: number
          raw_photos_included?: boolean
          status?: string
          team_size?: number | null
          team_size_custom?: number | null
          travel_details?: string | null
          travel_extra_charge?: number | null
          travel_included?: boolean
          travel_radius_km?: number | null
          updated_at?: string
          videography_coverage_hours?: string | null
          videography_deliverables?: string[] | null
          videography_delivery_time?: string | null
          videography_editing_options?: string[] | null
          videography_equipment?: string[] | null
          videography_included?: boolean | null
          videography_team_assistants?: number | null
          videography_team_drone_operator?: boolean | null
          videography_team_videographers?: number | null
          view_count?: number
        }
        Update: {
          album_details?: string | null
          album_included?: boolean
          album_pages?: number | null
          album_size?: string | null
          album_type?: string | null
          created_at?: string
          delivery_time?: string | null
          description?: string | null
          duration?: string | null
          edited_photos?: number | null
          id?: string
          is_active?: boolean
          is_visible?: boolean
          name?: string
          package_type?: string | null
          photographer_id?: string
          photography_type?: string | null
          price?: number
          raw_photos_included?: boolean
          status?: string
          team_size?: number | null
          team_size_custom?: number | null
          travel_details?: string | null
          travel_extra_charge?: number | null
          travel_included?: boolean
          travel_radius_km?: number | null
          updated_at?: string
          videography_coverage_hours?: string | null
          videography_deliverables?: string[] | null
          videography_delivery_time?: string | null
          videography_editing_options?: string[] | null
          videography_equipment?: string[] | null
          videography_included?: boolean | null
          videography_team_assistants?: number | null
          videography_team_drone_operator?: boolean | null
          videography_team_videographers?: number | null
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "photography_packages_photographer_id_fkey"
            columns: ["photographer_id"]
            isOneToOne: false
            referencedRelation: "approved_artists_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photography_packages_photographer_id_fkey"
            columns: ["photographer_id"]
            isOneToOne: false
            referencedRelation: "provider_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      photography_videography_package_addons: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          package_id: string
          price: number
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          package_id: string
          price: number
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          package_id?: string
          price?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "photography_videography_package_addons_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "photography_videography_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      photography_videography_package_bookings: {
        Row: {
          addons_amount: number
          base_amount: number
          created_at: string
          customer_id: string
          event_date: string
          event_time: string | null
          event_type: string | null
          id: string
          notes: string | null
          package_id: string
          provider_id: string
          selected_addon_ids: string[]
          status: string
          total_amount: number
          venue: string | null
        }
        Insert: {
          addons_amount?: number
          base_amount: number
          created_at?: string
          customer_id: string
          event_date: string
          event_time?: string | null
          event_type?: string | null
          id?: string
          notes?: string | null
          package_id: string
          provider_id: string
          selected_addon_ids?: string[]
          status?: string
          total_amount: number
          venue?: string | null
        }
        Update: {
          addons_amount?: number
          base_amount?: number
          created_at?: string
          customer_id?: string
          event_date?: string
          event_time?: string | null
          event_type?: string | null
          id?: string
          notes?: string | null
          package_id?: string
          provider_id?: string
          selected_addon_ids?: string[]
          status?: string
          total_amount?: number
          venue?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "photography_videography_package_bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photography_videography_package_bookings_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "photography_videography_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photography_videography_package_bookings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "approved_artists_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photography_videography_package_bookings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      photography_videography_package_images: {
        Row: {
          alt_text: string | null
          created_at: string
          duration_seconds: number | null
          id: string
          is_cover: boolean
          media_type: string | null
          package_id: string
          public_url: string
          sort_order: number
          storage_path: string
          thumbnail_url: string | null
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          duration_seconds?: number | null
          id?: string
          is_cover?: boolean
          media_type?: string | null
          package_id: string
          public_url: string
          sort_order?: number
          storage_path: string
          thumbnail_url?: string | null
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          duration_seconds?: number | null
          id?: string
          is_cover?: boolean
          media_type?: string | null
          package_id?: string
          public_url?: string
          sort_order?: number
          storage_path?: string
          thumbnail_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "photography_videography_package_images_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "photography_videography_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      photography_videography_packages: {
        Row: {
          advance_percentage: number | null
          created_at: string
          description: string | null
          duration: string | null
          event_type: string | null
          id: string
          is_active: boolean
          is_visible: boolean
          name: string
          package_type: string
          photography_album_details: string | null
          photography_album_included: boolean | null
          photography_deliverables: string[] | null
          photography_delivery_time: string | null
          photography_edited_photos: number | null
          photography_pre_event_shoot: boolean | null
          photography_raw_photos_included: boolean | null
          photography_team_size: number | null
          photography_team_size_custom: string | null
          photography_unlimited_edited: boolean | null
          price: number
          provider_id: string
          status: string | null
          travel_details: Json | null
          travel_extra_charge: number | null
          travel_included: boolean | null
          travel_radius_km: number | null
          updated_at: string
          videography_coverage_hours: string | null
          videography_deliverables: string[] | null
          videography_delivery_time: string | null
          videography_editing_options: string[] | null
          videography_equipment: string[] | null
          videography_event_types: string[] | null
          videography_included_services: string[] | null
          videography_pre_event_shoot: boolean | null
          videography_team_assistants: number | null
          videography_team_drone_operator: boolean | null
          videography_team_editor: number | null
          videography_team_videographers: number | null
          view_count: number
        }
        Insert: {
          advance_percentage?: number | null
          created_at?: string
          description?: string | null
          duration?: string | null
          event_type?: string | null
          id?: string
          is_active?: boolean
          is_visible?: boolean
          name: string
          package_type: string
          photography_album_details?: string | null
          photography_album_included?: boolean | null
          photography_deliverables?: string[] | null
          photography_delivery_time?: string | null
          photography_edited_photos?: number | null
          photography_pre_event_shoot?: boolean | null
          photography_raw_photos_included?: boolean | null
          photography_team_size?: number | null
          photography_team_size_custom?: string | null
          photography_unlimited_edited?: boolean | null
          price: number
          provider_id: string
          status?: string | null
          travel_details?: Json | null
          travel_extra_charge?: number | null
          travel_included?: boolean | null
          travel_radius_km?: number | null
          updated_at?: string
          videography_coverage_hours?: string | null
          videography_deliverables?: string[] | null
          videography_delivery_time?: string | null
          videography_editing_options?: string[] | null
          videography_equipment?: string[] | null
          videography_event_types?: string[] | null
          videography_included_services?: string[] | null
          videography_pre_event_shoot?: boolean | null
          videography_team_assistants?: number | null
          videography_team_drone_operator?: boolean | null
          videography_team_editor?: number | null
          videography_team_videographers?: number | null
          view_count?: number
        }
        Update: {
          advance_percentage?: number | null
          created_at?: string
          description?: string | null
          duration?: string | null
          event_type?: string | null
          id?: string
          is_active?: boolean
          is_visible?: boolean
          name?: string
          package_type?: string
          photography_album_details?: string | null
          photography_album_included?: boolean | null
          photography_deliverables?: string[] | null
          photography_delivery_time?: string | null
          photography_edited_photos?: number | null
          photography_pre_event_shoot?: boolean | null
          photography_raw_photos_included?: boolean | null
          photography_team_size?: number | null
          photography_team_size_custom?: string | null
          photography_unlimited_edited?: boolean | null
          price?: number
          provider_id?: string
          status?: string | null
          travel_details?: Json | null
          travel_extra_charge?: number | null
          travel_included?: boolean | null
          travel_radius_km?: number | null
          updated_at?: string
          videography_coverage_hours?: string | null
          videography_deliverables?: string[] | null
          videography_delivery_time?: string | null
          videography_editing_options?: string[] | null
          videography_equipment?: string[] | null
          videography_event_types?: string[] | null
          videography_included_services?: string[] | null
          videography_pre_event_shoot?: boolean | null
          videography_team_assistants?: number | null
          videography_team_drone_operator?: boolean | null
          videography_team_editor?: number | null
          videography_team_videographers?: number | null
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "photography_videography_packages_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "approved_artists_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photography_videography_packages_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      planner_recommendation_candidates: {
        Row: {
          availability_checked_at: string | null
          availability_status: string
          created_at: string
          evidence_snapshot: Json
          id: string
          match_score: number
          provider_id: string
          rank_position: number
          reason_breakdown: Json
          run_id: string
        }
        Insert: {
          availability_checked_at?: string | null
          availability_status: string
          created_at?: string
          evidence_snapshot?: Json
          id?: string
          match_score: number
          provider_id: string
          rank_position: number
          reason_breakdown?: Json
          run_id: string
        }
        Update: {
          availability_checked_at?: string | null
          availability_status?: string
          created_at?: string
          evidence_snapshot?: Json
          id?: string
          match_score?: number
          provider_id?: string
          rank_position?: number
          reason_breakdown?: Json
          run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "planner_recommendation_candidates_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "approved_artists_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planner_recommendation_candidates_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planner_recommendation_candidates_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "planner_recommendation_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      planner_recommendation_runs: {
        Row: {
          algorithm_version: string
          conversation_id: string | null
          created_at: string
          id: string
          intent: string
          message_id: string | null
          search_criteria: Json
          user_id: string
        }
        Insert: {
          algorithm_version?: string
          conversation_id?: string | null
          created_at?: string
          id?: string
          intent: string
          message_id?: string | null
          search_criteria?: Json
          user_id: string
        }
        Update: {
          algorithm_version?: string
          conversation_id?: string | null
          created_at?: string
          id?: string
          intent?: string
          message_id?: string | null
          search_criteria?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "planner_recommendation_runs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planner_recommendation_runs_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "ai_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_analytics: {
        Row: {
          active_customers: number | null
          active_providers: number | null
          created_at: string
          date: string
          id: string
          new_registrations: number | null
          total_bookings: number | null
          total_commission: number | null
          total_revenue: number | null
        }
        Insert: {
          active_customers?: number | null
          active_providers?: number | null
          created_at?: string
          date: string
          id?: string
          new_registrations?: number | null
          total_bookings?: number | null
          total_commission?: number | null
          total_revenue?: number | null
        }
        Update: {
          active_customers?: number | null
          active_providers?: number | null
          created_at?: string
          date?: string
          id?: string
          new_registrations?: number | null
          total_bookings?: number | null
          total_commission?: number | null
          total_revenue?: number | null
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      pooja_services: {
        Row: {
          created_at: string | null
          description: string | null
          duration_minutes: number | null
          id: string
          image_url: string | null
          is_available: boolean | null
          materials_included: boolean | null
          materials_note: string | null
          pooja_name: string
          price: number | null
          provider_id: string
          religion: string | null
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          image_url?: string | null
          is_available?: boolean | null
          materials_included?: boolean | null
          materials_note?: string | null
          pooja_name: string
          price?: number | null
          provider_id: string
          religion?: string | null
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          image_url?: string | null
          is_available?: boolean | null
          materials_included?: boolean | null
          materials_note?: string | null
          pooja_name?: string
          price?: number | null
          provider_id?: string
          religion?: string | null
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pooja_services_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "approved_artists_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pooja_services_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_items: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          event_name: string | null
          id: string
          is_published: boolean | null
          media_type: string
          media_url: string
          provider_id: string
          style_tag: string | null
          title: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          event_name?: string | null
          id?: string
          is_published?: boolean | null
          media_type: string
          media_url: string
          provider_id: string
          style_tag?: string | null
          title?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          event_name?: string | null
          id?: string
          is_published?: boolean | null
          media_type?: string
          media_url?: string
          provider_id?: string
          style_tag?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_items_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "approved_artists_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolio_items_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_packages: {
        Row: {
          created_at: string
          description: string | null
          duration: string | null
          id: string
          is_active: boolean | null
          name: string
          price: number
          provider_id: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          price: number
          provider_id: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          duration?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          price?: number
          provider_id?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_packages_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "approved_artists_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_packages_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      priest_addons: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          package_id: string
          price: number
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          package_id: string
          price: number
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          package_id?: string
          price?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "priest_addons_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "priest_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      priest_bookings: {
        Row: {
          accepted_at: string | null
          addons_amount: number
          advance_amount: number | null
          advance_paid_at: string | null
          base_amount: number
          calendar_locked: boolean
          city: string | null
          confirmed_at: string | null
          created_at: string
          customer_id: string
          event_date: string
          event_time: string | null
          event_type: string | null
          expired_at: string | null
          id: string
          otp_verified_at: string | null
          package_id: string
          payment_deadline: string | null
          provider_id: string
          remaining_amount: number | null
          selected_addon_ids: string[]
          settlement_status: string | null
          special_instructions: string | null
          start_requested_at: string | null
          status: string
          total_amount: number
          venue: string | null
          work_completed_at: string | null
          work_started_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          addons_amount?: number
          advance_amount?: number | null
          advance_paid_at?: string | null
          base_amount: number
          calendar_locked?: boolean
          city?: string | null
          confirmed_at?: string | null
          created_at?: string
          customer_id: string
          event_date: string
          event_time?: string | null
          event_type?: string | null
          expired_at?: string | null
          id?: string
          otp_verified_at?: string | null
          package_id: string
          payment_deadline?: string | null
          provider_id: string
          remaining_amount?: number | null
          selected_addon_ids?: string[]
          settlement_status?: string | null
          special_instructions?: string | null
          start_requested_at?: string | null
          status?: string
          total_amount: number
          venue?: string | null
          work_completed_at?: string | null
          work_started_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          addons_amount?: number
          advance_amount?: number | null
          advance_paid_at?: string | null
          base_amount?: number
          calendar_locked?: boolean
          city?: string | null
          confirmed_at?: string | null
          created_at?: string
          customer_id?: string
          event_date?: string
          event_time?: string | null
          event_type?: string | null
          expired_at?: string | null
          id?: string
          otp_verified_at?: string | null
          package_id?: string
          payment_deadline?: string | null
          provider_id?: string
          remaining_amount?: number | null
          selected_addon_ids?: string[]
          settlement_status?: string | null
          special_instructions?: string | null
          start_requested_at?: string | null
          status?: string
          total_amount?: number
          venue?: string | null
          work_completed_at?: string | null
          work_started_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "priest_bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "priest_bookings_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "priest_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "priest_bookings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "approved_artists_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "priest_bookings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      priest_gallery: {
        Row: {
          created_at: string
          id: string
          is_cover: boolean
          media_type: string
          package_id: string
          public_url: string
          sort_order: number
          storage_path: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_cover?: boolean
          media_type?: string
          package_id: string
          public_url: string
          sort_order?: number
          storage_path: string
        }
        Update: {
          created_at?: string
          id?: string
          is_cover?: boolean
          media_type?: string
          package_id?: string
          public_url?: string
          sort_order?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "priest_gallery_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "priest_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      priest_packages: {
        Row: {
          advance_percentage: number | null
          available_cities: string[]
          created_at: string
          daily_capacity: number | null
          dakshina_included: boolean | null
          description: string | null
          duration: string | null
          extra_hours_charges: number | null
          extra_ritual_charges: number | null
          id: string
          included_services: string[]
          is_featured: boolean
          languages: string[]
          materials_included: boolean | null
          max_bookings_per_day: number | null
          name: string
          outside_city_charges: number | null
          package_type: string
          provider_id: string
          required_materials: string[]
          service_details: Json
          service_price: number | null
          status: string
          temple_required: boolean | null
          travel_charges: number | null
          travel_distance: string | null
          updated_at: string
          view_count: number
          years_of_experience: number | null
        }
        Insert: {
          advance_percentage?: number | null
          available_cities?: string[]
          created_at?: string
          daily_capacity?: number | null
          dakshina_included?: boolean | null
          description?: string | null
          duration?: string | null
          extra_hours_charges?: number | null
          extra_ritual_charges?: number | null
          id?: string
          included_services?: string[]
          is_featured?: boolean
          languages?: string[]
          materials_included?: boolean | null
          max_bookings_per_day?: number | null
          name: string
          outside_city_charges?: number | null
          package_type: string
          provider_id: string
          required_materials?: string[]
          service_details?: Json
          service_price?: number | null
          status?: string
          temple_required?: boolean | null
          travel_charges?: number | null
          travel_distance?: string | null
          updated_at?: string
          view_count?: number
          years_of_experience?: number | null
        }
        Update: {
          advance_percentage?: number | null
          available_cities?: string[]
          created_at?: string
          daily_capacity?: number | null
          dakshina_included?: boolean | null
          description?: string | null
          duration?: string | null
          extra_hours_charges?: number | null
          extra_ritual_charges?: number | null
          id?: string
          included_services?: string[]
          is_featured?: boolean
          languages?: string[]
          materials_included?: boolean | null
          max_bookings_per_day?: number | null
          name?: string
          outside_city_charges?: number | null
          package_type?: string
          provider_id?: string
          required_materials?: string[]
          service_details?: Json
          service_price?: number | null
          status?: string
          temple_required?: boolean | null
          travel_charges?: number | null
          travel_distance?: string | null
          updated_at?: string
          view_count?: number
          years_of_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "priest_packages_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "approved_artists_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "priest_packages_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_order_items: {
        Row: {
          created_at: string
          id: string
          line_total: number
          order_id: string
          product_id: string
          product_name: string
          quantity: number
          unit_price: number
          variant_id: string
          variant_label: string
        }
        Insert: {
          created_at?: string
          id?: string
          line_total: number
          order_id: string
          product_id: string
          product_name: string
          quantity: number
          unit_price: number
          variant_id: string
          variant_label: string
        }
        Update: {
          created_at?: string
          id?: string
          line_total?: number
          order_id?: string
          product_id?: string
          product_name?: string
          quantity?: number
          unit_price?: number
          variant_id?: string
          variant_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "product_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "water_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "water_product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_orders: {
        Row: {
          created_at: string
          customer_id: string
          delivery_address: string
          delivery_charge: number
          delivery_date: string
          delivery_lat: number
          delivery_lng: number
          delivery_time_slot: string | null
          distance_km: number
          estimated_delivery_minutes: number | null
          id: string
          payment_status: string
          provider_id: string
          status: string
          subtotal: number
          total_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          delivery_address: string
          delivery_charge: number
          delivery_date: string
          delivery_lat: number
          delivery_lng: number
          delivery_time_slot?: string | null
          distance_km: number
          estimated_delivery_minutes?: number | null
          id?: string
          payment_status?: string
          provider_id: string
          status?: string
          subtotal: number
          total_amount: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          delivery_address?: string
          delivery_charge?: number
          delivery_date?: string
          delivery_lat?: number
          delivery_lng?: number
          delivery_time_slot?: string | null
          distance_km?: number
          estimated_delivery_minutes?: number | null
          id?: string
          payment_status?: string
          provider_id?: string
          status?: string
          subtotal?: number
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_orders_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "approved_artists_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_orders_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_verified_at: string | null
          address: string | null
          alternate_phone: string | null
          area: string | null
          avatar_url: string | null
          city: string | null
          created_at: string
          date_of_birth: string | null
          district: string | null
          email: string | null
          email_notifications_enabled: boolean | null
          full_name: string
          id: string
          is_active: boolean | null
          is_blocked: boolean | null
          last_active_at: string | null
          metadata: Json | null
          organization_name: string | null
          phone: string | null
          phone_verified: boolean | null
          preferences: Json | null
          profile_completion_percentage: number | null
          push_notifications_enabled: boolean | null
          sms_notifications_enabled: boolean | null
          state: string | null
          updated_at: string
          whatsapp_enabled: boolean | null
        }
        Insert: {
          account_verified_at?: string | null
          address?: string | null
          alternate_phone?: string | null
          area?: string | null
          avatar_url?: string | null
          city?: string | null
          created_at?: string
          date_of_birth?: string | null
          district?: string | null
          email?: string | null
          email_notifications_enabled?: boolean | null
          full_name: string
          id: string
          is_active?: boolean | null
          is_blocked?: boolean | null
          last_active_at?: string | null
          metadata?: Json | null
          organization_name?: string | null
          phone?: string | null
          phone_verified?: boolean | null
          preferences?: Json | null
          profile_completion_percentage?: number | null
          push_notifications_enabled?: boolean | null
          sms_notifications_enabled?: boolean | null
          state?: string | null
          updated_at?: string
          whatsapp_enabled?: boolean | null
        }
        Update: {
          account_verified_at?: string | null
          address?: string | null
          alternate_phone?: string | null
          area?: string | null
          avatar_url?: string | null
          city?: string | null
          created_at?: string
          date_of_birth?: string | null
          district?: string | null
          email?: string | null
          email_notifications_enabled?: boolean | null
          full_name?: string
          id?: string
          is_active?: boolean | null
          is_blocked?: boolean | null
          last_active_at?: string | null
          metadata?: Json | null
          organization_name?: string | null
          phone?: string | null
          phone_verified?: boolean | null
          preferences?: Json | null
          profile_completion_percentage?: number | null
          push_notifications_enabled?: boolean | null
          sms_notifications_enabled?: boolean | null
          state?: string | null
          updated_at?: string
          whatsapp_enabled?: boolean | null
        }
        Relationships: []
      }
      provider_availability: {
        Row: {
          id: string
          provider_id: string
          reason: string | null
          slot_type: string | null
          time_slot_end: string | null
          time_slot_start: string | null
          unavailable_date: string
        }
        Insert: {
          id?: string
          provider_id: string
          reason?: string | null
          slot_type?: string | null
          time_slot_end?: string | null
          time_slot_start?: string | null
          unavailable_date: string
        }
        Update: {
          id?: string
          provider_id?: string
          reason?: string | null
          slot_type?: string | null
          time_slot_end?: string | null
          time_slot_start?: string | null
          unavailable_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_availability_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "approved_artists_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_availability_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_calendar: {
        Row: {
          created_at: string
          date: string
          id: string
          is_available: boolean | null
          notes: string | null
          provider_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          is_available?: boolean | null
          notes?: string | null
          provider_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          is_available?: boolean | null
          notes?: string | null
          provider_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_calendar_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "approved_artists_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_calendar_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_faqs: {
        Row: {
          answer: string
          created_at: string | null
          id: string
          provider_id: string
          question: string
          sort_order: number | null
        }
        Insert: {
          answer: string
          created_at?: string | null
          id?: string
          provider_id: string
          question: string
          sort_order?: number | null
        }
        Update: {
          answer?: string
          created_at?: string | null
          id?: string
          provider_id?: string
          question?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "provider_faqs_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "approved_artists_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_faqs_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_profiles: {
        Row: {
          aadhaar_status: string | null
          aadhaar_verified_at: string | null
          available_dates: string[] | null
          available_days: number[] | null
          average_rating: number | null
          band_category: string | null
          bank_account_holder: string | null
          bank_account_number: string | null
          bank_ifsc: string | null
          bank_name: string | null
          bio: string | null
          branch_name: string | null
          business_hours: Json | null
          category_details: Json | null
          cover_banner_url: string | null
          cover_image_url: string | null
          created_at: string
          doc_verification_notes: string | null
          experience_years: number | null
          extra_charges: number | null
          facebook: string | null
          faqs: Json | null
          featured_until: string | null
          gallery_urls: string[] | null
          govt_id_status: string | null
          govt_id_verified_at: string | null
          gst_number: string | null
          id: string
          instagram: string | null
          instant_booking: boolean | null
          is_available: boolean | null
          is_bank_verified: boolean | null
          is_featured: boolean | null
          is_published: boolean | null
          is_verified: boolean | null
          languages: string[] | null
          liveness_attempts: number | null
          liveness_provider: string | null
          liveness_session_id: string | null
          liveness_verified: boolean | null
          liveness_verified_at: string | null
          onboarding_completed: boolean | null
          pan_status: string | null
          pan_verified_at: string | null
          performance_type: string | null
          price_max: number | null
          price_min: number | null
          pricing_type: string | null
          profession: Database["public"]["Enums"]["profession_type"]
          rejection_reason: string | null
          service_areas: string[] | null
          service_radius: number | null
          social_links: Json | null
          specialties: string[] | null
          stage_name: string | null
          subcategory: string | null
          total_bookings: number | null
          total_reviews: number | null
          travel_charges: number | null
          updated_at: string
          user_id: string
          vendor_details: Json | null
          verification_status: string | null
          verified_at: string | null
          verified_by: string | null
          video_urls: string[] | null
          website: string | null
          whatsapp: string | null
          youtube: string | null
        }
        Insert: {
          aadhaar_status?: string | null
          aadhaar_verified_at?: string | null
          available_dates?: string[] | null
          available_days?: number[] | null
          average_rating?: number | null
          band_category?: string | null
          bank_account_holder?: string | null
          bank_account_number?: string | null
          bank_ifsc?: string | null
          bank_name?: string | null
          bio?: string | null
          branch_name?: string | null
          business_hours?: Json | null
          category_details?: Json | null
          cover_banner_url?: string | null
          cover_image_url?: string | null
          created_at?: string
          doc_verification_notes?: string | null
          experience_years?: number | null
          extra_charges?: number | null
          facebook?: string | null
          faqs?: Json | null
          featured_until?: string | null
          gallery_urls?: string[] | null
          govt_id_status?: string | null
          govt_id_verified_at?: string | null
          gst_number?: string | null
          id?: string
          instagram?: string | null
          instant_booking?: boolean | null
          is_available?: boolean | null
          is_bank_verified?: boolean | null
          is_featured?: boolean | null
          is_published?: boolean | null
          is_verified?: boolean | null
          languages?: string[] | null
          liveness_attempts?: number | null
          liveness_provider?: string | null
          liveness_session_id?: string | null
          liveness_verified?: boolean | null
          liveness_verified_at?: string | null
          onboarding_completed?: boolean | null
          pan_status?: string | null
          pan_verified_at?: string | null
          performance_type?: string | null
          price_max?: number | null
          price_min?: number | null
          pricing_type?: string | null
          profession: Database["public"]["Enums"]["profession_type"]
          rejection_reason?: string | null
          service_areas?: string[] | null
          service_radius?: number | null
          social_links?: Json | null
          specialties?: string[] | null
          stage_name?: string | null
          subcategory?: string | null
          total_bookings?: number | null
          total_reviews?: number | null
          travel_charges?: number | null
          updated_at?: string
          user_id: string
          vendor_details?: Json | null
          verification_status?: string | null
          verified_at?: string | null
          verified_by?: string | null
          video_urls?: string[] | null
          website?: string | null
          whatsapp?: string | null
          youtube?: string | null
        }
        Update: {
          aadhaar_status?: string | null
          aadhaar_verified_at?: string | null
          available_dates?: string[] | null
          available_days?: number[] | null
          average_rating?: number | null
          band_category?: string | null
          bank_account_holder?: string | null
          bank_account_number?: string | null
          bank_ifsc?: string | null
          bank_name?: string | null
          bio?: string | null
          branch_name?: string | null
          business_hours?: Json | null
          category_details?: Json | null
          cover_banner_url?: string | null
          cover_image_url?: string | null
          created_at?: string
          doc_verification_notes?: string | null
          experience_years?: number | null
          extra_charges?: number | null
          facebook?: string | null
          faqs?: Json | null
          featured_until?: string | null
          gallery_urls?: string[] | null
          govt_id_status?: string | null
          govt_id_verified_at?: string | null
          gst_number?: string | null
          id?: string
          instagram?: string | null
          instant_booking?: boolean | null
          is_available?: boolean | null
          is_bank_verified?: boolean | null
          is_featured?: boolean | null
          is_published?: boolean | null
          is_verified?: boolean | null
          languages?: string[] | null
          liveness_attempts?: number | null
          liveness_provider?: string | null
          liveness_session_id?: string | null
          liveness_verified?: boolean | null
          liveness_verified_at?: string | null
          onboarding_completed?: boolean | null
          pan_status?: string | null
          pan_verified_at?: string | null
          performance_type?: string | null
          price_max?: number | null
          price_min?: number | null
          pricing_type?: string | null
          profession?: Database["public"]["Enums"]["profession_type"]
          rejection_reason?: string | null
          service_areas?: string[] | null
          service_radius?: number | null
          social_links?: Json | null
          specialties?: string[] | null
          stage_name?: string | null
          subcategory?: string | null
          total_bookings?: number | null
          total_reviews?: number | null
          travel_charges?: number | null
          updated_at?: string
          user_id?: string
          vendor_details?: Json | null
          verification_status?: string | null
          verified_at?: string | null
          verified_by?: string | null
          video_urls?: string[] | null
          website?: string | null
          whatsapp?: string | null
          youtube?: string | null
        }
        Relationships: []
      }
      provider_time_slots: {
        Row: {
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          is_active: boolean | null
          provider_id: string
          start_time: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          is_active?: boolean | null
          provider_id: string
          start_time: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          is_active?: boolean | null
          provider_id?: string
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_time_slots_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "approved_artists_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_time_slots_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_profiles"
            referencedColumns: ["id"]
          },
        ]
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
      refresh_tokens: {
        Row: {
          created_at: string
          device_info: Json | null
          expires_at: string
          id: string
          ip_address: unknown
          is_revoked: boolean | null
          last_used_at: string | null
          token_hash: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_info?: Json | null
          expires_at: string
          id?: string
          ip_address?: unknown
          is_revoked?: boolean | null
          last_used_at?: string | null
          token_hash: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_info?: Json | null
          expires_at?: string
          id?: string
          ip_address?: unknown
          is_revoked?: boolean | null
          last_used_at?: string | null
          token_hash?: string
          user_id?: string
        }
        Relationships: []
      }
      rental_addons: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          package_id: string
          price: number
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          package_id: string
          price: number
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          package_id?: string
          price?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "rental_addons_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "rental_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      rental_bookings: {
        Row: {
          accepted_at: string | null
          addons_amount: number
          advance_amount: number | null
          advance_paid_at: string | null
          base_amount: number
          calendar_locked: boolean
          city: string | null
          confirmed_at: string | null
          created_at: string
          customer_id: string
          delivery_address: string | null
          event_date: string
          event_time: string | null
          event_type: string | null
          expired_at: string | null
          id: string
          inventory_reserved: boolean
          otp_verified_at: string | null
          package_id: string
          payment_deadline: string | null
          provider_id: string
          quantity_required: number
          remaining_amount: number | null
          rental_duration: string | null
          selected_addon_ids: string[]
          settlement_status: string | null
          special_instructions: string | null
          start_requested_at: string | null
          status: string
          total_amount: number
          work_completed_at: string | null
          work_started_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          addons_amount?: number
          advance_amount?: number | null
          advance_paid_at?: string | null
          base_amount: number
          calendar_locked?: boolean
          city?: string | null
          confirmed_at?: string | null
          created_at?: string
          customer_id: string
          delivery_address?: string | null
          event_date: string
          event_time?: string | null
          event_type?: string | null
          expired_at?: string | null
          id?: string
          inventory_reserved?: boolean
          otp_verified_at?: string | null
          package_id: string
          payment_deadline?: string | null
          provider_id: string
          quantity_required?: number
          remaining_amount?: number | null
          rental_duration?: string | null
          selected_addon_ids?: string[]
          settlement_status?: string | null
          special_instructions?: string | null
          start_requested_at?: string | null
          status?: string
          total_amount: number
          work_completed_at?: string | null
          work_started_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          addons_amount?: number
          advance_amount?: number | null
          advance_paid_at?: string | null
          base_amount?: number
          calendar_locked?: boolean
          city?: string | null
          confirmed_at?: string | null
          created_at?: string
          customer_id?: string
          delivery_address?: string | null
          event_date?: string
          event_time?: string | null
          event_type?: string | null
          expired_at?: string | null
          id?: string
          inventory_reserved?: boolean
          otp_verified_at?: string | null
          package_id?: string
          payment_deadline?: string | null
          provider_id?: string
          quantity_required?: number
          remaining_amount?: number | null
          rental_duration?: string | null
          selected_addon_ids?: string[]
          settlement_status?: string | null
          special_instructions?: string | null
          start_requested_at?: string | null
          status?: string
          total_amount?: number
          work_completed_at?: string | null
          work_started_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rental_bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rental_bookings_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "rental_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rental_bookings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "approved_artists_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rental_bookings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rental_gallery: {
        Row: {
          created_at: string
          id: string
          is_cover: boolean
          media_type: string
          package_id: string
          public_url: string
          sort_order: number
          storage_path: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_cover?: boolean
          media_type?: string
          package_id: string
          public_url: string
          sort_order?: number
          storage_path: string
        }
        Update: {
          created_at?: string
          id?: string
          is_cover?: boolean
          media_type?: string
          package_id?: string
          public_url?: string
          sort_order?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "rental_gallery_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "rental_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      rental_items: {
        Row: {
          available_locations: string[] | null
          category: string | null
          created_at: string | null
          delivery_charges: number | null
          description: string | null
          id: string
          image_url: string | null
          is_available: boolean | null
          item_name: string
          price_per_day: number | null
          price_per_event: number | null
          provider_id: string
          quantity_available: number | null
          security_deposit: number | null
        }
        Insert: {
          available_locations?: string[] | null
          category?: string | null
          created_at?: string | null
          delivery_charges?: number | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean | null
          item_name: string
          price_per_day?: number | null
          price_per_event?: number | null
          provider_id: string
          quantity_available?: number | null
          security_deposit?: number | null
        }
        Update: {
          available_locations?: string[] | null
          category?: string | null
          created_at?: string | null
          delivery_charges?: number | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean | null
          item_name?: string
          price_per_day?: number | null
          price_per_event?: number | null
          provider_id?: string
          quantity_available?: number | null
          security_deposit?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rental_items_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "approved_artists_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rental_items_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rental_packages: {
        Row: {
          advance_percentage: number | null
          available_cities: string[]
          available_units: number | null
          created_at: string
          delivery_radius: string | null
          delivery_time: string | null
          description: string | null
          emergency_contact: string | null
          extra_hour_charges: number | null
          id: string
          included_items: string[]
          installation_charges: number | null
          installation_team: string | null
          inventory_quantity: number | null
          is_featured: boolean
          late_return_charges: number | null
          name: string
          outside_city_charges: number | null
          package_type: string
          pickup_time: string | null
          price: number | null
          provider_id: string
          rental_details: Json
          rental_type: string
          security_deposit: number | null
          setup_time: string | null
          status: string
          support_contact: string | null
          transportation_charges: number | null
          updated_at: string
          view_count: number
        }
        Insert: {
          advance_percentage?: number | null
          available_cities?: string[]
          available_units?: number | null
          created_at?: string
          delivery_radius?: string | null
          delivery_time?: string | null
          description?: string | null
          emergency_contact?: string | null
          extra_hour_charges?: number | null
          id?: string
          included_items?: string[]
          installation_charges?: number | null
          installation_team?: string | null
          inventory_quantity?: number | null
          is_featured?: boolean
          late_return_charges?: number | null
          name: string
          outside_city_charges?: number | null
          package_type: string
          pickup_time?: string | null
          price?: number | null
          provider_id: string
          rental_details?: Json
          rental_type?: string
          security_deposit?: number | null
          setup_time?: string | null
          status?: string
          support_contact?: string | null
          transportation_charges?: number | null
          updated_at?: string
          view_count?: number
        }
        Update: {
          advance_percentage?: number | null
          available_cities?: string[]
          available_units?: number | null
          created_at?: string
          delivery_radius?: string | null
          delivery_time?: string | null
          description?: string | null
          emergency_contact?: string | null
          extra_hour_charges?: number | null
          id?: string
          included_items?: string[]
          installation_charges?: number | null
          installation_team?: string | null
          inventory_quantity?: number | null
          is_featured?: boolean
          late_return_charges?: number | null
          name?: string
          outside_city_charges?: number | null
          package_type?: string
          pickup_time?: string | null
          price?: number | null
          provider_id?: string
          rental_details?: Json
          rental_type?: string
          security_deposit?: number | null
          setup_time?: string | null
          status?: string
          support_contact?: string | null
          transportation_charges?: number | null
          updated_at?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "rental_packages_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "approved_artists_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rental_packages_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reschedule_requests: {
        Row: {
          booking_id: string
          booking_table: string
          created_at: string
          customer_id: string
          decided_at: string | null
          decided_by: string | null
          decline_reason: string | null
          id: string
          original_amount_paid: number | null
          original_date: string
          original_time: string | null
          provider_id: string
          reason: string | null
          refund_amount: number | null
          refund_completed_at: string | null
          refund_eligible: boolean | null
          refund_initiated_at: string | null
          refund_percentage: number | null
          refund_status: string | null
          requested_date: string
          requested_time: string | null
          status: string
          updated_at: string
        }
        Insert: {
          booking_id: string
          booking_table: string
          created_at?: string
          customer_id: string
          decided_at?: string | null
          decided_by?: string | null
          decline_reason?: string | null
          id?: string
          original_amount_paid?: number | null
          original_date: string
          original_time?: string | null
          provider_id: string
          reason?: string | null
          refund_amount?: number | null
          refund_completed_at?: string | null
          refund_eligible?: boolean | null
          refund_initiated_at?: string | null
          refund_percentage?: number | null
          refund_status?: string | null
          requested_date: string
          requested_time?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          booking_id?: string
          booking_table?: string
          created_at?: string
          customer_id?: string
          decided_at?: string | null
          decided_by?: string | null
          decline_reason?: string | null
          id?: string
          original_amount_paid?: number | null
          original_date?: string
          original_time?: string | null
          provider_id?: string
          reason?: string | null
          refund_amount?: number | null
          refund_completed_at?: string | null
          refund_eligible?: boolean | null
          refund_initiated_at?: string | null
          refund_percentage?: number | null
          refund_status?: string | null
          requested_date?: string
          requested_time?: string | null
          status?: string
          updated_at?: string
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
            referencedRelation: "approved_artists_view"
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
      search_history: {
        Row: {
          created_at: string
          filters: Json | null
          id: string
          results_count: number | null
          search_query: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          filters?: Json | null
          id?: string
          results_count?: number | null
          search_query: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          filters?: Json | null
          id?: string
          results_count?: number | null
          search_query?: string
          user_id?: string | null
        }
        Relationships: []
      }
      security_events: {
        Row: {
          action: string | null
          created_at: string
          endpoint: string | null
          event_type: string
          http_status: number | null
          id: string
          is_authenticated: boolean | null
          metadata: Json | null
          reason: string | null
          resource_id: string | null
          resource_type: string | null
          result: string | null
          risk_score: number | null
          severity: string
          user_agent: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action?: string | null
          created_at?: string
          endpoint?: string | null
          event_type: string
          http_status?: number | null
          id?: string
          is_authenticated?: boolean | null
          metadata?: Json | null
          reason?: string | null
          resource_id?: string | null
          resource_type?: string | null
          result?: string | null
          risk_score?: number | null
          severity: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string | null
          created_at?: string
          endpoint?: string | null
          event_type?: string
          http_status?: number | null
          id?: string
          is_authenticated?: boolean | null
          metadata?: Json | null
          reason?: string | null
          resource_id?: string | null
          resource_type?: string | null
          result?: string | null
          risk_score?: number | null
          severity?: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      singer_addons: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          package_id: string
          price: number
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          package_id: string
          price: number
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          package_id?: string
          price?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "singer_addons_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "singer_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      singer_bookings: {
        Row: {
          accepted_at: string | null
          addons_amount: number
          advance_amount: number | null
          advance_paid_at: string | null
          base_amount: number
          calendar_locked: boolean
          city: string | null
          confirmed_at: string | null
          created_at: string
          customer_id: string
          event_date: string
          event_time: string | null
          event_type: string | null
          expired_at: string | null
          id: string
          otp_verified_at: string | null
          package_id: string
          payment_deadline: string | null
          provider_id: string
          remaining_amount: number | null
          selected_addon_ids: string[]
          settlement_status: string | null
          special_requirements: string | null
          start_requested_at: string | null
          status: string
          total_amount: number
          venue: string | null
          work_completed_at: string | null
          work_started_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          addons_amount?: number
          advance_amount?: number | null
          advance_paid_at?: string | null
          base_amount: number
          calendar_locked?: boolean
          city?: string | null
          confirmed_at?: string | null
          created_at?: string
          customer_id: string
          event_date: string
          event_time?: string | null
          event_type?: string | null
          expired_at?: string | null
          id?: string
          otp_verified_at?: string | null
          package_id: string
          payment_deadline?: string | null
          provider_id: string
          remaining_amount?: number | null
          selected_addon_ids?: string[]
          settlement_status?: string | null
          special_requirements?: string | null
          start_requested_at?: string | null
          status?: string
          total_amount: number
          venue?: string | null
          work_completed_at?: string | null
          work_started_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          addons_amount?: number
          advance_amount?: number | null
          advance_paid_at?: string | null
          base_amount?: number
          calendar_locked?: boolean
          city?: string | null
          confirmed_at?: string | null
          created_at?: string
          customer_id?: string
          event_date?: string
          event_time?: string | null
          event_type?: string | null
          expired_at?: string | null
          id?: string
          otp_verified_at?: string | null
          package_id?: string
          payment_deadline?: string | null
          provider_id?: string
          remaining_amount?: number | null
          selected_addon_ids?: string[]
          settlement_status?: string | null
          special_requirements?: string | null
          start_requested_at?: string | null
          status?: string
          total_amount?: number
          venue?: string | null
          work_completed_at?: string | null
          work_started_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "singer_bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "singer_bookings_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "singer_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "singer_bookings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "approved_artists_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "singer_bookings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      singer_gallery: {
        Row: {
          created_at: string
          id: string
          is_cover: boolean
          media_type: string
          package_id: string
          public_url: string
          sort_order: number
          storage_path: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_cover?: boolean
          media_type?: string
          package_id: string
          public_url: string
          sort_order?: number
          storage_path: string
        }
        Update: {
          created_at?: string
          id?: string
          is_cover?: boolean
          media_type?: string
          package_id?: string
          public_url?: string
          sort_order?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "singer_gallery_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "singer_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      singer_packages: {
        Row: {
          advance_percentage: number | null
          break_duration: string | null
          created_at: string
          deliverables: string[]
          description: string | null
          equipment_included: string[]
          event_types: string[]
          guitarist: string | null
          id: string
          is_featured: boolean
          keyboardist: string | null
          languages: string[]
          lead_singer: string | null
          music_styles: string[]
          name: string
          number_of_sets: string | null
          package_price: number | null
          package_type: string | null
          percussionist: string | null
          performance_duration: string | null
          performance_style: string | null
          provider_id: string
          set_duration: string | null
          status: string
          supporting_vocalist: string | null
          team_members: string | null
          updated_at: string
        }
        Insert: {
          advance_percentage?: number | null
          break_duration?: string | null
          created_at?: string
          deliverables?: string[]
          description?: string | null
          equipment_included?: string[]
          event_types?: string[]
          guitarist?: string | null
          id?: string
          is_featured?: boolean
          keyboardist?: string | null
          languages?: string[]
          lead_singer?: string | null
          music_styles?: string[]
          name: string
          number_of_sets?: string | null
          package_price?: number | null
          package_type?: string | null
          percussionist?: string | null
          performance_duration?: string | null
          performance_style?: string | null
          provider_id: string
          set_duration?: string | null
          status?: string
          supporting_vocalist?: string | null
          team_members?: string | null
          updated_at?: string
        }
        Update: {
          advance_percentage?: number | null
          break_duration?: string | null
          created_at?: string
          deliverables?: string[]
          description?: string | null
          equipment_included?: string[]
          event_types?: string[]
          guitarist?: string | null
          id?: string
          is_featured?: boolean
          keyboardist?: string | null
          languages?: string[]
          lead_singer?: string | null
          music_styles?: string[]
          name?: string
          number_of_sets?: string | null
          package_price?: number | null
          package_type?: string | null
          percussionist?: string | null
          performance_duration?: string | null
          performance_style?: string | null
          provider_id?: string
          set_duration?: string | null
          status?: string
          supporting_vocalist?: string | null
          team_members?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "singer_packages_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "approved_artists_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "singer_packages_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subcategories: {
        Row: {
          category_slug: string
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          sort_order: number | null
        }
        Insert: {
          category_slug: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          sort_order?: number | null
        }
        Update: {
          category_slug?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      supplier_delivery_settings: {
        Row: {
          delivery_origin_lat: number | null
          delivery_origin_lng: number | null
          emergency_delivery_enabled: boolean
          extra_delivery_charge: number
          free_delivery_radius_km: number
          max_delivery_radius_km: number
          provider_id: string
          same_day_delivery_enabled: boolean
          updated_at: string
        }
        Insert: {
          delivery_origin_lat?: number | null
          delivery_origin_lng?: number | null
          emergency_delivery_enabled?: boolean
          extra_delivery_charge?: number
          free_delivery_radius_km?: number
          max_delivery_radius_km?: number
          provider_id: string
          same_day_delivery_enabled?: boolean
          updated_at?: string
        }
        Update: {
          delivery_origin_lat?: number | null
          delivery_origin_lng?: number | null
          emergency_delivery_enabled?: boolean
          extra_delivery_charge?: number
          free_delivery_radius_km?: number
          max_delivery_radius_km?: number
          provider_id?: string
          same_day_delivery_enabled?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_delivery_settings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: true
            referencedRelation: "approved_artists_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_delivery_settings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: true
            referencedRelation: "provider_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          granted_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          granted_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          granted_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vendor_cancellations: {
        Row: {
          booking_id: string
          booking_table: string
          cancelled_at: string
          created_at: string
          customer_advance_paid: number
          customer_id: string
          customer_refund_amount: number
          customer_refund_status: string
          id: string
          penalty_amount: number
          penalty_percentage: number
          reason: string | null
          total_booking_cost: number
          vendor_id: string
          vendor_user_id: string
        }
        Insert: {
          booking_id: string
          booking_table: string
          cancelled_at?: string
          created_at?: string
          customer_advance_paid?: number
          customer_id: string
          customer_refund_amount?: number
          customer_refund_status?: string
          id?: string
          penalty_amount: number
          penalty_percentage?: number
          reason?: string | null
          total_booking_cost: number
          vendor_id: string
          vendor_user_id: string
        }
        Update: {
          booking_id?: string
          booking_table?: string
          cancelled_at?: string
          created_at?: string
          customer_advance_paid?: number
          customer_id?: string
          customer_refund_amount?: number
          customer_refund_status?: string
          id?: string
          penalty_amount?: number
          penalty_percentage?: number
          reason?: string | null
          total_booking_cost?: number
          vendor_id?: string
          vendor_user_id?: string
        }
        Relationships: []
      }
      vendor_embeddings: {
        Row: {
          content: string
          content_type: string | null
          created_at: string | null
          embedding: string | null
          embedding_sm: string | null
          id: string
          provider_id: string
          updated_at: string | null
        }
        Insert: {
          content: string
          content_type?: string | null
          created_at?: string | null
          embedding?: string | null
          embedding_sm?: string | null
          id?: string
          provider_id: string
          updated_at?: string | null
        }
        Update: {
          content?: string
          content_type?: string | null
          created_at?: string | null
          embedding?: string | null
          embedding_sm?: string | null
          id?: string
          provider_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_embeddings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "approved_artists_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_embeddings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_settlements: {
        Row: {
          advance_paid: number
          booking_amount: number
          booking_id: string
          booking_table: string
          created_at: string
          customer_id: string
          id: string
          platform_fee_amount: number
          platform_fee_rate: number
          remaining_due: number
          settled_at: string | null
          settlement_status: string
          vendor_earnings: number
          vendor_id: string
          vendor_user_id: string
        }
        Insert: {
          advance_paid?: number
          booking_amount: number
          booking_id: string
          booking_table: string
          created_at?: string
          customer_id: string
          id?: string
          platform_fee_amount?: number
          platform_fee_rate?: number
          remaining_due?: number
          settled_at?: string | null
          settlement_status?: string
          vendor_earnings?: number
          vendor_id: string
          vendor_user_id: string
        }
        Update: {
          advance_paid?: number
          booking_amount?: number
          booking_id?: string
          booking_table?: string
          created_at?: string
          customer_id?: string
          id?: string
          platform_fee_amount?: number
          platform_fee_rate?: number
          remaining_due?: number
          settled_at?: string | null
          settlement_status?: string
          vendor_earnings?: number
          vendor_id?: string
          vendor_user_id?: string
        }
        Relationships: []
      }
      videography_addons: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          package_id: string
          price: number
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          package_id: string
          price: number
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          package_id?: string
          price?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "videography_addons_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "videography_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      videography_bookings: {
        Row: {
          accepted_at: string | null
          addons_amount: number
          advance_amount: number | null
          advance_paid_at: string | null
          base_amount: number
          calendar_locked: boolean
          city: string | null
          confirmed_at: string | null
          created_at: string
          customer_id: string
          event_date: string
          event_time: string | null
          event_type: string | null
          expired_at: string | null
          id: string
          notes: string | null
          otp_verified_at: string | null
          package_id: string
          payment_deadline: string | null
          provider_id: string
          remaining_amount: number | null
          selected_addon_ids: string[]
          settlement_status: string | null
          special_requirements: string | null
          start_requested_at: string | null
          status: string
          total_amount: number
          venue: string | null
          work_completed_at: string | null
          work_started_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          addons_amount?: number
          advance_amount?: number | null
          advance_paid_at?: string | null
          base_amount: number
          calendar_locked?: boolean
          city?: string | null
          confirmed_at?: string | null
          created_at?: string
          customer_id: string
          event_date: string
          event_time?: string | null
          event_type?: string | null
          expired_at?: string | null
          id?: string
          notes?: string | null
          otp_verified_at?: string | null
          package_id: string
          payment_deadline?: string | null
          provider_id: string
          remaining_amount?: number | null
          selected_addon_ids?: string[]
          settlement_status?: string | null
          special_requirements?: string | null
          start_requested_at?: string | null
          status?: string
          total_amount: number
          venue?: string | null
          work_completed_at?: string | null
          work_started_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          addons_amount?: number
          advance_amount?: number | null
          advance_paid_at?: string | null
          base_amount?: number
          calendar_locked?: boolean
          city?: string | null
          confirmed_at?: string | null
          created_at?: string
          customer_id?: string
          event_date?: string
          event_time?: string | null
          event_type?: string | null
          expired_at?: string | null
          id?: string
          notes?: string | null
          otp_verified_at?: string | null
          package_id?: string
          payment_deadline?: string | null
          provider_id?: string
          remaining_amount?: number | null
          selected_addon_ids?: string[]
          settlement_status?: string | null
          special_requirements?: string | null
          start_requested_at?: string | null
          status?: string
          total_amount?: number
          venue?: string | null
          work_completed_at?: string | null
          work_started_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "videography_bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "videography_bookings_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "videography_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "videography_bookings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "approved_artists_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "videography_bookings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      videography_gallery: {
        Row: {
          created_at: string
          id: string
          is_cover: boolean
          media_type: string
          package_id: string
          public_url: string
          sort_order: number
          storage_path: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_cover?: boolean
          media_type?: string
          package_id: string
          public_url: string
          sort_order?: number
          storage_path: string
        }
        Update: {
          created_at?: string
          id?: string
          is_cover?: boolean
          media_type?: string
          package_id?: string
          public_url?: string
          sort_order?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "videography_gallery_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "videography_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      videography_packages: {
        Row: {
          advance_percentage: number | null
          cancellation_policy: string | null
          cinematic_coverage: boolean | null
          coverage_hours: string | null
          coverage_includes: string[]
          created_at: string
          deliverables: string[]
          delivery_time: string | null
          description: string | null
          editing_options: string[]
          equipment: string[]
          event_type: string | null
          event_types: string[]
          extra_coverage_cost: number | null
          extra_hour_cost: number | null
          full_day_price: number | null
          half_day_price: number | null
          hourly_price: number | null
          id: string
          included_services: string[]
          is_featured: boolean
          live_streaming: boolean | null
          max_travel_km: number | null
          multi_camera: boolean | null
          name: string
          num_cameras: number | null
          package_price: number | null
          package_type: string | null
          photography_album_details: string | null
          photography_album_included: boolean | null
          photography_deliverables: string[] | null
          photography_edited_photos: number | null
          photography_included: boolean | null
          photography_team_size: number | null
          photography_team_size_custom: string | null
          photography_unlimited_edited: boolean | null
          provider_id: string
          recording_4k: boolean | null
          starting_price: number | null
          status: string
          team_assistants: number | null
          team_drone_operator: boolean | null
          team_editor: number | null
          team_live_operator: boolean | null
          team_videographers: number | null
          travel_charges: number | null
          travel_outside_city: boolean | null
          travel_within_city: boolean | null
          updated_at: string
          view_count: number
        }
        Insert: {
          advance_percentage?: number | null
          cancellation_policy?: string | null
          cinematic_coverage?: boolean | null
          coverage_hours?: string | null
          coverage_includes?: string[]
          created_at?: string
          deliverables?: string[]
          delivery_time?: string | null
          description?: string | null
          editing_options?: string[]
          equipment?: string[]
          event_type?: string | null
          event_types?: string[]
          extra_coverage_cost?: number | null
          extra_hour_cost?: number | null
          full_day_price?: number | null
          half_day_price?: number | null
          hourly_price?: number | null
          id?: string
          included_services?: string[]
          is_featured?: boolean
          live_streaming?: boolean | null
          max_travel_km?: number | null
          multi_camera?: boolean | null
          name: string
          num_cameras?: number | null
          package_price?: number | null
          package_type?: string | null
          photography_album_details?: string | null
          photography_album_included?: boolean | null
          photography_deliverables?: string[] | null
          photography_edited_photos?: number | null
          photography_included?: boolean | null
          photography_team_size?: number | null
          photography_team_size_custom?: string | null
          photography_unlimited_edited?: boolean | null
          provider_id: string
          recording_4k?: boolean | null
          starting_price?: number | null
          status?: string
          team_assistants?: number | null
          team_drone_operator?: boolean | null
          team_editor?: number | null
          team_live_operator?: boolean | null
          team_videographers?: number | null
          travel_charges?: number | null
          travel_outside_city?: boolean | null
          travel_within_city?: boolean | null
          updated_at?: string
          view_count?: number
        }
        Update: {
          advance_percentage?: number | null
          cancellation_policy?: string | null
          cinematic_coverage?: boolean | null
          coverage_hours?: string | null
          coverage_includes?: string[]
          created_at?: string
          deliverables?: string[]
          delivery_time?: string | null
          description?: string | null
          editing_options?: string[]
          equipment?: string[]
          event_type?: string | null
          event_types?: string[]
          extra_coverage_cost?: number | null
          extra_hour_cost?: number | null
          full_day_price?: number | null
          half_day_price?: number | null
          hourly_price?: number | null
          id?: string
          included_services?: string[]
          is_featured?: boolean
          live_streaming?: boolean | null
          max_travel_km?: number | null
          multi_camera?: boolean | null
          name?: string
          num_cameras?: number | null
          package_price?: number | null
          package_type?: string | null
          photography_album_details?: string | null
          photography_album_included?: boolean | null
          photography_deliverables?: string[] | null
          photography_edited_photos?: number | null
          photography_included?: boolean | null
          photography_team_size?: number | null
          photography_team_size_custom?: string | null
          photography_unlimited_edited?: boolean | null
          provider_id?: string
          recording_4k?: boolean | null
          starting_price?: number | null
          status?: string
          team_assistants?: number | null
          team_drone_operator?: boolean | null
          team_editor?: number | null
          team_live_operator?: boolean | null
          team_videographers?: number | null
          travel_charges?: number | null
          travel_outside_city?: boolean | null
          travel_within_city?: boolean | null
          updated_at?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "videography_packages_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "approved_artists_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "videography_packages_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      water_addons: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          package_id: string
          price: number
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          package_id: string
          price: number
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          package_id?: string
          price?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "water_addons_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "water_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      water_bookings: {
        Row: {
          accepted_at: string | null
          addons_amount: number
          advance_amount: number | null
          advance_paid_at: string | null
          base_amount: number
          calendar_locked: boolean
          city: string | null
          confirmed_at: string | null
          created_at: string
          customer_id: string
          delivery_address: string | null
          delivery_time: string | null
          event_date: string
          event_type: string | null
          expired_at: string | null
          id: string
          otp_verified_at: string | null
          package_id: string
          payment_deadline: string | null
          provider_id: string
          quantity_required: string | null
          remaining_amount: number | null
          selected_addon_ids: string[]
          settlement_status: string | null
          special_instructions: string | null
          start_requested_at: string | null
          status: string
          total_amount: number
          work_completed_at: string | null
          work_started_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          addons_amount?: number
          advance_amount?: number | null
          advance_paid_at?: string | null
          base_amount: number
          calendar_locked?: boolean
          city?: string | null
          confirmed_at?: string | null
          created_at?: string
          customer_id: string
          delivery_address?: string | null
          delivery_time?: string | null
          event_date: string
          event_type?: string | null
          expired_at?: string | null
          id?: string
          otp_verified_at?: string | null
          package_id: string
          payment_deadline?: string | null
          provider_id: string
          quantity_required?: string | null
          remaining_amount?: number | null
          selected_addon_ids?: string[]
          settlement_status?: string | null
          special_instructions?: string | null
          start_requested_at?: string | null
          status?: string
          total_amount: number
          work_completed_at?: string | null
          work_started_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          addons_amount?: number
          advance_amount?: number | null
          advance_paid_at?: string | null
          base_amount?: number
          calendar_locked?: boolean
          city?: string | null
          confirmed_at?: string | null
          created_at?: string
          customer_id?: string
          delivery_address?: string | null
          delivery_time?: string | null
          event_date?: string
          event_type?: string | null
          expired_at?: string | null
          id?: string
          otp_verified_at?: string | null
          package_id?: string
          payment_deadline?: string | null
          provider_id?: string
          quantity_required?: string | null
          remaining_amount?: number | null
          selected_addon_ids?: string[]
          settlement_status?: string | null
          special_instructions?: string | null
          start_requested_at?: string | null
          status?: string
          total_amount?: number
          work_completed_at?: string | null
          work_started_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "water_bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "water_bookings_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "water_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "water_bookings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "approved_artists_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "water_bookings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      water_categories: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      water_gallery: {
        Row: {
          created_at: string
          id: string
          is_cover: boolean
          media_type: string
          package_id: string
          public_url: string
          sort_order: number
          storage_path: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_cover?: boolean
          media_type?: string
          package_id: string
          public_url: string
          sort_order?: number
          storage_path: string
        }
        Update: {
          created_at?: string
          id?: string
          is_cover?: boolean
          media_type?: string
          package_id?: string
          public_url?: string
          sort_order?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "water_gallery_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "water_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      water_packages: {
        Row: {
          additional_tank_charges: number | null
          advance_percentage: number | null
          available_cities: string[]
          available_time_slots: string[]
          base_price: number | null
          cooling_unit_available: boolean | null
          created_at: string
          delivery_radius: string | null
          delivery_team_size: string | null
          delivery_time: string | null
          description: string | null
          discount_percentage: number | null
          emergency_delivery_charges: number | null
          fleet_capacity: string | null
          id: string
          installation_included: boolean | null
          is_featured: boolean
          max_deliveries_per_day: number | null
          name: string
          night_delivery_charges: number | null
          outside_city_charges: number | null
          package_type: string
          pricing_type: string
          provider_id: string
          stand_included: boolean | null
          status: string
          supply_details: Json
          supply_features: string[]
          transportation_charges: number | null
          updated_at: string
          vehicle_type: string | null
          view_count: number
          water_dispenser_available: boolean | null
        }
        Insert: {
          additional_tank_charges?: number | null
          advance_percentage?: number | null
          available_cities?: string[]
          available_time_slots?: string[]
          base_price?: number | null
          cooling_unit_available?: boolean | null
          created_at?: string
          delivery_radius?: string | null
          delivery_team_size?: string | null
          delivery_time?: string | null
          description?: string | null
          discount_percentage?: number | null
          emergency_delivery_charges?: number | null
          fleet_capacity?: string | null
          id?: string
          installation_included?: boolean | null
          is_featured?: boolean
          max_deliveries_per_day?: number | null
          name: string
          night_delivery_charges?: number | null
          outside_city_charges?: number | null
          package_type: string
          pricing_type?: string
          provider_id: string
          stand_included?: boolean | null
          status?: string
          supply_details?: Json
          supply_features?: string[]
          transportation_charges?: number | null
          updated_at?: string
          vehicle_type?: string | null
          view_count?: number
          water_dispenser_available?: boolean | null
        }
        Update: {
          additional_tank_charges?: number | null
          advance_percentage?: number | null
          available_cities?: string[]
          available_time_slots?: string[]
          base_price?: number | null
          cooling_unit_available?: boolean | null
          created_at?: string
          delivery_radius?: string | null
          delivery_team_size?: string | null
          delivery_time?: string | null
          description?: string | null
          discount_percentage?: number | null
          emergency_delivery_charges?: number | null
          fleet_capacity?: string | null
          id?: string
          installation_included?: boolean | null
          is_featured?: boolean
          max_deliveries_per_day?: number | null
          name?: string
          night_delivery_charges?: number | null
          outside_city_charges?: number | null
          package_type?: string
          pricing_type?: string
          provider_id?: string
          stand_included?: boolean | null
          status?: string
          supply_details?: Json
          supply_features?: string[]
          transportation_charges?: number | null
          updated_at?: string
          vehicle_type?: string | null
          view_count?: number
          water_dispenser_available?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "water_packages_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "approved_artists_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "water_packages_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      water_product_images: {
        Row: {
          alt_text: string | null
          created_at: string
          id: string
          is_cover: boolean
          product_id: string
          public_url: string
          sort_order: number
          storage_path: string
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          id?: string
          is_cover?: boolean
          product_id: string
          public_url: string
          sort_order?: number
          storage_path: string
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          id?: string
          is_cover?: boolean
          product_id?: string
          public_url?: string
          sort_order?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "water_product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "water_products"
            referencedColumns: ["id"]
          },
        ]
      }
      water_product_reviews: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          order_item_id: string
          product_id: string
          rating: number
          review_text: string | null
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          order_item_id: string
          product_id: string
          rating: number
          review_text?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          order_item_id?: string
          product_id?: string
          rating?: number
          review_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "water_product_reviews_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "water_product_reviews_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: true
            referencedRelation: "product_order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "water_product_reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "water_products"
            referencedColumns: ["id"]
          },
        ]
      }
      water_product_stock: {
        Row: {
          low_stock_threshold: number
          quantity_available: number
          updated_at: string
          variant_id: string
        }
        Insert: {
          low_stock_threshold?: number
          quantity_available?: number
          updated_at?: string
          variant_id: string
        }
        Update: {
          low_stock_threshold?: number
          quantity_available?: number
          updated_at?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "water_product_stock_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: true
            referencedRelation: "water_product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      water_product_variants: {
        Row: {
          created_at: string
          id: string
          is_available: boolean
          label: string
          price: number
          product_id: string
          size_unit: string | null
          size_value: number | null
          sku: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_available?: boolean
          label: string
          price: number
          product_id: string
          size_unit?: string | null
          size_value?: number | null
          sku?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_available?: boolean
          label?: string
          price?: number
          product_id?: string
          size_unit?: string | null
          size_value?: number | null
          sku?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "water_product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "water_products"
            referencedColumns: ["id"]
          },
        ]
      }
      water_products: {
        Row: {
          category_id: string
          created_at: string
          delivery_options: string[]
          delivery_time_minutes: number
          description: string | null
          id: string
          is_active: boolean
          is_archived: boolean
          is_best_seller: boolean
          is_visible: boolean
          name: string
          provider_id: string
          unit_type: string
          updated_at: string
          view_count: number
          water_quality: string[]
        }
        Insert: {
          category_id: string
          created_at?: string
          delivery_options?: string[]
          delivery_time_minutes?: number
          description?: string | null
          id?: string
          is_active?: boolean
          is_archived?: boolean
          is_best_seller?: boolean
          is_visible?: boolean
          name: string
          provider_id: string
          unit_type: string
          updated_at?: string
          view_count?: number
          water_quality?: string[]
        }
        Update: {
          category_id?: string
          created_at?: string
          delivery_options?: string[]
          delivery_time_minutes?: number
          description?: string | null
          id?: string
          is_active?: boolean
          is_archived?: boolean
          is_best_seller?: boolean
          is_visible?: boolean
          name?: string
          provider_id?: string
          unit_type?: string
          updated_at?: string
          view_count?: number
          water_quality?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "water_products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "water_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "water_products_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "approved_artists_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "water_products_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_bank_accounts: {
        Row: {
          account_holder_name: string
          account_number: string
          bank_name: string
          branch_name: string | null
          created_at: string
          id: string
          ifsc_code: string
          is_verified: boolean | null
          updated_at: string
          verification_ref_id: string | null
          worker_id: string
        }
        Insert: {
          account_holder_name: string
          account_number: string
          bank_name: string
          branch_name?: string | null
          created_at?: string
          id?: string
          ifsc_code: string
          is_verified?: boolean | null
          updated_at?: string
          verification_ref_id?: string | null
          worker_id: string
        }
        Update: {
          account_holder_name?: string
          account_number?: string
          bank_name?: string
          branch_name?: string | null
          created_at?: string
          id?: string
          ifsc_code?: string
          is_verified?: boolean | null
          updated_at?: string
          verification_ref_id?: string | null
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "worker_bank_accounts_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "worker_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      worker_documents: {
        Row: {
          document_number: string | null
          document_type: string
          document_url: string
          expiry_date: string | null
          id: string
          issued_date: string | null
          rejection_reason: string | null
          uploaded_at: string
          verification_status: string | null
          verified_at: string | null
          verified_by: string | null
          worker_id: string
        }
        Insert: {
          document_number?: string | null
          document_type: string
          document_url: string
          expiry_date?: string | null
          id?: string
          issued_date?: string | null
          rejection_reason?: string | null
          uploaded_at?: string
          verification_status?: string | null
          verified_at?: string | null
          verified_by?: string | null
          worker_id: string
        }
        Update: {
          document_number?: string | null
          document_type?: string
          document_url?: string
          expiry_date?: string | null
          id?: string
          issued_date?: string | null
          rejection_reason?: string | null
          uploaded_at?: string
          verification_status?: string | null
          verified_at?: string | null
          verified_by?: string | null
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "worker_documents_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "worker_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      worker_profiles: {
        Row: {
          address_proof_url: string | null
          alternate_phone: string | null
          background_check_completed: boolean | null
          bank_account_holder: string | null
          bank_account_number: string | null
          bank_ifsc: string | null
          created_at: string
          date_of_birth: string | null
          email: string | null
          experience_years: number | null
          full_name: string
          gender: string | null
          government_id_type: string | null
          government_id_url: string | null
          id: string
          onboarded_at: string | null
          phone: string
          portfolio_urls: string[] | null
          profile_photo_url: string | null
          rejected_at: string | null
          rejection_reason: string | null
          service_area: string | null
          service_city: string | null
          service_type: string
          training_completed: boolean | null
          updated_at: string
          user_id: string
          verification_status:
            | Database["public"]["Enums"]["verification_status"]
            | null
          verified_at: string | null
          verified_by: string | null
          whatsapp_enabled: boolean | null
        }
        Insert: {
          address_proof_url?: string | null
          alternate_phone?: string | null
          background_check_completed?: boolean | null
          bank_account_holder?: string | null
          bank_account_number?: string | null
          bank_ifsc?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          experience_years?: number | null
          full_name: string
          gender?: string | null
          government_id_type?: string | null
          government_id_url?: string | null
          id?: string
          onboarded_at?: string | null
          phone: string
          portfolio_urls?: string[] | null
          profile_photo_url?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          service_area?: string | null
          service_city?: string | null
          service_type: string
          training_completed?: boolean | null
          updated_at?: string
          user_id: string
          verification_status?:
            | Database["public"]["Enums"]["verification_status"]
            | null
          verified_at?: string | null
          verified_by?: string | null
          whatsapp_enabled?: boolean | null
        }
        Update: {
          address_proof_url?: string | null
          alternate_phone?: string | null
          background_check_completed?: boolean | null
          bank_account_holder?: string | null
          bank_account_number?: string | null
          bank_ifsc?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          experience_years?: number | null
          full_name?: string
          gender?: string | null
          government_id_type?: string | null
          government_id_url?: string | null
          id?: string
          onboarded_at?: string | null
          phone?: string
          portfolio_urls?: string[] | null
          profile_photo_url?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          service_area?: string | null
          service_city?: string | null
          service_type?: string
          training_completed?: boolean | null
          updated_at?: string
          user_id?: string
          verification_status?:
            | Database["public"]["Enums"]["verification_status"]
            | null
          verified_at?: string | null
          verified_by?: string | null
          whatsapp_enabled?: boolean | null
        }
        Relationships: []
      }
    }
    Views: {
      approved_artists_view: {
        Row: {
          avatar_url: string | null
          average_rating: number | null
          bio: string | null
          category_icon: string | null
          category_name: string | null
          cover_image_url: string | null
          experience_years: number | null
          featured_until: string | null
          full_name: string | null
          id: string | null
          is_available: boolean | null
          is_featured: boolean | null
          is_verified: boolean | null
          languages: string[] | null
          price_max: number | null
          price_min: number | null
          profession: Database["public"]["Enums"]["profession_type"] | null
          service_area: string | null
          service_city: string | null
          specialties: string[] | null
          state: string | null
          total_bookings: number | null
          total_reviews: number | null
          user_id: string | null
        }
        Relationships: []
      }
      category_provider_counts: {
        Row: {
          description: string | null
          icon: string | null
          id: string | null
          is_active: boolean | null
          name: string | null
          profession_type: Database["public"]["Enums"]["profession_type"] | null
          provider_count: number | null
          sort_order: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      add_artist_to_event: {
        Args: {
          p_category: string
          p_event_id: string
          p_price: number
          p_provider_id: string
          p_provider_name: string
        }
        Returns: string
      }
      add_photography_cart_item: {
        Args: {
          p_addon_ids?: string[]
          p_album_id?: string
          p_package_id: string
        }
        Returns: string
      }
      admin_list_admins: {
        Args: never
        Returns: {
          email: string
          full_name: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }[]
      }
      admin_list_privileged_actions: {
        Args: { p_before?: string; p_limit?: number }
        Returns: {
          action: string
          actor_email: string
          detail: Json
          occurred_at: string
          outcome: string
          subject_role: Database["public"]["Enums"]["app_role"]
          target_email: string
        }[]
      }
      admin_set_user_role: {
        Args: {
          p_action: string
          p_actor_id: string
          p_role: Database["public"]["Enums"]["app_role"]
          p_target_email?: string
          p_target_id?: string
        }
        Returns: Json
      }
      approve_artist: {
        Args: { p_admin_user_id: string; p_provider_id: string }
        Returns: Json
      }
      assert_service_start_is_due: {
        Args: { p_booking_id: string; p_booking_table: string }
        Returns: undefined
      }
      check_artist_availability: {
        Args: {
          p_duration_hours?: number
          p_event_date: string
          p_event_time?: string
          p_provider_id: string
        }
        Returns: Json
      }
      check_provider_availability: {
        Args: { p_event_date: string; p_provider_id: string }
        Returns: boolean
      }
      checkout_photography_cart: {
        Args: {
          p_cart_id: string
          p_event_date: string
          p_event_time?: string
          p_notes?: string
          p_venue?: string
        }
        Returns: string[]
      }
      claim_provider_role: { Args: never; Returns: Json }
      create_event_booking: {
        Args: {
          p_customer_id: string
          p_event_date: string
          p_event_name: string
          p_event_type: string
          p_guest_count: number
          p_location: string
          p_notes?: string
          p_total_budget: number
        }
        Returns: string
      }
      create_photography_package_booking: {
        Args: {
          p_addon_ids?: string[]
          p_event_date: string
          p_event_time?: string
          p_notes?: string
          p_package_id: string
          p_venue?: string
        }
        Returns: string
      }
      create_service_start_otp: {
        Args: {
          p_booking_id: string
          p_booking_table: string
          p_is_resend?: boolean
          p_vendor_user_id: string
        }
        Returns: {
          customer_email: string
          otp_code: string
          otp_id: string
        }[]
      }
      create_water_product_order:
        | {
            Args: {
              p_delivery_address: string
              p_delivery_date: string
              p_delivery_lat: number
              p_delivery_lng: number
              p_delivery_time_slot?: string
              p_items: Json
              p_provider_id: string
            }
            Returns: string
          }
        | {
            Args: {
              p_delivery_address: string
              p_delivery_date: string
              p_delivery_lat: number
              p_delivery_lng: number
              p_delivery_time_slot?: string
              p_items: Json
              p_provider_id: string
              p_special_instructions?: string
            }
            Returns: string
          }
      generate_invoice_number: { Args: never; Returns: string }
      get_active_promotion_video: {
        Args: { p_user_id: string }
        Returns: {
          display_position: string
          has_user_viewed: boolean
          id: string
          priority_order: number
          unique_users_reached: number
          user_limit: number
          video_url: string
        }[]
      }
      get_nearest_available_dates: {
        Args: { p_after_date: string; p_count?: number; p_provider_id: string }
        Returns: string[]
      }
      get_random_eligible_promotion_video: {
        Args: { p_user_id: string }
        Returns: {
          display_position: string
          has_user_viewed: boolean
          id: string
          priority_order: number
          unique_users_reached: number
          user_limit: number
          video_url: string
        }[]
      }
      get_user_roles: { Args: { p_user_id: string }; Returns: string[] }
      get_water_variant_availability: {
        Args: { p_provider_id: string }
        Returns: {
          is_in_stock: boolean
          variant_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_anchor: { Args: { p_provider_id: string }; Returns: boolean }
      is_banquet_hall: { Args: { p_provider_id: string }; Returns: boolean }
      is_caterer: { Args: { p_provider_id: string }; Returns: boolean }
      is_chat_eligible: { Args: { p_booking_id: string }; Returns: boolean }
      is_chat_participant: {
        Args: { p_booking_id: string; p_user_id: string }
        Returns: boolean
      }
      is_current_service_start_otp: {
        Args: { p_otp_id: string }
        Returns: boolean
      }
      is_decorator: { Args: { p_provider_id: string }; Returns: boolean }
      is_dj: { Args: { p_provider_id: string }; Returns: boolean }
      is_drone_operator: { Args: { p_provider_id: string }; Returns: boolean }
      is_makeup_artist: { Args: { p_provider_id: string }; Returns: boolean }
      is_mehendi_artist: { Args: { p_provider_id: string }; Returns: boolean }
      is_photographer: { Args: { p_provider_id: string }; Returns: boolean }
      is_priest: { Args: { p_provider_id: string }; Returns: boolean }
      is_rental_service: { Args: { p_provider_id: string }; Returns: boolean }
      is_videographer: { Args: { p_provider_id: string }; Returns: boolean }
      is_water_supplier: { Args: { p_provider_id: string }; Returns: boolean }
      match_vendors: {
        Args: {
          filter_city?: string
          filter_price_max?: number
          filter_profession?: string
          match_count?: number
          query_embedding: string
          similarity_threshold?: number
        }
        Returns: {
          average_rating: number
          city: string
          content: string
          is_verified: boolean
          price_max: number
          price_min: number
          profession: string
          provider_id: string
          similarity: number
        }[]
      }
      owns_anchor: { Args: { p_provider_id: string }; Returns: boolean }
      owns_banquet_hall: { Args: { p_provider_id: string }; Returns: boolean }
      owns_caterer: { Args: { p_provider_id: string }; Returns: boolean }
      owns_decorator: { Args: { p_provider_id: string }; Returns: boolean }
      owns_dj: { Args: { p_provider_id: string }; Returns: boolean }
      owns_drone_operator: { Args: { p_provider_id: string }; Returns: boolean }
      owns_makeup_artist: { Args: { p_provider_id: string }; Returns: boolean }
      owns_mehendi_artist: { Args: { p_provider_id: string }; Returns: boolean }
      owns_photographer: { Args: { p_provider_id: string }; Returns: boolean }
      owns_priest: { Args: { p_provider_id: string }; Returns: boolean }
      owns_rental_service: { Args: { p_provider_id: string }; Returns: boolean }
      owns_videographer: { Args: { p_provider_id: string }; Returns: boolean }
      owns_water_supplier: { Args: { p_provider_id: string }; Returns: boolean }
      quote_water_delivery: {
        Args: {
          p_delivery_lat: number
          p_delivery_lng: number
          p_provider_id: string
        }
        Returns: {
          delivery_charge: number
          distance_km: number
          estimated_delivery_minutes: number
          is_free_delivery: boolean
        }[]
      }
      record_promotion_view: {
        Args: { p_user_id: string; p_video_id: string }
        Returns: boolean
      }
      record_service_start_otp_delivery: {
        Args: { p_delivered: boolean; p_error?: string; p_otp_id: string }
        Returns: undefined
      }
      reject_artist: {
        Args: {
          p_admin_user_id: string
          p_provider_id: string
          p_reason: string
        }
        Returns: Json
      }
      search_vendors_sql: {
        Args: {
          p_area?: string
          p_city?: string
          p_limit?: number
          p_min_rating?: number
          p_price_max?: number
          p_profession?: string
        }
        Returns: {
          area: string
          avatar_url: string
          average_rating: number
          bio: string
          city: string
          cover_image_url: string
          experience_years: number
          full_name: string
          is_available: boolean
          is_verified: boolean
          price_max: number
          price_min: number
          profession: string
          provider_id: string
          stage_name: string
          total_bookings: number
          total_reviews: number
        }[]
      }
      service_start_booking_context: {
        Args: { p_booking_id: string; p_booking_table: string }
        Returns: {
          advance_paid_at: string
          booking_status: string
          customer_id: string
          provider_id: string
          work_started_at: string
        }[]
      }
      update_artist_booking_status: {
        Args: {
          p_booking_id: string
          p_negotiation_message?: string
          p_status: string
        }
        Returns: boolean
      }
      user_has_role: {
        Args: { p_role: string; p_user_id: string }
        Returns: boolean
      }
      verify_service_start_otp: {
        Args: {
          p_booking_id: string
          p_booking_table: string
          p_otp: string
          p_vendor_user_id: string
        }
        Returns: Json
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
        | "music_band"
        | "traditional_band"
        | "maharashtra_band"
        | "dj"
        | "singer"
        | "instrumental_artist"
        | "classical_musician"
        | "photographer"
        | "videographer"
        | "cinematographer"
        | "drone_operator"
        | "dancer"
        | "choreographer"
        | "kuchipudi_dancer"
        | "classical_dancer"
        | "western_dancer"
        | "event_decorator"
        | "wedding_decorator"
        | "stage_decorator"
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
        | "event_support"
        | "banquet_hall"
        | "pandit"
        | "water_supplier"
        | "rentals"
        | "wedding_band"
        | "dhol_band"
        | "brass_band"
        | "photography_videography"
        | "priest"
        | "religious_services"
        | "wedding_venue"
        | "event_venue"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
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
        "music_band",
        "traditional_band",
        "maharashtra_band",
        "dj",
        "singer",
        "instrumental_artist",
        "classical_musician",
        "photographer",
        "videographer",
        "cinematographer",
        "drone_operator",
        "dancer",
        "choreographer",
        "kuchipudi_dancer",
        "classical_dancer",
        "western_dancer",
        "event_decorator",
        "wedding_decorator",
        "stage_decorator",
        "makeup_artist",
        "mehendi_artist",
        "anchor",
        "host",
        "magician",
        "stand_up_comedian",
        "celebrity_artist",
        "live_performer",
        "folk_artist",
        "lighting_services",
        "sound_services",
        "event_planner",
        "wedding_planner",
        "catering_services",
        "event_support",
        "banquet_hall",
        "pandit",
        "water_supplier",
        "rentals",
        "wedding_band",
        "dhol_band",
        "brass_band",
        "photography_videography",
        "priest",
        "religious_services",
        "wedding_venue",
        "event_venue",
      ],
      verification_status: ["pending", "under_review", "approved", "rejected"],
    },
  },
} as const
