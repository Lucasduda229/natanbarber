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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      admin_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          setting_key: string
          setting_value: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          setting_key: string
          setting_value: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          setting_key?: string
          setting_value?: string
          updated_at?: string
        }
        Relationships: []
      }
      appointment_services: {
        Row: {
          appointment_id: string
          created_at: string
          id: string
          service_id: string
        }
        Insert: {
          appointment_id: string
          created_at?: string
          id?: string
          service_id: string
        }
        Update: {
          appointment_id?: string
          created_at?: string
          id?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_services_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          appointment_date: string
          appointment_time: string
          created_at: string
          id: string
          notes: string | null
          payment_method: string | null
          payment_status: string
          reminder_1h_sent: boolean
          reminder_24h_sent: boolean
          service_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          appointment_date: string
          appointment_time: string
          created_at?: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          payment_status?: string
          reminder_1h_sent?: boolean
          reminder_24h_sent?: boolean
          service_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          appointment_date?: string
          appointment_time?: string
          created_at?: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          payment_status?: string
          reminder_1h_sent?: boolean
          reminder_24h_sent?: boolean
          service_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      barbershop_status: {
        Row: {
          id: string
          is_open: boolean
          updated_at: string
        }
        Insert: {
          id?: string
          is_open?: boolean
          updated_at?: string
        }
        Update: {
          id?: string
          is_open?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      blocked_dates: {
        Row: {
          blocked_date: string
          blocked_time: string | null
          created_at: string
          id: string
          reason: string | null
        }
        Insert: {
          blocked_date: string
          blocked_time?: string | null
          created_at?: string
          id?: string
          reason?: string | null
        }
        Update: {
          blocked_date?: string
          blocked_time?: string | null
          created_at?: string
          id?: string
          reason?: string | null
        }
        Relationships: []
      }
      client_package_usage: {
        Row: {
          appointment_id: string | null
          client_package_id: string
          id: string
          service_id: string
          used_at: string | null
        }
        Insert: {
          appointment_id?: string | null
          client_package_id: string
          id?: string
          service_id: string
          used_at?: string | null
        }
        Update: {
          appointment_id?: string | null
          client_package_id?: string
          id?: string
          service_id?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_package_usage_client_package_id_fkey"
            columns: ["client_package_id"]
            isOneToOne: false
            referencedRelation: "client_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_package_usage_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      client_packages: {
        Row: {
          created_at: string | null
          end_date: string
          id: string
          package_id: string
          start_date: string | null
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          end_date: string
          id?: string
          package_id: string
          start_date?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          end_date?: string
          id?: string
          package_id?: string
          start_date?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_packages_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_programs: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          required_visits: number
          reward_description: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          required_visits?: number
          reward_description: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          required_visits?: number
          reward_description?: string
          updated_at?: string
        }
        Relationships: []
      }
      loyalty_progress: {
        Row: {
          created_at: string
          current_visits: number
          id: string
          program_id: string
          rewards_claimed: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_visits?: number
          id?: string
          program_id: string
          rewards_claimed?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_visits?: number
          id?: string
          program_id?: string
          rewards_claimed?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_progress_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "loyalty_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_rewards_history: {
        Row: {
          claimed_at: string
          id: string
          program_id: string
          user_id: string
        }
        Insert: {
          claimed_at?: string
          id?: string
          program_id: string
          user_id: string
        }
        Update: {
          claimed_at?: string
          id?: string
          program_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_rewards_history_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "loyalty_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          appointment_id: string | null
          created_at: string
          id: string
          is_read: boolean
          message: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          appointment_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          title: string
          type?: string
          user_id: string
        }
        Update: {
          appointment_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      package_benefits: {
        Row: {
          created_at: string | null
          id: string
          package_id: string
          quantity: number | null
          service_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          package_id: string
          quantity?: number | null
          service_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          package_id?: string
          quantity?: number | null
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "package_benefits_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_benefits_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      package_items: {
        Row: {
          created_at: string
          id: string
          package_id: string
          quantity: number
          service_id: string | null
          service_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          package_id: string
          quantity?: number
          service_id?: string | null
          service_name: string
        }
        Update: {
          created_at?: string
          id?: string
          package_id?: string
          quantity?: number
          service_id?: string | null
          service_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "package_items_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      package_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          notes: string | null
          package_id: string | null
          package_name: string
          payment_date: string
          payment_method: string | null
          payment_status: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          notes?: string | null
          package_id?: string | null
          package_name: string
          payment_date?: string
          payment_method?: string | null
          payment_status?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          notes?: string | null
          package_id?: string | null
          package_name?: string
          payment_date?: string
          payment_method?: string | null
          payment_status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "package_payments_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
        ]
      }
      packages: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          discount_percent: number | null
          duration_days: number | null
          id: string
          name: string
          price: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          discount_percent?: number | null
          duration_days?: number | null
          id?: string
          name: string
          price: number
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          discount_percent?: number | null
          duration_days?: number | null
          id?: string
          name?: string
          price?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          admin_notes: string | null
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
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
          updated_at: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reminder_settings: {
        Row: {
          created_at: string
          id: string
          is_enabled: boolean
          message_template: string
          reminder_type: string
          send_time: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          message_template: string
          reminder_type: string
          send_time?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          message_template?: string
          reminder_type?: string
          send_time?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      revenue_adjustments: {
        Row: {
          adjusted_value: number
          adjustment_reason: string | null
          appointment_id: string
          created_at: string
          id: string
          original_value: number
          updated_at: string
        }
        Insert: {
          adjusted_value: number
          adjustment_reason?: string | null
          appointment_id: string
          created_at?: string
          id?: string
          original_value: number
          updated_at?: string
        }
        Update: {
          adjusted_value?: number
          adjustment_reason?: string | null
          appointment_id?: string
          created_at?: string
          id?: string
          original_value?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "revenue_adjustments_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: true
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          appointment_id: string
          comment: string | null
          created_at: string
          id: string
          rating: number
          user_id: string
        }
        Insert: {
          appointment_id: string
          comment?: string | null
          created_at?: string
          id?: string
          rating: number
          user_id: string
        }
        Update: {
          appointment_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          rating?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: true
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_claims: {
        Row: {
          admin_notes: string | null
          claimed_at: string
          delivered_at: string | null
          id: string
          reward_description: string
          reward_id: string | null
          reward_name: string
          status: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          claimed_at?: string
          delivered_at?: string | null
          id?: string
          reward_description: string
          reward_id?: string | null
          reward_name: string
          status?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          claimed_at?: string
          delivered_at?: string | null
          id?: string
          reward_description?: string
          reward_id?: string | null
          reward_name?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reward_claims_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "subscriber_rewards"
            referencedColumns: ["id"]
          },
        ]
      }
      service_gallery: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string
          service_id: string | null
          title: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url: string
          service_id?: string | null
          title?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string
          service_id?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_gallery_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          name: string
          price: number
          subscribers_only: boolean | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          name: string
          price: number
          subscribers_only?: boolean | null
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          name?: string
          price?: number
          subscribers_only?: boolean | null
        }
        Relationships: []
      }
      subscriber_rewards: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          required_months: number
          required_visits: number | null
          requirement_type: string
          reward_description: string
          target_audience: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          required_months: number
          required_visits?: number | null
          requirement_type?: string
          reward_description: string
          target_audience?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          required_months?: number
          required_visits?: number | null
          requirement_type?: string
          reward_description?: string
          target_audience?: string
          updated_at?: string
        }
        Relationships: []
      }
      subscription_progress: {
        Row: {
          consecutive_months: number
          created_at: string
          credits_expired_this_month: number | null
          current_month_start: string | null
          current_week_start: string | null
          cuts_used_this_month: number
          id: string
          is_active: boolean
          last_payment_date: string | null
          monthly_cuts_limit: number
          package_id: string | null
          package_name: string | null
          reward_12_months_claimed: boolean
          reward_6_months_claimed: boolean
          subscription_start_date: string
          updated_at: string
          usage_reset_date: string | null
          user_id: string
          weekly_credits_available: number | null
        }
        Insert: {
          consecutive_months?: number
          created_at?: string
          credits_expired_this_month?: number | null
          current_month_start?: string | null
          current_week_start?: string | null
          cuts_used_this_month?: number
          id?: string
          is_active?: boolean
          last_payment_date?: string | null
          monthly_cuts_limit?: number
          package_id?: string | null
          package_name?: string | null
          reward_12_months_claimed?: boolean
          reward_6_months_claimed?: boolean
          subscription_start_date?: string
          updated_at?: string
          usage_reset_date?: string | null
          user_id: string
          weekly_credits_available?: number | null
        }
        Update: {
          consecutive_months?: number
          created_at?: string
          credits_expired_this_month?: number | null
          current_month_start?: string | null
          current_week_start?: string | null
          cuts_used_this_month?: number
          id?: string
          is_active?: boolean
          last_payment_date?: string | null
          monthly_cuts_limit?: number
          package_id?: string | null
          package_name?: string | null
          reward_12_months_claimed?: boolean
          reward_6_months_claimed?: boolean
          subscription_start_date?: string
          updated_at?: string
          usage_reset_date?: string | null
          user_id?: string
          weekly_credits_available?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_progress_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
        ]
      }
      time_slots: {
        Row: {
          created_at: string
          day_of_week: number
          id: string
          is_blocked: boolean
          slot_time: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          id?: string
          is_blocked?: boolean
          slot_time: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          id?: string
          is_blocked?: boolean
          slot_time?: string
        }
        Relationships: []
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_old_blocked_dates: { Args: never; Returns: undefined }
      get_reviewer_profiles: {
        Args: { reviewer_user_ids: string[] }
        Returns: {
          avatar_url: string
          full_name: string
          user_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      use_subscription_cut: { Args: { p_user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
