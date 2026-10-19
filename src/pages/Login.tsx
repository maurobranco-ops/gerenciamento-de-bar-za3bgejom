import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Beer, Lock, Mail, Loader2, ArrowRight, AlertCircle } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'

export default function Login() {
  const { signIn, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const { session, role } = useAuth()
  const from = (location.state as any)?.from?.pathname

  // Determina rota padrão de destino conforme perfil: Cozinha vai direto para /fila-cozinha
  const targetDestination = React.useMemo(() => {
    if (role === 'Cozinha') return '/fila-cozinha'
    if (from && from !== '/login') {
      return from === '/kds' ? '/fila-cozinha' : from
    }
    return '/'
  }, [role, from])

  // Se o usuário já estiver autenticado e acessar /login, redirecionar para a tela pretendida
  React.useEffect(() => {
    if (!authLoading && session) {
      // Se for Cozinha ou se targetDestination for /kds, vai direto para /fila-cozinha
      const dest =
        role === 'Cozinha' || targetDestination === '/kds' ? '/fila-cozinha' : targetDestination
      navigate(dest, { replace: true })
    }
  }, [authLoading, session, navigate, targetDestination, role])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setSubmitting(true)

    try {
      const { error } = await signIn(email.trim(), password)
      if (error) {
        if (error.message?.includes('Invalid login credentials')) {
          setErrorMessage('E-mail ou senha incorretos. Verifique suas credenciais.')
        } else {
          setErrorMessage(error.message || 'Erro ao efetuar login. Tente novamente.')
        }
      } else {
        // Redirecionamento após login bem sucedido: se for Cozinha, cai direto em /fila-cozinha
        const isKitchen = email.trim().toLowerCase().includes('cozinha')
        navigate(isKitchen ? '/fila-cozinha' : targetDestination, { replace: true })
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro inesperado na autenticação.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#1C1917] text-[#F5F5F4] flex flex-col justify-center items-center px-4 py-8 font-sans">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Logo & Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 items-center justify-center text-[#1C1917] shadow-lg shadow-amber-950/60 mb-2">
            <Beer className="w-8 h-8 fill-current" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-stone-100">
            Rachide <span className="text-amber-500">Bar</span>
          </h1>
          <p className="text-xs sm:text-sm text-stone-400">
            Acesso ao Sistema de Gestão Gastronômica & Fiscal
          </p>
        </div>

        {/* Login Card */}
        <div className="p-6 sm:p-8 rounded-2xl bg-[#292524] border border-[#44403C] shadow-2xl space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-[#44403C]">
            <div className="flex items-center gap-2 text-sm font-bold text-stone-200">
              <Lock className="w-4 h-4 text-amber-500" />
              Entrar com sua conta
            </div>
            <Badge
              variant="outline"
              className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px]"
            >
              Supabase Auth Ativo
            </Badge>
          </div>

          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/40 flex items-start gap-2.5 text-xs text-red-300 animate-fade-in-up">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="leading-relaxed">{errorMessage}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-stone-300 font-semibold">E-mail corporativo</Label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-3 text-stone-500" />
                <Input
                  type="email"
                  name="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ex: gerente@rachide.bar"
                  required
                  autoFocus
                  className="pl-9 bg-[#1C1917] border-[#44403C] text-stone-100 text-sm focus:border-amber-500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-stone-300 font-semibold">Senha de acesso</Label>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-3 text-stone-500" />
                <Input
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
              disabled={submitting || authLoading}
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
        </div>

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
