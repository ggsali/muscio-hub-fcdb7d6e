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
      bills: {
        Row: {
          betrag: number
          bezahlt: boolean
          bezahlt_am: string | null
          created_at: string
          faellig_am: string | null
          file_path: string | null
          filename: string | null
          id: string
          notiz: string | null
          order_id: string | null
          titel: string
        }
        Insert: {
          betrag?: number
          bezahlt?: boolean
          bezahlt_am?: string | null
          created_at?: string
          faellig_am?: string | null
          file_path?: string | null
          filename?: string | null
          id?: string
          notiz?: string | null
          order_id?: string | null
          titel?: string
        }
        Update: {
          betrag?: number
          bezahlt?: boolean
          bezahlt_am?: string | null
          created_at?: string
          faellig_am?: string | null
          file_path?: string | null
          filename?: string | null
          id?: string
          notiz?: string | null
          order_id?: string | null
          titel?: string
        }
        Relationships: [
          {
            foreignKeyName: "bills_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          is_read: boolean
          role: string
          session_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_read?: boolean
          role?: string
          session_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_read?: boolean
          role?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          created_at: string
          id: string
          status: string
          updated_at: string
          user_email: string | null
          user_name: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
          user_email?: string | null
          user_name?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
          user_email?: string | null
          user_name?: string | null
        }
        Relationships: []
      }
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
          auth_user_id: string | null
          created_at: string | null
          email: string | null
          firma: string | null
          hausnummer: string | null
          id: string
          land: string | null
          name: string
          notizen: string | null
          ort: string | null
          plz: string | null
          strasse: string | null
          telefon: string | null
          vorname: string | null
        }
        Insert: {
          adresse?: string | null
          aktiv?: boolean | null
          auth_user_id?: string | null
          created_at?: string | null
          email?: string | null
          firma?: string | null
          hausnummer?: string | null
          id?: string
          land?: string | null
          name: string
          notizen?: string | null
          ort?: string | null
          plz?: string | null
          strasse?: string | null
          telefon?: string | null
          vorname?: string | null
        }
        Update: {
          adresse?: string | null
          aktiv?: boolean | null
          auth_user_id?: string | null
          created_at?: string | null
          email?: string | null
          firma?: string | null
          hausnummer?: string | null
          id?: string
          land?: string | null
          name?: string
          notizen?: string | null
          ort?: string | null
          plz?: string | null
          strasse?: string | null
          telefon?: string | null
          vorname?: string | null
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          aktiv: boolean
          betreff: string
          nachricht: string
          status_key: string
          updated_at: string
        }
        Insert: {
          aktiv?: boolean
          betreff: string
          nachricht: string
          status_key: string
          updated_at?: string
        }
        Update: {
          aktiv?: boolean
          betreff?: string
          nachricht?: string
          status_key?: string
          updated_at?: string
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
          verkaufspreis_pro_g: number | null
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
          verkaufspreis_pro_g?: number | null
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
          verkaufspreis_pro_g?: number | null
        }
        Relationships: []
      }
      inquiries: {
        Row: {
          betreff: string | null
          created_at: string
          customer_id: string | null
          email: string
          id: string
          nachricht: string
          name: string
          notiz: string | null
          order_id: string | null
          quelle: string | null
          status: string
          telefon: string | null
          updated_at: string
        }
        Insert: {
          betreff?: string | null
          created_at?: string
          customer_id?: string | null
          email: string
          id?: string
          nachricht: string
          name: string
          notiz?: string | null
          order_id?: string | null
          quelle?: string | null
          status?: string
          telefon?: string | null
          updated_at?: string
        }
        Update: {
          betreff?: string | null
          created_at?: string
          customer_id?: string | null
          email?: string
          id?: string
          nachricht?: string
          name?: string
          notiz?: string | null
          order_id?: string | null
          quelle?: string | null
          status?: string
          telefon?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inquiries_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inquiries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_positions: {
        Row: {
          bezeichnung: string
          created_at: string
          einheit: string
          id: string
          menge: number
          notiz: string | null
          order_id: string
          position_order: number
          preis_pro_einheit: number
          total: number | null
        }
        Insert: {
          bezeichnung?: string
          created_at?: string
          einheit?: string
          id?: string
          menge?: number
          notiz?: string | null
          order_id: string
          position_order?: number
          preis_pro_einheit?: number
          total?: number | null
        }
        Update: {
          bezeichnung?: string
          created_at?: string
          einheit?: string
          id?: string
          menge?: number
          notiz?: string | null
          order_id?: string
          position_order?: number
          preis_pro_einheit?: number
          total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "offer_positions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_log: {
        Row: {
          created_at: string
          id: string
          notiz: string | null
          order_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          notiz?: string | null
          order_id: string
          status: string
        }
        Update: {
          created_at?: string
          id?: string
          notiz?: string | null
          order_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_status_log_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          beschreibung: string | null
          created_at: string | null
          customer_id: string | null
          datum: string | null
          express_kosten: number | null
          express_label: string | null
          geplant_bis: string | null
          geplant_von: string | null
          gewinn_total: number | null
          id: string
          kosten_total: number | null
          marge: number | null
          name: string | null
          notes_internal: string | null
          preset_id: string | null
          source: string
          status: string | null
          tracking_nr: string | null
          umsatz_total: number | null
          updated_at: string | null
        }
        Insert: {
          beschreibung?: string | null
          created_at?: string | null
          customer_id?: string | null
          datum?: string | null
          express_kosten?: number | null
          express_label?: string | null
          geplant_bis?: string | null
          geplant_von?: string | null
          gewinn_total?: number | null
          id?: string
          kosten_total?: number | null
          marge?: number | null
          name?: string | null
          notes_internal?: string | null
          preset_id?: string | null
          source?: string
          status?: string | null
          tracking_nr?: string | null
          umsatz_total?: number | null
          updated_at?: string | null
        }
        Update: {
          beschreibung?: string | null
          created_at?: string | null
          customer_id?: string | null
          datum?: string | null
          express_kosten?: number | null
          express_label?: string | null
          geplant_bis?: string | null
          geplant_von?: string | null
          gewinn_total?: number | null
          id?: string
          kosten_total?: number | null
          marge?: number | null
          name?: string | null
          notes_internal?: string | null
          preset_id?: string | null
          source?: string
          status?: string | null
          tracking_nr?: string | null
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
          {
            foreignKeyName: "orders_preset_id_fkey"
            columns: ["preset_id"]
            isOneToOne: false
            referencedRelation: "price_presets"
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
          filament_einkauf_pro_kg: number | null
          filament_id: string | null
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
          filament_einkauf_pro_kg?: number | null
          filament_id?: string | null
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
          filament_einkauf_pro_kg?: number | null
          filament_id?: string | null
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
      profiles: {
        Row: {
          address: string | null
          city: string | null
          country: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          postal_code: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          postal_code?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          postal_code?: string | null
          updated_at?: string
          user_id?: string
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
      time_entries: {
        Row: {
          created_at: string
          dauer_sekunden: number | null
          id: string
          kategorie: string
          notiz: string | null
          order_id: string
          part_id: string | null
          started_at: string
          stopped_at: string | null
        }
        Insert: {
          created_at?: string
          dauer_sekunden?: number | null
          id?: string
          kategorie: string
          notiz?: string | null
          order_id: string
          part_id?: string | null
          started_at?: string
          stopped_at?: string | null
        }
        Update: {
          created_at?: string
          dauer_sekunden?: number | null
          id?: string
          kategorie?: string
          notiz?: string | null
          order_id?: string
          part_id?: string | null
          started_at?: string
          stopped_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
        ]
      }
      upload_link_files: {
        Row: {
          created_at: string
          file_size_bytes: number | null
          file_type: string | null
          filename: string
          id: string
          nas_path: string | null
          nas_synced: boolean | null
          storage_path: string
          upload_link_id: string
          uploader_email: string | null
          uploader_name: string | null
        }
        Insert: {
          created_at?: string
          file_size_bytes?: number | null
          file_type?: string | null
          filename: string
          id?: string
          nas_path?: string | null
          nas_synced?: boolean | null
          storage_path: string
          upload_link_id: string
          uploader_email?: string | null
          uploader_name?: string | null
        }
        Update: {
          created_at?: string
          file_size_bytes?: number | null
          file_type?: string | null
          filename?: string
          id?: string
          nas_path?: string | null
          nas_synced?: boolean | null
          storage_path?: string
          upload_link_id?: string
          uploader_email?: string | null
          uploader_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "upload_link_files_upload_link_id_fkey"
            columns: ["upload_link_id"]
            isOneToOne: false
            referencedRelation: "upload_links"
            referencedColumns: ["id"]
          },
        ]
      }
      upload_links: {
        Row: {
          aktiv: boolean
          beschreibung: string | null
          created_at: string
          customer_id: string | null
          expires_at: string | null
          id: string
          max_files: number | null
          order_id: string | null
          title: string
          token: string
          updated_at: string
        }
        Insert: {
          aktiv?: boolean
          beschreibung?: string | null
          created_at?: string
          customer_id?: string | null
          expires_at?: string | null
          id?: string
          max_files?: number | null
          order_id?: string | null
          title?: string
          token?: string
          updated_at?: string
        }
        Update: {
          aktiv?: boolean
          beschreibung?: string | null
          created_at?: string
          customer_id?: string | null
          expires_at?: string | null
          id?: string
          max_files?: number | null
          order_id?: string | null
          title?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "upload_links_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "upload_links_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      website_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
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
