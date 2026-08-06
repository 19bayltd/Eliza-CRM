// Generated from the staging Supabase project (yhrdyyvayistqqwxawqr) after
// applying migrations 20260731100001–20260805110002.
// Regenerate whenever migrations change: Supabase MCP/CLI type generation.
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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      attribute_values: {
        Row: {
          attribute_id: string
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          position: number
          status: string
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          attribute_id: string
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          position?: number
          status?: string
          updated_at?: string
          updated_by?: string | null
          value: string
        }
        Update: {
          attribute_id?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          position?: number
          status?: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "attribute_values_attribute_id_fkey"
            columns: ["attribute_id"]
            isOneToOne: false
            referencedRelation: "attributes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attribute_values_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      attributes: {
        Row: {
          code: string
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code: string
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attributes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_user_id: string | null
          approval_reference: string | null
          branch_id: string | null
          company_id: string | null
          entity_id: string | null
          entity_type: string | null
          failure_reason: string | null
          id: number
          ip_address: unknown
          module: string
          new_value: Json | null
          occurred_at: string
          previous_value: Json | null
          reason: string | null
          request_id: string | null
          result: string
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_user_id?: string | null
          approval_reference?: string | null
          branch_id?: string | null
          company_id?: string | null
          entity_id?: string | null
          entity_type?: string | null
          failure_reason?: string | null
          id?: never
          ip_address?: unknown
          module: string
          new_value?: Json | null
          occurred_at?: string
          previous_value?: Json | null
          reason?: string | null
          request_id?: string | null
          result?: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_user_id?: string | null
          approval_reference?: string | null
          branch_id?: string | null
          company_id?: string | null
          entity_id?: string | null
          entity_type?: string | null
          failure_reason?: string | null
          id?: never
          ip_address?: unknown
          module?: string
          new_value?: Json | null
          occurred_at?: string
          previous_value?: Json | null
          reason?: string | null
          request_id?: string | null
          result?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          code: string
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code: string
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "branches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          code: string
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          parent_id: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code: string
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          parent_id?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          base_currency: string
          code: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          status: string
          timezone: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          base_currency: string
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          status?: string
          timezone?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          base_currency?: string
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          status?: string
          timezone?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      departments: {
        Row: {
          branch_id: string | null
          code: string
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          branch_id?: string | null
          code: string
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          branch_id?: string | null
          code?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "departments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      file_metadata: {
        Row: {
          bucket: string
          classification: string
          company_id: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          mime_type: string
          original_name: string
          path: string
          size_bytes: number
          status: string
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          bucket: string
          classification?: string
          company_id: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          mime_type: string
          original_name: string
          path: string
          size_bytes: number
          status?: string
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          bucket?: string
          classification?: string
          company_id?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          mime_type?: string
          original_name?: string
          path?: string
          size_bytes?: number
          status?: string
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "file_metadata_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      import_job_rows: {
        Row: {
          applied: boolean
          company_id: string
          id: string
          job_id: string
          message: string | null
          planned_action: string
          raw: Json
          row_number: number
        }
        Insert: {
          applied?: boolean
          company_id: string
          id?: string
          job_id: string
          message?: string | null
          planned_action: string
          raw: Json
          row_number: number
        }
        Update: {
          applied?: boolean
          company_id?: string
          id?: string
          job_id?: string
          message?: string | null
          planned_action?: string
          raw?: Json
          row_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "import_job_rows_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_job_rows_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "import_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      import_jobs: {
        Row: {
          applied_at: string | null
          applied_by: string | null
          company_id: string
          created_at: string
          created_by: string | null
          filename: string
          id: string
          module: string
          rows_create: number
          rows_reject: number
          rows_total: number
          rows_update: number
          status: string
        }
        Insert: {
          applied_at?: string | null
          applied_by?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          filename: string
          id?: string
          module?: string
          rows_create?: number
          rows_reject?: number
          rows_total?: number
          rows_update?: number
          status?: string
        }
        Update: {
          applied_at?: string | null
          applied_by?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          filename?: string
          id?: string
          module?: string
          rows_create?: number
          rows_reject?: number
          rows_total?: number
          rows_update?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_jobs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          created_at: string
          description: string
          id: string
          key: string
          module: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          key: string
          module: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          key?: string
          module?: string
          name?: string
        }
        Relationships: []
      }
      product_images: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          file_id: string
          id: string
          position: number
          product_id: string
          status: string
          tier: string
          variant_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          file_id: string
          id?: string
          position?: number
          product_id: string
          status?: string
          tier: string
          variant_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          file_id?: string
          id?: string
          position?: number
          product_id?: string
          status?: string
          tier?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_images_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_images_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: true
            referencedRelation: "file_metadata"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_images_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_intelligence: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          product_id: string
          remarks: string | null
          sourcing_notes: string | null
          target_cost: number | null
          target_cost_currency: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          product_id: string
          remarks?: string | null
          sourcing_notes?: string | null
          target_cost?: number | null
          target_cost_currency?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          product_id?: string
          remarks?: string | null
          sourcing_notes?: string | null
          target_cost?: number | null
          target_cost_currency?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_intelligence_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_intelligence_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          product_id: string
          sku: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          product_id: string
          sku: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          product_id?: string
          sku?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          sku: string
          status: string
          unit_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          sku: string
          status?: string
          unit_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          sku?: string
          status?: string
          unit_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          permission_id: string
          role_id: string
        }
        Insert: {
          created_at?: string
          permission_id: string
          role_id: string
        }
        Update: {
          created_at?: string
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          description: string
          id: string
          is_system: boolean
          key: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          is_system?: boolean
          key: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          is_system?: boolean
          key?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      supplier_contacts: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          messaging: string | null
          name: string
          phone: string | null
          role_title: string | null
          status: string
          supplier_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          messaging?: string | null
          name: string
          phone?: string | null
          role_title?: string | null
          status?: string
          supplier_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          messaging?: string | null
          name?: string
          phone?: string | null
          role_title?: string | null
          status?: string
          supplier_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_contacts_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_documents: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          file_id: string
          id: string
          status: string
          supplier_id: string
          title: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          file_id: string
          id?: string
          status?: string
          supplier_id: string
          title?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          file_id?: string
          id?: string
          status?: string
          supplier_id?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_documents_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: true
            referencedRelation: "file_metadata"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_documents_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_quotation_costs: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          currency: string
          exchange_rate: number
          quotation_id: string
          unit_price: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          currency: string
          exchange_rate?: number
          quotation_id: string
          unit_price: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          exchange_rate?: number
          quotation_id?: string
          unit_price?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_quotation_costs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_quotation_costs_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: true
            referencedRelation: "supplier_quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_quotations: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          lead_time_days: number | null
          moq: number | null
          product_id: string
          status: string
          supplier_id: string
          terms: string | null
          updated_at: string
          updated_by: string | null
          valid_until: string | null
          variant_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          lead_time_days?: number | null
          moq?: number | null
          product_id: string
          status?: string
          supplier_id: string
          terms?: string | null
          updated_at?: string
          updated_by?: string | null
          valid_until?: string | null
          variant_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          lead_time_days?: number | null
          moq?: number | null
          product_id?: string
          status?: string
          supplier_id?: string
          terms?: string | null
          updated_at?: string
          updated_by?: string | null
          valid_until?: string | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_quotations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_quotations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_quotations_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_quotations_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          capabilities: string | null
          code: string
          company_id: string
          country: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          notes: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          address?: string | null
          capabilities?: string | null
          code: string
          company_id: string
          country: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          notes?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          address?: string | null
          capabilities?: string | null
          code?: string
          company_id?: string
          country?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          notes?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          code: string
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code: string
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "units_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_branch_scopes: {
        Row: {
          branch_id: string
          created_at: string
          created_by: string | null
          user_id: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          created_by?: string | null
          user_id: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          created_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_branch_scopes_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_branch_scopes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_company_scopes: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_company_scopes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_company_scopes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_department_scopes: {
        Row: {
          created_at: string
          created_by: string | null
          department_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          department_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          department_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_department_scopes_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_department_scopes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          account_status: Database["public"]["Enums"]["account_status"]
          created_at: string
          created_by: string | null
          email: string
          full_name: string
          id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          account_status?: Database["public"]["Enums"]["account_status"]
          created_at?: string
          created_by?: string | null
          email: string
          full_name?: string
          id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          account_status?: Database["public"]["Enums"]["account_status"]
          created_at?: string
          created_by?: string | null
          email?: string
          full_name?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          company_id: string | null
          created_at: string
          created_by: string | null
          id: string
          role_id: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          role_id: string
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_warehouse_scopes: {
        Row: {
          created_at: string
          created_by: string | null
          user_id: string
          warehouse_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          user_id: string
          warehouse_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          user_id?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_warehouse_scopes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_warehouse_scopes_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      variant_attribute_values: {
        Row: {
          attribute_id: string
          attribute_value_id: string
          company_id: string
          created_at: string
          variant_id: string
        }
        Insert: {
          attribute_id: string
          attribute_value_id: string
          company_id: string
          created_at?: string
          variant_id: string
        }
        Update: {
          attribute_id?: string
          attribute_value_id?: string
          company_id?: string
          created_at?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "variant_attribute_values_attribute_id_fkey"
            columns: ["attribute_id"]
            isOneToOne: false
            referencedRelation: "attributes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variant_attribute_values_attribute_value_id_fkey"
            columns: ["attribute_value_id"]
            isOneToOne: false
            referencedRelation: "attribute_values"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variant_attribute_values_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variant_attribute_values_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouses: {
        Row: {
          branch_id: string | null
          code: string
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          branch_id?: string | null
          code: string
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          branch_id?: string | null
          code?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "warehouses_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      account_status:
        | "invited"
        | "active"
        | "suspended"
        | "locked"
        | "disabled"
        | "exited"
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
      account_status: [
        "invited",
        "active",
        "suspended",
        "locked",
        "disabled",
        "exited",
      ],
    },
  },
} as const
