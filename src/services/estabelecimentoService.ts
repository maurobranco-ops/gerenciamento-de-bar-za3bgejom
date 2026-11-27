import { supabase } from '@/lib/supabase/client'
import type {
  EstabelecimentoComContagens,
  UsuarioEstabelecimento,
  PerfilUsuario,
} from '@/types/tenant'

// Bypass de tipo estático enquanto os types gerados não refletem as RPCs da Fase 2
const db = supabase as any

export const EstabelecimentoService = {
  /** Lista todos os estabelecimentos com contagem de mesas e usuários (RPC gerente) */
  async listar(): Promise<EstabelecimentoComContagens[]> {
    const { data, error } = await db.rpc('gerente_listar_estabelecimentos')
    if (error) {
      console.error('Erro ao listar estabelecimentos:', error)
      throw error
    }
    return (data || []) as EstabelecimentoComContagens[]
  },

  /** Cria estabelecimento + mesas iniciais + configurações padrão (Pix = CNPJ) */
  async criar(params: {
    nome: string
    cnpj: string
    endereco: string
    qtdMesas: number
  }): Promise<{ id: string; qtd_mesas: number; mensagem: string }> {
    const { data, error } = await db.rpc('gerente_criar_estabelecimento', {
      p_nome: params.nome,
      p_cnpj: params.cnpj,
      p_endereco: params.endereco,
      p_qtd_mesas: params.qtdMesas,
    })
    if (error) {
      console.error('Erro ao criar estabelecimento:', error)
      throw error
    }
    return data
  },

  /** Edita dados e ativa/desativa (RPC gerente; valida escopo no backend) */
  async atualizar(params: {
    id: string
    nome: string
    cnpj: string
    endereco: string
    ativo: boolean
  }): Promise<void> {
    const { error } = await db.rpc('gerente_atualizar_estabelecimento', {
      p_id: params.id,
      p_nome: params.nome,
      p_cnpj: params.cnpj,
      p_endereco: params.endereco,
      p_ativo: params.ativo,
    })
    if (error) {
      console.error('Erro ao atualizar estabelecimento:', error)
      throw error
    }
  },

  /** Usuários (auth) com vínculo atual ao estabelecimento informado */
  async listarUsuarios(estabelecimentoId: string): Promise<UsuarioEstabelecimento[]> {
    const { data, error } = await db.rpc('gerente_listar_usuarios_estabelecimento', {
      p_estabelecimento_id: estabelecimentoId,
    })
    if (error) {
      console.error('Erro ao listar usuários do estabelecimento:', error)
      throw error
    }
    return (data || []) as UsuarioEstabelecimento[]
  },

  /** Cria novo auth user já vinculado ao estabelecimento */
  async criarUsuario(params: {
    estabelecimentoId: string
    email: string
    senha: string
    nome: string
    perfil: PerfilUsuario
  }): Promise<void> {
    const { error } = await db.rpc('gerente_criar_usuario_estabelecimento', {
      p_estabelecimento_id: params.estabelecimentoId,
      p_email: params.email,
      p_senha: params.senha,
      p_nome: params.nome,
      p_perfil: params.perfil,
    })
    if (error) {
      console.error('Erro ao criar usuário para estabelecimento:', error)
      throw error
    }
  },

  /** Vincula (ou re-vincula, mudando perfil) um usuário existente */
  async vincularUsuario(params: {
    userId: string
    estabelecimentoId: string
    perfil: PerfilUsuario
  }): Promise<void> {
    const { error } = await db.rpc('gerente_vincular_usuario', {
      p_user_id: params.userId,
      p_estabelecimento_id: params.estabelecimentoId,
      p_perfil: params.perfil,
      p_usuario_ativo: true,
    })
    if (error) {
      console.error('Erro ao vincular usuário:', error)
      throw error
    }
  },

  /** Desvincula: marca perfil como inativo (sem acesso até novo vínculo) */
  async desvincularUsuario(userId: string): Promise<void> {
    const { error } = await db.rpc('gerente_desvincular_usuario', { p_user_id: userId })
    if (error) {
      console.error('Erro ao desvincular usuário:', error)
      throw error
    }
  },

  // ===== Administração da PLATAFORMA (perfil 'admin') =====
  // RPCs com verificação de perfil admin no banco — ignoram o escopo por tenant.

  /** Lista TODOS os estabelecimentos (ativos e inativos) de todos os tenants */
  async adminListar(): Promise<EstabelecimentoComContagens[]> {
    const { data, error } = await db.rpc('admin_listar_estabelecimentos')
    if (error) {
      console.error('Erro ao listar estabelecimentos (admin):', error)
      throw error
    }
    return (data || []) as EstabelecimentoComContagens[]
  },

  /** Cria novo estabelecimento (nasce ativo, com mesas e configurações padrão) */
  async adminCriar(params: {
    nome: string
    cnpj: string
    endereco: string
    quantidade_mesas: number
  }): Promise<{ id: string; qtd_mesas: number; mensagem: string }> {
    const { data, error } = await db.rpc('admin_criar_estabelecimento', {
      p_nome: params.nome,
      p_cnpj: params.cnpj,
      p_endereco: params.endereco,
      p_qtd_mesas: params.quantidade_mesas,
    })
    if (error) {
      console.error('Erro ao criar estabelecimento (admin):', error)
      throw error
    }
    return data
  },

  /** Edita dados cadastrais do estabelecimento */
  async adminEditar(
    id: string,
    dados: { nome: string; cnpj: string; endereco: string; quantidade_mesas: number },
  ): Promise<void> {
    const { error } = await db.rpc('admin_atualizar_estabelecimento', {
      p_id: id,
      p_nome: dados.nome,
      p_cnpj: dados.cnpj,
      p_endereco: dados.endereco,
      p_quantidade_mesas: dados.quantidade_mesas,
    })
    if (error) {
      console.error('Erro ao editar estabelecimento (admin):', error)
      throw error
    }
  },

  /** Ativa/desativa (desativado some do seletor do login) */
  async adminAtivarDesativar(id: string, ativo: boolean): Promise<void> {
    const { error } = await db.rpc('admin_atualizar_estabelecimento', {
      p_id: id,
      p_ativo: ativo,
    })
    if (error) {
      console.error('Erro ao ativar/desativar estabelecimento (admin):', error)
      throw error
    }
  },
}
