import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import Layout from './components/Layout'
import { BarProvider } from './context/BarContext'
import { AuthProvider } from './hooks/use-auth'
import { ProtectedRoute } from './components/ProtectedRoute'

import Index from './pages/Index'
import Comandas from './pages/Comandas'
import Cardapio from './pages/Cardapio'
import Estoque from './pages/Estoque'
import FluxoCaixa from './pages/FluxoCaixa'
import DRE from './pages/DRE'
import Fiscal from './pages/Fiscal'
import FilaCozinha from './pages/FilaCozinha'
import { Navigate } from 'react-router-dom'
import ProdutosAdmin from './pages/ProdutosAdmin'
import MesasConfig from './pages/MesasConfig'
import PedidoOnline from './pages/PedidoOnline'
import PedidosOnlineManager from './pages/PedidosOnlineManager'
import Configuracoes from './pages/Configuracoes'
import Usuarios from './pages/Usuarios'
import Apresentacao from './pages/Apresentacao'
import PlanoNFCe from './pages/PlanoNFCe'
import Login from './pages/Login'
import NotFound from './pages/NotFound'

export function App() {
  return (
    <TooltipProvider>
      <AuthProvider>
        <BarProvider>
          <BrowserRouter>
            <Routes>
              {/* Rotas Públicas: Pedido On-line pelo QR Code da Mesa e Login */}
              <Route path="/login" element={<Login />} />
              <Route path="/pedido" element={<PedidoOnline />} />
              <Route path="/pedido/:mesaNumero" element={<PedidoOnline />} />

              {/* Rotas Protegidas pelo Supabase Auth */}
              <Route element={<ProtectedRoute />}>
                <Route path="/" element={<Layout />}>
                  <Route index element={<Index />} />
                  <Route path="comandas" element={<Comandas />} />
                  <Route path="pedidos-online" element={<PedidosOnlineManager />} />
                  <Route path="cardapio" element={<Cardapio />} />
                  <Route path="estoque" element={<Estoque />} />
                  <Route path="fluxo-caixa" element={<FluxoCaixa />} />
                  <Route path="dre" element={<DRE />} />
                  <Route path="fiscal" element={<Fiscal />} />
                  <Route path="fila-cozinha" element={<FilaCozinha />} />
                  <Route path="kds" element={<Navigate to="/fila-cozinha" replace />} />
                  <Route path="produtos-admin" element={<ProdutosAdmin />} />
                  <Route path="mesas-config" element={<MesasConfig />} />
                  <Route path="usuarios" element={<Usuarios />} />
                  <Route path="configuracoes" element={<Configuracoes />} />
                  <Route path="apresentacao" element={<Apresentacao />} />
                  <Route path="plano-nfce" element={<PlanoNFCe />} />
                  <Route path="*" element={<NotFound />} />
                </Route>
              </Route>
            </Routes>
          </BrowserRouter>
          <Toaster />
          <Sonner />
        </BarProvider>
      </AuthProvider>
    </TooltipProvider>
  )
}

export default App
