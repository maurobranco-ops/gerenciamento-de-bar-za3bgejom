/* Main App Component - Handles routing (using react-router-dom), query client and other providers */
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import Layout from './components/Layout'
import { BarProvider } from './context/BarContext'

import Index from './pages/Index'
import Comandas from './pages/Comandas'
import Cardapio from './pages/Cardapio'
import Estoque from './pages/Estoque'
import FluxoCaixa from './pages/FluxoCaixa'
import DRE from './pages/DRE'
import Fiscal from './pages/Fiscal'
import MesasConfig from './pages/MesasConfig'
import FilaCozinha from './pages/FilaCozinha'
import ProdutosAdmin from './pages/ProdutosAdmin'
import NotFound from './pages/NotFound'

const App = () => (
  <BrowserRouter>
    <BarProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Index />} />
            <Route path="/comandas" element={<Comandas />} />
            <Route path="/fila-cozinha" element={<FilaCozinha />} />
            <Route path="/produtos-admin" element={<ProdutosAdmin />} />
            <Route path="/mesas-config" element={<MesasConfig />} />
            <Route path="/cardapio" element={<Cardapio />} />
            <Route path="/estoque" element={<Estoque />} />
            <Route path="/fluxo-caixa" element={<FluxoCaixa />} />
            <Route path="/dre" element={<DRE />} />
            <Route path="/fiscal" element={<Fiscal />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </TooltipProvider>
    </BarProvider>
  </BrowserRouter>
)

export default App
