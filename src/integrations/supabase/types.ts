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
      agencies: {
        Row: {
          created_at: string | null
          custom_css: string | null
          custom_domain: string | null
          deleted_at: string | null
          domain: string | null
          id: string
          is_active: boolean | null
          logo_url: string | null
          name: string
          owner_id: string
          primary_color: string | null
          scheduled_deletion_date: string | null
          secondary_color: string | null
          slug: string
          support_email: string | null
          trial_ends_at: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          custom_css?: string | null
          custom_domain?: string | null
          deleted_at?: string | null
          domain?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name: string
          owner_id: string
          primary_color?: string | null
          scheduled_deletion_date?: string | null
          secondary_color?: string | null
          slug: string
          support_email?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          custom_css?: string | null
          custom_domain?: string | null
          deleted_at?: string | null
          domain?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name?: string
          owner_id?: string
          primary_color?: string | null
          scheduled_deletion_date?: string | null
          secondary_color?: string | null
          slug?: string
          support_email?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      agency_settings: {
        Row: {
          agency_domain: string | null
          agency_id: string | null
          agency_logo_url: string | null
          agency_name: string | null
          created_at: string | null
          id: string
          openai_api_key: string | null
          resend_api_key: string | null
          support_email: string | null
          updated_at: string | null
        }
        Insert: {
          agency_domain?: string | null
          agency_id?: string | null
          agency_logo_url?: string | null
          agency_name?: string | null
          created_at?: string | null
          id?: string
          openai_api_key?: string | null
          resend_api_key?: string | null
          support_email?: string | null
          updated_at?: string | null
        }
        Update: {
          agency_domain?: string | null
          agency_id?: string | null
          agency_logo_url?: string | null
          agency_name?: string | null
          created_at?: string | null
          id?: string
          openai_api_key?: string | null
          resend_api_key?: string | null
          support_email?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agency_settings_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: true
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      agency_subscriptions: {
        Row: {
          agency_id: string
          canceled_at: string | null
          created_at: string | null
          current_agents: number | null
          current_clients: number | null
          current_period_end: string | null
          current_period_start: string | null
          current_team_members: number | null
          id: string
          plan_id: string
          status: Database["public"]["Enums"]["subscription_status"] | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          trial_ends_at: string | null
          updated_at: string | null
        }
        Insert: {
          agency_id: string
          canceled_at?: string | null
          created_at?: string | null
          current_agents?: number | null
          current_clients?: number | null
          current_period_end?: string | null
          current_period_start?: string | null
          current_team_members?: number | null
          id?: string
          plan_id: string
          status?: Database["public"]["Enums"]["subscription_status"] | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
        }
        Update: {
          agency_id?: string
          canceled_at?: string | null
          created_at?: string | null
          current_agents?: number | null
          current_clients?: number | null
          current_period_end?: string | null
          current_period_start?: string | null
          current_team_members?: number | null
          id?: string
          plan_id?: string
          status?: Database["public"]["Enums"]["subscription_status"] | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agency_subscriptions_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: true
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      agency_users: {
        Row: {
          agency_id: string
          created_at: string | null
          id: string
          page_permissions: Json | null
          role: Database["public"]["Enums"]["agency_role"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          agency_id: string
          created_at?: string | null
          id?: string
          page_permissions?: Json | null
          role?: Database["public"]["Enums"]["agency_role"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          agency_id?: string
          created_at?: string | null
          id?: string
          page_permissions?: Json | null
          role?: Database["public"]["Enums"]["agency_role"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agency_users_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_assignments: {
        Row: {
          agent_id: string
          client_id: string
          created_at: string | null
          id: string
          sort_order: number | null
        }
        Insert: {
          agent_id: string
          client_id: string
          created_at?: string | null
          id?: string
          sort_order?: number | null
        }
        Update: {
          agent_id?: string
          client_id?: string
          created_at?: string | null
          id?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_assignments_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_assignments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_integrations: {
        Row: {
          agent_id: string
          created_at: string
          id: string
          integration_id: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          id?: string
          integration_id: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          id?: string
          integration_id?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_integrations_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_integrations_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integration_options"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_spec_sections: {
        Row: {
          agent_id: string
          content: Json | null
          created_at: string | null
          id: string
          section_type: string
          sort_order: number | null
          title: string
          updated_at: string | null
        }
        Insert: {
          agent_id: string
          content?: Json | null
          created_at?: string | null
          id?: string
          section_type: string
          sort_order?: number | null
          title: string
          updated_at?: string | null
        }
        Update: {
          agent_id?: string
          content?: Json | null
          created_at?: string | null
          id?: string
          section_type?: string
          sort_order?: number | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_spec_sections_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_types: {
        Row: {
          created_at: string
          function_type: string
          id: string
          provider: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          function_type?: string
          id?: string
          provider: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          function_type?: string
          id?: string
          provider?: string
          updated_at?: string
        }
        Relationships: []
      }
      agent_update_logs: {
        Row: {
          agent_id: string
          created_at: string | null
          created_by: string | null
          description: string
          id: string
        }
        Insert: {
          agent_id: string
          created_at?: string | null
          created_by?: string | null
          description: string
          id?: string
        }
        Update: {
          agent_id?: string
          created_at?: string | null
          created_by?: string | null
          description?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_update_logs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_workflow_categories: {
        Row: {
          agent_id: string
          color: string | null
          created_at: string | null
          id: string
          name: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          agent_id: string
          color?: string | null
          created_at?: string | null
          id?: string
          name: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          agent_id?: string
          color?: string | null
          created_at?: string | null
          id?: string
          name?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_workflow_categories_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_workflows: {
        Row: {
          agent_id: string
          category: string
          created_at: string | null
          description: string | null
          id: string
          name: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          agent_id: string
          category: string
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          agent_id?: string
          category?: string
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_workflows_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agents: {
        Row: {
          agency_id: string | null
          api_key: string
          config: Json | null
          created_at: string | null
          id: string
          name: string
          provider: string
          status: Database["public"]["Enums"]["agent_status"]
          updated_at: string | null
        }
        Insert: {
          agency_id?: string | null
          api_key: string
          config?: Json | null
          created_at?: string | null
          id?: string
          name: string
          provider: string
          status?: Database["public"]["Enums"]["agent_status"]
          updated_at?: string | null
        }
        Update: {
          agency_id?: string | null
          api_key?: string
          config?: Json | null
          created_at?: string | null
          id?: string
          name?: string
          provider?: string
          status?: Database["public"]["Enums"]["agent_status"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agents_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_cards: {
        Row: {
          card_type: string
          config: Json | null
          created_at: string | null
          grid_position: Json | null
          id: string
          is_expanded: boolean | null
          metric_type: string
          tab_id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          card_type: string
          config?: Json | null
          created_at?: string | null
          grid_position?: Json | null
          id?: string
          is_expanded?: boolean | null
          metric_type: string
          tab_id: string
          title: string
          updated_at?: string | null
        }
        Update: {
          card_type?: string
          config?: Json | null
          created_at?: string | null
          grid_position?: Json | null
          id?: string
          is_expanded?: boolean | null
          metric_type?: string
          tab_id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analytics_cards_tab_id_fkey"
            columns: ["tab_id"]
            isOneToOne: false
            referencedRelation: "analytics_tabs"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_tabs: {
        Row: {
          agent_id: string
          created_at: string | null
          default_date_range: string | null
          id: string
          is_default: boolean | null
          name: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          agent_id: string
          created_at?: string | null
          default_date_range?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          agent_id?: string
          created_at?: string | null
          default_date_range?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analytics_tabs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      client_settings: {
        Row: {
          client_id: string
          company_name: string | null
          created_at: string | null
          custom_css: string | null
          custom_guide_sections: Json | null
          default_user_permissions: Json | null
          id: string
          logo_url: string | null
          primary_color: string | null
          secondary_color: string | null
          updated_at: string | null
        }
        Insert: {
          client_id: string
          company_name?: string | null
          created_at?: string | null
          custom_css?: string | null
          custom_guide_sections?: Json | null
          default_user_permissions?: Json | null
          id?: string
          logo_url?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          updated_at?: string | null
        }
        Update: {
          client_id?: string
          company_name?: string | null
          created_at?: string | null
          custom_css?: string | null
          custom_guide_sections?: Json | null
          default_user_permissions?: Json | null
          id?: string
          logo_url?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_settings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_subscriptions: {
        Row: {
          amount_cents: number | null
          billing_cycle_end: string | null
          billing_cycle_start: string | null
          client_id: string
          created_at: string | null
          currency: string | null
          current_usage: number | null
          id: string
          monthly_limit: number | null
          plan_name: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          amount_cents?: number | null
          billing_cycle_end?: string | null
          billing_cycle_start?: string | null
          client_id: string
          created_at?: string | null
          currency?: string | null
          current_usage?: number | null
          id?: string
          monthly_limit?: number | null
          plan_name?: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          amount_cents?: number | null
          billing_cycle_end?: string | null
          billing_cycle_start?: string | null
          client_id?: string
          created_at?: string | null
          currency?: string | null
          current_usage?: number | null
          id?: string
          monthly_limit?: number | null
          plan_name?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_subscriptions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_user_agent_permissions: {
        Row: {
          agent_id: string
          client_id: string
          created_at: string
          id: string
          permissions: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          agent_id: string
          client_id: string
          created_at?: string
          id?: string
          permissions?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          agent_id?: string
          client_id?: string
          created_at?: string
          id?: string
          permissions?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_user_agent_permissions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_user_agent_permissions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_users: {
        Row: {
          avatar_url: string | null
          client_id: string
          created_at: string | null
          department_id: string | null
          full_name: string | null
          id: string
          page_permissions: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          client_id: string
          created_at?: string | null
          department_id?: string | null
          full_name?: string | null
          id?: string
          page_permissions?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          client_id?: string
          created_at?: string | null
          department_id?: string | null
          full_name?: string | null
          id?: string
          page_permissions?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_users_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_users_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_users_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          agency_id: string | null
          company_address: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string
          is_active: boolean | null
          logo_url: string | null
          name: string
          scheduled_deletion_date: string | null
          status: string | null
          subscription_status: string | null
          updated_at: string | null
        }
        Insert: {
          agency_id?: string | null
          company_address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name: string
          scheduled_deletion_date?: string | null
          status?: string | null
          subscription_status?: string | null
          updated_at?: string | null
        }
        Update: {
          agency_id?: string | null
          company_address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name?: string
          scheduled_deletion_date?: string | null
          status?: string | null
          subscription_status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          agent_id: string
          caller_phone: string | null
          duration: number | null
          ended_at: string | null
          id: string
          is_widget_test: boolean | null
          metadata: Json | null
          sentiment: string | null
          started_at: string | null
          status: string
        }
        Insert: {
          agent_id: string
          caller_phone?: string | null
          duration?: number | null
          ended_at?: string | null
          id?: string
          is_widget_test?: boolean | null
          metadata?: Json | null
          sentiment?: string | null
          started_at?: string | null
          status?: string
        }
        Update: {
          agent_id?: string
          caller_phone?: string | null
          duration?: number | null
          ended_at?: string | null
          id?: string
          is_widget_test?: boolean | null
          metadata?: Json | null
          sentiment?: string | null
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          client_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_options: {
        Row: {
          created_at: string
          icon: string
          id: string
          is_custom: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          icon: string
          id?: string
          is_custom?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          icon?: string
          id?: string
          is_custom?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          created_at: string | null
          description: string | null
          features: Json | null
          has_support_access: boolean | null
          has_whitelabel_access: boolean | null
          id: string
          is_active: boolean | null
          max_agents: number
          max_clients: number
          max_team_members: number
          name: string
          price_monthly_cents: number
          tier: Database["public"]["Enums"]["subscription_tier"]
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          features?: Json | null
          has_support_access?: boolean | null
          has_whitelabel_access?: boolean | null
          id?: string
          is_active?: boolean | null
          max_agents?: number
          max_clients?: number
          max_team_members?: number
          name: string
          price_monthly_cents?: number
          tier: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          features?: Json | null
          has_support_access?: boolean | null
          has_whitelabel_access?: boolean | null
          id?: string
          is_active?: boolean | null
          max_agents?: number
          max_clients?: number
          max_team_members?: number
          name?: string
          price_monthly_cents?: number
          tier?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string | null
        }
        Relationships: []
      }
      super_admin_users: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          page_permissions: Json | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          page_permissions?: Json | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          page_permissions?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "super_admin_users_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "super_admin_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      transcripts: {
        Row: {
          buttons: Json | null
          confidence: number | null
          conversation_id: string
          id: string
          metadata: Json | null
          speaker: string
          text: string
          timestamp: string | null
        }
        Insert: {
          buttons?: Json | null
          confidence?: number | null
          conversation_id: string
          id?: string
          metadata?: Json | null
          speaker: string
          text: string
          timestamp?: string | null
        }
        Update: {
          buttons?: Json | null
          confidence?: number | null
          conversation_id?: string
          id?: string
          metadata?: Json | null
          speaker?: string
          text?: string
          timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transcripts_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_passwords: {
        Row: {
          created_at: string | null
          id: string
          password_text: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          password_text: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          password_text?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          client_id: string
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_agency_limit: {
        Args: { _agency_id: string; _limit_type: string }
        Returns: boolean
      }
      check_page_permission: {
        Args: { _client_id: string; _page_name: string; _user_id: string }
        Returns: boolean
      }
      get_user_agency_id: { Args: { _user_id: string }; Returns: string }
      get_user_client_ids: {
        Args: { user_id: string }
        Returns: {
          client_id: string
        }[]
      }
      get_user_departments: {
        Args: { _client_id: string }
        Returns: {
          description: string
          id: string
          name: string
        }[]
      }
      has_agency_role: {
        Args: {
          _agency_id: string
          _role: Database["public"]["Enums"]["agency_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _client_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_settings_permission: {
        Args: { _client_id: string; _user_id: string }
        Returns: boolean
      }
      has_whitelabel_access: { Args: { _agency_id: string }; Returns: boolean }
      is_admin: { Args: { user_id: string }; Returns: boolean }
      is_agency_owner: {
        Args: { _agency_id: string; _user_id: string }
        Returns: boolean
      }
      is_last_admin: {
        Args: { _client_id: string; _user_id: string }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      agency_role: "owner" | "admin" | "user"
      agent_status: "active" | "testing" | "in_development"
      app_role: "admin" | "user"
      subscription_status:
        | "trialing"
        | "active"
        | "past_due"
        | "canceled"
        | "incomplete"
      subscription_tier:
        | "free_trial"
        | "starter"
        | "professional"
        | "enterprise"
      user_role: "admin" | "client"
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
      agency_role: ["owner", "admin", "user"],
      agent_status: ["active", "testing", "in_development"],
      app_role: ["admin", "user"],
      subscription_status: [
        "trialing",
        "active",
        "past_due",
        "canceled",
        "incomplete",
      ],
      subscription_tier: [
        "free_trial",
        "starter",
        "professional",
        "enterprise",
      ],
      user_role: ["admin", "client"],
    },
  },
} as const
