// AVOID UPDATING THIS FILE DIRECTLY. It is automatically generated.
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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      caixa_diarios: {
        Row: {
          created_at: string
          data: string
          fechado: boolean
          fechado_em: string | null
          fechado_por: string | null
          saldo_abertura: number
        }
        Insert: {
          created_at?: string
          data: string
          fechado?: boolean
          fechado_em?: string | null
          fechado_por?: string | null
          saldo_abertura?: number
        }
        Update: {
          created_at?: string
          data?: string
          fechado?: boolean
          fechado_em?: string | null
          fechado_por?: string | null
          saldo_abertura?: number
        }
        Relationships: []
      }
      comanda_itens: {
        Row: {
          comanda_id: string
          created_at: string
          id: string
          nome_produto: string
          observacoes: string | null
          origem_online: boolean
          preco_unitario: number
          produto_id: string
          quantidade: number
          updated_at: string
        }
        Insert: {
          comanda_id: string
          created_at?: string
          id: string
          nome_produto: string
          observacoes?: string | null
          origem_online?: boolean
          preco_unitario?: number
          produto_id: string
          quantidade?: number
          updated_at?: string
        }
        Update: {
          comanda_id?: string
          created_at?: string
          id?: string
          nome_produto?: string
          observacoes?: string | null
          origem_online?: boolean
          preco_unitario?: number
          produto_id?: string
          quantidade?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comanda_itens_comanda_id_fkey"
            columns: ["comanda_id"]
            isOneToOne: false
            referencedRelation: "comandas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comanda_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      comandas: {
        Row: {
          aberta_em: string | null
          cliente_nome: string | null
          conta_solicitada: boolean
          conta_solicitada_em: string | null
          created_at: string
          fechada_em: string | null
          forma_pagamento_solicitada: string | null
          garcom: string | null
          id: string
          inclui_taxa_servico: boolean
          mesa_numero: number
          motivo_recusa_conta: string | null
          nfce_documento_id: string | null
          nfce_solicitada: boolean
          pessoas: number
          status: string
          status_conta: string
          total: number
          updated_at: string
        }
        Insert: {
          aberta_em?: string | null
          cliente_nome?: string | null
          conta_solicitada?: boolean
          conta_solicitada_em?: string | null
          created_at?: string
          fechada_em?: string | null
          forma_pagamento_solicitada?: string | null
          garcom?: string | null
          id: string
          inclui_taxa_servico?: boolean
          mesa_numero: number
          motivo_recusa_conta?: string | null
          nfce_documento_id?: string | null
          nfce_solicitada?: boolean
          pessoas?: number
          status?: string
          status_conta?: string
          total?: number
          updated_at?: string
        }
        Update: {
          aberta_em?: string | null
          cliente_nome?: string | null
          conta_solicitada?: boolean
          conta_solicitada_em?: string | null
          created_at?: string
          fechada_em?: string | null
          forma_pagamento_solicitada?: string | null
          garcom?: string | null
          id?: string
          inclui_taxa_servico?: boolean
          mesa_numero?: number
          motivo_recusa_conta?: string | null
          nfce_documento_id?: string | null
          nfce_solicitada?: boolean
          pessoas?: number
          status?: string
          status_conta?: string
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comandas_mesa_numero_fkey"
            columns: ["mesa_numero"]
            isOneToOne: false
            referencedRelation: "mesas"
            referencedColumns: ["numero"]
          },
        ]
      }
      configuracoes_bar: {
        Row: {
          cnpj: string
          created_at: string
          endereco_completo: string
          id: string
          impressora_cozinha_ativa: boolean
          impressora_cozinha_nome: string
          impressora_fiscal_ativa: boolean
          impressora_fiscal_nome: string
          inscricao_estadual: string
          nome_fantasia: string
          pix_beneficiario_nome: string
          pix_chave: string
          pix_cidade: string
          razao_social: string
          taxa_entrega_delivery: number
          taxa_servico_padrao: number
          telefone: string
          updated_at: string
        }
        Insert: {
          cnpj?: string
          created_at?: string
          endereco_completo?: string
          id?: string
          impressora_cozinha_ativa?: boolean
          impressora_cozinha_nome?: string
          impressora_fiscal_ativa?: boolean
          impressora_fiscal_nome?: string
          inscricao_estadual?: string
          nome_fantasia?: string
          pix_beneficiario_nome?: string
          pix_chave?: string
          pix_cidade?: string
          razao_social?: string
          taxa_entrega_delivery?: number
          taxa_servico_padrao?: number
          telefone?: string
          updated_at?: string
        }
        Update: {
          cnpj?: string
          created_at?: string
          endereco_completo?: string
          id?: string
          impressora_cozinha_ativa?: boolean
          impressora_cozinha_nome?: string
          impressora_fiscal_ativa?: boolean
          impressora_fiscal_nome?: string
          inscricao_estadual?: string
          nome_fantasia?: string
          pix_beneficiario_nome?: string
          pix_chave?: string
          pix_cidade?: string
          razao_social?: string
          taxa_entrega_delivery?: number
          taxa_servico_padrao?: number
          telefone?: string
          updated_at?: string
        }
        Relationships: []
      }
      documentos_fiscais: {
        Row: {
          chave_acesso: string | null
          comanda_id: string | null
          created_at: string
          documento_cliente: string | null
          emitido_em: string
          id: string
          nome_cliente: string | null
          numero: string
          serie: string
          status: string
          tipo: string
          valor: number
        }
        Insert: {
          chave_acesso?: string | null
          comanda_id?: string | null
          created_at?: string
          documento_cliente?: string | null
          emitido_em?: string
          id: string
          nome_cliente?: string | null
          numero: string
          serie?: string
          status?: string
          tipo: string
          valor?: number
        }
        Update: {
          chave_acesso?: string | null
          comanda_id?: string | null
          created_at?: string
          documento_cliente?: string | null
          emitido_em?: string
          id?: string
          nome_cliente?: string | null
          numero?: string
          serie?: string
          status?: string
          tipo?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "documentos_fiscais_comanda_id_fkey"
            columns: ["comanda_id"]
            isOneToOne: false
            referencedRelation: "comandas"
            referencedColumns: ["id"]
          },
        ]
      }
      fila_cozinha: {
        Row: {
          area_preparo: string
          comanda_item_id: string | null
          created_at: string
          id: string
          observacoes: string | null
          origem_online: boolean
          status: string
          updated_at: string
        }
        Insert: {
          area_preparo: string
          comanda_item_id?: string | null
          created_at?: string
          id?: string
          observacoes?: string | null
          origem_online?: boolean
          status?: string
          updated_at?: string
        }
        Update: {
          area_preparo?: string
          comanda_item_id?: string | null
          created_at?: string
          id?: string
          observacoes?: string | null
          origem_online?: boolean
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fila_cozinha_comanda_item_id_fkey"
            columns: ["comanda_item_id"]
            isOneToOne: false
            referencedRelation: "comanda_itens"
            referencedColumns: ["id"]
          },
        ]
      }
      mesas: {
        Row: {
          capacidade: number
          created_at: string
          id: string
          numero: number
          status: string
          updated_at: string
        }
        Insert: {
          capacidade?: number
          created_at?: string
          id?: string
          numero: number
          status?: string
          updated_at?: string
        }
        Update: {
          capacidade?: number
          created_at?: string
          id?: string
          numero?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      movimentacoes_estoque: {
        Row: {
          created_at: string
          data_hora: string
          fornecedor: string | null
          id: string
          motivo: string | null
          nome_produto: string
          produto_id: string
          quantidade: number
          tipo: string
          unidade: string
          usuario: string
        }
        Insert: {
          created_at?: string
          data_hora?: string
          fornecedor?: string | null
          id: string
          motivo?: string | null
          nome_produto: string
          produto_id: string
          quantidade: number
          tipo: string
          unidade: string
          usuario: string
        }
        Update: {
          created_at?: string
          data_hora?: string
          fornecedor?: string | null
          id?: string
          motivo?: string | null
          nome_produto?: string
          produto_id?: string
          quantidade?: number
          tipo?: string
          unidade?: string
          usuario?: string
        }
        Relationships: [
          {
            foreignKeyName: "movimentacoes_estoque_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      movimentos_caixa: {
        Row: {
          comanda_id: string | null
          created_at: string
          data_hora: string
          descricao: string
          forma_pagamento: string | null
          id: string
          tipo: string
          usuario: string
          valor: number
        }
        Insert: {
          comanda_id?: string | null
          created_at?: string
          data_hora?: string
          descricao: string
          forma_pagamento?: string | null
          id: string
          tipo: string
          usuario: string
          valor?: number
        }
        Update: {
          comanda_id?: string | null
          created_at?: string
          data_hora?: string
          descricao?: string
          forma_pagamento?: string | null
          id?: string
          tipo?: string
          usuario?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "movimentos_caixa_comanda_id_fkey"
            columns: ["comanda_id"]
            isOneToOne: false
            referencedRelation: "comandas"
            referencedColumns: ["id"]
          },
        ]
      }
      perfis_usuarios: {
        Row: {
          ativo: boolean
          created_at: string
          email: string
          id: string
          nome_exibicao: string
          perfil: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          email?: string
          id: string
          nome_exibicao?: string
          perfil?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          email?: string
          id?: string
          nome_exibicao?: string
          perfil?: string
          updated_at?: string
        }
        Relationships: []
      }
      produtos: {
        Row: {
          area_preparo: string
          ativo: boolean
          categoria: string
          created_at: string
          descricao: string
          estoque: number
          estoque_minimo: number
          id: string
          image_url: string | null
          nome: string
          preco: number
          unidade: string
          updated_at: string
        }
        Insert: {
          area_preparo?: string
          ativo?: boolean
          categoria: string
          created_at?: string
          descricao?: string
          estoque?: number
          estoque_minimo?: number
          id: string
          image_url?: string | null
          nome: string
          preco?: number
          unidade: string
          updated_at?: string
        }
        Update: {
          area_preparo?: string
          ativo?: boolean
          categoria?: string
          created_at?: string
          descricao?: string
          estoque?: number
          estoque_minimo?: number
          id?: string
          image_url?: string | null
          nome?: string
          preco?: number
          unidade?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      abater_estoque_comanda: {
        Args: { p_delta: number; p_produto_id: string }
        Returns: number
      }
      admin_atualizar_perfil_usuario: {
        Args: {
          p_ativo?: boolean
          p_novo_nome?: string
          p_novo_perfil: string
          p_user_id: string
        }
        Returns: Json
      }
      admin_criar_usuario: {
        Args: {
          p_email: string
          p_nome: string
          p_perfil: string
          p_senha: string
        }
        Returns: Json
      }
      admin_listar_usuarios: {
        Args: never
        Returns: {
          ativo: boolean
          created_at: string
          email: string
          id: string
          last_sign_in_at: string
          nome_exibicao: string
          perfil: string
        }[]
      }
      admin_redefinir_senha_usuario: {
        Args: { p_nova_senha: string; p_user_id: string }
        Returns: Json
      }
      atualizar_status_item_fila: {
        Args: { p_item_id: string; p_novo_status: string }
        Returns: Json
      }
      caixa_autorizar_fechar_conta: {
        Args: {
          p_forma_pagamento: string
          p_marcar_em_processamento_pix?: boolean
          p_mesa_numero: number
          p_valor_pago: number
        }
        Returns: Json
      }
      caixa_recusar_adiar_conta: {
        Args: { p_mesa_numero: number; p_motivo: string }
        Returns: Json
      }
      cancelar_documento_fiscal: {
        Args: { p_documento_id: string }
        Returns: boolean
      }
      enviar_pedido_online: {
        Args: { p_cliente_nome: string; p_itens: Json; p_mesa_numero: number }
        Returns: Json
      }
      gerente_atualizar_capacidade_mesa: {
        Args: { p_capacidade: number; p_mesa_id: string }
        Returns: boolean
      }
      get_current_user_profile: { Args: never; Returns: string }
      iniciar_atendimento_online: {
        Args: { p_cliente_nome: string; p_mesa_numero: number }
        Returns: Json
      }
      is_caixa: { Args: never; Returns: boolean }
      is_cozinha: { Args: never; Returns: boolean }
      is_garcom: { Args: never; Returns: boolean }
      is_gerente: { Args: never; Returns: boolean }
      is_operador_cozinha: { Args: never; Returns: boolean }
      obter_detalhes_conta_mesa: {
        Args: { p_mesa_numero: number }
        Returns: Json
      }
      obter_nfce_comanda_mesa: {
        Args: { p_mesa_numero: number }
        Returns: Json
      }
      obter_status_pedido_mesa: {
        Args: { p_comanda_id?: string; p_mesa_numero?: number }
        Returns: {
          area_preparo: string
          categoria: string
          comanda_id: string
          comanda_item_id: string
          created_at: string
          fila_id: string
          image_url: string
          mesa_numero: number
          nome_produto: string
          observacoes: string
          origem_online: boolean
          produto_id: string
          quantidade: number
          status: string
          updated_at: string
        }[]
      }
      registrar_movimento_caixa_seguro: {
        Args: {
          p_comanda_id?: string
          p_descricao: string
          p_forma_pagamento: string
          p_id: string
          p_tipo: string
          p_valor: number
        }
        Returns: Json
      }
      solicitar_conta_mesa:
        | {
            Args: { p_forma_pagamento: string; p_mesa_numero: number }
            Returns: Json
          }
        | {
            Args: {
              p_deseja_nfce?: boolean
              p_forma_pagamento: string
              p_mesa_numero: number
            }
            Returns: Json
          }
      transferir_mesa_atendimento: {
        Args: { p_mesa_destino: number; p_mesa_origem: number }
        Returns: Json
      }
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
    Enums: {},
  },
} as const

