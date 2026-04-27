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
  public: {
    Tables: {
      access_codes: {
        Row: {
          code: string
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          code: string
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "access_codes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      calls: {
        Row: {
          caller: string | null
          company_id: string
          created_at: string
          direction: string | null
          duration_sec: number
          external_id: string | null
          id: string
          metadata: Json | null
          phone: string | null
          recording_url: string | null
          source: Database["public"]["Enums"]["call_source"]
          started_at: string
          status: string
          summary: string | null
          tag: string | null
          to_number: string | null
          transcript: Json | null
          updated_at: string
        }
        Insert: {
          caller?: string | null
          company_id: string
          created_at?: string
          direction?: string | null
          duration_sec?: number
          external_id?: string | null
          id?: string
          metadata?: Json | null
          phone?: string | null
          recording_url?: string | null
          source: Database["public"]["Enums"]["call_source"]
          started_at?: string
          status?: string
          summary?: string | null
          tag?: string | null
          to_number?: string | null
          transcript?: Json | null
          updated_at?: string
        }
        Update: {
          caller?: string | null
          company_id?: string
          created_at?: string
          direction?: string | null
          duration_sec?: number
          external_id?: string | null
          id?: string
          metadata?: Json | null
          phone?: string | null
          recording_url?: string | null
          source?: Database["public"]["Enums"]["call_source"]
          started_at?: string
          status?: string
          summary?: string | null
          tag?: string | null
          to_number?: string | null
          transcript?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calls_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          ai_first_message: string | null
          ai_system_prompt: string | null
          ai_voice_id: string | null
          business_hours_always_on: boolean
          business_hours_close: string
          business_hours_open: string
          business_hours_timezone: string
          created_at: string
          id: string
          name: string
          shared_calendar_id: string | null
          shared_calendar_owner_user_id: string | null
          shared_calendar_summary: string | null
          updated_at: string
        }
        Insert: {
          ai_first_message?: string | null
          ai_system_prompt?: string | null
          ai_voice_id?: string | null
          business_hours_always_on?: boolean
          business_hours_close?: string
          business_hours_open?: string
          business_hours_timezone?: string
          created_at?: string
          id?: string
          name: string
          shared_calendar_id?: string | null
          shared_calendar_owner_user_id?: string | null
          shared_calendar_summary?: string | null
          updated_at?: string
        }
        Update: {
          ai_first_message?: string | null
          ai_system_prompt?: string | null
          ai_voice_id?: string | null
          business_hours_always_on?: boolean
          business_hours_close?: string
          business_hours_open?: string
          business_hours_timezone?: string
          created_at?: string
          id?: string
          name?: string
          shared_calendar_id?: string | null
          shared_calendar_owner_user_id?: string | null
          shared_calendar_summary?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      company_elevenlabs_agents: {
        Row: {
          agent_id: string
          company_id: string
          created_at: string
          id: string
        }
        Insert: {
          agent_id: string
          company_id: string
          created_at?: string
          id?: string
        }
        Update: {
          agent_id?: string
          company_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_elevenlabs_agents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_phone_numbers: {
        Row: {
          company_id: string
          created_at: string
          id: string
          label: string | null
          phone_number: string
          provider: string
          requested_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          label?: string | null
          phone_number: string
          provider?: string
          requested_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          label?: string | null
          phone_number?: string
          provider?: string
          requested_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_phone_numbers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      location_requests: {
        Row: {
          company_id: string
          created_at: string
          id: string
          location_name: string
          locations_wanted: number
          note: string | null
          requested_by: string
          status: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          location_name: string
          locations_wanted?: number
          note?: string | null
          requested_by: string
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          location_name?: string
          locations_wanted?: number
          note?: string | null
          requested_by?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          body: string | null
          company_id: string
          created_at: string
          created_by: string
          done: boolean
          due_at: string | null
          id: string
          reminded_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          company_id: string
          created_at?: string
          created_by: string
          done?: boolean
          due_at?: string | null
          id?: string
          reminded_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          company_id?: string
          created_at?: string
          created_by?: string
          done?: boolean
          due_at?: string | null
          id?: string
          reminded_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string
          daily_summary: boolean
          email: boolean
          missed_call: boolean
          new_lead: boolean
          new_review: boolean
          new_sms: boolean
          push: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          daily_summary?: boolean
          email?: boolean
          missed_call?: boolean
          new_lead?: boolean
          new_review?: boolean
          new_sms?: boolean
          push?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          daily_summary?: boolean
          email?: boolean
          missed_call?: boolean
          new_lead?: boolean
          new_review?: boolean
          new_sms?: boolean
          push?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          company_id: string
          created_at: string
          id: string
          link: string | null
          metadata: Json | null
          read: boolean
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string | null
        }
        Insert: {
          body?: string | null
          company_id: string
          created_at?: string
          id?: string
          link?: string | null
          metadata?: Json | null
          read?: boolean
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id?: string | null
        }
        Update: {
          body?: string | null
          company_id?: string
          created_at?: string
          id?: string
          link?: string | null
          metadata?: Json | null
          read?: boolean
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          business_name: string | null
          company_id: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          business_name?: string | null
          company_id?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          business_name?: string | null
          company_id?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_codes: {
        Row: {
          code: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      sms_messages: {
        Row: {
          body: string
          company_id: string
          created_at: string
          delivered: boolean
          direction: string
          external_id: string | null
          id: string
          sent_at: string
          thread_id: string
          updated_at: string
        }
        Insert: {
          body: string
          company_id: string
          created_at?: string
          delivered?: boolean
          direction: string
          external_id?: string | null
          id?: string
          sent_at?: string
          thread_id: string
          updated_at?: string
        }
        Update: {
          body?: string
          company_id?: string
          created_at?: string
          delivered?: boolean
          direction?: string
          external_id?: string | null
          id?: string
          sent_at?: string
          thread_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "sms_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_threads: {
        Row: {
          company_id: string
          created_at: string
          customer: string | null
          flagged: boolean
          id: string
          last_message_at: string
          phone: string
          unread: number
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          customer?: string | null
          flagged?: boolean
          id?: string
          last_message_at?: string
          phone: string
          unread?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          customer?: string | null
          flagged?: boolean
          id?: string
          last_message_at?: string
          phone?: string
          unread?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_google_tokens: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string
          google_email: string | null
          id: string
          refresh_token: string
          scope: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at: string
          google_email?: string | null
          id?: string
          refresh_token: string
          scope?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string
          google_email?: string | null
          id?: string
          refresh_token?: string
          scope?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
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
      claim_access_code: { Args: { _code: string }; Returns: string }
      generate_referral_code: { Args: never; Returns: string }
      get_company_calendar_connection: {
        Args: { _company_id: string }
        Returns: {
          access_token: string
          calendar_id: string
          calendar_summary: string
          expires_at: string
          owner_email: string
          owner_user_id: string
          refresh_token: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      lookup_referral_code: { Args: { _code: string }; Returns: string }
      redeem_access_code: {
        Args: { _code: string; _user_id: string }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "company_admin"
      call_source: "elevenlabs" | "twilio" | "manual"
      notification_type:
        | "lead"
        | "booking"
        | "missed"
        | "review"
        | "summary"
        | "sms"
        | "note"
        | "system"
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
      app_role: ["admin", "company_admin"],
      call_source: ["elevenlabs", "twilio", "manual"],
      notification_type: [
        "lead",
        "booking",
        "missed",
        "review",
        "summary",
        "sms",
        "note",
        "system",
      ],
    },
  },
} as const
