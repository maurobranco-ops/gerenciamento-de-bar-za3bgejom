import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { Skeleton } from '@/components/ui/skeleton'

interface ProtectedRouteProps {
  children?: React.ReactNode
  /** Perfis (em formato UserRole) com permissão; se omitido, qualquer autenticado entra */
  allowedRoles?: string[]
}

export const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const { user, profile, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-dvh bg-[#1C1917] flex items-center justify-center">
        <div className="w-full max-w-sm space-y-3 p-4">
          <Skeleton className="h-9 w-2/3 bg-[#292524]" />
          <Skeleton className="h-4 w-1/2 bg-[#292524]" />
          <Skeleton className="h-32 w-full bg-[#292524]" />
        </div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" state={{ from: location }} replace />

  if (allowedRoles && allowedRoles.length > 0) {
    const roleMapping: Record<string, string> = {
      Garçom: 'garcom',
      Caixa: 'caixa',
      Gerente: 'gerente',
      Cozinha: 'cozinha',
      Admin: 'admin',
    }
    const allowedProfiles = allowedRoles.map((r) => roleMapping[r] ?? r)
    if (profile && !allowedProfiles.includes(profile.perfil)) {
      return <Navigate to="/" replace />
    }
  }

  // Usado como layout route (<Route element={<ProtectedRoute/>}>): renderiza as
  // rotas filhas via Outlet. CRÍTICO: quando children é null (padrão usado no
  // App.tsx), retornar <>{children}</> renderizava NADA — tela escura sem erro.
  if (children === null || children === undefined) {
    return <Outlet />
  }

  return <>{children}</>
}
