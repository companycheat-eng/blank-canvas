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
      bairros: {
        Row: {
          ativo: boolean
          cidade: string
          cidade_inteira: boolean
          created_at: string
          estado: string
          id: string
          lat: number | null
          lng: number | null
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cidade?: string
          cidade_inteira?: boolean
          created_at?: string
          estado?: string
          id?: string
          lat?: number | null
          lng?: number | null
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cidade?: string
          cidade_inteira?: boolean
          created_at?: string
          estado?: string
          id?: string
          lat?: number | null
          lng?: number | null
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      categorias_itens: {
        Row: {
          ativo: boolean
          created_at: string
          icone: string | null
          id: string
          nome: string
          ordem: number | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          icone?: string | null
          id?: string
          nome: string
          ordem?: number | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          icone?: string | null
          id?: string
          nome?: string
          ordem?: number | null
        }
        Relationships: []
      }
      chat_mensagens: {
        Row: {
          autor_id: string
          autor_tipo: Database["public"]["Enums"]["autor_tipo"]
          corrida_id: string
          created_at: string
          id: string
          texto: string
        }
        Insert: {
          autor_id: string
          autor_tipo: Database["public"]["Enums"]["autor_tipo"]
          corrida_id: string
          created_at?: string
          id?: string
          texto: string
        }
        Update: {
          autor_id?: string
          autor_tipo?: Database["public"]["Enums"]["autor_tipo"]
          corrida_id?: string
          created_at?: string
          id?: string
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_mensagens_corrida_id_fkey"
            columns: ["corrida_id"]
            isOneToOne: false
            referencedRelation: "corridas"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          bairro_id: string
          cpf: string
          created_at: string
          email: string | null
          foto_url: string | null
          id: string
          nome: string
          status: string
          suspenso_ate: string | null
          telefone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bairro_id: string
          cpf: string
          created_at?: string
          email?: string | null
          foto_url?: string | null
          id?: string
          nome?: string
          status?: string
          suspenso_ate?: string | null
          telefone: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bairro_id?: string
          cpf?: string
          created_at?: string
          email?: string | null
          foto_url?: string | null
          id?: string
          nome?: string
          status?: string
          suspenso_ate?: string | null
          telefone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clientes_bairro_id_fkey"
            columns: ["bairro_id"]
            isOneToOne: false
            referencedRelation: "bairros"
            referencedColumns: ["id"]
          },
        ]
      }
      config_bairro: {
        Row: {
          bairro_id: string
          id: string
          key: string
          value: Json
        }
        Insert: {
          bairro_id: string
          id?: string
          key: string
          value?: Json
        }
        Update: {
          bairro_id?: string
          id?: string
          key?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "config_bairro_bairro_id_fkey"
            columns: ["bairro_id"]
            isOneToOne: false
            referencedRelation: "bairros"
            referencedColumns: ["id"]
          },
        ]
      }
      config_global: {
        Row: {
          descricao: string | null
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          descricao?: string | null
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          descricao?: string | null
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      contra_propostas: {
        Row: {
          corrida_id: string
          created_at: string
          id: string
          motorista_foto_url: string | null
          motorista_id: string
          motorista_nome: string
          motorista_nota: number
          motorista_placa: string | null
          motorista_veiculo: string | null
          status: string
          valor: number
        }
        Insert: {
          corrida_id: string
          created_at?: string
          id?: string
          motorista_foto_url?: string | null
          motorista_id: string
          motorista_nome?: string
          motorista_nota?: number
          motorista_placa?: string | null
          motorista_veiculo?: string | null
          status?: string
          valor: number
        }
        Update: {
          corrida_id?: string
          created_at?: string
          id?: string
          motorista_foto_url?: string | null
          motorista_id?: string
          motorista_nome?: string
          motorista_nota?: number
          motorista_placa?: string | null
          motorista_veiculo?: string | null
          status?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "contra_propostas_corrida_id_fkey"
            columns: ["corrida_id"]
            isOneToOne: false
            referencedRelation: "corridas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contra_propostas_motorista_id_fkey"
            columns: ["motorista_id"]
            isOneToOne: false
            referencedRelation: "motoristas"
            referencedColumns: ["id"]
          },
        ]
      }
      corrida_itens: {
        Row: {
          corrida_id: string
          id: string
          item_id: string
          preco_unit: number
          qtd: number
          subtotal: number
        }
        Insert: {
          corrida_id: string
          id?: string
          item_id: string
          preco_unit: number
          qtd?: number
          subtotal: number
        }
        Update: {
          corrida_id?: string
          id?: string
          item_id?: string
          preco_unit?: number
          qtd?: number
          subtotal?: number
        }
        Relationships: [
          {
            foreignKeyName: "corrida_itens_corrida_id_fkey"
            columns: ["corrida_id"]
            isOneToOne: false
            referencedRelation: "corridas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "corrida_itens_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "itens_global"
            referencedColumns: ["id"]
          },
        ]
      }
      corridas: {
        Row: {
          bairro_id: string
          cancelado_por: string | null
          cliente_foto_url: string | null
          cliente_id: string
          cliente_nome: string
          codigo_coleta: string | null
          codigo_entrega: string | null
          com_ajudante: boolean
          contra_proposta_at: string | null
          contra_proposta_valor: number | null
          created_at: string
          destino_lat: number
          destino_lng: number
          destino_texto: string
          distancia_km: number | null
          duracao_min: number | null
          forma_pagamento: string
          id: string
          motorista_id: string | null
          origem_lat: number
          origem_lng: number
          origem_texto: string
          preco_ajudante: number
          preco_itens: number
          preco_km: number
          preco_total_estimado: number
          status: Database["public"]["Enums"]["corrida_status"]
          taxa_creditos_debitada: number | null
          taxa_pct_usada: number | null
          updated_at: string
        }
        Insert: {
          bairro_id: string
          cancelado_por?: string | null
          cliente_foto_url?: string | null
          cliente_id: string
          cliente_nome?: string
          codigo_coleta?: string | null
          codigo_entrega?: string | null
          com_ajudante?: boolean
          contra_proposta_at?: string | null
          contra_proposta_valor?: number | null
          created_at?: string
          destino_lat: number
          destino_lng: number
          destino_texto: string
          distancia_km?: number | null
          duracao_min?: number | null
          forma_pagamento?: string
          id?: string
          motorista_id?: string | null
          origem_lat: number
          origem_lng: number
          origem_texto: string
          preco_ajudante?: number
          preco_itens?: number
          preco_km?: number
          preco_total_estimado?: number
          status?: Database["public"]["Enums"]["corrida_status"]
          taxa_creditos_debitada?: number | null
          taxa_pct_usada?: number | null
          updated_at?: string
        }
        Update: {
          bairro_id?: string
          cancelado_por?: string | null
          cliente_foto_url?: string | null
          cliente_id?: string
          cliente_nome?: string
          codigo_coleta?: string | null
          codigo_entrega?: string | null
          com_ajudante?: boolean
          contra_proposta_at?: string | null
          contra_proposta_valor?: number | null
          created_at?: string
          destino_lat?: number
          destino_lng?: number
          destino_texto?: string
          distancia_km?: number | null
          duracao_min?: number | null
          forma_pagamento?: string
          id?: string
          motorista_id?: string | null
          origem_lat?: number
          origem_lng?: number
          origem_texto?: string
          preco_ajudante?: number
          preco_itens?: number
          preco_km?: number
          preco_total_estimado?: number
          status?: Database["public"]["Enums"]["corrida_status"]
          taxa_creditos_debitada?: number | null
          taxa_pct_usada?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "corridas_bairro_id_fkey"
            columns: ["bairro_id"]
            isOneToOne: false
            referencedRelation: "bairros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "corridas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "corridas_motorista_id_fkey"
            columns: ["motorista_id"]
            isOneToOne: false
            referencedRelation: "motoristas"
            referencedColumns: ["id"]
          },
        ]
      }
      itens_bairro_override: {
        Row: {
          ativo: boolean
          bairro_id: string
          id: string
          item_id: string
          preco_override: number
        }
        Insert: {
          ativo?: boolean
          bairro_id: string
          id?: string
          item_id: string
          preco_override: number
        }
        Update: {
          ativo?: boolean
          bairro_id?: string
          id?: string
          item_id?: string
          preco_override?: number
        }
        Relationships: [
          {
            foreignKeyName: "itens_bairro_override_bairro_id_fkey"
            columns: ["bairro_id"]
            isOneToOne: false
            referencedRelation: "bairros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itens_bairro_override_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "itens_global"
            referencedColumns: ["id"]
          },
        ]
      }
      itens_global: {
        Row: {
          ativo: boolean
          categoria_id: string | null
          created_at: string
          icone: string | null
          id: string
          nome: string
          preco_base: number
        }
        Insert: {
          ativo?: boolean
          categoria_id?: string | null
          created_at?: string
          icone?: string | null
          id?: string
          nome: string
          preco_base?: number
        }
        Update: {
          ativo?: boolean
          categoria_id?: string | null
          created_at?: string
          icone?: string | null
          id?: string
          nome?: string
          preco_base?: number
        }
        Relationships: [
          {
            foreignKeyName: "itens_global_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_itens"
            referencedColumns: ["id"]
          },
        ]
      }
      motoristas: {
        Row: {
          aceita_pagamento: string
          bairro_id: string
          cnh_url: string | null
          cor_veiculo: string | null
          cpf: string
          created_at: string
          doc_veiculo_url: string | null
          foto_url: string | null
          id: string
          kyc_motivo: string | null
          last_heading: number | null
          last_lat: number | null
          last_lng: number | null
          last_seen: string | null
          marca_veiculo: string | null
          nome: string
          nota_referencia: number
          placa: string | null
          saldo_creditos: number
          selfie_url: string | null
          status_kyc: Database["public"]["Enums"]["kyc_status"]
          status_online: Database["public"]["Enums"]["online_status"]
          suspenso_ate: string | null
          telefone: string
          tipo_veiculo: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          aceita_pagamento?: string
          bairro_id: string
          cnh_url?: string | null
          cor_veiculo?: string | null
          cpf: string
          created_at?: string
          doc_veiculo_url?: string | null
          foto_url?: string | null
          id?: string
          kyc_motivo?: string | null
          last_heading?: number | null
          last_lat?: number | null
          last_lng?: number | null
          last_seen?: string | null
          marca_veiculo?: string | null
          nome: string
          nota_referencia?: number
          placa?: string | null
          saldo_creditos?: number
          selfie_url?: string | null
          status_kyc?: Database["public"]["Enums"]["kyc_status"]
          status_online?: Database["public"]["Enums"]["online_status"]
          suspenso_ate?: string | null
          telefone: string
          tipo_veiculo?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          aceita_pagamento?: string
          bairro_id?: string
          cnh_url?: string | null
          cor_veiculo?: string | null
          cpf?: string
          created_at?: string
          doc_veiculo_url?: string | null
          foto_url?: string | null
          id?: string
          kyc_motivo?: string | null
          last_heading?: number | null
          last_lat?: number | null
          last_lng?: number | null
          last_seen?: string | null
          marca_veiculo?: string | null
          nome?: string
          nota_referencia?: number
          placa?: string | null
          saldo_creditos?: number
          selfie_url?: string | null
          status_kyc?: Database["public"]["Enums"]["kyc_status"]
          status_online?: Database["public"]["Enums"]["online_status"]
          suspenso_ate?: string | null
          telefone?: string
          tipo_veiculo?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "motoristas_bairro_id_fkey"
            columns: ["bairro_id"]
            isOneToOne: false
            referencedRelation: "bairros"
            referencedColumns: ["id"]
          },
        ]
      }
      password_reset_tokens: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          token: string
          used: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          token: string
          used?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          token?: string
          used?: boolean
          user_id?: string
        }
        Relationships: []
      }
      push_tokens: {
        Row: {
          created_at: string
          device: string | null
          id: string
          token: string
          user_id: string
          user_tipo: Database["public"]["Enums"]["user_tipo"]
        }
        Insert: {
          created_at?: string
          device?: string | null
          id?: string
          token: string
          user_id: string
          user_tipo: Database["public"]["Enums"]["user_tipo"]
        }
        Update: {
          created_at?: string
          device?: string | null
          id?: string
          token?: string
          user_id?: string
          user_tipo?: Database["public"]["Enums"]["user_tipo"]
        }
        Relationships: []
      }
      recargas: {
        Row: {
          created_at: string
          creditos: number
          id: string
          motorista_id: string
          mp_payment_id: string | null
          pix_copia_cola: string | null
          pix_qr_code: string | null
          status: Database["public"]["Enums"]["recarga_status"]
          valor_brl: number
        }
        Insert: {
          created_at?: string
          creditos: number
          id?: string
          motorista_id: string
          mp_payment_id?: string | null
          pix_copia_cola?: string | null
          pix_qr_code?: string | null
          status?: Database["public"]["Enums"]["recarga_status"]
          valor_brl: number
        }
        Update: {
          created_at?: string
          creditos?: number
          id?: string
          motorista_id?: string
          mp_payment_id?: string | null
          pix_copia_cola?: string | null
          pix_qr_code?: string | null
          status?: Database["public"]["Enums"]["recarga_status"]
          valor_brl?: number
        }
        Relationships: [
          {
            foreignKeyName: "recargas_motorista_id_fkey"
            columns: ["motorista_id"]
            isOneToOne: false
            referencedRelation: "motoristas"
            referencedColumns: ["id"]
          },
        ]
      }
      suporte_mensagens: {
        Row: {
          autor_id: string
          autor_tipo: string
          created_at: string
          id: string
          texto: string
          ticket_id: string
        }
        Insert: {
          autor_id: string
          autor_tipo?: string
          created_at?: string
          id?: string
          texto: string
          ticket_id: string
        }
        Update: {
          autor_id?: string
          autor_tipo?: string
          created_at?: string
          id?: string
          texto?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "suporte_mensagens_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "suporte_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      suporte_tickets: {
        Row: {
          assunto: string
          created_at: string
          id: string
          status: string
          updated_at: string
          user_id: string
          user_tipo: Database["public"]["Enums"]["user_tipo"]
        }
        Insert: {
          assunto: string
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
          user_id: string
          user_tipo: Database["public"]["Enums"]["user_tipo"]
        }
        Update: {
          assunto?: string
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
          user_tipo?: Database["public"]["Enums"]["user_tipo"]
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          bairro_id: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          bairro_id?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          bairro_id?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_bairro_id_fkey"
            columns: ["bairro_id"]
            isOneToOne: false
            referencedRelation: "bairros"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_ledger: {
        Row: {
          created_at: string
          id: string
          motivo: string
          motorista_id: string
          ref_id: string | null
          tipo: Database["public"]["Enums"]["ledger_tipo"]
          valor: number
        }
        Insert: {
          created_at?: string
          id?: string
          motivo: string
          motorista_id: string
          ref_id?: string | null
          tipo: Database["public"]["Enums"]["ledger_tipo"]
          valor: number
        }
        Update: {
          created_at?: string
          id?: string
          motivo?: string
          motorista_id?: string
          ref_id?: string | null
          tipo?: Database["public"]["Enums"]["ledger_tipo"]
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "wallet_ledger_motorista_id_fkey"
            columns: ["motorista_id"]
            isOneToOne: false
            referencedRelation: "motoristas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      aceitar_contra_proposta:
        | { Args: { p_corrida_id: string }; Returns: Json }
        | {
            Args: { p_corrida_id: string; p_proposta_id?: string }
            Returns: Json
          }
      aceitar_corrida: {
        Args: { p_corrida_id: string; p_motorista_id: string }
        Returns: Json
      }
      cancelar_corrida_cliente: {
        Args: { p_cliente_id: string; p_corrida_id: string }
        Returns: Json
      }
      cancelar_corrida_motorista: {
        Args: { p_corrida_id: string; p_motorista_id: string }
        Returns: Json
      }
      cliente_pode_ver_motorista: {
        Args: { _motorista_id: string; _user_id: string }
        Returns: boolean
      }
      corridas_disponiveis_motorista: {
        Args: { p_excluir_ids?: string[]; p_motorista_id: string }
        Returns: {
          bairro_id: string
          cancelado_por: string | null
          cliente_foto_url: string | null
          cliente_id: string
          cliente_nome: string
          codigo_coleta: string | null
          codigo_entrega: string | null
          com_ajudante: boolean
          contra_proposta_at: string | null
          contra_proposta_valor: number | null
          created_at: string
          destino_lat: number
          destino_lng: number
          destino_texto: string
          distancia_km: number | null
          duracao_min: number | null
          forma_pagamento: string
          id: string
          motorista_id: string | null
          origem_lat: number
          origem_lng: number
          origem_texto: string
          preco_ajudante: number
          preco_itens: number
          preco_km: number
          preco_total_estimado: number
          status: Database["public"]["Enums"]["corrida_status"]
          taxa_creditos_debitada: number | null
          taxa_pct_usada: number | null
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "corridas"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      enviar_contra_proposta: {
        Args: { p_corrida_id: string; p_motorista_id: string; p_valor: number }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role_in_bairro: {
        Args: {
          _bairro_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      motorista_pode_ver_cliente: {
        Args: { _cliente_id: string; _user_id: string }
        Returns: boolean
      }
      recalcular_nota_motorista: {
        Args: { p_motorista_id: string }
        Returns: number
      }
    }
    Enums: {
      app_role: "admin_geral" | "admin_bairro" | "suporte"
      autor_tipo: "cliente" | "motorista" | "sistema"
      corrida_status:
        | "buscando"
        | "aceita"
        | "a_caminho"
        | "chegou"
        | "carregando"
        | "em_deslocamento"
        | "finalizada"
        | "cancelada"
        | "contra_proposta"
        | "recusada_cliente"
      kyc_status: "pendente_analise" | "aprovado" | "reprovado" | "bloqueado"
      ledger_tipo: "credito" | "debito"
      online_status: "online" | "offline"
      recarga_status: "pendente" | "aprovada" | "cancelada"
      user_tipo: "cliente" | "motorista"
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
      app_role: ["admin_geral", "admin_bairro", "suporte"],
      autor_tipo: ["cliente", "motorista", "sistema"],
      corrida_status: [
        "buscando",
        "aceita",
        "a_caminho",
        "chegou",
        "carregando",
        "em_deslocamento",
        "finalizada",
        "cancelada",
        "contra_proposta",
        "recusada_cliente",
      ],
      kyc_status: ["pendente_analise", "aprovado", "reprovado", "bloqueado"],
      ledger_tipo: ["credito", "debito"],
      online_status: ["online", "offline"],
      recarga_status: ["pendente", "aprovada", "cancelada"],
      user_tipo: ["cliente", "motorista"],
    },
  },
} as const
