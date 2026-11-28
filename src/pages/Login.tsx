import { useState, FormEvent } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Beer, Mail, Lock, Loader2, ArrowRight } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/hooks/use-auth'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Pós-login: Cozinha vai exclusivo para a fila; o admin da plataforma vai
  // direto para /admin; demais seguem para o destino guardado (ou o Dashboard).
  const getDestinationForRole = (role: string, from?: string): string => {
    if (role === 'Cozinha') return '/fila-cozinha'
    if (role === 'Admin') return '/admin'
    return from && from !== '/login' ? from : '/'
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    console.log('[Login] Submit do formulário de login para', email)
    setError(null)
    setSubmitting(true)

    try {
      console.log('[Login] Etapa 1/4 — chamando signIn')
      const { error } = await signIn(email, password)
      if (error) {
        console.error('[Login] Etapa 1/4 — signIn retornou erro:', error.message)
        setError(
          error.message?.includes('Invalid login')
            ? 'E-mail ou senha inválidos.'
            : error.message || 'Erro ao entrar. Tente novamente.',
        )
        return
      }
      console.log('[Login] Etapa 1/4 concluída — autenticado')

      // Redireciona conforme o perfil do usuário autenticado
      console.log('[Login] Etapa 2/4 — identificando perfil no banco')
      const supabase = (await import('@/lib/supabase/client')).supabase
      const { data: userData } = await supabase.auth.getUser()
      const { data: perfil, error: perfilError } = await supabase
        .from('perfis_usuarios')
        .select('perfil')
        .eq('id', userData?.user?.id ?? '')
        .maybeSingle()

      // Perfil ausente (RLS, cadastro incompleto ou usuário desativado) é um
      // erro visível — nunca assumir silenciosamente o papel Garçom.
      if (perfilError || !perfil) {
        console.error(
          '[Login] Etapa 2/4 — perfil não encontrado:',
          perfilError?.message ?? 'linha ausente',
        )
        setError(
          'Perfil não encontrado — contate o administrador da plataforma para verificar seu cadastro.',
        )
        await supabase.auth.signOut()
        return
      }
      console.log('[Login] Etapa 2/4 concluída — perfil no banco:', perfil.perfil)

      let role = 'Garçom'
      if (perfil.perfil === 'gerente') role = 'Gerente'
      else if (perfil.perfil === 'caixa') role = 'Caixa'
      else if (perfil.perfil === 'cozinha') role = 'Cozinha'
      else if (perfil.perfil === 'admin') role = 'Admin'
      console.log('[Login] Etapa 3/4 concluída — papel identificado:', role)

      const from = (location.state as any)?.from?.pathname
      const destination = getDestinationForRole(role, from)
      console.log('[Login] Etapa 4/4 — navegando para', destination)
      navigate(destination, { replace: true })
      console.log('[Login] Etapa 4/4 — navegação disparada')
    } catch (err: any) {
      console.error('[Login] Erro inesperado no fluxo de login:', err)
      setError(err.message || 'Erro inesperado ao entrar.')
    } finally {
      setSubmitting(false)
      console.log('[Login] handleSubmit finalizado — submitting=false')
    }
  }

  return (
    <div className="min-h-dvh bg-[#1C1917] text-stone-100 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Branding da PLATAFORMA (nunca de um tenant) */}
        <div className="text-center space-y-3">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-[#1C1917] shadow-lg shadow-amber-950/40">
            <Beer className="w-9 h-9 fill-current" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-stone-50">
            Bares e <span className="text-amber-500">Restaurantes</span>
          </h1>
          <p className="text-sm text-stone-400">Plataforma de gestão para bares e restaurantes</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg border border-red-900/60 bg-red-950/40 text-red-300 text-xs p-3">
              {error}
            </div>
          )}

          {/* Sem seleção de estabelecimento aqui: com as políticas RLS da
              v0.0.59 a consulta anônima volta vazia e a tela caía no fallback
              genérico "Estabelecimento". O estabelecimento ativo pós-login vem
              do perfil.tenant_id (use-auth) — nada para escolher antes. */}
          <div className="space-y-1.5">
            <Label htmlFor="email-login" className="text-xs text-stone-300 font-semibold">
              E-mail de acesso
            </Label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-3 text-stone-500" />
              <Input
                id="email-login"
                type="email"
                name="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ex: gerente@bareserestaurantes.com"
                required
                autoFocus
                className="pl-9 bg-[#1C1917] border-[#44403C] text-stone-100 text-sm focus:border-amber-500"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="senha-login" className="text-xs text-stone-300 font-semibold">
              Senha de acesso
            </Label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-3 text-stone-500" />
              <Input
                id="senha-login"
                type="password"
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="pl-9 bg-[#1C1917] border-[#44403C] text-stone-100 text-sm focus:border-amber-500"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={submitting}
            className="w-full bg-amber-500 hover:bg-amber-600 text-stone-950 font-black text-sm h-11 shadow-md shadow-amber-950/40 transition-all flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Autenticando...
              </>
            ) : (
              <>
                <span>Entrar no Sistema</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </Button>
        </form>

        {/* Public Access Link */}
        <div className="text-center text-xs text-stone-400">
          É um cliente querendo pedir na mesa?{' '}
          <a
            href="/pedido"
            className="text-amber-400 hover:text-amber-300 underline font-semibold ml-1"
          >
            Abrir cardápio e pedido on-line
          </a>
        </div>
      </div>
    </div>
  )
}
