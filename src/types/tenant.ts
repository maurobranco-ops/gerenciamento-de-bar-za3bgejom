// Fase 1 multi-tenant: tipos de estabelecimento (tenant)
export interface Estabelecimento {
  id: string
  nome: string
  cnpj: string | null
  ativo: boolean
  config: Record<string, any> | null
  criado_em?: string
  atualizado_em?: string
  endereco?: string | null
}

// Fase 2: linha retornada pela RPC gerente_listar_estabelecimentos
export interface EstabelecimentoComContagens extends Estabelecimento {
  criado_por?: string | null
  qtd_mesas: number
  qtd_usuarios: number
}

// Fase 2: linha retornada pela RPC gerente_listar_usuarios_estabelecimento
export interface UsuarioEstabelecimento {
  usuario_id: string
  email: string
  nome_exibicao: string
  perfil: 'garcom' | 'caixa' | 'gerente' | 'cozinha'
  ativo: boolean
  tenant_id: string | null
  vinculado: boolean
  last_sign_in_at?: string | null
}

export type PerfilUsuario = 'garcom' | 'caixa' | 'gerente' | 'cozinha'
