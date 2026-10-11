import { supabase } from '@/lib/supabase/client'

export interface ManagedUser {
  id: string
  email: string
  nome_exibicao: string
  perfil: 'garcom' | 'caixa' | 'gerente'
  ativo: boolean
  created_at?: string
  last_sign_in_at?: string
}

export const UserService = {
  /**
   * Lista todos os usuários. Tenta primeiro a edge function; se falhar/não disponível,
   * chama diretamente a RPC admin_listar_usuarios (que também valida public.is_gerente()).
   */
  async listUsers(): Promise<ManagedUser[]> {
    try {
      const { data, error } = await supabase.functions.invoke('admin-users', {
        body: { action: 'list' },
      })
      if (!error && data?.usuarios) {
        return data.usuarios
      }
    } catch {
      // continua para fallback via RPC direta
    }

    const { data: rpcData, error: rpcError } = await (supabase.rpc as any)('admin_listar_usuarios')
    if (rpcError) {
      console.error('Erro ao listar usuários via RPC:', rpcError)
      throw new Error(rpcError.message || 'Falha ao carregar lista de usuários.')
    }

    return (rpcData || []).map((u: any) => ({
      id: u.id,
      email: u.email,
      nome_exibicao: u.nome_exibicao,
      perfil: u.perfil,
      ativo: u.ativo !== false,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
    }))
  },

  /**
   * Cria um novo usuário com nome, e-mail, senha e perfil (garçom, caixa, gerente).
   */
  async createUser(payload: {
    nome: string
    email: string
    password: string
    perfil: 'garcom' | 'caixa' | 'gerente'
  }): Promise<{ sucesso: boolean; id: string; email: string }> {
    try {
      const { data, error } = await supabase.functions.invoke('admin-users', {
        body: {
          action: 'create',
          name: payload.nome,
          email: payload.email,
          password: payload.password,
          perfil: payload.perfil,
        },
      })
      if (!error && data?.sucesso) {
        return data
      }
      if (error && (data as any)?.error) {
        throw new Error((data as any).error)
      }
    } catch (edgeErr: any) {
      if (edgeErr.message && !edgeErr.message.includes('FunctionsFetchError')) {
        throw edgeErr
      }
    }

    // Fallback RPC direta autenticada
    const { data, error } = await (supabase.rpc as any)('admin_criar_usuario', {
      p_email: payload.email.trim().toLowerCase(),
      p_senha: payload.password,
      p_nome: payload.nome.trim(),
      p_perfil: payload.perfil,
    })

    if (error) {
      console.error('Erro ao criar usuário via RPC:', error)
      throw new Error(error.message || 'Falha ao cadastrar usuário.')
    }

    return data
  },

  /**
   * Atualiza o perfil e opcionalmente o nome de um usuário.
   */
  async updateUserRole(payload: {
    userId: string
    perfil: 'garcom' | 'caixa' | 'gerente'
    nome?: string
    ativo?: boolean
  }): Promise<{ sucesso: boolean }> {
    try {
      const { data, error } = await supabase.functions.invoke('admin-users', {
        body: {
          action: 'update_role',
          userId: payload.userId,
          perfil: payload.perfil,
          name: payload.nome,
          ativo: payload.ativo,
        },
      })
      if (!error && data?.sucesso) {
        return data
      }
      if (error && (data as any)?.error) {
        throw new Error((data as any).error)
      }
    } catch (edgeErr: any) {
      if (edgeErr.message && !edgeErr.message.includes('FunctionsFetchError')) {
        throw edgeErr
      }
    }

    // Fallback RPC direta
    const { data, error } = await (supabase.rpc as any)('admin_atualizar_perfil_usuario', {
      p_user_id: payload.userId,
      p_novo_perfil: payload.perfil,
      p_novo_nome: payload.nome?.trim() || null,
      p_ativo: payload.ativo !== undefined ? payload.ativo : null,
    })

    if (error) {
      console.error('Erro ao atualizar perfil via RPC:', error)
      throw new Error(error.message || 'Falha ao atualizar perfil do usuário.')
    }

    return data
  },

  /**
   * Redefine a senha de um usuário existente.
   */
  async resetPassword(userId: string, newPassword: string): Promise<{ sucesso: boolean }> {
    try {
      const { data, error } = await supabase.functions.invoke('admin-users', {
        body: {
          action: 'reset_password',
          userId,
          password: newPassword,
        },
      })
      if (!error && data?.sucesso) {
        return data
      }
      if (error && (data as any)?.error) {
        throw new Error((data as any).error)
      }
    } catch (edgeErr: any) {
      if (edgeErr.message && !edgeErr.message.includes('FunctionsFetchError')) {
        throw edgeErr
      }
    }

    // Fallback RPC direta
    const { data, error } = await (supabase.rpc as any)('admin_redefinir_senha_usuario', {
      p_user_id: userId,
      p_nova_senha: newPassword,
    })

    if (error) {
      console.error('Erro ao redefinir senha via RPC:', error)
      throw new Error(error.message || 'Falha ao redefinir senha.')
    }

    return data
  },
}
