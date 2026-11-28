import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'
import { UserRole } from '@/types/bar'
import { Estabelecimento } from '@/types/tenant'
import { TenantStorage } from '@/lib/tenantStorage'

export interface UserProfile {
  id: string
  email: string
  nome_exibicao: string
  perfil: 'garcom' | 'caixa' | 'gerente' | 'cozinha' | 'admin'
  ativo: boolean
  tenant_id: string | null
}

interface AuthContextType {
  user: User | null
  session: Session | null
  profile: UserProfile | null
  role: UserRole
  isAdmin: boolean
  loading: boolean
  estabelecimentos: Estabelecimento[]
  estabelecimentoAtivo: Estabelecimento | null
  setEstabelecimentoAtivo: (e: Estabelecimento | null) => void
  signIn: (email: string, password: string) => Promise<{ error: any }>
  signUp: (email: string, password: string) => Promise<{ error: any }>
  signOut: () => Promise<{ error: any }>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}

// 'admin' é o administrador da PLATAFORMA (não de um estabelecimento):
// mapeado para o papel reservado 'Admin' — só tem acesso à /admin
const mapPerfilToRole = (perfil?: string | null): UserRole => {
  if (perfil === 'admin') return 'Admin'
  if (perfil === 'gerente') return 'Gerente'
  if (perfil === 'caixa') return 'Caixa'
  if (perfil === 'cozinha') return 'Cozinha'
  return 'Garçom'
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [estabelecimentos, setEstabelecimentos] = useState<Estabelecimento[]>([])
  // O estabelecimentoAtivo NÃO inicia lendo o TenantStorage: a chave é
  // compartilhada entre usuários do mesmo aparelho e pode apontar para outro
  // estabelecimento. Ele é definido pelo perfil do usuário (ou pela escolha
  // explicita do admin) — nunca pela seleção antiga de outra sessão.
  const [estabelecimentoAtivo, setEstabelecimentoAtivoState] = useState<Estabelecimento | null>(
    null,
  )

  // Retorna o perfil carregado (ou null) para quem chamou — o signIn precisa
  // do tenant_id do perfil recém-logado para decidir o estabelecimento ativo.
  const fetchProfile = async (userId: string): Promise<UserProfile | null> => {
    try {
      // Limpa resquícios antigos de cache de override local caso ainda existam
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          window.localStorage.removeItem('rachide_bar_role')
        } catch {
          // ignore
        }
      }

      console.log('[useAuth] Buscando perfil de', userId)
      const { data, error } = await (supabase as any)
        .from('perfis_usuarios')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      if (!error && data) {
        // Perfil encontrado — incluindo perfil 'admin' da plataforma com
        // tenant_id nulo: NÃO é descartado, é um perfil válido.
        console.log('[useAuth] Perfil carregado:', {
          perfil: (data as any).perfil,
          tenant_id: (data as any).tenant_id,
          ativo: (data as any).ativo,
        })
        setProfile(data as unknown as UserProfile)
        console.log('[useAuth] Papel identificado:', mapPerfilToRole((data as any).perfil))
        return data as unknown as UserProfile
      } else {
        // Linha ausente (cadastro incompleto) ou bloqueada por RLS — visível
        // no console para diagnóstico do pós-login (ex.: admin sem tenant).
        console.error('[useAuth] Perfil NÃO carregado para', userId, error?.message)
        setProfile(null)
        return null
      }
    } catch (err) {
      console.error('[useAuth] Erro ao buscar perfil do usuário:', err)
      setProfile(null)
      return null
    }
  }

  // Fase 1 multi-tenant: lista de estabelecimentos disponíveis na sessão.
  // Enquanto o usuário não está autenticado, a lista pública de tenants ativos
  // alimenta o seletor da tela de login (tabela liberada em SELECT para anon).
  // Retorna a lista carregada para o signIn poder localizar o tenant do perfil.
  const fetchEstabelecimentos = async (): Promise<Estabelecimento[]> => {
    try {
      // Fase 1: a tabela estabelecimentos é pública em SELECT para ativos
      // (policy estabelecimentos_select_public) — mesma consulta no login e logado.
      const { data, error } = await (supabase as any)
        .from('estabelecimentos')
        .select('*')
        .eq('ativo', true)
        .order('nome', { ascending: true })
      if (!error && data) {
        setEstabelecimentos(data as Estabelecimento[])
        console.log('[useAuth] Estabelecimentos carregados:', data.length)
        return data as Estabelecimento[]
      } else {
        console.error('[useAuth] Erro ao buscar estabelecimentos:', error?.message)
      }
    } catch (err) {
      console.error('[useAuth] Erro inesperado ao buscar estabelecimentos:', err)
    }
    return []
  }

  useEffect(() => {
    // IMPORTANTE: o callback de onAuthStateChange NÃO faz chamadas ao client
    // Supabase (fetchProfile etc.) — consultar o banco dentro do callback causa
    // deadlock conhecido do supabase-js (goTrueClient trava o lock e o app fica
    // em loading infinito pós-login). Aqui só atualizamos estado sincronamente;
    // o perfil é buscado no useEffect abaixo, disparado pelo user.id.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, currentSession) => {
      console.log('[useAuth] onAuthStateChange:', event, 'com sessão:', !!currentSession)
      setSession(currentSession)
      setUser(currentSession?.user ?? null)
      if (!currentSession?.user) {
        setProfile(null)
      }
      setLoading(false)
    })

    // Checagem inicial de sessão persistida — SEMPRE termina com loading=false
    // (com sessão, sem sessão ou com erro), nenhum caminho fica pendente.
    supabase.auth
      .getSession()
      .then(({ data: { session: initialSession } }) => {
        console.log('[useAuth] Sessão inicial:', initialSession ? 'existe' : 'não existe')
        setSession(initialSession)
        setUser(initialSession?.user ?? null)
      })
      .catch((err) => console.error('[useAuth] getSession falhou:', err))
      .finally(() => {
        setLoading(false)
        console.log('[useAuth] Sessão inicial verificada — loading=false')
      })

    // Guarda de segurança: se nem getSession nem onAuthStateChange resolverem
    // (ex.: requisição de rede presa), loading nunca fica true para sempre —
    // todo caminho termina com a tela renderizada.
    const safetyTimer = setTimeout(() => {
      setLoading((prev) => {
        if (prev)
          console.warn('[useAuth] Guarda de segurança acionada — loading forçado para false')
        return false
      })
    }, 8000)

    return () => {
      clearTimeout(safetyTimer)
      subscription.unsubscribe()
    }
  }, [])

  // Busca o perfil FORA do callback de auth, sempre que o usuário muda.
  useEffect(() => {
    if (user?.id) {
      fetchProfile(user.id)
    } else {
      console.log('[useAuth] Sem usuário — perfil limpo')
      setProfile(null)
    }
  }, [user?.id])

  // A lista de estabelecimentos é carregada SOMENTE com o usuário autenticado:
  // com as políticas RLS da v0.0.59 a consulta anônima volta vazia, e o login
  // caía no fallback genérico "Estabelecimento". Na tela de login o usuário
  // informa apenas credenciais — a lista é buscada após o signIn (dentro dele,
  // já autenticado) e em recarregamentos de página com sessão ativa.
  useEffect(() => {
    if (user?.id) {
      fetchEstabelecimentos()
    } else {
      setEstabelecimentos([])
    }
  }, [user?.id])

  // Regra do estabelecimento ativo: quem está LOGADO com tenant segue SEMPRE o
  // tenant_id do seu perfil — o TenantStorage nunca decide o tenant de um
  // usuário recém-logado, serve apenas para manter a seleção entre
  // recarregamentos de página (e pré-selecionar o seletor da tela de login).
  useEffect(() => {
    if (estabelecimentos.length === 0) return
    // Enquanto a sessão/perfil carregam, NADA é decidido aqui: o ramo "sem
    // usuário" abaixo só vale quando o carregamento terminou de verdade
    // (usuário realmente deslogado). Sem isso, no primeiro paint o estado
    // transitório (user=null, loading=true) restaurava a seleção salva do
    // TenantStorage — seleção que pode ser de OUTRO usuário do mesmo aparelho.
    if (loading) return
    if (user && profile) {
      if (profile.tenant_id) {
        // Usuário de um estabelecimento: ativa o dele, vindo do perfil.
        const own = estabelecimentos.find((e) => e.id === profile.tenant_id)
        if (own && estabelecimentoAtivo?.id !== own.id) {
          setEstabelecimentoAtivoState(own)
          TenantStorage.set(own)
        }
        // tenant fora da lista (inativo/inexistente): signIn já mostra o erro
        // visível — aqui NUNCA adotamos outro estabelecimento silenciosamente.
        return
      }
      // Admin da plataforma (tenant nulo): escolha livre — mantém/adota a
      // seleção como hoje, sem ser forçado a um estabelecimento.
      const saved = TenantStorage.get()
      if (saved && estabelecimentos.some((e) => e.id === saved.id)) {
        if (estabelecimentoAtivo?.id !== saved.id) setEstabelecimentoAtivoState(saved)
        return
      }
      if (!estabelecimentoAtivo) {
        setEstabelecimentoAtivoState(estabelecimentos[0])
        TenantStorage.set(estabelecimentos[0])
      }
      return
    }
    // Sem usuário logado (tela de login): apenas restaura a seleção salva,
    // se ainda existir — nada é escrito sem ação do usuário.
    const saved = TenantStorage.get()
    if (saved && estabelecimentos.some((e) => e.id === saved.id)) {
      if (estabelecimentoAtivo?.id !== saved.id) setEstabelecimentoAtivoState(saved)
    }
  }, [user, profile, estabelecimentos, estabelecimentoAtivo, loading])

  const setEstabelecimentoAtivo = (e: Estabelecimento | null) => {
    setEstabelecimentoAtivoState(e)
    if (e) TenantStorage.set(e)
    else TenantStorage.clear()
  }

  const signIn = async (email: string, password: string) => {
    console.log('[useAuth] signIn: iniciando autenticação para', email)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      console.error('[useAuth] signIn: falhou —', error.message)
      return { error }
    }
    console.log('[useAuth] signIn: autenticado com sucesso, user.id =', data?.user?.id)
    // Perfil e lista de estabelecimentos são recarregados aqui de forma
    // explícita (fora do callback de auth) para a navegação pós-login ter
    // os dados prontos.
    let loadedProfile: UserProfile | null = null
    let lista: Estabelecimento[] = []
    try {
      loadedProfile = await fetchProfile(data.user.id)
      lista = await fetchEstabelecimentos()
      console.log('[useAuth] signIn: perfil e estabelecimentos recarregados pós-login')
    } catch (err) {
      console.error('[useAuth] signIn: erro ao recarregar perfil/estabelecimentos', err)
    }

    // O estabelecimento ativo NO LOGIN vem SEMPRE do tenant_id do perfil —
    // nunca da seleção salva no TenantStorage (que pode ser de outro cliente).
    if (loadedProfile?.tenant_id) {
      const own = lista.find((e) => e.id === loadedProfile!.tenant_id)
      if (own) {
        console.log('[useAuth] signIn: estabelecimento do perfil ativado:', own.nome)
        setEstabelecimentoAtivoState(own)
        TenantStorage.set(own)
      } else {
        // Erro VISÍVEL: o estabelecimento do usuário não existe ou está
        // inativo — não seguir silenciosamente com o tenant de outro cliente.
        console.error(
          '[useAuth] signIn: estabelecimento do usuário não encontrado (tenant_id =',
          loadedProfile.tenant_id,
          ')',
        )
        setEstabelecimentoAtivoState(null)
        TenantStorage.clear()
        await supabase.auth.signOut()
        setUser(null)
        setSession(null)
        setProfile(null)
        return {
          error: new Error(
            'Estabelecimento do usuário não encontrado — contate o administrador da plataforma.',
          ),
        }
      }
    }
    return { error: null }
  }

  const signUp = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/` },
    })
    return { error, data }
  }

  const signOut = async () => {
    console.log('[useAuth] signOut: limpando estado local')
    // Ao sair, limpa explicitamente qualquer resquício de storage/cache de perfil
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.removeItem('rachide_bar_role')
      } catch {
        // ignore
      }
    }
    const { error } = await supabase.auth.signOut()
    setUser(null)
    setSession(null)
    setProfile(null)
    // A seleção salva era do usuário que saiu — o próximo login é decidido
    // pelo perfil do novo usuário, nunca pelo que ficou salvo aqui.
    setEstabelecimentoAtivoState(null)
    TenantStorage.clear()
    console.log('[useAuth] signOut: concluído, erro:', error?.message ?? 'nenhum')
    return { error }
  }

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id)
    }
  }

  const role: UserRole = mapPerfilToRole(profile?.perfil)
  const isAdmin = role === 'Admin'

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        role,
        isAdmin,
        loading,
        estabelecimentos,
        estabelecimentoAtivo,
        setEstabelecimentoAtivo,
        signIn,
        signUp,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
