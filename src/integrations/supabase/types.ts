export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      clients: {
        Row: {
          id: string
          name: string
          instantly_api_key: string
          color: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          instantly_api_key: string
          color?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          instantly_api_key?: string
          color?: string | null
          created_at?: string
        }
        Relationships: []
      }
      email_threads: {
        Row: {
          created_at: string
          id: string
          instantly_thread_id: string | null
          last_message_at: string | null
          lead_id: string
          messages: Json
          subject: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          instantly_thread_id?: string | null
          last_message_at?: string | null
          lead_id: string
          messages?: Json
          subject?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          instantly_thread_id?: string | null
          last_message_at?: string | null
          lead_id?: string
          messages?: Json
          subject?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_threads_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          }
        ]
      }
      follow_up_logs: {
        Row: {
          created_at: string
          id: string
          lead_id: string
          message: string
          sent_at: string
          template_name: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          lead_id: string
          message: string
          sent_at?: string
          template_name?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          lead_id?: string
          message?: string
          sent_at?: string
          template_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "follow_up_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          }
        ]
      }
      leads: {
        Row: {
          campaign_name: string | null
          client_id: string | null
          company: string
          created_at: string
          email: string
          id: string
          instantly_id: string | null
          last_contacted: string | null
          linkedin_url: string | null
          name: string
          notes: string | null
          phone: string | null
          sentiment: string | null
          source: Database["public"]["Enums"]["lead_source"]
          status: Database["public"]["Enums"]["lead_status"]
          sub_account: string | null
          tags: string[] | null
          title: string | null
          updated_at: string
          value: number | null
          workspace_id: string | null
        }
        Insert: {
          campaign_name?: string | null
          client_id?: string | null
          company?: string
          created_at?: string
          email: string
          id?: string
          instantly_id?: string | null
          last_contacted?: string | null
          linkedin_url?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          sentiment?: string | null
          source?: Database["public"]["Enums"]["lead_source"]
          status?: Database["public"]["Enums"]["lead_status"]
          sub_account?: string | null
          tags?: string[] | null
          title?: string | null
          updated_at?: string
          value?: number | null
          workspace_id?: string | null
        }
        Update: {
          campaign_name?: string | null
          client_id?: string | null
          company?: string
          created_at?: string
          email?: string
          id?: string
          instantly_id?: string | null
          last_contacted?: string | null
          linkedin_url?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          sentiment?: string | null
          source?: Database["public"]["Enums"]["lead_source"]
          status?: Database["public"]["Enums"]["lead_status"]
          sub_account?: string | null
          tags?: string[] | null
          title?: string | null
          updated_at?: string
          value?: number | null
          workspace_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      lead_source: "cold_call" | "linkedin" | "networking" | "instantly"
      lead_status: "new" | "booked" | "qualified" | "proposal" | "won" | "lost"
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
      lead_source: ["cold_call", "linkedin", "networking", "instantly"],
      lead_status: ["new", "booked", "qualified", "proposal", "won", "lost"],
    },
  },
} as const
