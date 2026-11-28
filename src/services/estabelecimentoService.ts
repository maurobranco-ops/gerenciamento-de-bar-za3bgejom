import { supabase } from '@/lib/supabase/client'
import type {
  EstabelecimentoComContagens,
  UsuarioEstabelecimento,
  PerfilUsuario,
} from '@/types/tenant'

// Bypass de tipo estático enquanto os types gerados não refletem as RPCs da Fase 2
const db = supabase as any

/** Perfis que o admin da plataforma pode atribuir a usuários de um estabelecimento */
export type PerfilGestao = 'gerente' | 'garcom' | 'caixa' | 'cozinha'

export interface AdminUsuarioEstabelecimento {
  usuario_id: string
  email: string
  nome_exibicao: string
  perfil: string
  ativo: boolean
  last_sign_in_at: string | null
}

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
    if (data && typeof data === 'object' && 'error' in data) {
      console.error('Erro retornado pela RPC admin_criar_estabelecimento:', data)
      throw new Error(String((data as any).error))
    }
    if (error) {
      console.error('Erro ao criar estabelecimento (admin):', error)
      throw error
    }
    return data
  },

  /** Edita nome/CNPJ/endereço e ajusta mesas (ativa/desativa via adminAtivarDesativar) */
  async adminEditar(
    id: string,
    dados: { nome: string; cnpj: string; endereco: string; quantidade_mesas: number },
  ): Promise<void> {
    const { error } = await db.rpc('admin_atualizar_estabelecimento', {
      p_id: id,
      p_nome: dados.nome,
      p_cnpj: dados.cnpj,
      p_endereco: dados.endereco,
      p_ativo: true,
    })
    if (error) {
      console.error('Erro ao editar estabelecimento (admin):', error)
      throw error
    }
    await this.adminAjustarMesas(id, dados.quantidade_mesas)
  },

  /** Ajusta o número de mesas do estabelecimento (cria as que faltam) */
  async adminAjustarMesas(id: string, quantidadeMesas: number): Promise<void> {
    const { data, error } = await db.rpc('admin_ajustar_mesas', {
      p_estabelecimento_id: id,
      p_qtd_mesas: quantidadeMesas,
    })
    if (error) {
      console.error('Erro ao ajustar mesas (admin):', error)
      throw error
    }
    return data
  },

  /** Ativa/desativa (desativado some do seletor do login) */
  async adminAtivarDesativar(id: string, ativo: boolean): Promise<void> {
    const { data, error } = await db.rpc('admin_ativar_desativar_estabelecimento', {
      p_id: id,
      p_ativo: ativo,
    })
    if (data && typeof data === 'object' && 'error' in data) {
      console.error('Erro retornado pela RPC admin_ativar_desativar_estabelecimento:', data)
      throw new Error(String((data as any).error))
    }
    if (error) {
      console.error('Erro ao ativar/desativar estabelecimento (admin):', error)
      throw error
    }
  },

  // ===== Usuários de cada estabelecimento, geridos pelo admin da PLATAFORMA =====

  /** Usuários vinculados ao estabelecimento (RPC admin, sem depender de is_gerente) */
  async adminListarUsuarios(estabelecimentoId: string): Promise<AdminUsuarioEstabelecimento[]> {
    const { data, error } = await db.rpc('admin_listar_usuarios_estabelecimento', {
      p_estabelecimento_id: estabelecimentoId,
    })
    if (error) {
      console.error('Erro ao listar usuários do estabelecimento (admin):', error)
      throw error
    }
    return (data || []) as AdminUsuarioEstabelecimento[]
  },

  /** Cria usuário com senha provisória já vinculado ao estabelecimento escolhido */
  async adminCriarUsuario(params: {
    estabelecimentoId: string
    nome: string
    email: string
    senha: string
    perfil: PerfilGestao
  }): Promise<void> {
    const { data, error } = await db.rpc('admin_criar_usuario_estabelecimento', {
      p_estabelecimento_id: params.estabelecimentoId,
      p_email: params.email,
      p_senha: params.senha,
      p_nome: params.nome,
      p_perfil: params.perfil,
    })
    if (error) {
      console.error('Erro ao criar usuário do estabelecimento (admin):', error)
      throw error
    }
    if (data && typeof data === 'object' && 'error' in data) {
      throw new Error(String((data as any).error))
    }
  },

  /** Redefine a senha provisória de um usuário do estabelecimento */
  async adminRedefinirSenhaUsuario(
    estabelecimentoId: string,
    userId: string,
    senha: string,
  ): Promise<void> {
    const { error } = await db.rpc('admin_redefinir_senha_usuario_estabelecimento', {
      p_estabelecimento_id: estabelecimentoId,
      p_user_id: userId,
      p_nova_senha: senha,
    })
    if (error) {
      console.error('Erro ao redefinir senha (admin):', error)
      throw error
    }
  },

  /** Ativa/desativa um usuário do estabelecimento (desativado não consegue logar) */
  async adminAtivarUsuario(
    estabelecimentoId: string,
    userId: string,
    ativo: boolean,
  ): Promise<void> {
    const { error } = await db.rpc('admin_ativar_usuario_estabelecimento', {
      p_estabelecimento_id: estabelecimentoId,
      p_user_id: userId,
      p_ativo: ativo,
    })
    if (error) {
      console.error('Erro ao ativar/desativar usuário (admin):', error)
      throw error
    }
  },

  /** EXCLUI definitivamente um usuário do estabelecimento: remove o perfil e a conta de login (RPC admin, is_admin no banco) */
  async adminExcluirUsuario(estabelecimentoId: string, userId: string): Promise<void> {
    const { data, error } = await db.rpc('admin_excluir_usuario_estabelecimento', {
      p_estabelecimento_id: estabelecimentoId,
      p_user_id: userId,
    })
    if (data && typeof data === 'object' && 'error' in data) {
      console.error('Erro retornado pela RPC admin_excluir_usuario_estabelecimento:', data)
      throw new Error(String((data as any).error))
    }
    if (error) {
      console.error('Erro ao excluir usuário (admin):', error)
      throw error
    }
  },

  // ===== Cor de marca do PRÓPRIO estabelecimento (perfil Gerente, via RLS) =====

  /** Gerente define a cor primária do seu estabelecimento (tenant vem do perfil logado no banco) */
  async gerenteDefinirCorMarca(cor: string): Promise<void> {
    const { data, error } = await db.rpc('gerente_definir_cor_marca', { p_cor: cor })
    if (data && typeof data === 'object' && 'error' in data) {
      console.error('Erro retornado pela RPC gerente_definir_cor_marca:', data)
      throw new Error(String((data as any).error))
    }
    if (error) {
      console.error('Erro ao definir cor de marca:', error)
      throw error
    }
  },
}
