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
  // Salvaguarda: quando passar de 24h (1440 min), exibe "Item antigo" e data de entrada em vez de tempos absurdos (ex: 165h)
  const getWaitingTimeData = (createdAt: string) => {
    try {
      const createdDate = new Date(createdAt)
      const created = createdDate.getTime()
      const diffMs = Math.max(0, nowTimestamp - created)
      const diffMins = Math.floor(diffMs / 60000)
      const diffSecs = Math.floor((diffMs % 60000) / 1000)

      let label = ''
      let isOldItem = false

      if (diffMins >= 1440) {
        // Mais de 24 horas: salvaguarda para evitar números gigantes na UI
        isOldItem = true
        label = 'Item antigo'
      } else if (diffMins < 1) {
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

      if (isOldItem) {
        severityClass = 'bg-stone-800/95 text-stone-400 border-stone-600 font-medium'
      } else if (diffMins >= 20) {
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
        isOldItem,
      }
    } catch {
      return {
        label: '--',
        diffMins: 0,
        severityClass: 'bg-stone-800 text-stone-400 border-stone-700',
        isUrgent: false,
        isOldItem: false,
      }
    }
  }

  const formatHoraPedido = (createdAt: string) => {
    try {
      const date = new Date(createdAt)
      const now = new Date(nowTimestamp)
      const diffHours = Math.abs(now.getTime() - date.getTime()) / 3600000

      // Se passou de 24 horas, exibe dia/mês além da hora
      if (diffHours >= 24) {
        return date.toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        })
      }

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
      {/* BARRA SUPERIOR DO KDS COM FILTROS POR PRAÇA E BOTÕES DE CONTROLE */}
      <header className="p-3 sm:p-4 rounded-2xl bg-[#1C1917] border border-[#38332E] shadow-lg flex flex-col xl:flex-row xl:items-center justify-between gap-3 sm:gap-3.5">
        {/* GRUPO 1: Identificação da tela & Status realtime */}
        <div className="flex items-center justify-between gap-2.5 sm:gap-3 min-w-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-amber-500 text-stone-950 flex items-center justify-center font-black shadow-md shadow-amber-950/40 flex-shrink-0">
              <ChefHat className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-xl md:text-2xl font-black tracking-tight text-stone-50 whitespace-nowrap">
                  KDS Cozinha & Bar
                </h1>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] sm:text-[11px] font-bold whitespace-nowrap flex-shrink-0">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Ao Vivo
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-stone-400 hidden md:block truncate">
                Fila de produção em colunas Kanban com cronômetro de espera e toque rápido.
              </p>
            </div>
          </div>
        </div>

        {/* GRUPO 2: FILTRO POR PRAÇA (Cozinha / Bar / Todas) */}
        <nav
          aria-label="Filtro de praça"
          className="flex items-center bg-[#292524] p-1 sm:p-1.5 rounded-xl sm:rounded-2xl border border-[#44403C] gap-1 sm:gap-1.5 overflow-x-auto w-full xl:w-auto justify-stretch sm:justify-center flex-shrink-0"
        >
          <button
            type="button"
            onClick={() => setSelectedArea('todos')}
            className={`flex-1 xl:flex-initial min-w-[76px] sm:min-w-[100px] py-1.5 sm:py-2 px-2.5 sm:px-3.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap active:scale-95 ${
              selectedArea === 'todos'
                ? 'bg-amber-500 text-stone-950 shadow-md shadow-amber-950/40'
                : 'text-stone-300 hover:text-white hover:bg-[#38332E]'
            }`}
          >
            <Filter className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Todas ({counts.totalAtivo})</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedArea('cozinha')}
            className={`flex-1 xl:flex-initial min-w-[76px] sm:min-w-[110px] py-1.5 sm:py-2 px-2.5 sm:px-3.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap active:scale-95 ${
              selectedArea === 'cozinha'
                ? 'bg-amber-500 text-stone-950 shadow-md shadow-amber-950/40'
                : 'text-stone-300 hover:text-white hover:bg-[#38332E]'
            }`}
          >
            <UtensilsCrossed className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Cozinha ({counts.cozinha})</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedArea('bar')}
            className={`flex-1 xl:flex-initial min-w-[76px] sm:min-w-[100px] py-1.5 sm:py-2 px-2.5 sm:px-3.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap active:scale-95 ${
              selectedArea === 'bar'
                ? 'bg-amber-500 text-stone-950 shadow-md shadow-amber-950/40'
                : 'text-stone-300 hover:text-white hover:bg-[#38332E]'
            }`}
          >
            <Beer className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Bar ({counts.bar})</span>
          </button>
        </nav>

        {/* GRUPO 3: CONTROLES (SOM, TELA CHEIA, ATUALIZAR E SAIR SEMPRE JUNTOS EM UMA BARRA) */}
        <div className="flex items-center gap-1.5 sm:gap-2 justify-end w-full xl:w-auto flex-wrap sm:flex-nowrap">
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
            className={`flex-1 sm:flex-initial h-9 sm:h-10 px-2.5 sm:px-3 rounded-xl text-xs font-bold bg-[#292524] border-[#44403C] transition-all whitespace-nowrap active:scale-95 ${
              soundEnabled
                ? 'text-amber-400 border-amber-500/50 bg-amber-500/10'
                : 'text-stone-400 hover:text-stone-200'
            }`}
            title={soundEnabled ? 'Silenciar alerta sonoro' : 'Ativar alerta sonoro de novo pedido'}
          >
            {soundEnabled ? (
              <>
                <Volume2 className="w-4 h-4 mr-1 sm:mr-1.5 text-amber-400 flex-shrink-0" />
                <span className="whitespace-nowrap">Alerta Som</span>
              </>
            ) : (
              <>
                <VolumeX className="w-4 h-4 mr-1 sm:mr-1.5 text-stone-500 flex-shrink-0" />
                <span className="whitespace-nowrap">Mudo</span>
              </>
            )}
          </Button>

          {/* Modo Tela Cheia */}
          <Button
            variant="outline"
            size="sm"
            onClick={toggleFullscreen}
            className={`flex-1 sm:flex-initial h-9 sm:h-10 px-2.5 sm:px-3 rounded-xl text-xs font-bold bg-[#292524] border-[#44403C] hover:bg-[#38332E] text-stone-200 transition-all whitespace-nowrap active:scale-95 ${
              isFullscreen ? 'border-amber-500 text-amber-300' : ''
            }`}
            title={isFullscreen ? 'Sair da tela cheia' : 'Ativar modo tela cheia (KDS TV)'}
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="w-4 h-4 mr-1 sm:mr-1.5 text-amber-400 flex-shrink-0" />
                <span className="whitespace-nowrap">Janela</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-4 h-4 mr-1 sm:mr-1.5 text-amber-400 flex-shrink-0" />
                <span className="whitespace-nowrap">Tela Cheia</span>
              </>
            )}
          </Button>

          {/* Atualizar Manual */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="flex-1 sm:flex-initial h-9 sm:h-10 px-2.5 sm:px-3 rounded-xl text-xs font-bold bg-[#292524] border-[#44403C] hover:bg-[#38332E] text-stone-200 transition-all whitespace-nowrap active:scale-95"
            title="Atualizar dados agora"
          >
            <RefreshCw
              className={`w-4 h-4 mr-1 sm:mr-1.5 text-amber-500 flex-shrink-0 ${
                isRefreshing ? 'animate-spin' : ''
              }`}
            />
            <span className="whitespace-nowrap">Atualizar</span>
          </Button>

          {/* Botão de Logout consistente integrado ao grupo de controles */}
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await signOut()
              navigate('/login')
            }}
            className="flex-1 sm:flex-initial h-9 sm:h-10 px-2.5 sm:px-3 rounded-xl text-xs font-bold bg-red-950/20 hover:bg-red-950/40 text-red-300 border-red-900/50 hover:border-red-800 transition-all whitespace-nowrap active:scale-95 flex items-center justify-center"
            title="Sair do sistema (Logout)"
          >
            <LogOut className="w-4 h-4 mr-1 sm:mr-1.5 text-red-400 flex-shrink-0" />
            <span className="whitespace-nowrap">Sair</span>
          </Button>
        </div>
      </header>

      {/* QUADRO KANBAN EM COLUNAS: PENDENTE | PREPARANDO | PRONTO | ENTREGUE */}
      {/* Garante rolagem horizontal fluida quando as 4 colunas não couberem na viewport */}
      <main className="flex-1 pb-6 overflow-x-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 items-start min-w-[300px] lg:min-w-[960px] xl:min-w-0">
          {KANBAN_COLUMNS.map((col) => {
            const ColIcon = col.icon
            const itemsInCol = filteredItems.filter((i) => i.status === col.key)
            const isEntregueCol = col.key === 'entregue'

            return (
              <section
                key={col.key}
                className={`rounded-2xl border transition-all flex flex-col min-h-[580px] bg-[#1C1917] min-w-0 ${
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
                            className={`p-3 sm:p-3.5 rounded-xl sm:rounded-2xl bg-[#25221F] border-2 transition-all shadow-md flex flex-col gap-2.5 group relative ${
                              isRecentPulse
                                ? 'border-amber-400 ring-4 ring-amber-500/40 animate-pulse bg-amber-950/20'
                                : waiting.isUrgent && item.status !== 'entregue'
                                  ? 'border-red-500/70 shadow-red-950/40'
                                  : 'border-[#3D3833] hover:border-amber-500/50'
                            }`}
                          >
                            {/* TOPO DO CARTÃO (EMPILHADO / COMPACTO): MESA + CRONÔMETRO DE ESPERA */}
                            <div className="flex flex-col gap-1.5 border-b border-[#38332E] pb-2.5">
                              {/* Linha superior: Mesa e Badges */}
                              <div className="flex items-center justify-between gap-1.5 flex-wrap">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {/* Identificador da Mesa compacto */}
                                  <span className="px-2.5 py-0.5 rounded-lg bg-amber-500 text-stone-950 font-black text-xs sm:text-sm tracking-tight shadow-sm shadow-amber-950/40 whitespace-nowrap">
                                    MESA {item.mesaNumero ?? '?'}
                                  </span>

                                  {/* Badge Pedido On-line */}
                                  {isOnlineOrder && (
                                    <Badge className="bg-amber-400/20 text-amber-300 border-amber-400/50 text-[10px] font-bold px-1.5 py-0.5 whitespace-nowrap">
                                      On-line
                                    </Badge>
                                  )}

                                  {/* Praça: Bar ou Cozinha */}
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] font-bold uppercase px-1.5 py-0.5 flex items-center gap-1 whitespace-nowrap ${
                                      item.areaPreparo === 'bar'
                                        ? 'bg-blue-500/15 text-blue-300 border-blue-500/40'
                                        : 'bg-orange-500/15 text-orange-300 border-orange-500/40'
                                    }`}
                                  >
                                    {item.areaPreparo === 'bar' ? (
                                      <>
                                        <Beer className="w-3 h-3" /> Bar
                                      </>
                                    ) : (
                                      <>
                                        <ChefHat className="w-3 h-3" /> Cozinha
                                      </>
                                    )}
                                  </Badge>
                                </div>

                                {/* Cronômetro de Espera */}
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] sm:text-xs font-bold border tabular-nums whitespace-nowrap shadow-sm ${waiting.severityClass}`}
                                  title={`Tempo de espera desde o pedido: ${waiting.label}`}
                                >
                                  <Clock className="w-3 h-3 flex-shrink-0" />
                                  <span>{waiting.label}</span>
                                </span>
                              </div>

                              {/* Linha secundária do cabeçalho: horário de entrada e comanda */}
                              <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-stone-400 gap-1">
                                {item.clienteNome ? (
                                  <span className="truncate">
                                    Comanda:{' '}
                                    <strong className="text-stone-300 font-semibold">
                                      {item.clienteNome}
                                    </strong>
                                  </span>
                                ) : (
                                  <span />
                                )}
                                {horaFormatada && (
                                  <span className="font-mono text-stone-400 flex-shrink-0 whitespace-nowrap">
                                    Entrou às {horaFormatada}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* CORPO DO CARTÃO: ITEM COMPACTO, DILIGENTE E DIRETO */}
                            {/* IMPORTANTE: NUNCA exibir fotos de produtos nesta tela — apenas texto/ícones */}
                            <div className="space-y-1.5 py-0.5">
                              <div className="flex items-start gap-2">
                                <span className="text-lg sm:text-xl font-black text-amber-400 tabular-nums leading-none pt-0.5 flex-shrink-0">
                                  {item.quantidade ?? 1}x
                                </span>
                                <div className="flex-1 min-w-0">
                                  <h3 className="text-sm sm:text-base font-bold text-stone-100 leading-snug break-words">
                                    {item.nomeProduto || 'Item da Comanda'}
                                  </h3>
                                </div>
                              </div>

                              {/* Observações de item compacta e destacada */}
                              {item.observacoes && (
                                <div className="p-2 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-200 text-[11px] font-medium flex items-start gap-1.5 shadow-sm">
                                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                                  <div className="leading-tight min-w-0 flex-1">
                                    <span className="text-amber-400 uppercase tracking-wider text-[9px] block font-black">
                                      Obs:
                                    </span>
                                    <span className="break-words">{item.observacoes}</span>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* RODAPÉ DO CARTÃO: EMPILHAMENTO VERTICAL ROBUSTO (NUNCA TRUNCA O BOTÃO PRINCIPAL) */}
                            <div className="pt-2 border-t border-[#38332E] flex flex-col gap-1.5 w-full">
                              {/* BOTÃO PRINCIPAL DE AVANÇO: 100% de largura, flexível, sem truncar texto */}
                              {item.status === 'pendente' && (
                                <Button
                                  type="button"
                                  onClick={() => updateFilaStatus(item.id, 'preparando')}
                                  className="w-full h-10 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs sm:text-sm shadow-md shadow-blue-950/50 flex items-center justify-center gap-1.5 active:scale-95 transition-all whitespace-nowrap"
                                >
                                  <Flame className="w-4 h-4 text-blue-200 flex-shrink-0" />
                                  <span>Iniciar Preparo</span>
                                  <ArrowRight className="w-3.5 h-3.5 flex-shrink-0" />
                                </Button>
                              )}

                              {item.status === 'preparando' && (
                                <Button
                                  type="button"
                                  onClick={() => updateFilaStatus(item.id, 'pronto')}
                                  className="w-full h-10 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs sm:text-sm shadow-md shadow-emerald-950/50 flex items-center justify-center gap-1.5 active:scale-95 transition-all whitespace-nowrap"
                                >
                                  <CheckCircle2 className="w-4 h-4 text-emerald-200 flex-shrink-0" />
                                  <span>Marcar Pronto</span>
                                  <ArrowRight className="w-3.5 h-3.5 flex-shrink-0" />
                                </Button>
                              )}

                              {item.status === 'pronto' && (
                                <Button
                                  type="button"
                                  onClick={() => updateFilaStatus(item.id, 'entregue')}
                                  className="w-full h-10 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-extrabold text-xs sm:text-sm shadow-md shadow-amber-950/50 flex items-center justify-center gap-1.5 active:scale-95 transition-all whitespace-nowrap"
                                >
                                  <CheckCheck className="w-4 h-4 text-stone-950 flex-shrink-0" />
                                  <span>Marcar Entregue</span>
                                </Button>
                              )}

                              {item.status === 'entregue' && (
                                <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-stone-400 py-1">
                                  <Check className="w-4 h-4 text-emerald-400" />
                                  <span>Entregue</span>
                                </div>
                              )}

                              {/* LINHA SECUNDÁRIA DE AÇÕES AUXILIARES: TICKET + VOLTAR (SE APLICÁVEL) */}
                              <div className="flex items-center justify-between gap-1.5 w-full">
                                {/* Botão Imprimir Ticket Térmico */}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handlePrintTicket(item)}
                                  className="h-8 flex-1 px-2.5 bg-[#1C1917] hover:bg-[#38332E] border-[#44403C] text-stone-300 hover:text-white text-[11px] font-semibold rounded-lg flex items-center justify-center gap-1.5 active:scale-95 whitespace-nowrap"
                                  title="Imprimir ticket para cozinha"
                                >
                                  <Printer className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                                  <span>Imprimir Ticket</span>
                                </Button>

                                {/* Botão Voltar de Status */}
                                {item.status === 'preparando' && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => updateFilaStatus(item.id, 'pendente')}
                                    className="h-8 px-2 text-[11px] text-stone-400 hover:text-stone-200 hover:bg-[#292524] rounded-lg flex-shrink-0 whitespace-nowrap"
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
                                    className="h-8 px-2 text-[11px] text-stone-400 hover:text-stone-200 hover:bg-[#292524] rounded-lg flex-shrink-0 whitespace-nowrap"
                                    title="Voltar para Preparando"
                                  >
                                    Voltar
                                  </Button>
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
