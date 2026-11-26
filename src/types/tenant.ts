// Fase 1 multi-tenant: tipos de estabelecimento (tenant)
export interface Estabelecimento {
  id: string
  nome: string
  cnpj: string | null
  ativo: boolean
  config: Record<string, any> | null
  criado_em?: string
  atualizado_em?: string
}
