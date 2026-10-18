import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { Loader2 } from 'lucide-react'

export function ProtectedRoute() {
  const { session, loading, role } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1C1917] flex flex-col items-center justify-center text-stone-200">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin mb-3" />
        <span className="text-xs text-stone-400">Verificando sessão segura...</span>
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Se o usuário possui perfil Cozinha, seu acesso é EXCLUSIVO à tela KDS (/kds)
  // Caso tente acessar qualquer outra rota protegida, redireciona diretamente para /kds
  if (role === 'Cozinha' && location.pathname !== '/kds') {
    return <Navigate to="/kds" replace />
  }

  return <Outlet />
}
