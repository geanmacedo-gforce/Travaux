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
      clientes: {
        Row: {
          arquivado: boolean
          bairro: string | null
          cep: string | null
          cidade: string | null
          created_at: string
          documento: string | null
          email: string | null
          estado: string | null
          id: string
          nome: string
          numero: string | null
          observacoes: string | null
          rua: string | null
          telefone: string | null
        }
        Insert: {
          arquivado?: boolean
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          created_at?: string
          documento?: string | null
          email?: string | null
          estado?: string | null
          id?: string
          nome: string
          numero?: string | null
          observacoes?: string | null
          rua?: string | null
          telefone?: string | null
        }
        Update: {
          arquivado?: boolean
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          created_at?: string
          documento?: string | null
          email?: string | null
          estado?: string | null
          id?: string
          nome?: string
          numero?: string | null
          observacoes?: string | null
          rua?: string | null
          telefone?: string | null
        }
        Relationships: []
      }
      despesas: {
        Row: {
          categoria: Database["public"]["Enums"]["categoria_despesa"]
          comprovante_url: string | null
          created_at: string
          data: string
          data_checkout: string | null
          descricao: string | null
          id: string
          litros: number | null
          local: string | null
          obra_id: string
          qtd_pessoas: number | null
          responsavel_id: string | null
          valor: number
        }
        Insert: {
          categoria: Database["public"]["Enums"]["categoria_despesa"]
          comprovante_url?: string | null
          created_at?: string
          data: string
          data_checkout?: string | null
          descricao?: string | null
          id?: string
          litros?: number | null
          local?: string | null
          obra_id: string
          qtd_pessoas?: number | null
          responsavel_id?: string | null
          valor: number
        }
        Update: {
          categoria?: Database["public"]["Enums"]["categoria_despesa"]
          comprovante_url?: string | null
          created_at?: string
          data?: string
          data_checkout?: string | null
          descricao?: string | null
          id?: string
          litros?: number | null
          local?: string | null
          obra_id?: string
          qtd_pessoas?: number | null
          responsavel_id?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "despesas_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      funcionarios: {
        Row: {
          agencia: string | null
          banco: string | null
          conta: string | null
          cpf: string | null
          created_at: string
          funcao: Database["public"]["Enums"]["funcao_funcionario"]
          id: string
          nome: string
          observacoes: string | null
          pix: string | null
          status: Database["public"]["Enums"]["status_funcionario"]
          telefone: string | null
          tipo_remuneracao: Database["public"]["Enums"]["tipo_remuneracao"]
          valor: number
        }
        Insert: {
          agencia?: string | null
          banco?: string | null
          conta?: string | null
          cpf?: string | null
          created_at?: string
          funcao?: Database["public"]["Enums"]["funcao_funcionario"]
          id?: string
          nome: string
          observacoes?: string | null
          pix?: string | null
          status?: Database["public"]["Enums"]["status_funcionario"]
          telefone?: string | null
          tipo_remuneracao?: Database["public"]["Enums"]["tipo_remuneracao"]
          valor?: number
        }
        Update: {
          agencia?: string | null
          banco?: string | null
          conta?: string | null
          cpf?: string | null
          created_at?: string
          funcao?: Database["public"]["Enums"]["funcao_funcionario"]
          id?: string
          nome?: string
          observacoes?: string | null
          pix?: string | null
          status?: Database["public"]["Enums"]["status_funcionario"]
          telefone?: string | null
          tipo_remuneracao?: Database["public"]["Enums"]["tipo_remuneracao"]
          valor?: number
        }
        Relationships: []
      }
      horas_trabalhadas: {
        Row: {
          created_at: string
          created_by: string | null
          data: string
          descricao: string | null
          funcionario_id: string
          horas: number
          id: string
          obra_id: string
          valor_hora: number
          valor_total: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data: string
          descricao?: string | null
          funcionario_id: string
          horas: number
          id?: string
          obra_id: string
          valor_hora?: number
          valor_total?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data?: string
          descricao?: string | null
          funcionario_id?: string
          horas?: number
          id?: string
          obra_id?: string
          valor_hora?: number
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "horas_trabalhadas_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "horas_trabalhadas_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      materiais_usados: {
        Row: {
          comprovante_url: string | null
          created_at: string
          data: string
          id: string
          link_url: string | null
          obra_id: string
          observacoes: string | null
          produto_id: string | null
          quantidade: number
          valor_total: number
          valor_unitario: number
        }
        Insert: {
          comprovante_url?: string | null
          created_at?: string
          data: string
          id?: string
          link_url?: string | null
          obra_id: string
          observacoes?: string | null
          produto_id?: string | null
          quantidade: number
          valor_total: number
          valor_unitario: number
        }
        Update: {
          comprovante_url?: string | null
          created_at?: string
          data?: string
          id?: string
          link_url?: string | null
          obra_id?: string
          observacoes?: string | null
          produto_id?: string | null
          quantidade?: number
          valor_total?: number
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "materiais_usados_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "materiais_usados_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      obras: {
        Row: {
          cliente_id: string | null
          created_at: string
          data_inicio: string | null
          data_termino_prevista: string | null
          descricao: string | null
          endereco: string | null
          id: string
          nome: string
          status: Database["public"]["Enums"]["status_obra"]
          tipo_servico: Database["public"]["Enums"]["tipo_servico"]
          valor_contratado: number
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          data_inicio?: string | null
          data_termino_prevista?: string | null
          descricao?: string | null
          endereco?: string | null
          id?: string
          nome: string
          status?: Database["public"]["Enums"]["status_obra"]
          tipo_servico?: Database["public"]["Enums"]["tipo_servico"]
          valor_contratado?: number
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          data_inicio?: string | null
          data_termino_prevista?: string | null
          descricao?: string | null
          endereco?: string | null
          id?: string
          nome?: string
          status?: Database["public"]["Enums"]["status_obra"]
          tipo_servico?: Database["public"]["Enums"]["tipo_servico"]
          valor_contratado?: number
        }
        Relationships: [
          {
            foreignKeyName: "obras_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      pagamentos: {
        Row: {
          created_at: string
          data_pagamento: string | null
          forma: Database["public"]["Enums"]["forma_pagamento"] | null
          funcionario_id: string
          id: string
          observacoes: string | null
          periodo_fim: string
          periodo_inicio: string
          status: Database["public"]["Enums"]["status_pagamento"]
          valor: number
        }
        Insert: {
          created_at?: string
          data_pagamento?: string | null
          forma?: Database["public"]["Enums"]["forma_pagamento"] | null
          funcionario_id: string
          id?: string
          observacoes?: string | null
          periodo_fim: string
          periodo_inicio: string
          status?: Database["public"]["Enums"]["status_pagamento"]
          valor: number
        }
        Update: {
          created_at?: string
          data_pagamento?: string | null
          forma?: Database["public"]["Enums"]["forma_pagamento"] | null
          funcionario_id?: string
          id?: string
          observacoes?: string | null
          periodo_fim?: string
          periodo_inicio?: string
          status?: Database["public"]["Enums"]["status_pagamento"]
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      produtos: {
        Row: {
          categoria: Database["public"]["Enums"]["categoria_produto"]
          created_at: string
          fornecedor: string | null
          id: string
          nome: string
          observacoes: string | null
          unidade: string
          valor_unitario: number
        }
        Insert: {
          categoria?: Database["public"]["Enums"]["categoria_produto"]
          created_at?: string
          fornecedor?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          unidade?: string
          valor_unitario?: number
        }
        Update: {
          categoria?: Database["public"]["Enums"]["categoria_produto"]
          created_at?: string
          fornecedor?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          unidade?: string
          valor_unitario?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          ativo: boolean
          created_at: string
          email: string
          funcionario_id: string | null
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          email: string
          funcionario_id?: string | null
          id: string
          nome: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          email?: string
          funcionario_id?: string | null
          id?: string
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_funcionario_fk"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
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
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "proprietario" | "gerente" | "funcionario" | "admin"
      categoria_despesa: "combustivel" | "alimentacao" | "hospedagem" | "outros"
      categoria_produto: "drywall" | "masticagem" | "fixacao" | "epi" | "outros"
      forma_pagamento: "dinheiro" | "pix" | "transferencia"
      funcao_funcionario: "drywall" | "masticagem" | "auxiliar" | "outro"
      status_funcionario: "ativo" | "afastado" | "desligado"
      status_obra:
        | "orcamento"
        | "em_andamento"
        | "pausada"
        | "concluida"
        | "cancelada"
      status_pagamento: "pendente" | "pago"
      tipo_remuneracao: "hora" | "diaria" | "mensal"
      tipo_servico: "drywall" | "masticagem" | "drywall_masticagem"
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
      app_role: ["proprietario", "gerente", "funcionario", "admin"],
      categoria_despesa: ["combustivel", "alimentacao", "hospedagem", "outros"],
      categoria_produto: ["drywall", "masticagem", "fixacao", "epi", "outros"],
      forma_pagamento: ["dinheiro", "pix", "transferencia"],
      funcao_funcionario: ["drywall", "masticagem", "auxiliar", "outro"],
      status_funcionario: ["ativo", "afastado", "desligado"],
      status_obra: [
        "orcamento",
        "em_andamento",
        "pausada",
        "concluida",
        "cancelada",
      ],
      status_pagamento: ["pendente", "pago"],
      tipo_remuneracao: ["hora", "diaria", "mensal"],
      tipo_servico: ["drywall", "masticagem", "drywall_masticagem"],
    },
  },
} as const
