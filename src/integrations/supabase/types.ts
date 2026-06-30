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
      admin_allowlist: {
        Row: {
          created_at: string
          email: string
          id: string
          notiz: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          notiz?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          notiz?: string | null
        }
        Relationships: []
      }
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
      blog_posts: {
        Row: {
          autor: string
          created_at: string
          id: string
          inhalt: string
          slug: string
          tags: string[] | null
          titel: string
          titelbild_url: string | null
          updated_at: string
          veroeffentlicht: boolean
          veroeffentlicht_am: string | null
          zusammenfassung: string | null
        }
        Insert: {
          autor?: string
          created_at?: string
          id?: string
          inhalt?: string
          slug: string
          tags?: string[] | null
          titel: string
          titelbild_url?: string | null
          updated_at?: string
          veroeffentlicht?: boolean
          veroeffentlicht_am?: string | null
          zusammenfassung?: string | null
        }
        Update: {
          autor?: string
          created_at?: string
          id?: string
          inhalt?: string
          slug?: string
          tags?: string[] | null
          titel?: string
          titelbild_url?: string | null
          updated_at?: string
          veroeffentlicht?: boolean
          veroeffentlicht_am?: string | null
          zusammenfassung?: string | null
        }
        Relationships: []
      }
      calculator_uploads: {
        Row: {
          auth_user_id: string | null
          bucket: string
          color: string | null
          created_at: string
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          estimated_price: number | null
          estimated_weight: number | null
          file_name: string
          id: string
          infill: number | null
          material_id: string | null
          material_name: string | null
          notes: string | null
          quantity: number | null
          session_id: string | null
          size_bytes: number | null
          status: string
          storage_path: string
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          bucket?: string
          color?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          estimated_price?: number | null
          estimated_weight?: number | null
          file_name: string
          id?: string
          infill?: number | null
          material_id?: string | null
          material_name?: string | null
          notes?: string | null
          quantity?: number | null
          session_id?: string | null
          size_bytes?: number | null
          status?: string
          storage_path: string
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          bucket?: string
          color?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          estimated_price?: number | null
          estimated_weight?: number | null
          file_name?: string
          id?: string
          infill?: number | null
          material_id?: string | null
          material_name?: string | null
          notes?: string | null
          quantity?: number | null
          session_id?: string | null
          size_bytes?: number | null
          status?: string
          storage_path?: string
          updated_at?: string
        }
        Relationships: []
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
      customer_profile_completion_tokens: {
        Row: {
          created_at: string
          customer_id: string | null
          expires_at: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          expires_at?: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          expires_at?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_profile_completion_tokens_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
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
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      equipment: {
        Row: {
          aktiv: boolean
          bauplatte_breite_mm: number | null
          bauplatte_tiefe_mm: number | null
          beschreibung: string | null
          created_at: string
          id: string
          ist_drucker: boolean
          model_rotation: Json
          modell_url: string | null
          name: string
          sort_order: number
          specs: Json | null
          vorschaubild_url: string | null
        }
        Insert: {
          aktiv?: boolean
          bauplatte_breite_mm?: number | null
          bauplatte_tiefe_mm?: number | null
          beschreibung?: string | null
          created_at?: string
          id?: string
          ist_drucker?: boolean
          model_rotation?: Json
          modell_url?: string | null
          name: string
          sort_order?: number
          specs?: Json | null
          vorschaubild_url?: string | null
        }
        Update: {
          aktiv?: boolean
          bauplatte_breite_mm?: number | null
          bauplatte_tiefe_mm?: number | null
          beschreibung?: string | null
          created_at?: string
          id?: string
          ist_drucker?: boolean
          model_rotation?: Json
          modell_url?: string | null
          name?: string
          sort_order?: number
          specs?: Json | null
          vorschaubild_url?: string | null
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
          attachments: Json | null
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
          attachments?: Json | null
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
          attachments?: Json | null
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
      inquiry_messages: {
        Row: {
          body: string
          body_html: string | null
          created_at: string
          direction: string
          from_email: string
          from_name: string | null
          id: string
          in_reply_to: string | null
          inquiry_id: string
          message_id: string | null
          subject: string | null
          to_email: string
        }
        Insert: {
          body: string
          body_html?: string | null
          created_at?: string
          direction: string
          from_email: string
          from_name?: string | null
          id?: string
          in_reply_to?: string | null
          inquiry_id: string
          message_id?: string | null
          subject?: string | null
          to_email: string
        }
        Update: {
          body?: string
          body_html?: string | null
          created_at?: string
          direction?: string
          from_email?: string
          from_name?: string | null
          id?: string
          in_reply_to?: string | null
          inquiry_id?: string
          message_id?: string | null
          subject?: string | null
          to_email?: string
        }
        Relationships: []
      }
      materials: {
        Row: {
          aktiv: boolean
          created_at: string
          density: number
          description: string | null
          farben: string[]
          id: string
          name: string
          price_per_gram: number
          sort_order: number
          tag: string
          updated_at: string
        }
        Insert: {
          aktiv?: boolean
          created_at?: string
          density?: number
          description?: string | null
          farben?: string[]
          id?: string
          name: string
          price_per_gram: number
          sort_order?: number
          tag: string
          updated_at?: string
        }
        Update: {
          aktiv?: boolean
          created_at?: string
          density?: number
          description?: string | null
          farben?: string[]
          id?: string
          name?: string
          price_per_gram?: number
          sort_order?: number
          tag?: string
          updated_at?: string
        }
        Relationships: []
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
          bewertungs_token: string | null
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
          lieferart: string
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
          bewertungs_token?: string | null
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
          lieferart?: string
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
          bewertungs_token?: string | null
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
          lieferart?: string
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
      page_views: {
        Row: {
          created_at: string
          device: string | null
          id: string
          path: string
          referrer: string | null
          session_id: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          device?: string | null
          id?: string
          path: string
          referrer?: string | null
          session_id?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          device?: string | null
          id?: string
          path?: string
          referrer?: string | null
          session_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
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
      partners: {
        Row: {
          aktiv: boolean
          created_at: string
          id: string
          logo_path: string | null
          name: string
          sort_order: number
          website_url: string | null
        }
        Insert: {
          aktiv?: boolean
          created_at?: string
          id?: string
          logo_path?: string | null
          name: string
          sort_order?: number
          website_url?: string | null
        }
        Update: {
          aktiv?: boolean
          created_at?: string
          id?: string
          logo_path?: string | null
          name?: string
          sort_order?: number
          website_url?: string | null
        }
        Relationships: []
      }
      parts: {
        Row: {
          breite_mm: number | null
          created_at: string | null
          customer_id: string | null
          druckzeit_h: number | null
          filament_einkauf_pro_kg: number | null
          filament_id: string | null
          gewicht_g: number | null
          id: string
          konstruktion_h: number | null
          laenge_mm: number | null
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
          breite_mm?: number | null
          created_at?: string | null
          customer_id?: string | null
          druckzeit_h?: number | null
          filament_einkauf_pro_kg?: number | null
          filament_id?: string | null
          gewicht_g?: number | null
          id?: string
          konstruktion_h?: number | null
          laenge_mm?: number | null
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
          breite_mm?: number | null
          created_at?: string | null
          customer_id?: string | null
          druckzeit_h?: number | null
          filament_einkauf_pro_kg?: number | null
          filament_id?: string | null
          gewicht_g?: number | null
          id?: string
          konstruktion_h?: number | null
          laenge_mm?: number | null
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
      print_plate_parts: {
        Row: {
          created_at: string
          id: string
          menge: number
          part_id: string
          plate_id: string
          pos_x_mm: number | null
          pos_y_mm: number | null
          rot_deg: number
        }
        Insert: {
          created_at?: string
          id?: string
          menge?: number
          part_id: string
          plate_id: string
          pos_x_mm?: number | null
          pos_y_mm?: number | null
          rot_deg?: number
        }
        Update: {
          created_at?: string
          id?: string
          menge?: number
          part_id?: string
          plate_id?: string
          pos_x_mm?: number | null
          pos_y_mm?: number | null
          rot_deg?: number
        }
        Relationships: [
          {
            foreignKeyName: "print_plate_parts_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_plate_parts_plate_id_fkey"
            columns: ["plate_id"]
            isOneToOne: false
            referencedRelation: "print_plates"
            referencedColumns: ["id"]
          },
        ]
      }
      print_plates: {
        Row: {
          created_at: string
          equipment_id: string | null
          id: string
          name: string
          notiz: string | null
          order_id: string | null
          status: string
          updated_at: string
          zip_path: string | null
        }
        Insert: {
          created_at?: string
          equipment_id?: string | null
          id?: string
          name?: string
          notiz?: string | null
          order_id?: string | null
          status?: string
          updated_at?: string
          zip_path?: string | null
        }
        Update: {
          created_at?: string
          equipment_id?: string | null
          id?: string
          name?: string
          notiz?: string | null
          order_id?: string | null
          status?: string
          updated_at?: string
          zip_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "print_plates_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_plates_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          city: string | null
          country: string | null
          created_at: string
          full_name: string | null
          id: string
          land: string | null
          nachname: string | null
          ort: string | null
          phone: string | null
          plz: string | null
          postal_code: string | null
          strasse: string | null
          updated_at: string
          user_id: string
          vorname: string | null
          welcome_email_sent_at: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          land?: string | null
          nachname?: string | null
          ort?: string | null
          phone?: string | null
          plz?: string | null
          postal_code?: string | null
          strasse?: string | null
          updated_at?: string
          user_id: string
          vorname?: string | null
          welcome_email_sent_at?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          land?: string | null
          nachname?: string | null
          ort?: string | null
          phone?: string | null
          plz?: string | null
          postal_code?: string | null
          strasse?: string | null
          updated_at?: string
          user_id?: string
          vorname?: string | null
          welcome_email_sent_at?: string | null
        }
        Relationships: []
      }
      projekte: {
        Row: {
          aktiv: boolean
          beschreibung: string | null
          bild_url: string | null
          created_at: string
          featured: boolean
          gallery_paths: string[] | null
          hero_image_path: string | null
          id: string
          kategorie: string | null
          kurzbeschreibung: string | null
          lieferzeit: string | null
          material: string | null
          name: string
          slug: string
          sort_order: number
          stl_url: string | null
          toleranz: string | null
          updated_at: string
          verfahren: string | null
        }
        Insert: {
          aktiv?: boolean
          beschreibung?: string | null
          bild_url?: string | null
          created_at?: string
          featured?: boolean
          gallery_paths?: string[] | null
          hero_image_path?: string | null
          id?: string
          kategorie?: string | null
          kurzbeschreibung?: string | null
          lieferzeit?: string | null
          material?: string | null
          name: string
          slug: string
          sort_order?: number
          stl_url?: string | null
          toleranz?: string | null
          updated_at?: string
          verfahren?: string | null
        }
        Update: {
          aktiv?: boolean
          beschreibung?: string | null
          bild_url?: string | null
          created_at?: string
          featured?: boolean
          gallery_paths?: string[] | null
          hero_image_path?: string | null
          id?: string
          kategorie?: string | null
          kurzbeschreibung?: string | null
          lieferzeit?: string | null
          material?: string | null
          name?: string
          slug?: string
          sort_order?: number
          stl_url?: string | null
          toleranz?: string | null
          updated_at?: string
          verfahren?: string | null
        }
        Relationships: []
      }
      referrals: {
        Row: {
          created_at: string
          id: string
          rabatt_code: string
          rabatt_prozent: number
          referred_customer_id: string | null
          referred_email: string | null
          referrer_customer_id: string | null
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          rabatt_code: string
          rabatt_prozent?: number
          referred_customer_id?: string | null
          referred_email?: string | null
          referrer_customer_id?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          rabatt_code?: string
          rabatt_prozent?: number
          referred_customer_id?: string | null
          referred_email?: string | null
          referrer_customer_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_referred_customer_id_fkey"
            columns: ["referred_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referrer_customer_id_fkey"
            columns: ["referrer_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          created_at: string
          customer_email: string | null
          customer_name: string
          freigegeben: boolean
          id: string
          kommentar: string | null
          order_id: string | null
          rating: number
          sichtbar_auf_website: boolean
          source: string | null
          token: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_email?: string | null
          customer_name: string
          freigegeben?: boolean
          id?: string
          kommentar?: string | null
          order_id?: string | null
          rating?: number
          sichtbar_auf_website?: boolean
          source?: string | null
          token?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_email?: string | null
          customer_name?: string
          freigegeben?: boolean
          id?: string
          kommentar?: string | null
          order_id?: string | null
          rating?: number
          sichtbar_auf_website?: boolean
          source?: string | null
          token?: string | null
          updated_at?: string
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
      shop_categories: {
        Row: {
          aktiv: boolean
          beschreibung: string | null
          created_at: string
          id: string
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          aktiv?: boolean
          beschreibung?: string | null
          created_at?: string
          id?: string
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          aktiv?: boolean
          beschreibung?: string | null
          created_at?: string
          id?: string
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      shop_order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          product_id: string | null
          product_name: string
          product_slug: string | null
          quantity: number
          total: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          product_id?: string | null
          product_name: string
          product_slug?: string | null
          quantity?: number
          total?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          product_id?: string | null
          product_name?: string
          product_slug?: string | null
          quantity?: number
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "shop_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "shop_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "shop_products"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_orders: {
        Row: {
          created_at: string
          customer_email: string
          customer_name: string
          customer_phone: string | null
          id: string
          mwst: number
          notiz: string | null
          order_id: string | null
          paid_at: string | null
          shipping: number
          shipping_address: string
          shipping_city: string
          shipping_country: string
          shipping_postal_code: string
          status: string
          stripe_session_id: string | null
          subtotal: number
          total: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          customer_email: string
          customer_name: string
          customer_phone?: string | null
          id?: string
          mwst?: number
          notiz?: string | null
          order_id?: string | null
          paid_at?: string | null
          shipping?: number
          shipping_address: string
          shipping_city: string
          shipping_country?: string
          shipping_postal_code: string
          status?: string
          stripe_session_id?: string | null
          subtotal?: number
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          customer_email?: string
          customer_name?: string
          customer_phone?: string | null
          id?: string
          mwst?: number
          notiz?: string | null
          order_id?: string | null
          paid_at?: string | null
          shipping?: number
          shipping_address?: string
          shipping_city?: string
          shipping_country?: string
          shipping_postal_code?: string
          status?: string
          stripe_session_id?: string | null
          subtotal?: number
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      shop_product_images: {
        Row: {
          created_at: string
          id: string
          is_primary: boolean
          product_id: string
          sort_order: number
          storage_path: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_primary?: boolean
          product_id: string
          sort_order?: number
          storage_path: string
        }
        Update: {
          created_at?: string
          id?: string
          is_primary?: boolean
          product_id?: string
          sort_order?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "shop_products"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_products: {
        Row: {
          aktiv: boolean
          beschreibung: string | null
          created_at: string
          featured: boolean
          id: string
          kategorie_id: string | null
          kurzbeschreibung: string | null
          lagerbestand: number
          material: string | null
          name: string
          preis: number
          slug: string
          sort_order: number
          stripe_price_id: string | null
          tags: string[] | null
          unendlich_bestand: boolean
          updated_at: string
          vergleichspreis: number | null
        }
        Insert: {
          aktiv?: boolean
          beschreibung?: string | null
          created_at?: string
          featured?: boolean
          id?: string
          kategorie_id?: string | null
          kurzbeschreibung?: string | null
          lagerbestand?: number
          material?: string | null
          name: string
          preis?: number
          slug: string
          sort_order?: number
          stripe_price_id?: string | null
          tags?: string[] | null
          unendlich_bestand?: boolean
          updated_at?: string
          vergleichspreis?: number | null
        }
        Update: {
          aktiv?: boolean
          beschreibung?: string | null
          created_at?: string
          featured?: boolean
          id?: string
          kategorie_id?: string | null
          kurzbeschreibung?: string | null
          lagerbestand?: number
          material?: string | null
          name?: string
          preis?: number
          slug?: string
          sort_order?: number
          stripe_price_id?: string | null
          tags?: string[] | null
          unendlich_bestand?: boolean
          updated_at?: string
          vergleichspreis?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shop_products_kategorie_id_fkey"
            columns: ["kategorie_id"]
            isOneToOne: false
            referencedRelation: "shop_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      team_members: {
        Row: {
          aktiv: boolean
          bio: string | null
          created_at: string
          id: string
          name: string
          photo_path: string | null
          role: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          aktiv?: boolean
          bio?: string | null
          created_at?: string
          id?: string
          name: string
          photo_path?: string | null
          role?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          aktiv?: boolean
          bio?: string | null
          created_at?: string
          id?: string
          name?: string
          photo_path?: string | null
          role?: string | null
          sort_order?: number
          updated_at?: string
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
      timeline_events: {
        Row: {
          aktiv: boolean
          beschreibung: string | null
          created_at: string
          icon: string | null
          id: string
          image_path: string | null
          jahr: string
          sort_order: number
          titel: string
          updated_at: string
        }
        Insert: {
          aktiv?: boolean
          beschreibung?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          image_path?: string | null
          jahr: string
          sort_order?: number
          titel: string
          updated_at?: string
        }
        Update: {
          aktiv?: boolean
          beschreibung?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          image_path?: string | null
          jahr?: string
          sort_order?: number
          titel?: string
          updated_at?: string
        }
        Relationships: []
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
      current_user_email: { Args: never; Returns: string }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_chat_messages: {
        Args: { p_session_id: string }
        Returns: {
          content: string
          created_at: string
          id: string
          is_read: boolean
          role: string
          session_id: string
        }[]
      }
      get_referral_by_code: {
        Args: { p_code: string }
        Returns: {
          created_at: string
          id: string
          rabatt_code: string
          rabatt_prozent: number
          status: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_email: { Args: { _email: string }; Returns: boolean }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "customer"
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
      app_role: ["admin", "customer"],
    },
  },
} as const
