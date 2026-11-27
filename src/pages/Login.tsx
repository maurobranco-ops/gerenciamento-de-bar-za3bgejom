import { useState, FormEvent } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Beer, Mail, Lock, Loader2, ArrowRight, Building2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuth } from '@/hooks/use-auth'

export default function Login() {
  const { signIn, estabelecimentos, estabelecimentoAtivo, setEstabelecimentoAtivo } = useAuth()
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
    setError(null)
    setSubmitting(true)

    try {
      const { error } = await signIn(email, password)
      if (error) {
        setError(
          error.message?.includes('Invalid login')
            ? 'E-mail ou senha inválidos.'
            : error.message || 'Erro ao entrar. Tente novamente.',
        )
        return
      }

      // Redireciona conforme o perfil do usuário autenticado
      const supabase = (await import('@/lib/supabase/client')).supabase
      const { data: userData } = await supabase.auth.getUser()
      const { data: perfil } = await supabase
        .from('perfis_usuarios')
        .select('perfil')
        .eq('id', userData?.user?.id ?? '')
        .maybeSingle()

      let role = 'Garçom'
      if (perfil?.perfil === 'gerente') role = 'Gerente'
      else if (perfil?.perfil === 'caixa') role = 'Caixa'
      else if (perfil?.perfil === 'cozinha') role = 'Cozinha'
      else if (perfil?.perfil === 'admin') role = 'Admin'

      const from = (location.state as any)?.from?.pathname
      const destination = getDestinationForRole(role, from)
      navigate(destination, { replace: true })
    } catch (err: any) {
      setError(err.message || 'Erro inesperado ao entrar.')
    } finally {
      setSubmitting(false)
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

          {/* Seleção de estabelecimento (tenant) — nunca uma marca do app */}
          <div className="space-y-1.5">
            <Label htmlFor="estabelecimento-login" className="text-xs text-stone-300 font-semibold">
              Estabelecimento
            </Label>
            <div className="relative">
              <Building2 className="w-4 h-4 absolute left-3 top-3 text-stone-500" />
              <Select
                value={estabelecimentoAtivo?.id ?? ''}
                onValueChange={(id) => {
                  const found = estabelecimentos.find((e) => e.id === id)
                  if (found) setEstabelecimentoAtivo(found)
                }}
              >
                <SelectTrigger
                  id="estabelecimento-login"
                  aria-label="Selecionar estabelecimento"
                  className="w-full pl-9 bg-[#1C1917] border-[#44403C] text-stone-100 text-sm focus:border-amber-500"
                >
                  <SelectValue placeholder="Selecione o estabelecimento" />
                </SelectTrigger>
                <SelectContent className="bg-[#292524] border-[#44403C] text-stone-100">
                  {estabelecimentos.map((e) => (
                    <SelectItem key={e.id} value={e.id} className="focus:bg-stone-700">
                      {e.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {estabelecimentos.length === 0 && (
              <p className="text-[10px] text-stone-500">
                Nenhum estabelecimento disponível no momento.
              </p>
            )}
          </div>

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
