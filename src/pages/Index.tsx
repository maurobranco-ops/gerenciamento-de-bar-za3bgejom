import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  TrendingUp,
  DollarSign,
  ClipboardList,
  Receipt,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownLeft,
  PlusCircle,
  Coins,
  PackagePlus,
  Lock,
  Sparkles,
  PieChart as PieIcon,
  ShoppingBag,
  ChefHat,
  Clock,
  CheckCircle2,
  Users,
  Wallet,
  Plus,
  ArrowRight,
  BadgeDollarSign,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { useBar } from '../context/BarContext'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { PaymentMethod } from '../types/bar'

const LAST_7_DAYS_DATA = [
  { day: 'Seg', valor: 2150 },
  { day: 'Ter', valor: 2480 },
  { day: 'Qua', valor: 3120 },
  { day: 'Qui', valor: 3890 },
  { day: 'Sex', valor: 6420 },
  { day: 'Sáb', valor: 8950 },
  { day: 'Hoje', valor: 3640 },
]

const PAYMENT_METHODS_DATA = [
  { name: 'Pix', value: 38, color: '#10B981' },
  { name: 'TEP', value: 27, color: '#F59E0B' },
  { name: 'Cartão Crédito', value: 18, color: '#3B82F6' },
  { name: 'Cartão Débito', value: 12, border: '#14B8A6', color: '#14B8A6' },
  { name: 'Dinheiro', value: 5, color: '#8B5CF6' },
]

export default function Dashboard() {
  const {
    role,
    menuItems,
    comandas,
    cashMovements,
    cashDays,
    filaCozinha,
    openComanda,
    addCashMovement,
    closeCashRegister,
    checkRoleAccess,
  } = useBar()
  const navigate = useNavigate()

  // State for quick action modals (Gerente)
  const [newComandaModal, setNewComandaModal] = useState(false)
  const [selectedTableNum, setSelectedTableNum] = useState<number>(4)
  const [guestCount, setGuestCount] = useState<number>(2)
  const [clientName, setClientName] = useState<string>('')

  const [quickSaleModal, setQuickSaleModal] = useState(false)
  const [quickSaleDesc, setQuickSaleDesc] = useState('Venda Balcão Chopp & Petisco')
  const [quickSaleVal, setQuickSaleVal] = useState('45.00')

  const [closeRegisterModal, setCloseRegisterModal] = useState(false)

  // Caixa modals / actions
  const [caixaSangriaModal, setCaixaSangriaModal] = useState(false)
  const [caixaSangriaDesc, setCaixaSangriaDesc] = useState('')
  const [caixaSangriaVal, setCaixaSangriaVal] = useState('')
  const [caixaSuprimentoModal, setCaixaSuprimentoModal] = useState(false)
  const [caixaSuprimentoDesc, setCaixaSuprimentoDesc] = useState('Reforço de Troco / Suprimento')
  const [caixaSuprimentoVal, setCaixaSuprimentoVal] = useState('')
  const [caixaPaymentMethod, setCaixaPaymentMethod] = useState<PaymentMethod>('Dinheiro')

  // Cálculos Comuns
  const todayCashEntries = cashMovements
    .filter((m) => m.type === 'Entrada')
    .reduce((sum, m) => sum + m.value, 0)

  const todayCashExits = cashMovements
    .filter((m) => m.type === 'Saída')
    .reduce((sum, m) => sum + m.value, 0)

  const todayCashNet = todayCashEntries - todayCashExits

  const openComandas = comandas.filter(
    (c) => c.status === 'Ocupada' || c.status === 'Aguardando Pagamento',
  )
  const openComandasCount = openComandas.length
  const totalMesasCount = comandas.length
  const ocupacaoPercent =
    totalMesasCount > 0 ? Math.round((openComandasCount / totalMesasCount) * 100) : 0

  const awaitingPaymentComandas = comandas.filter(
    (c) => c.status === 'Aguardando Pagamento' || c.contaSolicitada,
  )
  const occupiedComandas = comandas.filter((c) => c.status === 'Ocupada')

  // Cozinha / Fila
  const pendingKitchenItems = filaCozinha.filter((i) => i.status === 'pendente')
  const preparingKitchenItems = filaCozinha.filter((i) => i.status === 'preparando')
  const readyKitchenItems = filaCozinha.filter((i) => i.status === 'pronto')
  const activeOrdersCount =
    pendingKitchenItems.length + preparingKitchenItems.length + readyKitchenItems.length

  // Ticket Médio
  const totalSalesCount = cashMovements.filter((m) => m.type === 'Entrada').length
  const ticketMedio = totalSalesCount > 0 ? todayCashEntries / totalSalesCount : 54.5

  const criticalStockCount = menuItems.filter((m) => m.stock <= m.minStock).length

  // Info do Caixa do dia
  const todayStr = new Date().toISOString().substring(0, 10)
  const currentDayInfo = cashDays.find((d) => d.date === todayStr) || {
    date: todayStr,
    openingBalance: 400.0,
    isClosed: false,
  }

  // Saldo em dinheiro do caixa
  const cashInDrawer =
    currentDayInfo.openingBalance +
    cashMovements
      .filter((m) => m.type === 'Entrada' && (m.paymentMethod === 'Dinheiro' || !m.paymentMethod))
      .reduce((sum, m) => sum + m.value, 0) -
    cashMovements
      .filter((m) => m.type === 'Saída' && (m.paymentMethod === 'Dinheiro' || !m.paymentMethod))
      .reduce((sum, m) => sum + m.value, 0)

  // Top 5 produtos (Gerente)
  const topProducts = [
    { name: 'Chopp Pilsen Artesanal 500ml', sales: 142, max: 150, percent: 95 },
    { name: 'Heineken Long Neck 330ml', sales: 118, max: 150, percent: 79 },
    { name: 'Bolinho de Costela (6 un)', sales: 74, max: 150, percent: 49 },
    { name: 'Batata Rústica com Cheddar', sales: 68, max: 150, percent: 45 },
    { name: 'Gin Tropical Rachide', sales: 52, max: 150, percent: 35 },
  ]

  // Formatted date
  const todayDateString = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date())

  const handleOpenComandaSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    openComanda(selectedTableNum, guestCount, clientName)
    setNewComandaModal(false)
    navigate('/comandas')
  }

  const handleQuickSaleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const val = parseFloat(quickSaleVal)
    if (!isNaN(val) && val > 0) {
      addCashMovement('Entrada', quickSaleDesc, val, 'Pix')
      setQuickSaleModal(false)
    }
  }

  const handleConfirmCloseRegister = () => {
    const todayISO = new Date().toISOString().split('T')[0]
    closeCashRegister(todayISO)
    setCloseRegisterModal(false)
    navigate('/fluxo-caixa')
  }

  const handleSangriaSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const val = parseFloat(caixaSangriaVal)
    if (!isNaN(val) && val > 0 && caixaSangriaDesc.trim()) {
      addCashMovement('Saída', `[Sangria] ${caixaSangriaDesc.trim()}`, val, caixaPaymentMethod)
      setCaixaSangriaModal(false)
      setCaixaSangriaDesc('')
      setCaixaSangriaVal('')
    }
  }

  const handleSuprimentoSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const val = parseFloat(caixaSuprimentoVal)
    if (!isNaN(val) && val > 0 && caixaSuprimentoDesc.trim()) {
      addCashMovement('Entrada', `[Suprimento] ${caixaSuprimentoDesc.trim()}`, val, 'Dinheiro')
      setCaixaSuprimentoModal(false)
      setCaixaSuprimentoDesc('Reforço de Troco / Suprimento')
      setCaixaSuprimentoVal('')
    }
  }

  // =========================================================================
  // RENDER: DASHBOARD DO GARÇOM
  // =========================================================================
  if (role === 'Garçom') {
    return (
      <div className="space-y-6 animate-fade-in-up">
        {/* Banner Garçom */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-[#292524] via-[#292524] to-[#342D26] border border-[#44403C]">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl sm:text-2xl font-black text-stone-100 tracking-tight">
                Olá, Garçom!
              </span>
              <Badge className="bg-amber-500/15 text-amber-400 border border-amber-500/40 text-xs px-2.5 py-0.5 font-bold flex items-center gap-1">
                <ClipboardList className="w-3.5 h-3.5 text-amber-400" />
                Painel de Atendimento
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-stone-400 capitalize mt-1">
              {todayDateString} • Rachide Bar & Petiscaria
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => navigate('/comandas')}
              className="bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold text-xs"
            >
              <ClipboardList className="w-4 h-4 mr-1.5" />
              Abrir Mapa de Mesas ({openComandasCount})
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate('/fila-cozinha')}
              className="bg-[#1C1917] hover:bg-[#44403C] border-[#44403C] text-stone-200 font-bold text-xs"
            >
              <ChefHat className="w-4 h-4 mr-1.5 text-amber-500" />
              Fila da Cozinha
            </Button>
          </div>
        </div>

        {/* 4 Cards de Atendimento do Garçom */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Mesas Ocupadas */}
          <div
            onClick={() => navigate('/comandas')}
            className="p-5 rounded-2xl bg-[#292524] border border-[#44403C] hover:border-amber-500/60 cursor-pointer transition-all duration-200 shadow-md"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-stone-400 uppercase tracking-wider">
                Mesas Ocupadas
              </span>
              <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-extrabold text-stone-100 tabular-nums">
                {occupiedComandas.length}{' '}
                <span className="text-sm font-normal text-stone-400">mesas</span>
              </div>
              <div className="flex items-center gap-1 mt-1 text-xs text-amber-400 font-medium">
                <span>Atendimento e pedidos em andamento</span>
              </div>
            </div>
          </div>

          {/* Card 2: Pedidos Prontos p/ Entrega */}
          <div
            onClick={() => navigate('/fila-cozinha')}
            className="p-5 rounded-2xl bg-[#292524] border border-emerald-500/40 bg-gradient-to-br from-[#292524] to-emerald-950/20 hover:border-emerald-500 cursor-pointer transition-all duration-200 shadow-md"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                Prontos para Servir
              </span>
              <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-extrabold text-emerald-400 tabular-nums">
                {readyKitchenItems.length}{' '}
                <span className="text-sm font-normal text-stone-400">pratos/drinks</span>
              </div>
              <div className="flex items-center gap-1 mt-1 text-xs text-emerald-400 font-medium">
                <span>Aguardando garçom levar à mesa</span>
              </div>
            </div>
          </div>

          {/* Card 3: Pedidos em Preparo */}
          <div
            onClick={() => navigate('/fila-cozinha')}
            className="p-5 rounded-2xl bg-[#292524] border border-[#44403C] hover:border-blue-500/60 cursor-pointer transition-all duration-200 shadow-md"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-stone-400 uppercase tracking-wider">
                Em Preparo na Cozinha
              </span>
              <div className="p-2 rounded-xl bg-blue-500/15 text-blue-400 border border-blue-500/30">
                <ChefHat className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-extrabold text-blue-400 tabular-nums">
                {preparingKitchenItems.length + pendingKitchenItems.length}{' '}
                <span className="text-sm font-normal text-stone-400">pedidos</span>
              </div>
              <div className="flex items-center gap-1 mt-1 text-xs text-stone-400">
                <span>
                  {pendingKitchenItems.length} pendentes • {preparingKitchenItems.length} no
                  fogo/bar
                </span>
              </div>
            </div>
          </div>

          {/* Card 4: Aguardando Pagamento */}
          <div
            onClick={() => navigate('/comandas')}
            className="p-5 rounded-2xl bg-[#292524] border border-[#44403C] hover:border-purple-500/60 cursor-pointer transition-all duration-200 shadow-md"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-stone-400 uppercase tracking-wider">
                Conta Solicitada
              </span>
              <div className="p-2 rounded-xl bg-purple-500/15 text-purple-400 border border-purple-500/30">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-extrabold text-purple-400 tabular-nums">
                {awaitingPaymentComandas.length}{' '}
                <span className="text-sm font-normal text-stone-400">mesas</span>
              </div>
              <div className="flex items-center gap-1 mt-1 text-xs text-purple-400 font-medium">
                <span>Aguardando fechamento no caixa</span>
              </div>
            </div>
          </div>
        </div>

        {/* 2 Seções Operacionais de Atendimento: Pedidos Prontos para Entrega + Mesas Ativas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Seção 1: Pedidos Prontos p/ Servir Imediatamente */}
          <div className="p-5 rounded-2xl bg-[#292524] border border-[#44403C] shadow-md flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-stone-100 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Pedidos Prontos para Entrega ({readyKitchenItems.length})
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/fila-cozinha')}
                  className="text-amber-400 text-xs h-7 hover:bg-stone-800"
                >
                  Ver fila completa
                </Button>
              </div>

              {readyKitchenItems.length === 0 ? (
                <div className="py-12 text-center text-xs text-stone-400 space-y-2">
                  <ChefHat className="w-8 h-8 text-stone-600 mx-auto" />
                  <p className="font-semibold text-stone-300">Nenhum prato aguardando entrega</p>
                  <p className="text-stone-500">
                    Quando a cozinha marcar um item como &quot;Pronto&quot;, ele aparecerá aqui com
                    o número da mesa.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                  {readyKitchenItems.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 rounded-xl bg-[#1C1917] border border-emerald-500/40 flex items-center justify-between hover:border-emerald-500 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex flex-col items-center justify-center font-black">
                          <span className="text-[9px] uppercase leading-none text-emerald-300">
                            Mesa
                          </span>
                          <span className="text-sm leading-none font-bold">
                            {item.mesaNumero || '?'}
                          </span>
                        </div>
                        <div>
                          <div className="font-bold text-stone-100 text-sm">
                            {item.quantidade ? `${item.quantidade}x ` : ''}
                            {item.nomeProduto || 'Item do pedido'}
                          </div>
                          <div className="text-xs text-stone-400 flex items-center gap-2 mt-0.5">
                            <span className="capitalize text-amber-400 font-medium">
                              Praça: {item.areaPreparo}
                            </span>
                            {item.clienteNome && <span>• {item.clienteNome}</span>}
                            {item.observacoes && (
                              <span className="text-stone-300 italic">
                                &quot;{item.observacoes}&quot;
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <Button
                        size="sm"
                        onClick={() => navigate('/fila-cozinha')}
                        className="bg-emerald-500 hover:bg-emerald-600 text-stone-950 font-bold text-xs h-8"
                      >
                        Entregar
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-3 mt-3 border-t border-[#44403C]/60 flex items-center justify-between text-xs text-stone-400">
              <span>{activeOrdersCount} pedidos ativos no bar & cozinha</span>
              <Button
                variant="link"
                size="sm"
                onClick={() => navigate('/fila-cozinha')}
                className="text-amber-400 p-0 h-auto text-xs"
              >
                Ir para o KDS <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </div>

          {/* Seção 2: Mesas e Comandas com Atendimento em Andamento */}
          <div className="p-5 rounded-2xl bg-[#292524] border border-[#44403C] shadow-md flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-stone-100 flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-amber-500" />
                  Mesas Ativas no Salão ({openComandasCount})
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/comandas')}
                  className="text-amber-400 text-xs h-7 hover:bg-stone-800"
                >
                  Abrir salão
                </Button>
              </div>

              {openComandas.length === 0 ? (
                <div className="py-12 text-center text-xs text-stone-400 space-y-2">
                  <ClipboardList className="w-8 h-8 text-stone-600 mx-auto" />
                  <p className="font-semibold text-stone-300">Nenhuma mesa aberta no momento</p>
                  <p className="text-stone-500">
                    Acesse o mapa de mesas para abrir uma nova comanda de cliente.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                  {openComandas.map((c) => {
                    const totalItens = c.items.reduce((sum, it) => sum + it.quantity, 0)
                    const isWaitingPay = c.status === 'Aguardando Pagamento'
                    return (
                      <div
                        key={c.id}
                        onClick={() => navigate('/comandas')}
                        className={`p-3 rounded-xl bg-[#1C1917] border cursor-pointer hover:border-amber-500/60 transition-all flex items-center justify-between ${
                          isWaitingPay
                            ? 'border-purple-500/50 bg-purple-950/15'
                            : 'border-[#44403C]'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-xl border flex items-center justify-center font-black text-sm ${
                              isWaitingPay
                                ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                                : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                            }`}
                          >
                            {c.tableNumber}
                          </div>
                          <div>
                            <div className="font-bold text-stone-100 text-sm">
                              Mesa {c.tableNumber}{' '}
                              {c.clientName && (
                                <span className="text-stone-400 font-normal">— {c.clientName}</span>
                              )}
                            </div>
                            <div className="text-xs text-stone-400 flex items-center gap-2 mt-0.5">
                              <span>{c.guestCount} pessoa(s)</span>
                              <span>•</span>
                              <span>{totalItens} item(ns) lançados</span>
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <Badge
                            variant="outline"
                            className={
                              isWaitingPay
                                ? 'bg-purple-500/10 text-purple-400 border-purple-500/30 text-[10px]'
                                : 'bg-amber-500/10 text-amber-400 border-amber-500/30 text-[10px]'
                            }
                          >
                            {c.status}
                          </Badge>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="pt-3 mt-3 border-t border-[#44403C]/60 flex items-center justify-between text-xs text-stone-400">
              <span>
                Ocupação: {ocupacaoPercent}% ({openComandasCount}/{totalMesasCount} mesas)
              </span>
              <Button
                variant="link"
                size="sm"
                onClick={() => navigate('/comandas')}
                className="text-amber-400 p-0 h-auto text-xs"
              >
                Gerenciar comandas <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </div>
        </div>

        {/* Atalhos Rápidos Operacionais do Garçom */}
        <div className="p-5 rounded-2xl bg-[#292524] border border-[#44403C] shadow-md">
          <h2 className="text-sm font-bold text-stone-300 uppercase tracking-wider mb-3">
            Atalhos Operacionais do Garçom
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Button
              onClick={() => navigate('/comandas')}
              className="h-12 bg-[#1C1917] hover:bg-amber-500 hover:text-stone-950 text-stone-200 border border-[#44403C] hover:border-amber-500 font-semibold text-xs transition-all duration-200 flex items-center justify-center gap-2 group"
            >
              <ClipboardList className="w-4 h-4 text-amber-500 group-hover:text-stone-950" />
              Salão & Comandas
            </Button>

            <Button
              onClick={() => navigate('/fila-cozinha')}
              className="h-12 bg-[#1C1917] hover:bg-amber-500 hover:text-stone-950 text-stone-200 border border-[#44403C] hover:border-amber-500 font-semibold text-xs transition-all duration-200 flex items-center justify-center gap-2 group"
            >
              <ChefHat className="w-4 h-4 text-blue-400 group-hover:text-stone-950" />
              Fila da Cozinha & Bar (KDS)
            </Button>

            <Button
              onClick={() => navigate('/cardapio')}
              className="h-12 bg-[#1C1917] hover:bg-amber-500 hover:text-stone-950 text-stone-200 border border-[#44403C] hover:border-amber-500 font-semibold text-xs transition-all duration-200 flex items-center justify-center gap-2 group"
            >
              <ShoppingBag className="w-4 h-4 text-emerald-400 group-hover:text-stone-950" />
              Consultar Cardápio & Preços
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // =========================================================================
  // RENDER: DASHBOARD DO CAIXA
  // =========================================================================
  if (role === 'Caixa') {
    return (
      <div className="space-y-6 animate-fade-in-up">
        {/* Banner Caixa */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-[#292524] via-[#292524] to-[#342D26] border border-[#44403C]">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl sm:text-2xl font-black text-stone-100 tracking-tight">
                Olá, Operador de Caixa!
              </span>
              <Badge
                className={`text-xs px-2.5 py-0.5 font-bold flex items-center gap-1 ${
                  currentDayInfo.isClosed
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/40'
                    : 'bg-amber-500/15 text-amber-400 border border-amber-500/40'
                }`}
              >
                {currentDayInfo.isClosed ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Turno Homologado / Fechado
                  </>
                ) : (
                  <>
                    <Clock className="w-3.5 h-3.5" />
                    Caixa Aberto em Operação
                  </>
                )}
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-stone-400 capitalize mt-1">
              {todayDateString} • Rachide Bar & Petiscaria
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => navigate('/fluxo-caixa')}
              className="bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold text-xs"
            >
              <BadgeDollarSign className="w-4 h-4 mr-1.5" />
              Fluxo de Caixa Completo
            </Button>
          </div>
        </div>

        {/* 4 KPIs Operacionais do Caixa */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* KPI 1: Status do Caixa & Saldo em Gaveta */}
          <div className="p-5 rounded-2xl bg-[#292524] border border-[#44403C] hover:-translate-y-1 transition-all duration-200 shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-stone-400 uppercase tracking-wider">
                Gaveta (Dinheiro)
              </span>
              <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
                <Wallet className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-extrabold text-stone-100 tabular-nums">
                R$ {cashInDrawer.toFixed(2)}
              </div>
              <div className="flex items-center gap-1.5 mt-1 text-xs text-stone-400">
                <span>Abertura: R$ {currentDayInfo.openingBalance.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* KPI 2: Entradas Registradas Hoje */}
          <div className="p-5 rounded-2xl bg-[#292524] border border-[#44403C] hover:-translate-y-1 transition-all duration-200 shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-stone-400 uppercase tracking-wider">
                Entradas do Turno
              </span>
              <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                <ArrowUpRight className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-extrabold text-emerald-400 tabular-nums">
                + R$ {todayCashEntries.toFixed(2)}
              </div>
              <div className="flex items-center gap-1.5 mt-1 text-xs text-emerald-400 font-medium">
                <span>{cashMovements.filter((m) => m.type === 'Entrada').length} recebimentos</span>
              </div>
            </div>
          </div>

          {/* KPI 3: Saídas / Sangrias do Caixa */}
          <div className="p-5 rounded-2xl bg-[#292524] border border-[#44403C] hover:-translate-y-1 transition-all duration-200 shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-stone-400 uppercase tracking-wider">
                Saídas / Sangrias
              </span>
              <div className="p-2 rounded-xl bg-red-500/15 text-red-400 border border-red-500/30">
                <ArrowDownLeft className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-extrabold text-red-400 tabular-nums">
                - R$ {todayCashExits.toFixed(2)}
              </div>
              <div className="flex items-center gap-1 mt-1 text-xs text-stone-400">
                <span>{cashMovements.filter((m) => m.type === 'Saída').length} retiradas</span>
              </div>
            </div>
          </div>

          {/* KPI 4: Comandas Aguardando Fechamento */}
          <div
            onClick={() => navigate('/comandas')}
            className="p-5 rounded-2xl bg-gradient-to-br from-[#292524] to-purple-950/25 border border-purple-500/40 hover:border-purple-500 cursor-pointer transition-all duration-200 shadow-md"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-purple-400 uppercase tracking-wider">
                Aguardando Pagamento
              </span>
              <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/40">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-extrabold text-purple-400 tabular-nums">
                {awaitingPaymentComandas.length}{' '}
                <span className="text-sm font-normal text-stone-400">mesas</span>
              </div>
              <div className="flex items-center gap-1 mt-1 text-xs text-purple-300 font-medium">
                <span>Clique para receber no mapa de mesas</span>
              </div>
            </div>
          </div>
        </div>

        {/* 2 Painéis Operacionais do Caixa: Comandas Aguardando Fechamento + Últimos Movimentos de Caixa */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Painel 1: Comandas Aguardando Pagamento */}
          <div className="p-5 rounded-2xl bg-[#292524] border border-[#44403C] shadow-md flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-stone-100 flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-purple-400" />
                  Comandas Aguardando Pagamento ({awaitingPaymentComandas.length})
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/comandas')}
                  className="text-amber-400 text-xs h-7 hover:bg-stone-800"
                >
                  Ver salão
                </Button>
              </div>

              {awaitingPaymentComandas.length === 0 ? (
                <div className="py-12 text-center text-xs text-stone-400 space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500/60 mx-auto" />
                  <p className="font-semibold text-stone-300">Nenhuma comanda pendente de acerto</p>
                  <p className="text-stone-500">
                    Quando o garçom solicitar a conta de uma mesa, ela aparecerá aqui para você
                    receber.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                  {awaitingPaymentComandas.map((c) => {
                    const subtotal = c.items.reduce((s, it) => s + it.price * it.quantity, 0)
                    const totalComanda = c.includeServiceFee ? subtotal * 1.1 : subtotal
                    return (
                      <div
                        key={c.id}
                        className="p-3.5 rounded-xl bg-[#1C1917] border border-purple-500/40 flex items-center justify-between hover:border-purple-500 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/40 flex flex-col items-center justify-center font-black">
                            <span className="text-[9px] uppercase leading-none text-purple-400">
                              Mesa
                            </span>
                            <span className="text-sm leading-none font-bold">{c.tableNumber}</span>
                          </div>
                          <div>
                            <div className="font-bold text-stone-100 text-sm flex items-center gap-2 flex-wrap">
                              <span>Mesa {c.tableNumber}</span>
                              {c.clientName && (
                                <span className="text-stone-400 font-normal">— {c.clientName}</span>
                              )}
                              {c.contaSolicitada && (
                                <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/40 text-[10px] font-bold py-0 h-4">
                                  {c.formaPagamentoSolicitada || 'Pix'}
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-stone-400 flex items-center gap-2 mt-0.5">
                              <span>{c.items.length} itens</span>
                              <span>•</span>
                              <span>{c.guestCount} pessoa(s)</span>
                              {c.formaPagamentoSolicitada && (
                                <>
                                  <span>•</span>
                                  <span className="text-amber-400 font-medium">
                                    Paga em {c.formaPagamentoSolicitada}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="text-xs text-stone-400">Total</div>
                            <div className="text-base font-extrabold text-stone-100 tabular-nums">
                              R$ {totalComanda.toFixed(2)}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => navigate('/comandas')}
                            className="bg-purple-500 hover:bg-purple-600 text-stone-950 font-bold text-xs h-8"
                          >
                            Receber
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="pt-3 mt-3 border-t border-[#44403C]/60 flex items-center justify-between text-xs text-stone-400">
              <span>{openComandasCount} comandas abertas no total</span>
              <Button
                variant="link"
                size="sm"
                onClick={() => navigate('/comandas')}
                className="text-amber-400 p-0 h-auto text-xs"
              >
                Mapa de mesas <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </div>

          {/* Painel 2: Movimentações do Caixa Hoje */}
          <div className="p-5 rounded-2xl bg-[#292524] border border-[#44403C] shadow-md flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-stone-100">Movimentações do Caixa Hoje</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/fluxo-caixa')}
                  className="text-amber-400 text-xs h-7 hover:bg-stone-800"
                >
                  Histórico completo
                </Button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#44403C] text-stone-400">
                      <th className="pb-2 font-semibold">Horário</th>
                      <th className="pb-2 font-semibold">Descrição</th>
                      <th className="pb-2 font-semibold">Forma</th>
                      <th className="pb-2 font-semibold text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#44403C]/40">
                    {cashMovements.slice(0, 6).map((m) => (
                      <tr key={m.id} className="hover:bg-[#44403C]/30 transition-colors">
                        <td className="py-2.5 text-stone-400 tabular-nums">
                          {m.datetime.includes('T')
                            ? m.datetime.split('T')[1].substring(0, 5)
                            : '19:30'}
                        </td>
                        <td className="py-2.5 font-medium text-stone-200 truncate max-w-[140px]">
                          {m.description}
                        </td>
                        <td className="py-2.5 text-stone-400">
                          {m.paymentMethod || (m.type === 'Entrada' ? 'Pix' : 'Dinheiro')}
                        </td>
                        <td className="py-2.5 font-bold tabular-nums text-right">
                          <span
                            className={m.type === 'Entrada' ? 'text-emerald-400' : 'text-red-400'}
                          >
                            {m.type === 'Entrada' ? '+' : '-'} R$ {m.value.toFixed(2)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="pt-3 mt-3 border-t border-[#44403C]/60 flex items-center justify-between text-xs text-stone-400">
              <span>Saldo líquido do turno: R$ {todayCashNet.toFixed(2)}</span>
              <Button
                variant="link"
                size="sm"
                onClick={() => navigate('/fluxo-caixa')}
                className="text-amber-400 p-0 h-auto text-xs"
              >
                Abrir fluxo de caixa <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </div>
        </div>

        {/* Atalhos Operacionais do Caixa */}
        <div className="p-5 rounded-2xl bg-[#292524] border border-[#44403C] shadow-md">
          <h2 className="text-sm font-bold text-stone-300 uppercase tracking-wider mb-3">
            Atalhos Operacionais do Caixa
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <Button
              onClick={() => navigate('/comandas')}
              className="h-12 bg-[#1C1917] hover:bg-amber-500 hover:text-stone-950 text-stone-200 border border-[#44403C] hover:border-amber-500 font-semibold text-xs transition-all duration-200 flex items-center justify-center gap-2 group"
            >
              <Receipt className="w-4 h-4 text-purple-400 group-hover:text-stone-950" />
              Receber Comandas
            </Button>

            <Button
              onClick={() => setCaixaSangriaModal(true)}
              className="h-12 bg-[#1C1917] hover:bg-red-500 hover:text-white text-stone-200 border border-[#44403C] hover:border-red-500 font-semibold text-xs transition-all duration-200 flex items-center justify-center gap-2 group"
            >
              <ArrowDownLeft className="w-4 h-4 text-red-400 group-hover:text-white" />
              Registrar Saída / Sangria
            </Button>

            <Button
              onClick={() => setCaixaSuprimentoModal(true)}
              className="h-12 bg-[#1C1917] hover:bg-emerald-500 hover:text-stone-950 text-stone-200 border border-[#44403C] hover:border-emerald-500 font-semibold text-xs transition-all duration-200 flex items-center justify-center gap-2 group"
            >
              <Plus className="w-4 h-4 text-emerald-400 group-hover:text-stone-950" />
              Suprimento de Troco
            </Button>

            <Button
              onClick={() => setCloseRegisterModal(true)}
              className="h-12 bg-[#1C1917] hover:bg-red-500 hover:text-white text-stone-200 border border-[#44403C] hover:border-red-500 font-semibold text-xs transition-all duration-200 flex items-center justify-center gap-2 group"
            >
              <Lock className="w-4 h-4 text-red-400 group-hover:text-white" />
              Fechar Caixa do Dia
            </Button>
          </div>
        </div>

        {/* Modal Caixa: Sangria / Saída */}
        <Dialog open={caixaSangriaModal} onOpenChange={setCaixaSangriaModal}>
          <DialogContent className="max-w-md bg-[#292524] border-[#44403C] text-stone-100">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-stone-100 flex items-center gap-2">
                <ArrowDownLeft className="w-5 h-5 text-red-400" />
                Registrar Sangria / Retirada do Caixa
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSangriaSubmit} className="space-y-4 pt-2">
              <div>
                <Label className="text-xs text-stone-400">Motivo / Descrição da Saída</Label>
                <Input
                  value={caixaSangriaDesc}
                  onChange={(e) => setCaixaSangriaDesc(e.target.value)}
                  placeholder="Ex: Sangria para cofre, pagamento fornecedor gelo..."
                  className="mt-1 bg-[#1C1917] border-[#44403C] text-stone-100 text-sm"
                  required
                />
              </div>

              <div>
                <Label className="text-xs text-stone-400">Valor da Retirada (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={caixaSangriaVal}
                  onChange={(e) => setCaixaSangriaVal(e.target.value)}
                  placeholder="0.00"
                  className="mt-1 bg-[#1C1917] border-[#44403C] text-stone-100 text-sm"
                  required
                />
              </div>

              <div>
                <Label className="text-xs text-stone-400">Forma de Retirada</Label>
                <select
                  value={caixaPaymentMethod}
                  onChange={(e) => setCaixaPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full mt-1 bg-[#1C1917] border border-[#44403C] rounded-lg px-3 py-2 text-sm text-stone-100 focus:outline-none focus:border-red-500"
                >
                  <option value="Dinheiro">Dinheiro (Gaveta)</option>
                  <option value="Pix">Pix</option>
                  <option value="Cartão Débito">Cartão Débito</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setCaixaSangriaModal(false)}
                  className="text-stone-400 text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="bg-red-500 hover:bg-red-600 text-white font-bold text-xs"
                >
                  Confirmar Sangria
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Modal Caixa: Suprimento */}
        <Dialog open={caixaSuprimentoModal} onOpenChange={setCaixaSuprimentoModal}>
          <DialogContent className="max-w-md bg-[#292524] border-[#44403C] text-stone-100">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-stone-100 flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-400" />
                Registrar Suprimento de Troco
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSuprimentoSubmit} className="space-y-4 pt-2">
              <div>
                <Label className="text-xs text-stone-400">Descrição</Label>
                <Input
                  value={caixaSuprimentoDesc}
                  onChange={(e) => setCaixaSuprimentoDesc(e.target.value)}
                  className="mt-1 bg-[#1C1917] border-[#44403C] text-stone-100 text-sm"
                  required
                />
              </div>

              <div>
                <Label className="text-xs text-stone-400">Valor do Suprimento (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={caixaSuprimentoVal}
                  onChange={(e) => setCaixaSuprimentoVal(e.target.value)}
                  placeholder="0.00"
                  className="mt-1 bg-[#1C1917] border-[#44403C] text-stone-100 text-sm"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setCaixaSuprimentoModal(false)}
                  className="text-stone-400 text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="bg-emerald-500 hover:bg-emerald-600 text-stone-950 font-bold text-xs"
                >
                  Confirmar Suprimento
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Modal: Fechar Caixa */}
        <Dialog open={closeRegisterModal} onOpenChange={setCloseRegisterModal}>
          <DialogContent className="max-w-md bg-[#292524] border-[#44403C] text-stone-100">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-stone-100">
                Confirmar Fechamento do Caixa
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-2 text-xs">
              <p className="text-stone-300">
                Você está prestes a fechar o turno e homologar o saldo do caixa de hoje.
              </p>
              <div className="p-3 rounded-xl bg-[#1C1917] border border-[#44403C] space-y-2">
                <div className="flex justify-between">
                  <span className="text-stone-400">Total de Entradas:</span>
                  <span className="text-emerald-400 font-bold tabular-nums">
                    R$ {todayCashEntries.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">Total de Saídas:</span>
                  <span className="text-red-400 font-bold tabular-nums">
                    R$ {todayCashExits.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">Saldo Dinheiro na Gaveta:</span>
                  <span className="text-amber-400 font-bold tabular-nums">
                    R$ {cashInDrawer.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-[#44403C] pt-2">
                  <span className="text-stone-400">Responsável:</span>
                  <span className="text-stone-200 font-semibold">{role}</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setCloseRegisterModal(false)}
                  className="text-stone-400 text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleConfirmCloseRegister}
                  className="bg-red-500 hover:bg-red-600 text-white font-bold text-xs"
                >
                  Confirmar Fechamento
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  // =========================================================================
  // RENDER: DASHBOARD DO GERENTE (COMPLETO)
  // =========================================================================
  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Welcome & Simulation Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-[#292524] via-[#292524] to-[#342D26] border border-[#44403C]">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl sm:text-2xl font-black text-stone-100 tracking-tight">
              Olá, {role}!
            </span>
            <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/40 text-xs px-2.5 py-0.5 font-bold flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              Supabase Ativo
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-stone-400 capitalize mt-1">
            {todayDateString} • Rachide Bar & Petiscaria
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => navigate('/comandas')}
            className="bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold text-xs"
          >
            <ClipboardList className="w-4 h-4 mr-1.5" />
            Ver Mesas ({openComandasCount})
          </Button>
        </div>
      </div>

      {/* 4 KPIs Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Faturamento Hoje */}
        <div className="p-5 rounded-2xl bg-[#292524] border border-[#44403C] hover:-translate-y-1 transition-all duration-200 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-400 uppercase tracking-wider">
              Faturamento Hoje
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-stone-100 tabular-nums">
              R$ {todayCashEntries.toFixed(2)}
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-xs text-emerald-400 font-medium">
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>+18.4% vs. ontem</span>
            </div>
          </div>
        </div>

        {/* KPI 2: Comandas Abertas */}
        <div className="p-5 rounded-2xl bg-[#292524] border border-[#44403C] hover:-translate-y-1 transition-all duration-200 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-400 uppercase tracking-wider">
              Comandas Abertas
            </span>
            <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
              <ClipboardList className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-stone-100 tabular-nums">
              {openComandasCount} <span className="text-sm font-normal text-stone-400">mesas</span>
            </div>
            <div className="flex items-center gap-1 mt-1 text-xs text-stone-400">
              <span>
                Capacidade ativa: {ocupacaoPercent}% ({totalMesasCount} mesas no banco)
              </span>
            </div>
          </div>
        </div>

        {/* KPI 3: Ticket Médio */}
        <div className="p-5 rounded-2xl bg-[#292524] border border-[#44403C] hover:-translate-y-1 transition-all duration-200 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-400 uppercase tracking-wider">
              Ticket Médio
            </span>
            <div className="p-2 rounded-xl bg-blue-500/15 text-blue-400 border border-blue-500/30">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-stone-100 tabular-nums">
              R$ {ticketMedio.toFixed(2)}
            </div>
            <div className="flex items-center gap-1 mt-1 text-xs text-blue-400 font-medium">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Meta diária: R$ 50,00</span>
            </div>
          </div>
        </div>

        {/* KPI 4: Estoque Crítico */}
        <div className="p-5 rounded-2xl bg-[#292524] border border-[#44403C] hover:-translate-y-1 transition-all duration-200 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-400 uppercase tracking-wider">
              Estoque Crítico
            </span>
            <div className="p-2 rounded-xl bg-red-500/15 text-red-400 border border-red-500/30">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-red-400 tabular-nums">
              {criticalStockCount} <span className="text-sm font-normal text-stone-400">itens</span>
            </div>
            <div className="flex items-center gap-1 mt-1 text-xs text-red-400 font-medium">
              <span>Requer reposição urgente</span>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row: 7 Days Sales + Payment Methods */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Chart (Spans 2 columns) */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-[#292524] border border-[#44403C] shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-stone-100">Faturamento dos Últimos 7 Dias</h2>
              <p className="text-xs text-stone-400">Histórico semanal com média de R$ 4.380/dia</p>
            </div>
            <Badge
              variant="outline"
              className="border-amber-500/40 text-amber-400 bg-amber-500/10 text-xs"
            >
              Valores em R$
            </Badge>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={LAST_7_DAYS_DATA}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#44403C" vertical={false} />
                <XAxis dataKey="day" stroke="#A8A29E" fontSize={12} tickLine={false} />
                <YAxis stroke="#A8A29E" fontSize={12} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1C1917',
                    border: '1px solid #44403C',
                    borderRadius: '8px',
                    color: '#F5F5F4',
                  }}
                  formatter={(value: any) => [`R$ ${Number(value).toFixed(2)}`, 'Faturamento']}
                />
                <Bar dataKey="valor" fill="#F59E0B" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Payment Methods Donut */}
        <div className="p-5 rounded-2xl bg-[#292524] border border-[#44403C] shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-base font-bold text-stone-100 flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-amber-500" />
              Formas de Pagamento
            </h2>
            <span className="text-[11px] text-stone-400">Hoje</span>
          </div>

          <div className="h-44 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={PAYMENT_METHODS_DATA}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {PAYMENT_METHODS_DATA.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1C1917',
                    border: '1px solid #44403C',
                    borderRadius: '8px',
                  }}
                  formatter={(val: any) => [`${val}%`, 'Participação']}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-[#44403C]">
            {PAYMENT_METHODS_DATA.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-stone-300">{item.name}</span>
                </div>
                <span className="font-bold text-stone-200 tabular-nums">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top 5 Products & Recent Sales */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 5 Products */}
        <div className="p-5 rounded-2xl bg-[#292524] border border-[#44403C] shadow-md">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-stone-100 flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-amber-500" />
              Produtos Mais Vendidos
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/cardapio')}
              className="text-amber-400 text-xs h-7 hover:bg-stone-800"
            >
              Ver cardápio
            </Button>
          </div>

          <div className="space-y-3.5">
            {topProducts.map((p, i) => (
              <div key={p.name} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-stone-200 flex items-center gap-2">
                    <span className="text-amber-500 font-bold text-[11px] w-4">{i + 1}º</span>
                    {p.name}
                  </span>
                  <span className="text-stone-400 font-bold tabular-nums">{p.sales} un</span>
                </div>
                <div className="w-full bg-[#1C1917] h-2 rounded-full overflow-hidden border border-stone-800">
                  <div
                    className="bg-amber-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${p.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Sales Table */}
        <div className="p-5 rounded-2xl bg-[#292524] border border-[#44403C] shadow-md flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-stone-100">Últimas Vendas & Movimentos</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/fluxo-caixa')}
                className="text-amber-400 text-xs h-7 hover:bg-stone-800"
              >
                Histórico completo
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#44403C] text-stone-400">
                    <th className="pb-2 font-semibold">Horário</th>
                    <th className="pb-2 font-semibold">Descrição</th>
                    <th className="pb-2 font-semibold">Valor</th>
                    <th className="pb-2 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#44403C]/40">
                  {cashMovements.slice(0, 5).map((m) => (
                    <tr key={m.id} className="hover:bg-[#44403C]/30 transition-colors">
                      <td className="py-2.5 text-stone-400 tabular-nums">
                        {m.datetime.includes('T')
                          ? m.datetime.split('T')[1].substring(0, 5)
                          : '19:30'}
                      </td>
                      <td className="py-2.5 font-medium text-stone-200 truncate max-w-[150px]">
                        {m.description}
                      </td>
                      <td className="py-2.5 font-bold tabular-nums text-stone-100">
                        R$ {m.value.toFixed(2)}
                      </td>
                      <td className="py-2.5">
                        <Badge
                          variant="outline"
                          className={
                            m.type === 'Entrada'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px]'
                              : 'bg-red-500/10 text-red-400 border-red-500/30 text-[10px]'
                          }
                        >
                          {m.type === 'Entrada' ? 'Concluído' : 'Saída'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* 4 Quick Actions Row (Gestor) */}
      <div className="p-5 rounded-2xl bg-[#292524] border border-[#44403C] shadow-md">
        <h2 className="text-sm font-bold text-stone-300 uppercase tracking-wider mb-3">
          Ações Rápidas do Gestor
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Button
            onClick={() => setNewComandaModal(true)}
            className="h-12 bg-[#1C1917] hover:bg-amber-500 hover:text-stone-950 text-stone-200 border border-[#44403C] hover:border-amber-500 font-semibold text-xs transition-all duration-200 flex items-center justify-center gap-2 group"
          >
            <PlusCircle className="w-4 h-4 text-amber-500 group-hover:text-stone-950" />
            Nova Comanda
          </Button>

          <Button
            onClick={() => setQuickSaleModal(true)}
            className="h-12 bg-[#1C1917] hover:bg-amber-500 hover:text-stone-950 text-stone-200 border border-[#44403C] hover:border-amber-500 font-semibold text-xs transition-all duration-200 flex items-center justify-center gap-2 group"
          >
            <Coins className="w-4 h-4 text-emerald-500 group-hover:text-stone-950" />
            Registrar Venda
          </Button>

          <Button
            onClick={() => {
              if (checkRoleAccess(['Gerente'], 'repor estoque')) {
                navigate('/estoque')
              }
            }}
            className="h-12 bg-[#1C1917] hover:bg-amber-500 hover:text-stone-950 text-stone-200 border border-[#44403C] hover:border-amber-500 font-semibold text-xs transition-all duration-200 flex items-center justify-center gap-2 group"
          >
            <PackagePlus className="w-4 h-4 text-blue-500 group-hover:text-stone-950" />
            Repor Estoque
          </Button>

          <Button
            onClick={() => setCloseRegisterModal(true)}
            className="h-12 bg-[#1C1917] hover:bg-red-500 hover:text-white text-stone-200 border border-[#44403C] hover:border-red-500 font-semibold text-xs transition-all duration-200 flex items-center justify-center gap-2 group"
          >
            <Lock className="w-4 h-4 text-red-400 group-hover:text-white" />
            Fechar Caixa
          </Button>
        </div>
      </div>

      {/* Quick Action Modal: Nova Comanda */}
      <Dialog open={newComandaModal} onOpenChange={setNewComandaModal}>
        <DialogContent className="max-w-md bg-[#292524] border-[#44403C] text-stone-100">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-stone-100">
              Abertura Rápida de Comanda
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleOpenComandaSubmit} className="space-y-4 pt-2">
            <div>
              <Label className="text-xs text-stone-400">Número da Mesa</Label>
              <select
                value={selectedTableNum}
                onChange={(e) => setSelectedTableNum(Number(e.target.value))}
                className="w-full mt-1 bg-[#1C1917] border border-[#44403C] rounded-lg px-3 py-2 text-sm text-stone-100 focus:outline-none focus:border-amber-500"
              >
                {comandas
                  .filter((c) => c.status === 'Livre')
                  .map((c) => (
                    <option key={c.tableNumber} value={c.tableNumber}>
                      Mesa {c.tableNumber} (Livre)
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <Label className="text-xs text-stone-400">Nome do Cliente (Opcional)</Label>
              <Input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Ex: Família Silva, Aniversário..."
                className="mt-1 bg-[#1C1917] border-[#44403C] text-stone-100 text-sm"
              />
            </div>

            <div>
              <Label className="text-xs text-stone-400">Quantidade de Pessoas</Label>
              <div className="flex items-center gap-3 mt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setGuestCount(Math.max(1, guestCount - 1))}
                  className="bg-[#1C1917] border-[#44403C] text-stone-200"
                >
                  -
                </Button>
                <span className="font-bold text-lg tabular-nums w-8 text-center">{guestCount}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setGuestCount(guestCount + 1)}
                  className="bg-[#1C1917] border-[#44403C] text-stone-200"
                >
                  +
                </Button>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setNewComandaModal(false)}
                className="text-stone-400 text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold text-xs"
              >
                Abrir Comanda
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Quick Action Modal: Registrar Venda */}
      <Dialog open={quickSaleModal} onOpenChange={setQuickSaleModal}>
        <DialogContent className="max-w-md bg-[#292524] border-[#44403C] text-stone-100">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-stone-100">
              Registrar Venda Rápida de Balcão
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleQuickSaleSubmit} className="space-y-4 pt-2">
            <div>
              <Label className="text-xs text-stone-400">Descrição da Venda</Label>
              <Input
                value={quickSaleDesc}
                onChange={(e) => setQuickSaleDesc(e.target.value)}
                className="mt-1 bg-[#1C1917] border-[#44403C] text-stone-100 text-sm"
                required
              />
            </div>

            <div>
              <Label className="text-xs text-stone-400">Valor Total (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={quickSaleVal}
                onChange={(e) => setQuickSaleVal(e.target.value)}
                className="mt-1 bg-[#1C1917] border-[#44403C] text-stone-100 text-sm"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setQuickSaleModal(false)}
                className="text-stone-400 text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-emerald-500 hover:bg-emerald-600 text-stone-950 font-bold text-xs"
              >
                Confirmar Recebimento
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Quick Action Modal: Fechar Caixa */}
      <Dialog open={closeRegisterModal} onOpenChange={setCloseRegisterModal}>
        <DialogContent className="max-w-md bg-[#292524] border-[#44403C] text-stone-100">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-stone-100">
              Confirmar Fechamento do Caixa
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2 text-xs">
            <p className="text-stone-300">
              Você está prestes a fechar o turno e homologar o saldo do caixa de hoje.
            </p>
            <div className="p-3 rounded-xl bg-[#1C1917] border border-[#44403C] space-y-2">
              <div className="flex justify-between">
                <span className="text-stone-400">Total de Entradas:</span>
                <span className="text-emerald-400 font-bold tabular-nums">
                  R$ {todayCashEntries.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-400">Responsável:</span>
                <span className="text-stone-200 font-semibold">{role}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setCloseRegisterModal(false)}
                className="text-stone-400 text-xs"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleConfirmCloseRegister}
                className="bg-red-500 hover:bg-red-600 text-white font-bold text-xs"
              >
                Confirmar Fechamento
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
