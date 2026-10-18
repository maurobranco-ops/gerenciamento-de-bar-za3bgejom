import React, { useState, useMemo, useEffect, useCallback } from 'react'
import {
  ChefHat,
  Beer,
  Clock,
  CheckCircle2,
  Flame,
  ArrowRight,
  RefreshCw,
  Filter,
  Check,
  CheckCheck,
  UtensilsCrossed,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  Radio,
  Printer,
  Sparkles,
  LogOut,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
} from 'lucide-react'
import { useBar } from '../context/BarContext'
import { useAuth } from '../hooks/use-auth'
import { AreaPreparo, KitchenStatus, FilaCozinhaItem } from '../types/bar'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { SoundEffects } from '../lib/soundEffects'
import { printKitchenTicket } from '../lib/thermalPrinter'
import { toast } from '../hooks/use-toast'
import { useNavigate } from 'react-router-dom'

interface ColumnConfig {
  key: KitchenStatus
  label: string
  subtitle: string
  color: string
  badgeClass: string
  icon: React.ComponentType<{ className?: string }>
}

const KANBAN_COLUMNS: ColumnConfig[] = [
  {
    key: 'pendente',
    label: 'Pendente',
    subtitle: 'Aguardando início de preparo',
    color: 'border-amber-500/60 bg-amber-500/5',
    badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    icon: Clock,
  },
  {
    key: 'preparando',
    label: 'Preparando',
    subtitle: 'Em confecção na praça',
    color: 'border-blue-500/60 bg-blue-500/5',
    badgeClass: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    icon: Flame,
  },
  {
    key: 'pronto',
    label: 'Pronto',
    subtitle: 'Pronto para retirada / entrega',
    color: 'border-emerald-500/60 bg-emerald-500/5',
    badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    icon: CheckCircle2,
  },
  {
    key: 'entregue',
    label: 'Entregue',
    subtitle: 'Servido na mesa / finalizado',
    color: 'border-stone-700 bg-stone-900/40',
    badgeClass: 'bg-stone-800 text-stone-400 border-stone-700',
    icon: CheckCheck,
  },
]

export default function KdsCozinha() {
  const {
    filaCozinha,
    fetchFilaCozinha,
    updateFilaStatus,
    settings,
    soundEnabled,
    toggleSound,
    lastOnlineOrderId,
    clearUnreadOnlineOrders,
  } = useBar()

  const { role, profile, user, signOut } = useAuth()
  const navigate = useNavigate()

  // Filtro grande por praça
  const [selectedArea, setSelectedArea] = useState<AreaPreparo | 'todos'>('todos')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [collapsedEntregue, setCollapsedEntregue] = useState(true)

  // Timer "ao vivo" para atualizar o cronômetro a cada 5 segundos
  const [nowTimestamp, setNowTimestamp] = useState<number>(() => Date.now())

  useEffect(() => {
    const timer = setInterval(() => {
      setNowTimestamp(Date.now())
    }, 5000)
    return () => clearInterval(timer)
  }, [])

  // Limpa notificações pendentes de online ao abrir a tela de KDS
  useEffect(() => {
    clearUnreadOnlineOrders()
  }, [clearUnreadOnlineOrders])

  // Ouvinte de mudança de fullscreen nativo
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement))
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen()
        setIsFullscreen(true)
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen()
        }
        setIsFullscreen(false)
      }
    } catch (err) {
      console.warn('Erro ao alternar tela cheia:', err)
      toast({
        title: 'Tela Cheia',
        description: 'Pressione F11 no seu teclado para alternar modo tela cheia.',
      })
    }
  }, [])

  const handleManualRefresh = async () => {
    setIsRefreshing(true)
    await fetchFilaCozinha()
    setTimeout(() => setIsRefreshing(false), 400)
  }

  // Filtragem dos itens da fila por área
  const filteredItems = useMemo(() => {
    return filaCozinha.filter((item) => {
      if (selectedArea !== 'todos' && item.areaPreparo !== selectedArea) {
        return false
      }
      return true
    })
  }, [filaCozinha, selectedArea])

  // Contadores
  const counts = useMemo(() => {
    const bar = filaCozinha.filter((i) => i.areaPreparo === 'bar' && i.status !== 'entregue').length
    const cozinha = filaCozinha.filter(
      (i) => i.areaPreparo === 'cozinha' && i.status !== 'entregue',
    ).length
    const pendentes = filaCozinha.filter((i) => i.status === 'pendente').length
    const preparando = filaCozinha.filter((i) => i.status === 'preparando').length
    const prontos = filaCozinha.filter((i) => i.status === 'pronto').length
    const entregues = filaCozinha.filter((i) => i.status === 'entregue').length
    return {
      bar,
      cozinha,
      totalAtivo: pendentes + preparando + prontos,
      pendentes,
      preparando,
      prontos,
      entregues,
    }
  }, [filaCozinha])

  // Cronômetro de espera: cálculo de minutos e classe de cor
  // Normal (0-10 min) -> Amarelo (10-20 min) -> Vermelho (> 20 min)
  const getWaitingTimeData = (createdAt: string) => {
    try {
      const created = new Date(createdAt).getTime()
      const diffMs = Math.max(0, nowTimestamp - created)
      const diffMins = Math.floor(diffMs / 60000)
      const diffSecs = Math.floor((diffMs % 60000) / 1000)

      let label = ''
      if (diffMins < 1) {
        label = `${diffSecs}s`
      } else if (diffMins < 60) {
        label = `${diffMins}m ${diffSecs}s`
      } else {
        const hours = Math.floor(diffMins / 60)
        label = `${hours}h ${diffMins % 60}m`
      }

      // Severidade por tempo de espera
      let severityClass = 'bg-stone-800/90 text-stone-200 border-stone-600'
      let isUrgent = false

      if (diffMins >= 20) {
        severityClass = 'bg-red-500/20 text-red-300 border-red-500/60 animate-pulse font-extrabold'
        isUrgent = true
      } else if (diffMins >= 10) {
        severityClass = 'bg-amber-500/20 text-amber-300 border-amber-500/60 font-bold'
      } else {
        severityClass = 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 font-semibold'
      }

      return {
        label,
        diffMins,
        severityClass,
        isUrgent,
      }
    } catch {
      return {
        label: '--',
        diffMins: 0,
        severityClass: 'bg-stone-800 text-stone-400 border-stone-700',
        isUrgent: false,
      }
    }
  }

  const formatHoraPedido = (createdAt: string) => {
    try {
      const date = new Date(createdAt)
      return date.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return ''
    }
  }

  const handlePrintTicket = (item: FilaCozinhaItem) => {
    const success = printKitchenTicket({ item, settings })
    if (success) {
      toast({
        title: `Ticket impresso: Mesa ${item.mesaNumero}`,
        description: `Ticket de ${item.nomeProduto} enviado para impressora térmica.`,
      })
    } else {
      toast({
        variant: 'destructive',
        title: 'Popups bloqueados',
        description: 'Permita popups neste navegador para imprimir o ticket.',
      })
    }
  }

  const isOnlyKitchenUser = role === 'Cozinha'

  return (
    <div
      className={`min-h-screen bg-[#141210] text-stone-100 flex flex-col font-sans transition-all ${
        isFullscreen ? 'fixed inset-0 z-50 p-3 sm:p-5 overflow-y-auto' : 'space-y-4'
      }`}
    >
      {/* BARRA SUPERIOR DO KDS COM FILTROS GRANDES POR PRAÇA E BOTÕES DE CONTROLE */}
      <header className="p-3.5 sm:p-4 rounded-2xl bg-[#1C1917] border border-[#38332E] shadow-lg flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Identificação da tela & Status realtime */}
        <div className="flex items-center justify-between lg:justify-start gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500 text-stone-950 flex items-center justify-center font-black shadow-md shadow-amber-950/40">
              <ChefHat className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-stone-50">
                  KDS Cozinha & Bar
                </h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[11px] font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Ao Vivo
                </span>
              </div>
              <p className="text-xs text-stone-400 hidden sm:block">
                Fila de produção em colunas Kanban com cronômetro de espera e toque rápido.
              </p>
            </div>
          </div>

          {/* Em modo Cozinha restrita, botão de logout rápido no topo para mobile */}
          {isOnlyKitchenUser && (
            <div className="lg:hidden">
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  await signOut()
                  navigate('/login')
                }}
                className="text-stone-400 hover:text-red-400 text-xs h-9 px-2.5"
                title="Sair da conta"
              >
                <LogOut className="w-4 h-4 mr-1" />
                Sair
              </Button>
            </div>
          )}
        </div>

        {/* FILTRO GIGANTE POR PRAÇA (Cozinha / Bar / Todas) - botões touch-first */}
        <div className="flex items-center justify-center bg-[#292524] p-1.5 rounded-2xl border border-[#44403C] gap-1.5 overflow-x-auto max-w-full">
          <button
            type="button"
            onClick={() => setSelectedArea('todos')}
            className={`flex-1 sm:flex-initial min-w-[90px] sm:min-w-[110px] py-2.5 px-4 rounded-xl text-xs sm:text-sm font-extrabold transition-all flex items-center justify-center gap-2 whitespace-nowrap active:scale-95 ${
              selectedArea === 'todos'
                ? 'bg-amber-500 text-stone-950 shadow-md shadow-amber-950/40'
                : 'text-stone-300 hover:text-white hover:bg-[#38332E]'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span>Todas ({counts.totalAtivo})</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedArea('cozinha')}
            className={`flex-1 sm:flex-initial min-w-[90px] sm:min-w-[120px] py-2.5 px-4 rounded-xl text-xs sm:text-sm font-extrabold transition-all flex items-center justify-center gap-2 whitespace-nowrap active:scale-95 ${
              selectedArea === 'cozinha'
                ? 'bg-amber-500 text-stone-950 shadow-md shadow-amber-950/40'
                : 'text-stone-300 hover:text-white hover:bg-[#38332E]'
            }`}
          >
            <UtensilsCrossed className="w-4 h-4" />
            <span>Cozinha ({counts.cozinha})</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedArea('bar')}
            className={`flex-1 sm:flex-initial min-w-[90px] sm:min-w-[110px] py-2.5 px-4 rounded-xl text-xs sm:text-sm font-extrabold transition-all flex items-center justify-center gap-2 whitespace-nowrap active:scale-95 ${
              selectedArea === 'bar'
                ? 'bg-amber-500 text-stone-950 shadow-md shadow-amber-950/40'
                : 'text-stone-300 hover:text-white hover:bg-[#38332E]'
            }`}
          >
            <Beer className="w-4 h-4" />
            <span>Bar ({counts.bar})</span>
          </button>
        </div>

        {/* CONTROLES: SOM, TELA CHEIA, ATUALIZAR E SAIR */}
        <div className="flex items-center justify-end gap-2 flex-wrap">
          {/* Som Ativo / Mudo */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              toggleSound()
              if (!soundEnabled) {
                SoundEffects.playOrderAlert()
              }
            }}
            className={`h-10 px-3.5 rounded-xl text-xs font-bold bg-[#292524] border-[#44403C] transition-all active:scale-95 ${
              soundEnabled
                ? 'text-amber-400 border-amber-500/50 bg-amber-500/10'
                : 'text-stone-400 hover:text-stone-200'
            }`}
            title={soundEnabled ? 'Silenciar alerta sonoro' : 'Ativar alerta sonoro de novo pedido'}
          >
            {soundEnabled ? (
              <>
                <Volume2 className="w-4 h-4 mr-1.5 text-amber-400" />
                <span>Alerta Som</span>
              </>
            ) : (
              <>
                <VolumeX className="w-4 h-4 mr-1.5 text-stone-500" />
                <span>Mudo</span>
              </>
            )}
          </Button>

          {/* Modo Tela Cheia */}
          <Button
            variant="outline"
            size="sm"
            onClick={toggleFullscreen}
            className={`h-10 px-3.5 rounded-xl text-xs font-bold bg-[#292524] border-[#44403C] hover:bg-[#38332E] text-stone-200 active:scale-95 ${
              isFullscreen ? 'border-amber-500 text-amber-300' : ''
            }`}
            title={isFullscreen ? 'Sair da tela cheia' : 'Ativar modo tela cheia (KDS TV)'}
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="w-4 h-4 mr-1.5 text-amber-400" />
                <span>Janela</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-4 h-4 mr-1.5 text-amber-400" />
                <span>Tela Cheia</span>
              </>
            )}
          </Button>

          {/* Atualizar Manual */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="h-10 px-3.5 rounded-xl text-xs font-bold bg-[#292524] border-[#44403C] hover:bg-[#38332E] text-stone-200 active:scale-95"
            title="Atualizar dados agora"
          >
            <RefreshCw
              className={`w-4 h-4 mr-1.5 text-amber-500 ${isRefreshing ? 'animate-spin' : ''}`}
            />
            <span className="hidden sm:inline">Atualizar</span>
          </Button>

          {/* Botão de Logout para usuário com perfil Cozinha */}
          {isOnlyKitchenUser && (
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await signOut()
                navigate('/login')
              }}
              className="h-10 px-3.5 rounded-xl text-xs font-bold bg-red-950/20 hover:bg-red-950/40 text-red-300 border-red-900/40 hidden lg:flex items-center gap-1.5 active:scale-95"
              title="Sair do sistema"
            >
              <LogOut className="w-4 h-4" />
              <span>Sair</span>
            </Button>
          )}
        </div>
      </header>

      {/* QUADRO KANBAN EM COLUNAS: PENDENTE | PREPARANDO | PRONTO | ENTREGUE */}
      <main className="flex-1 pb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
          {KANBAN_COLUMNS.map((col) => {
            const ColIcon = col.icon
            const itemsInCol = filteredItems.filter((i) => i.status === col.key)
            const isEntregueCol = col.key === 'entregue'

            return (
              <section
                key={col.key}
                className={`rounded-2xl border transition-all flex flex-col min-h-[580px] bg-[#1C1917] ${
                  col.color
                } ${isEntregueCol && collapsedEntregue ? 'lg:min-h-[140px]' : ''}`}
              >
                {/* Header da Coluna */}
                <div className="p-4 border-b border-[#38332E] flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-[#292524] border border-[#44403C] text-amber-400">
                      <ColIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-base sm:text-lg font-black text-stone-100">
                          {col.label}
                        </h2>
                        <Badge
                          variant="outline"
                          className={`text-xs font-black px-2 py-0.5 rounded-full ${col.badgeClass}`}
                        >
                          {itemsInCol.length}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-stone-400 leading-tight mt-0.5">
                        {col.subtitle}
                      </p>
                    </div>
                  </div>

                  {/* Toggle para colapsar coluna de entregues */}
                  {isEntregueCol && (
                    <button
                      type="button"
                      onClick={() => setCollapsedEntregue(!collapsedEntregue)}
                      className="p-1.5 rounded-lg bg-[#292524] hover:bg-[#38332E] text-stone-400 hover:text-stone-200 border border-[#44403C] transition-colors"
                      title={collapsedEntregue ? 'Expandir coluna' : 'Recolher coluna'}
                    >
                      {collapsedEntregue ? (
                        <ChevronDown className="w-4 h-4 text-amber-400" />
                      ) : (
                        <ChevronUp className="w-4 h-4 text-amber-400" />
                      )}
                    </button>
                  )}
                </div>

                {/* Conteúdo da Coluna (Cartões) */}
                {(!isEntregueCol || !collapsedEntregue) && (
                  <div className="p-3.5 space-y-3.5 flex-1 overflow-y-auto max-h-[calc(100vh-220px)]">
                    {itemsInCol.length === 0 ? (
                      <div className="py-16 text-center text-stone-500 text-xs border border-dashed border-[#38332E] rounded-2xl flex flex-col items-center justify-center gap-2">
                        <ColIcon className="w-8 h-8 text-stone-600" />
                        <span>Nenhum pedido {col.label.toLowerCase()} no momento</span>
                      </div>
                    ) : (
                      itemsInCol.map((item) => {
                        const waiting = getWaitingTimeData(item.createdAt)
                        const horaFormatada = formatHoraPedido(item.createdAt)
                        const isOnlineOrder = Boolean(item.origemOnline)
                        const isRecentPulse = lastOnlineOrderId === item.id

                        return (
                          <article
                            key={item.id}
                            className={`p-4 sm:p-5 rounded-2xl bg-[#25221F] border-2 transition-all shadow-md flex flex-col justify-between gap-3 group relative ${
                              isRecentPulse
                                ? 'border-amber-400 ring-4 ring-amber-500/40 animate-pulse bg-amber-950/20'
                                : waiting.isUrgent && item.status !== 'entregue'
                                  ? 'border-red-500/70 shadow-red-950/40'
                                  : 'border-[#3D3833] hover:border-amber-500/50'
                            }`}
                          >
                            {/* TOPO DO CARTÃO: MESA GIGANTE + HORÁRIO + CRONÔMETRO DE ESPERA */}
                            <div className="flex items-start justify-between gap-2 border-b border-[#38332E] pb-3">
                              <div className="flex items-center gap-2 flex-wrap">
                                {/* Mesa Gigante */}
                                <div className="px-3.5 py-1.5 rounded-xl bg-amber-500 text-stone-950 font-black text-base sm:text-lg tracking-tight shadow-md shadow-amber-950/40">
                                  MESA {item.mesaNumero ?? '?'}
                                </div>

                                {/* Badge Pedido On-line */}
                                {isOnlineOrder && (
                                  <Badge className="bg-amber-400/20 text-amber-300 border-amber-400/50 text-[11px] font-black px-2 py-0.5">
                                    Pedido On-line
                                  </Badge>
                                )}

                                {/* Praça: Bar ou Cozinha */}
                                <Badge
                                  variant="outline"
                                  className={`text-[11px] font-black uppercase px-2.5 py-0.5 flex items-center gap-1.5 ${
                                    item.areaPreparo === 'bar'
                                      ? 'bg-blue-500/15 text-blue-300 border-blue-500/40'
                                      : 'bg-orange-500/15 text-orange-300 border-orange-500/40'
                                  }`}
                                >
                                  {item.areaPreparo === 'bar' ? (
                                    <>
                                      <Beer className="w-3.5 h-3.5" /> Bar
                                    </>
                                  ) : (
                                    <>
                                      <ChefHat className="w-3.5 h-3.5" /> Cozinha
                                    </>
                                  )}
                                </Badge>
                              </div>

                              {/* Cronômetro de Espera + Horário do Pedido */}
                              <div className="text-right flex flex-col items-end gap-1">
                                <span
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs sm:text-sm font-black border tabular-nums shadow-sm ${waiting.severityClass}`}
                                  title={`Tempo de espera desde o pedido: ${waiting.label}`}
                                >
                                  <Clock className="w-3.5 h-3.5" />
                                  <span>{waiting.label}</span>
                                </span>
                                {horaFormatada && (
                                  <span className="text-[11px] text-stone-400 font-mono">
                                    Entrou às {horaFormatada}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* CORPO DO CARTÃO: ITENS EM LETRAS GRANDES E OBSERVAÇÃO DESTACADA */}
                            {/* IMPORTANTE: NUNCA exibir fotos de produtos nesta tela — apenas texto/ícones */}
                            <div className="space-y-2 py-1">
                              <div className="flex items-start gap-3">
                                <span className="text-2xl sm:text-3xl font-black text-amber-400 tabular-nums leading-none">
                                  {item.quantidade ?? 1}x
                                </span>
                                <div className="flex-1">
                                  <h3 className="text-lg sm:text-xl font-black text-stone-50 leading-snug tracking-tight">
                                    {item.nomeProduto || 'Item da Comanda'}
                                  </h3>
                                  {item.clienteNome && (
                                    <p className="text-xs text-stone-400 mt-0.5">
                                      Comanda:{' '}
                                      <span className="text-stone-300 font-bold">
                                        {item.clienteNome}
                                      </span>
                                    </p>
                                  )}
                                </div>
                              </div>

                              {/* Observações de item em grande destaque */}
                              {item.observacoes && (
                                <div className="mt-2.5 p-3 rounded-xl bg-amber-500/15 border-2 border-amber-500/40 text-amber-200 text-xs sm:text-sm font-bold flex items-start gap-2 shadow-sm">
                                  <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                                  <div className="leading-snug">
                                    <span className="text-amber-400 uppercase tracking-wider text-[10px] block font-black">
                                      Observação do Cliente:
                                    </span>
                                    {item.observacoes}
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* RODAPÉ DO CARTÃO: BOTÕES DE AVANÇO GIGANTES PARA TOQUE FÁCIL */}
                            <div className="pt-3 border-t border-[#38332E] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                              {/* Botão Imprimir Ticket Térmico 80mm */}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handlePrintTicket(item)}
                                className="h-10 px-3 bg-[#1C1917] hover:bg-[#38332E] border-[#44403C] text-stone-300 hover:text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 active:scale-95"
                                title="Imprimir ticket para cozinha"
                              >
                                <Printer className="w-4 h-4 text-amber-500" />
                                <span>Ticket</span>
                              </Button>

                              {/* Ações de avanço de status */}
                              <div className="flex items-center gap-2 flex-1 justify-end">
                                {/* Botão de retrocesso simples */}
                                {item.status === 'preparando' && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => updateFilaStatus(item.id, 'pendente')}
                                    className="h-11 px-3 text-xs text-stone-400 hover:text-stone-200 rounded-xl"
                                    title="Voltar para Pendente"
                                  >
                                    Voltar
                                  </Button>
                                )}
                                {item.status === 'pronto' && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => updateFilaStatus(item.id, 'preparando')}
                                    className="h-11 px-3 text-xs text-stone-400 hover:text-stone-200 rounded-xl"
                                    title="Voltar para Preparando"
                                  >
                                    Voltar
                                  </Button>
                                )}

                                {/* BOTÕES GIGANTES DE UM TOQUE: */}
                                {item.status === 'pendente' && (
                                  <Button
                                    size="lg"
                                    onClick={() => updateFilaStatus(item.id, 'preparando')}
                                    className="flex-1 sm:flex-initial h-12 px-6 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-sm sm:text-base shadow-lg shadow-blue-950/50 flex items-center justify-center gap-2 active:scale-95 transition-all"
                                  >
                                    <Flame className="w-5 h-5 text-blue-200" />
                                    <span>Iniciar Preparo</span>
                                    <ArrowRight className="w-4 h-4" />
                                  </Button>
                                )}

                                {item.status === 'preparando' && (
                                  <Button
                                    size="lg"
                                    onClick={() => updateFilaStatus(item.id, 'pronto')}
                                    className="flex-1 sm:flex-initial h-12 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm sm:text-base shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-2 active:scale-95 transition-all"
                                  >
                                    <CheckCircle2 className="w-5 h-5 text-emerald-200" />
                                    <span>Marcar Pronto</span>
                                    <ArrowRight className="w-4 h-4" />
                                  </Button>
                                )}

                                {item.status === 'pronto' && (
                                  <Button
                                    size="lg"
                                    onClick={() => updateFilaStatus(item.id, 'entregue')}
                                    className="flex-1 sm:flex-initial h-12 px-6 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-sm sm:text-base shadow-lg shadow-amber-950/50 flex items-center justify-center gap-2 active:scale-95 transition-all"
                                  >
                                    <CheckCheck className="w-5 h-5 text-stone-950" />
                                    <span>Marcar Entregue</span>
                                  </Button>
                                )}

                                {item.status === 'entregue' && (
                                  <div className="flex items-center gap-1.5 text-xs font-bold text-stone-400 py-2">
                                    <Check className="w-4 h-4 text-emerald-400" />
                                    <span>Pedido Entregue</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </article>
                        )
                      })
                    )}
                  </div>
                )}
              </section>
            )
          })}
        </div>
      </main>
    </div>
  )
}
