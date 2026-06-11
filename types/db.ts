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
      audit_log: {
        Row: {
          action: string
          after_state: Json | null
          before_state: Json | null
          created_at: string
          id: string
          monthly_run_id: string | null
          transaction_id: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          id?: string
          monthly_run_id?: string | null
          transaction_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          id?: string
          monthly_run_id?: string | null
          transaction_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_monthly_run_id_fkey"
            columns: ["monthly_run_id"]
            isOneToOne: false
            referencedRelation: "monthly_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      drive_connection: {
        Row: {
          access_expires_at: string | null
          access_token: string | null
          account_email: string | null
          created_at: string
          folder_id: string | null
          id: string
          refresh_token_enc: string
          updated_at: string
        }
        Insert: {
          access_expires_at?: string | null
          access_token?: string | null
          account_email?: string | null
          created_at?: string
          folder_id?: string | null
          id?: string
          refresh_token_enc: string
          updated_at?: string
        }
        Update: {
          access_expires_at?: string | null
          access_token?: string | null
          account_email?: string | null
          created_at?: string
          folder_id?: string | null
          id?: string
          refresh_token_enc?: string
          updated_at?: string
        }
        Relationships: []
      }
      monthly_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          month_year: string
          narrative: string | null
          source_summary: Json | null
          started_at: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          month_year: string
          narrative?: string | null
          source_summary?: Json | null
          started_at?: string
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          month_year?: string
          narrative?: string | null
          source_summary?: Json | null
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_runs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      qbo_connection: {
        Row: {
          access_expires_at: string | null
          access_token: string | null
          created_at: string
          environment: string
          id: string
          realm_id: string
          refresh_token_enc: string
          updated_at: string
        }
        Insert: {
          access_expires_at?: string | null
          access_token?: string | null
          created_at?: string
          environment?: string
          id?: string
          realm_id: string
          refresh_token_enc: string
          updated_at?: string
        }
        Update: {
          access_expires_at?: string | null
          access_token?: string | null
          created_at?: string
          environment?: string
          id?: string
          realm_id?: string
          refresh_token_enc?: string
          updated_at?: string
        }
        Relationships: []
      }
      rulebook_rules: {
        Row: {
          category: string | null
          created_at: string
          id: string
          notes: string | null
          pattern: string
          priority: number
          rule_type: string
          updated_at: string
          vendor: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          pattern: string
          priority?: number
          rule_type: string
          updated_at?: string
          vendor?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          pattern?: string
          priority?: number
          rule_type?: string
          updated_at?: string
          vendor?: string | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          approved_at: string | null
          approved_category: string | null
          approved_vendor: string | null
          confidence: number | null
          created_at: string
          description: string | null
          external_id: string
          id: string
          matched_rule_id: string | null
          monthly_run_id: string
          posted_at: string | null
          qbo_journal_entry_id: string | null
          qbo_post_error: string | null
          raw_data: Json | null
          reasoning: string | null
          source: string
          status: string
          suggested_category: string | null
          suggested_vendor: string | null
          transaction_date: string | null
          user_note: string | null
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_category?: string | null
          approved_vendor?: string | null
          confidence?: number | null
          created_at?: string
          description?: string | null
          external_id: string
          id?: string
          matched_rule_id?: string | null
          monthly_run_id: string
          posted_at?: string | null
          qbo_journal_entry_id?: string | null
          qbo_post_error?: string | null
          raw_data?: Json | null
          reasoning?: string | null
          source: string
          status?: string
          suggested_category?: string | null
          suggested_vendor?: string | null
          transaction_date?: string | null
          user_note?: string | null
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_category?: string | null
          approved_vendor?: string | null
          confidence?: number | null
          created_at?: string
          description?: string | null
          external_id?: string
          id?: string
          matched_rule_id?: string | null
          monthly_run_id?: string
          posted_at?: string | null
          qbo_journal_entry_id?: string | null
          qbo_post_error?: string | null
          raw_data?: Json | null
          reasoning?: string | null
          source?: string
          status?: string
          suggested_category?: string | null
          suggested_vendor?: string | null
          transaction_date?: string | null
          user_note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_monthly_run_id_fkey"
            columns: ["monthly_run_id"]
            isOneToOne: false
            referencedRelation: "monthly_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          email: string
          id: string
          role: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          role?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          role?: string
        }
        Relationships: []
      }
    }
    Views: {
      qbo_status: {
        Row: {
          environment: string | null
          connected: boolean | null
        }
        Relationships: []
      }
      drive_status: {
        Row: {
          folder_id: string | null
          account_email: string | null
          connected: boolean | null
        }
        Relationships: []
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
