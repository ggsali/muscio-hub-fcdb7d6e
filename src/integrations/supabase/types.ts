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
      company_settings: {
        Row: {
          id: string
          key: string
          updated_at: string | null
          value: string | null
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string | null
          value?: string | null
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string | null
          value?: string | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          adresse: string | null
          aktiv: boolean | null
          created_at: string | null
          email: string | null
          firma: string | null
          id: string
          name: string
          notizen: string | null
          telefon: string | null
        }
        Insert: {
          adresse?: string | null
          aktiv?: boolean | null
          created_at?: string | null
          email?: string | null
          firma?: string | null
          id?: string
          name: string
          notizen?: string | null
          telefon?: string | null
        }
        Update: {
          adresse?: string | null
          aktiv?: boolean | null
          created_at?: string | null
          email?: string | null
          firma?: string | null
          id?: string
          name?: string
          notizen?: string | null
          telefon?: string | null
        }
        Relationships: []
      }
      filaments: {
        Row: {
          aktiv: boolean | null
          created_at: string | null
          dichte_g_cm3: number | null
          farbe: string | null
          hersteller: string | null
          id: string
          material: string
          name: string
          notizen: string | null
          preis_pro_kg: number
        }
        Insert: {
          aktiv?: boolean | null
          created_at?: string | null
          dichte_g_cm3?: number | null
          farbe?: string | null
          hersteller?: string | null
          id?: string
          material?: string
          name: string
          notizen?: string | null
          preis_pro_kg?: number
        }
        Update: {
          aktiv?: boolean | null
          created_at?: string | null
          dichte_g_cm3?: number | null
          farbe?: string | null
          hersteller?: string | null
          id?: string
          material?: string
          name?: string
          notizen?: string | null
          preis_pro_kg?: number
        }
        Relationships: []
      }
      orders: {
        Row: {
          beschreibung: string | null
          created_at: string | null
          customer_id: string | null
          datum: string | null
          gewinn_total: number | null
          id: string
          kosten_total: number | null
          marge: number | null
          status: string | null
          umsatz_total: number | null
          updated_at: string | null
        }
        Insert: {
          beschreibung?: string | null
          created_at?: string | null
          customer_id?: string | null
          datum?: string | null
          gewinn_total?: number | null
          id?: string
          kosten_total?: number | null
          marge?: number | null
          status?: string | null
          umsatz_total?: number | null
          updated_at?: string | null
        }
        Update: {
          beschreibung?: string | null
          created_at?: string | null
          customer_id?: string | null
          datum?: string | null
          gewinn_total?: number | null
          id?: string
          kosten_total?: number | null
          marge?: number | null
          status?: string | null
          umsatz_total?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      part_files: {
        Row: {
          created_at: string | null
          customer_id: string | null
          file_size_bytes: number | null
          file_type: string | null
          filename: string
          id: string
          order_id: string | null
          part_id: string | null
          storage_path: string
        }
        Insert: {
          created_at?: string | null
          customer_id?: string | null
          file_size_bytes?: number | null
          file_type?: string | null
          filename: string
          id?: string
          order_id?: string | null
          part_id?: string | null
          storage_path: string
        }
        Update: {
          created_at?: string | null
          customer_id?: string | null
          file_size_bytes?: number | null
          file_type?: string | null
          filename?: string
          id?: string
          order_id?: string | null
          part_id?: string | null
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "part_files_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "part_files_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "part_files_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
        ]
      }
      parts: {
        Row: {
          created_at: string | null
          customer_id: string | null
          druckzeit_h: number | null
          gewicht_g: number | null
          id: string
          konstruktion_h: number | null
          material: string | null
          menge: number | null
          nachbearbeitung_h: number | null
          notizen: string | null
          order_id: string | null
          preis_pro_stueck: number | null
          preis_total: number | null
          status: string | null
          teilname: string
        }
        Insert: {
          created_at?: string | null
          customer_id?: string | null
          druckzeit_h?: number | null
          gewicht_g?: number | null
          id?: string
          konstruktion_h?: number | null
          material?: string | null
          menge?: number | null
          nachbearbeitung_h?: number | null
          notizen?: string | null
          order_id?: string | null
          preis_pro_stueck?: number | null
          preis_total?: number | null
          status?: string | null
          teilname: string
        }
        Update: {
          created_at?: string | null
          customer_id?: string | null
          druckzeit_h?: number | null
          gewicht_g?: number | null
          id?: string
          konstruktion_h?: number | null
          material?: string | null
          menge?: number | null
          nachbearbeitung_h?: number | null
          notizen?: string | null
          order_id?: string | null
          preis_pro_stueck?: number | null
          preis_total?: number | null
          status?: string | null
          teilname?: string
        }
        Relationships: [
          {
            foreignKeyName: "parts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      price_presets: {
        Row: {
          beschreibung: string | null
          created_at: string | null
          id: string
          is_default: boolean | null
          konstruktion_pro_h: number | null
          maschinenzeit_pro_h: number | null
          material_einkauf_pro_kg: number | null
          material_verkauf_pro_g: number | null
          nachbearbeitung_pro_h: number | null
          name: string
          rabatt_prozent: number | null
          setup_pauschale: number | null
          strom_verschleiss_pro_h: number | null
        }
        Insert: {
          beschreibung?: string | null
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          konstruktion_pro_h?: number | null
          maschinenzeit_pro_h?: number | null
          material_einkauf_pro_kg?: number | null
          material_verkauf_pro_g?: number | null
          nachbearbeitung_pro_h?: number | null
          name: string
          rabatt_prozent?: number | null
          setup_pauschale?: number | null
          strom_verschleiss_pro_h?: number | null
        }
        Update: {
          beschreibung?: string | null
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          konstruktion_pro_h?: number | null
          maschinenzeit_pro_h?: number | null
          material_einkauf_pro_kg?: number | null
          material_verkauf_pro_g?: number | null
          nachbearbeitung_pro_h?: number | null
          name?: string
          rabatt_prozent?: number | null
          setup_pauschale?: number | null
          strom_verschleiss_pro_h?: number | null
        }
        Relationships: []
      }
      settings: {
        Row: {
          id: string
          key: string
          updated_at: string | null
          value: string
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string | null
          value: string
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string | null
          value?: string
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
