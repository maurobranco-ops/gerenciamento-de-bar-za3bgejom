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

      const { data, error } = await (supabase as any)
        .from('perfis_usuarios')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      if (!error && data) {
        setProfile(data as unknown as UserProfile)
      } else {
        // Fallback default profile if table row is absent
        setProfile(null)
      }
    } catch (err) {
      console.error('Erro ao buscar perfil do usuário:', err)
      setProfile(null)
    }
  }

  // Fase 1 multi-tenant: lista de estabelecimentos disponíveis na sessão.
  // Enquanto o usuário não está autenticado, a lista pública de tenants ativos
  // alimenta o seletor da tela de login (tabela liberada em SELECT para anon).
  const fetchEstabelecimentos = async (authenticated: boolean) => {
    try {
      // Fase 1: a tabela estabelecimentos é pública em SELECT para ativos
      // (policy estabelecimentos_select_public) — mesma consulta no login e logado.
      const { data, error } = await (supabase as any)
        .from('estabelecimentos')
        .select('*')
        .eq('ativo', true)
        .order('nome', { ascending: true })
      if (!error && data) setEstabelecimentos(data as Estabelecimento[])
    } catch (err) {
      console.error('Erro ao buscar estabelecimentos:', err)
    }
  }

  useEffect(() => {
    // Escuta mudanças de auth (sincrono sem async/await no callback)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession)
      setUser(currentSession?.user ?? null)
      if (currentSession?.user) {
        fetchProfile(currentSession.user.id)
      } else {
        setProfile(null)
      }
      setLoading(false)
    })

    // Checagem inicial
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession)
      setUser(initialSession?.user ?? null)
      if (initialSession?.user) {
        fetchProfile(initialSession.user.id).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // Carrega estabelecimentos uma vez na inicialização (login precisa da lista)
  useEffect(() => {
    fetchEstabelecimentos(!!user)
  }, [user])

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
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (!error && data?.user) {
      await fetchProfile(data.user.id)
      await fetchEstabelecimentos(true)
    }
    return { error }
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
