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
  const [estabelecimentoAtivo, setEstabelecimentoAtivoState] = useState<Estabelecimento | null>(
    () => {
      return TenantStorage.get()
    },
  )

  const fetchProfile = async (userId: string) => {
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
      } else {
        // Linha ausente (cadastro incompleto) ou bloqueada por RLS — visível
        // no console para diagnóstico do pós-login (ex.: admin sem tenant).
        console.error('[useAuth] Perfil NÃO carregado para', userId, error?.message)
        setProfile(null)
      }
    } catch (err) {
      console.error('[useAuth] Erro ao buscar perfil do usuário:', err)
      setProfile(null)
    }
  }

  // Fase 1 multi-tenant: lista de estabelecimentos disponíveis na sessão.
  // Enquanto o usuário não está autenticado, a lista pública de tenants ativos
  // alimenta o seletor da tela de login (tabela liberada em SELECT para anon).
  const fetchEstabelecimentos = async () => {
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
      } else {
        console.error('[useAuth] Erro ao buscar estabelecimentos:', error?.message)
      }
    } catch (err) {
      console.error('[useAuth] Erro inesperado ao buscar estabelecimentos:', err)
    }
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

  // Carrega estabelecimentos uma vez na inicialização e quando o login muda
  // (login precisa da lista; consulta pública de tenants ativos).
  useEffect(() => {
    fetchEstabelecimentos()
  }, [user?.id])

  // Se um estabelecimento estava salvo e some da lista, limpa; se não há seleção,
  // adota o primeiro disponível.
  useEffect(() => {
    if (estabelecimentos.length === 0) return
    const saved = TenantStorage.get()
    if (saved && estabelecimentos.some((e) => e.id === saved.id)) {
      if (estabelecimentoAtivo?.id !== saved.id) setEstabelecimentoAtivoState(saved)
      return
    }
    if (!estabelecimentoAtivo) {
      setEstabelecimentoAtivoState(estabelecimentos[0])
      TenantStorage.set(estabelecimentos[0])
    }
  }, [estabelecimentos])

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
    try {
      await fetchProfile(data.user.id)
      await fetchEstabelecimentos()
      console.log('[useAuth] signIn: perfil e estabelecimentos recarregados pós-login')
    } catch (err) {
      console.error('[useAuth] signIn: erro ao recarregar perfil/estabelecimentos', err)
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
