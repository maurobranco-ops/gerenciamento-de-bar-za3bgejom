import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

interface AdminRequest {
  action: 'list' | 'create' | 'update_role' | 'reset_password'
  email?: string
  password?: string
  name?: string
  perfil?: 'garcom' | 'caixa' | 'gerente'
  userId?: string
  ativo?: boolean
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Cabeçalho de autorização não fornecido.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Cria cliente com o token do chamador para verificar quem é
    const callerClient = createClient(supabaseUrl, supabaseAnonKey || supabaseServiceRoleKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    })

    const {
      data: { user: callerUser },
      error: userErr,
    } = await callerClient.auth.getUser()

    if (userErr || !callerUser) {
      return new Response(
        JSON.stringify({ error: 'Sessão inválida ou expirada. Faça login novamente.' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    // Verifica se o chamador possui perfil de gerente
    const { data: callerProfile, error: profileErr } = await callerClient
      .from('perfis_usuarios')
      .select('perfil, ativo')
      .eq('id', callerUser.id)
      .maybeSingle()

    if (
      profileErr ||
      !callerProfile ||
      callerProfile.perfil !== 'gerente' ||
      !callerProfile.ativo
    ) {
      return new Response(
        JSON.stringify({
          error: 'Acesso negado: apenas usuários com perfil Gerente podem gerenciar a equipe.',
        }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    // Cliente admin com service role (se disponível) para tocar no Auth do Supabase
    // Fallback: executa as RPCs autenticadas do callerClient (admin_*)
    const adminClient = supabaseServiceRoleKey
      ? createClient(supabaseUrl, supabaseServiceRoleKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        })
      : callerClient

    const body: AdminRequest = await req.json()
    const { action } = body

    if (action === 'list') {
      const { data, error } = await callerClient.rpc('admin_listar_usuarios')
      if (error) throw error
      return new Response(JSON.stringify({ usuarios: data || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'create') {
      const { email, password, name, perfil } = body
      if (!email || !password) {
        return new Response(JSON.stringify({ error: 'E-mail e senha são obrigatórios.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      if (password.length < 6) {
        return new Response(
          JSON.stringify({ error: 'A senha deve conter no mínimo 6 caracteres.' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        )
      }

      // Executa via RPC de segurança (já compatível com GoTrue e triggers)
      const { data, error } = await callerClient.rpc('admin_criar_usuario', {
        p_email: email.trim().toLowerCase(),
        p_senha: password,
        p_nome: name?.trim() || '',
        p_perfil: perfil || 'garcom',
      })
      if (error) throw error

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'update_role') {
      const { userId, perfil, name, ativo } = body
      if (!userId || !perfil) {
        return new Response(
          JSON.stringify({ error: 'ID do usuário e novo perfil são obrigatórios.' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        )
      }

      const { data, error } = await callerClient.rpc('admin_atualizar_perfil_usuario', {
        p_user_id: userId,
        p_novo_perfil: perfil,
        p_novo_nome: name ?? null,
        p_ativo: ativo !== undefined ? ativo : null,
      })
      if (error) throw error

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'reset_password') {
      const { userId, password } = body
      if (!userId || !password) {
        return new Response(JSON.stringify({ error: 'ID e nova senha são obrigatórios.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { data, error } = await callerClient.rpc('admin_redefinir_senha_usuario', {
        p_user_id: userId,
        p_nova_senha: password,
      })
      if (error) throw error

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: 'Ação não reconhecida.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || 'Erro interno no servidor.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
