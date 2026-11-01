// Generated from the Lumio Supabase schema. Do not edit by hand.
// Regenerate after every migration:
//   npx supabase gen types typescript --project-id <ref> --schema public > src/types/database.ts

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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      assessment_criteria: {
        Row: {
          code: string
          description: string
          id: string
          specification_id: string
          weighting_percent: number | null
        }
        Insert: {
          code: string
          description: string
          id?: string
          specification_id: string
          weighting_percent?: number | null
        }
        Update: {
          code?: string
          description?: string
          id?: string
          specification_id?: string
          weighting_percent?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "assessment_criteria_specification_id_fkey"
            columns: ["specification_id"]
            isOneToOne: false
            referencedRelation: "specifications"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: number
          metadata: Json
          target_id: string | null
          target_table: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: never
          metadata?: Json
          target_id?: string | null
          target_table?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: never
          metadata?: Json
          target_id?: string | null
          target_table?: string | null
        }
        Relationships: []
      }
      curriculum_modules: {
        Row: {
          code: string | null
          id: string
          position: number
          specification_id: string
          title: string
        }
        Insert: {
          code?: string | null
          id?: string
          position: number
          specification_id: string
          title: string
        }
        Update: {
          code?: string | null
          id?: string
          position?: number
          specification_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "curriculum_modules_specification_id_fkey"
            columns: ["specification_id"]
            isOneToOne: false
            referencedRelation: "specifications"
            referencedColumns: ["id"]
          },
        ]
      }
      curriculum_topics: {
        Row: {
          code: string | null
          id: string
          module_id: string
          parent_topic_id: string | null
          position: number
          summary: string | null
          title: string
        }
        Insert: {
          code?: string | null
          id?: string
          module_id: string
          parent_topic_id?: string | null
          position: number
          summary?: string | null
          title: string
        }
        Update: {
          code?: string | null
          id?: string
          module_id?: string
          parent_topic_id?: string | null
          position?: number
          summary?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "curriculum_topics_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "curriculum_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curriculum_topics_parent_topic_id_fkey"
            columns: ["parent_topic_id"]
            isOneToOne: false
            referencedRelation: "curriculum_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_boards: {
        Row: {
          id: string
          name: string
          slug: string
          sort_order: number
          website_url: string | null
        }
        Insert: {
          id?: string
          name: string
          slug: string
          sort_order?: number
          website_url?: string | null
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          sort_order?: number
          website_url?: string | null
        }
        Relationships: []
      }
      examination_dates: {
        Row: {
          created_at: string
          exam_board_id: string | null
          exam_date: string
          id: string
          notes: string | null
          qualification_id: string
          student_id: string
          subject_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          exam_board_id?: string | null
          exam_date: string
          id?: string
          notes?: string | null
          qualification_id: string
          student_id: string
          subject_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          exam_board_id?: string | null
          exam_date?: string
          id?: string
          notes?: string | null
          qualification_id?: string
          student_id?: string
          subject_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      learning_objectives: {
        Row: {
          code: string | null
          id: string
          position: number
          statement: string
          topic_id: string
        }
        Insert: {
          code?: string | null
          id?: string
          position: number
          statement: string
          topic_id: string
        }
        Update: {
          code?: string | null
          id?: string
          position?: number
          statement?: string
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_objectives_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "curriculum_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          code_hash: string
          created_at: string
          expires_at: string
          id: string
          parent_id: string
          revoked_at: string | null
          status: Database["public"]["Enums"]["invitation_status"]
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          code_hash: string
          created_at?: string
          expires_at: string
          id?: string
          parent_id: string
          revoked_at?: string | null
          status?: Database["public"]["Enums"]["invitation_status"]
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          code_hash?: string
          created_at?: string
          expires_at?: string
          id?: string
          parent_id?: string
          revoked_at?: string | null
          status?: Database["public"]["Enums"]["invitation_status"]
        }
        Relationships: []
      }
      parent_profiles: {
        Row: {
          created_at: string
          first_name: string | null
          profile_id: string
          updated_at: string
          weekly_report_opt_in: boolean
        }
        Insert: {
          created_at?: string
          first_name?: string | null
          profile_id: string
          updated_at?: string
          weekly_report_opt_in?: boolean
        }
        Update: {
          created_at?: string
          first_name?: string | null
          profile_id?: string
          updated_at?: string
          weekly_report_opt_in?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "parent_profiles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_student_links: {
        Row: {
          accepted_at: string | null
          created_at: string
          id: string
          initiated_by: Database["public"]["Enums"]["link_initiator"]
          parent_id: string
          revoked_at: string | null
          share_activity: boolean
          share_conversations: boolean
          share_results: boolean
          status: Database["public"]["Enums"]["link_status"]
          student_id: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          initiated_by: Database["public"]["Enums"]["link_initiator"]
          parent_id: string
          revoked_at?: string | null
          share_activity?: boolean
          share_conversations?: boolean
          share_results?: boolean
          status?: Database["public"]["Enums"]["link_status"]
          student_id: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          initiated_by?: Database["public"]["Enums"]["link_initiator"]
          parent_id?: string
          revoked_at?: string | null
          share_activity?: boolean
          share_conversations?: boolean
          share_results?: boolean
          status?: Database["public"]["Enums"]["link_status"]
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_student_links_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_student_links_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          onboarding_completed_at: string | null
          role: Database["public"]["Enums"]["account_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          onboarding_completed_at?: string | null
          role: Database["public"]["Enums"]["account_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          onboarding_completed_at?: string | null
          role?: Database["public"]["Enums"]["account_role"]
          updated_at?: string
        }
        Relationships: []
      }
      qualification_exam_boards: {
        Row: {
          exam_board_id: string
          qualification_id: string
        }
        Insert: {
          exam_board_id: string
          qualification_id: string
        }
        Update: {
          exam_board_id?: string
          qualification_id?: string
        }
        Relationships: []
      }
      qualifications: {
        Row: {
          id: string
          jurisdiction: string
          level: Database["public"]["Enums"]["qualification_level"]
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          id?: string
          jurisdiction?: string
          level: Database["public"]["Enums"]["qualification_level"]
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          id?: string
          jurisdiction?: string
          level?: Database["public"]["Enums"]["qualification_level"]
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      specifications: {
        Row: {
          code: string
          created_at: string
          exam_board_id: string
          first_teaching_year: number | null
          id: string
          licence_note: string | null
          qualification_id: string
          source_url: string | null
          status: Database["public"]["Enums"]["content_status"]
          subject_id: string
          title: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          exam_board_id: string
          first_teaching_year?: number | null
          id?: string
          licence_note?: string | null
          qualification_id: string
          source_url?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          subject_id: string
          title: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          exam_board_id?: string
          first_teaching_year?: number | null
          id?: string
          licence_note?: string | null
          qualification_id?: string
          source_url?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          subject_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "specifications_exam_board_id_fkey"
            columns: ["exam_board_id"]
            isOneToOne: false
            referencedRelation: "exam_boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "specifications_qualification_id_fkey"
            columns: ["qualification_id"]
            isOneToOne: false
            referencedRelation: "qualifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "specifications_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      student_profiles: {
        Row: {
          academic_goals: string | null
          age_band: Database["public"]["Enums"]["age_band"] | null
          created_at: string
          education_level: Database["public"]["Enums"]["education_level"] | null
          first_name: string | null
          learning_preferences: string[]
          onboarding_step: number
          primary_qualification_id: string | null
          parental_consent: Database["public"]["Enums"]["consent_status"]
          profile_id: string
          school_year: number | null
          timezone: string
          updated_at: string
          weekly_study_minutes_goal: number | null
        }
        Insert: {
          academic_goals?: string | null
          age_band?: Database["public"]["Enums"]["age_band"] | null
          created_at?: string
          education_level?: Database["public"]["Enums"]["education_level"] | null
          first_name?: string | null
          learning_preferences?: string[]
          onboarding_step?: number
          primary_qualification_id?: string | null
          parental_consent?: Database["public"]["Enums"]["consent_status"]
          profile_id: string
          school_year?: number | null
          timezone?: string
          updated_at?: string
          weekly_study_minutes_goal?: number | null
        }
        Update: {
          academic_goals?: string | null
          age_band?: Database["public"]["Enums"]["age_band"] | null
          created_at?: string
          education_level?: Database["public"]["Enums"]["education_level"] | null
          first_name?: string | null
          learning_preferences?: string[]
          onboarding_step?: number
          primary_qualification_id?: string | null
          parental_consent?: Database["public"]["Enums"]["consent_status"]
          profile_id?: string
          school_year?: number | null
          timezone?: string
          updated_at?: string
          weekly_study_minutes_goal?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "student_profiles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_subjects: {
        Row: {
          confidence: Database["public"]["Enums"]["subject_confidence"] | null
          created_at: string
          current_grade: string | null
          exam_board_id: string | null
          id: string
          qualification_id: string
          specification_id: string | null
          student_id: string
          subject_id: string
          target_grade: string | null
          updated_at: string
        }
        Insert: {
          confidence?: Database["public"]["Enums"]["subject_confidence"] | null
          created_at?: string
          current_grade?: string | null
          exam_board_id?: string | null
          id?: string
          qualification_id: string
          specification_id?: string | null
          student_id: string
          subject_id: string
          target_grade?: string | null
          updated_at?: string
        }
        Update: {
          confidence?: Database["public"]["Enums"]["subject_confidence"] | null
          created_at?: string
          current_grade?: string | null
          exam_board_id?: string | null
          id?: string
          qualification_id?: string
          specification_id?: string | null
          student_id?: string
          subject_id?: string
          target_grade?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_subjects_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_subjects_qualification_id_fkey"
            columns: ["qualification_id"]
            isOneToOne: false
            referencedRelation: "qualifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_subjects_exam_board_id_fkey"
            columns: ["exam_board_id"]
            isOneToOne: false
            referencedRelation: "exam_boards"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          id: string
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          id?: string
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          allowances: Json
          annual_price_pence: number | null
          currency: string
          id: string
          is_active: boolean
          is_public: boolean
          max_students: number
          monthly_price_pence: number
          name: string
          sort_order: number
          stripe_annual_price_id: string | null
          stripe_monthly_price_id: string | null
          updated_at: string
        }
        Insert: {
          allowances?: Json
          annual_price_pence?: number | null
          currency?: string
          id: string
          is_active?: boolean
          is_public?: boolean
          max_students?: number
          monthly_price_pence: number
          name: string
          sort_order?: number
          stripe_annual_price_id?: string | null
          stripe_monthly_price_id?: string | null
          updated_at?: string
        }
        Update: {
          allowances?: Json
          annual_price_pence?: number | null
          currency?: string
          id?: string
          is_active?: boolean
          is_public?: boolean
          max_students?: number
          monthly_price_pence?: number
          name?: string
          sort_order?: number
          stripe_annual_price_id?: string | null
          stripe_monthly_price_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          billing_interval: Database["public"]["Enums"]["billing_interval"]
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          owner_id: string
          plan_id: string
          status: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
        }
        Insert: {
          billing_interval?: Database["public"]["Enums"]["billing_interval"]
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          owner_id: string
          plan_id: string
          status: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          billing_interval?: Database["public"]["Enums"]["billing_interval"]
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          owner_id?: string
          plan_id?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_events: {
        Row: {
          allowance: Database["public"]["Enums"]["allowance_key"] | null
          audio_seconds: number
          cached_input_tokens: number
          created_at: string
          estimated_cost_usd_micros: number
          feature: string
          id: number
          input_tokens: number
          model: string | null
          output_tokens: number
          parent_operation_id: string | null
          plan_id: string | null
          provider: string | null
          request_id: string | null
          status: string
          units: number
          user_id: string
        }
        Insert: {
          allowance?: Database["public"]["Enums"]["allowance_key"] | null
          audio_seconds?: number
          cached_input_tokens?: number
          created_at?: string
          estimated_cost_usd_micros?: number
          feature: string
          id?: never
          input_tokens?: number
          model?: string | null
          output_tokens?: number
          parent_operation_id?: string | null
          plan_id?: string | null
          provider?: string | null
          request_id?: string | null
          status?: string
          units?: number
          user_id: string
        }
        Update: {
          allowance?: Database["public"]["Enums"]["allowance_key"] | null
          audio_seconds?: number
          cached_input_tokens?: number
          created_at?: string
          estimated_cost_usd_micros?: number
          feature?: string
          id?: never
          input_tokens?: number
          model?: string | null
          output_tokens?: number
          parent_operation_id?: string | null
          plan_id?: string | null
          provider?: string | null
          request_id?: string | null
          status?: string
          units?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_events_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      usage_current_month: {
        Row: {
          allowance: Database["public"]["Enums"]["allowance_key"] | null
          cost_usd_micros: number | null
          units_used: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "usage_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_parent_invitation: {
        Args: { p_code: string }
        Returns: {
          link_id: string
          status: string
        }[]
      }
      complete_parent_onboarding: { Args: never; Returns: undefined }
      complete_student_onboarding: { Args: never; Returns: undefined }
      create_parent_invitation: {
        Args: never
        Returns: {
          code: string
          expires_at: string
          invitation_id: string
        }[]
      }
      preview_parent_invitation: {
        Args: { p_code: string }
        Returns: {
          expires_at: string
          parent_first_name: string
          status: string
        }[]
      }
      revoke_parent_invitation: {
        Args: { p_invitation_id: string }
        Returns: undefined
      }
      unlink_parent_student: { Args: { p_link_id: string }; Returns: undefined }
    }
    Enums: {
      account_role: "student" | "parent"
      age_band: "under_13" | "13_15" | "16_17" | "18_plus"
      allowance_key:
        | "tutor_messages"
        | "lessons"
        | "voice_minutes"
        | "flashcards_generated"
        | "quizzes"
        | "exam_questions_marked"
        | "notes_generated"
        | "diagrams_generated"
      billing_interval: "month" | "year"
      consent_status: "not_required" | "pending" | "granted" | "withdrawn"
      content_status: "draft" | "published" | "retired"
      education_level: "gcse" | "a_level" | "igcse" | "other"
      invitation_status: "pending" | "accepted" | "revoked"
      link_initiator: "parent" | "student"
      link_status: "pending" | "active" | "revoked"
      qualification_level: "gcse" | "igcse" | "as_level" | "a_level"
      report_scope: "activity" | "results" | "conversations"
      staff_role: "admin" | "support"
      subject_confidence: "difficult" | "neutral" | "confident"
      subscription_status:
        | "trialing"
        | "active"
        | "past_due"
        | "canceled"
        | "incomplete"
        | "incomplete_expired"
        | "unpaid"
        | "paused"
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
  public: {
    Enums: {
      account_role: ["student", "parent"],
      age_band: ["under_13", "13_15", "16_17", "18_plus"],
      allowance_key: [
        "tutor_messages",
        "lessons",
        "voice_minutes",
        "flashcards_generated",
        "quizzes",
        "exam_questions_marked",
        "notes_generated",
        "diagrams_generated",
      ],
      billing_interval: ["month", "year"],
      consent_status: ["not_required", "pending", "granted", "withdrawn"],
      content_status: ["draft", "published", "retired"],
      education_level: ["gcse", "a_level", "igcse", "other"],
      invitation_status: ["pending", "accepted", "revoked"],
      link_initiator: ["parent", "student"],
      link_status: ["pending", "active", "revoked"],
      qualification_level: ["gcse", "igcse", "as_level", "a_level"],
      report_scope: ["activity", "results", "conversations"],
      staff_role: ["admin", "support"],
      subject_confidence: ["difficult", "neutral", "confident"],
      subscription_status: [
        "trialing",
        "active",
        "past_due",
        "canceled",
        "incomplete",
        "incomplete_expired",
        "unpaid",
        "paused",
      ],
    },
  },
} as const
