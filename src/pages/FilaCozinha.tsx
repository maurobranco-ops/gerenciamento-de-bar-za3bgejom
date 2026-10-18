import React, { useState, useMemo, useEffect } from 'react'
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
  Sparkles,
  Printer,
  Volume2,
  VolumeX,
  Radio,
} from 'lucide-react'
import { useBar } from '../context/BarContext'
import { AreaPreparo, KitchenStatus, FilaCozinhaItem } from '../types/bar'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Switch } from '../components/ui/switch'
import { Label } from '../components/ui/label'
import { printKitchenTicket } from '../lib/thermalPrinter'
import { SoundEffects } from '../lib/soundEffects'
import { toast } from '../hooks/use-toast'

const STATUS_COLUMNS: {
  key: KitchenStatus
  label: string
  color: string
  badgeClass: string
  icon: React.ComponentType<{ className?: string }>
}[] = [
  {
    key: 'pendente',
    label: 'Pendente',
    color: 'border-amber-500/50 text-amber-400',
    badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    icon: Clock,
  },
  {
    key: 'preparando',
    label: 'Preparando',
    color: 'border-blue-500/50 text-blue-400',
    badgeClass: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    icon: Flame,
  },
  {
    key: 'pronto',
    label: 'Pronto',
    color: 'border-emerald-500/50 text-emerald-400',
    badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    icon: CheckCircle2,
  },
  {
    key: 'entregue',
    label: 'Entregue',
    color: 'border-stone-600 text-stone-400',
    badgeClass: 'bg-stone-800 text-stone-400 border-stone-700',
    icon: CheckCheck,
  },
]

export default function FilaCozinha() {
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

  const [selectedArea, setSelectedArea] = useState<AreaPreparo | 'todos'>('todos')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [showDelivered, setShowDelivered] = useState(false)

  // Estação de impressão automática (toggle local por dispositivo)
  const [autoPrintStation, setAutoPrintStation] = useState<boolean>(() => {
    return localStorage.getItem('rachide_bar_autoprint_enabled') === 'true'
  })

  // Ao entrar na tela de fila, limpa contador de não lidos
  useEffect(() => {
    clearUnreadOnlineOrders()
  }, [clearUnreadOnlineOrders])

  const handleToggleAutoPrint = (enabled: boolean) => {
    setAutoPrintStation(enabled)
    localStorage.setItem('rachide_bar_autoprint_enabled', String(enabled))
    if (enabled) {
      toast({
        title: 'Estação de Impressão de Cozinha Ativada!',
        description:
          'Novos pedidos recebidos abrirão a janela de impressão térmica automaticamente (requer permissão do navegador).',
      })
    } else {
      toast({
        title: 'Impressão Automática Desativada',
        description: 'Os pedidos deverão ser impressos manualmente pelo botão Imprimir.',
      })
    }
  }

  const handleManualPrint = (item: FilaCozinhaItem) => {
    const success = printKitchenTicket({ item, settings })
    if (success) {
      toast({
        title: `Ticket impresso: Mesa ${item.mesaNumero}`,
        description: `Comanda de ${item.nomeProduto} enviada para o spooler de impressão térmica.`,
      })
    } else {
      toast({
        variant: 'destructive',
        title: 'Bloqueador de popup ativo',
        description: 'Permita popups neste navegador para abrir o layout de impressão da comanda.',
      })
    }
  }

  const handleManualRefresh = async () => {
    setIsRefreshing(true)
    await fetchFilaCozinha()
    setTimeout(() => setIsRefreshing(false), 400)
  }

  // Filtragem dos itens da fila
  const filteredItems = useMemo(() => {
    return filaCozinha.filter((item) => {
      if (selectedArea !== 'todos' && item.areaPreparo !== selectedArea) {
        return false
      }
      if (!showDelivered && item.status === 'entregue') {
        return false
      }
      return true
    })
  }, [filaCozinha, selectedArea, showDelivered])

  // Contadores
  const counts = useMemo(() => {
    const total = filaCozinha.length
    const bar = filaCozinha.filter((i) => i.areaPreparo === 'bar' && i.status !== 'entregue').length
    const cozinha = filaCozinha.filter(
      (i) => i.areaPreparo === 'cozinha' && i.status !== 'entregue',
    ).length
    const pendentes = filaCozinha.filter((i) => i.status === 'pendente').length
    const preparando = filaCozinha.filter((i) => i.status === 'preparando').length
    const prontos = filaCozinha.filter((i) => i.status === 'pronto').length
    return { total, bar, cozinha, pendentes, preparando, prontos }
  }, [filaCozinha])

  const getNextStatus = (current: KitchenStatus): KitchenStatus | null => {
    switch (current) {
      case 'pendente':
        return 'preparando'
      case 'preparando':
        return 'pronto'
      case 'pronto':
        return 'entregue'
      default:
        return null
    }
  }

  const getNextStatusActionLabel = (current: KitchenStatus): string => {
    switch (current) {
      case 'pendente':
        return 'Iniciar Preparo'
      case 'preparando':
        return 'Marcar Pronto'
      case 'pronto':
        return 'Confirmar Entrega'
      default:
        return ''
    }
  }

  const formatElapsedTime = (createdAt: string) => {
    try {
      const created = new Date(createdAt).getTime()
      const now = Date.now()
      const diffMins = Math.floor((now - created) / 60000)
      if (diffMins < 1) return 'Agora mesmo'
      if (diffMins === 1) return 'Há 1 min'
      if (diffMins < 60) return `Há ${diffMins} min`
      const diffHours = Math.floor(diffMins / 60)
      return `Há ${diffHours}h ${diffMins % 60}m`
    } catch {
      return ''
    }
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header com filtros de área e botão de refresh */}
      <div className="p-5 rounded-2xl bg-[#292524] border border-[#44403C] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-500">
              <ChefHat className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-stone-100 flex items-center gap-2">
                Fila de Cozinha & Bar (KDS)
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/30 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Sincronizado Supabase
                </span>
              </h2>
              <p className="text-xs text-stone-400 mt-1">
                Controle em tempo real de pedidos agrupados por praça de preparo (Bar e Cozinha).
              </p>
            </div>
          </div>
        </div>

        {/* Controles de filtro, som, auto-print e refresh */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Toggle de Som */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              toggleSound()
              if (!soundEnabled) {
                // Teste som imediato
                SoundEffects.playOrderAlert()
              }
            }}
            className={`text-xs h-9 bg-[#1C1917] border-[#44403C] ${
              soundEnabled ? 'text-amber-400 border-amber-500/40' : 'text-stone-400'
            }`}
            title={soundEnabled ? 'Silenciar alertas de pedidos' : 'Ativar alertas sonoros'}
          >
            {soundEnabled ? (
              <>
                <Volume2 className="w-3.5 h-3.5 mr-1.5 text-amber-500" /> Som Ativo
              </>
            ) : (
              <>
                <VolumeX className="w-3.5 h-3.5 mr-1.5" /> Mudo
              </>
            )}
          </Button>

          {/* Toggle de Estação Impressora de Cozinha */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#1C1917] border border-[#44403C]">
            <Switch
              id="auto-print-switch"
              checked={autoPrintStation}
              onCheckedChange={handleToggleAutoPrint}
              className="data-[state=checked]:bg-emerald-500"
            />
            <Label
              htmlFor="auto-print-switch"
              className="text-xs font-semibold text-stone-300 cursor-pointer flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5 text-stone-400" />
              <span>Impressora Auto</span>
              {autoPrintStation && (
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              )}
            </Label>
          </div>

          {/* Seletor de Praça / Área - com scroll horizontal em mobile se necessário */}
          <div className="flex items-center bg-[#1C1917] p-1 rounded-xl border border-[#44403C] max-w-full overflow-x-auto">
            <button
              onClick={() => setSelectedArea('todos')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                selectedArea === 'todos'
                  ? 'bg-amber-500 text-stone-950 shadow-sm'
                  : 'text-stone-300 hover:text-white'
              }`}
            >
              <Filter className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Todas</span>
            </button>
            <button
              onClick={() => setSelectedArea('cozinha')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                selectedArea === 'cozinha'
                  ? 'bg-amber-500 text-stone-950 shadow-sm'
                  : 'text-stone-300 hover:text-white'
              }`}
            >
              <UtensilsCrossed className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Cozinha ({counts.cozinha})</span>
            </button>
            <button
              onClick={() => setSelectedArea('bar')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                selectedArea === 'bar'
                  ? 'bg-amber-500 text-stone-950 shadow-sm'
                  : 'text-stone-300 hover:text-white'
              }`}
            >
              <Beer className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Bar ({counts.bar})</span>
            </button>
          </div>

          {/* Toggle para exibir ou ocultar entregues */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDelivered(!showDelivered)}
            className={`text-xs h-9 bg-[#1C1917] border-[#44403C] ${
              showDelivered ? 'text-amber-400 border-amber-500/40' : 'text-stone-400'
            }`}
          >
            <CheckCheck className="w-3.5 h-3.5 mr-1.5" />
            {showDelivered ? 'Ocultar Entregues' : 'Ver Entregues'}
          </Button>

          {/* Botão de refresh manual */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="text-xs h-9 bg-[#1C1917] border-[#44403C] text-stone-200 hover:text-white"
            title="Atualizar fila do banco"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 mr-1.5 ${isRefreshing ? 'animate-spin text-amber-500' : ''}`}
            />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Banner Informativo de Impressora de Cozinha caso ativa */}
      <div className="p-3 rounded-xl bg-[#1C1917] border border-[#44403C] flex items-center justify-between text-xs text-stone-300">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-amber-500 flex-shrink-0 animate-pulse" />
          <span>
            <strong>Estação de KDS / Cozinha:</strong>{' '}
            {autoPrintStation ? (
              <span className="text-emerald-400 font-bold">
                Impressão automática 80mm ATIVA para novos pedidos (Dispositivo conectado:{' '}
                {settings?.impressoraCozinhaNome || 'Bematech MP-4200'}).
              </span>
            ) : (
              <span className="text-stone-400">
                Impressão manual ativada. Ative o toggle &quot;Impressora Auto&quot; nesta máquina
                para disparar impressão automática na cozinha/bar.
              </span>
            )}
          </span>
        </div>
      </div>

      {/* Cards de Resumo Rápido */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-[#292524] border border-[#44403C] flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-stone-400 font-semibold">
              Pendentes
            </div>
            <div className="text-xl font-black text-amber-400 mt-0.5">{counts.pendentes}</div>
          </div>
          <Clock className="w-6 h-6 text-amber-500/60" />
        </div>

        <div className="p-3.5 rounded-xl bg-[#292524] border border-[#44403C] flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-stone-400 font-semibold">
              Em Preparo
            </div>
            <div className="text-xl font-black text-blue-400 mt-0.5">{counts.preparando}</div>
          </div>
          <Flame className="w-6 h-6 text-blue-500/60" />
        </div>

        <div className="p-3.5 rounded-xl bg-[#292524] border border-[#44403C] flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-stone-400 font-semibold">
              Prontos p/ Servir
            </div>
            <div className="text-xl font-black text-emerald-400 mt-0.5">{counts.prontos}</div>
          </div>
          <CheckCircle2 className="w-6 h-6 text-emerald-500/60" />
        </div>

        <div className="p-3.5 rounded-xl bg-[#292524] border border-[#44403C] flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-stone-400 font-semibold">
              Total Ativo
            </div>
            <div className="text-xl font-black text-stone-100 mt-0.5">
              {counts.pendentes + counts.preparando + counts.prontos}
            </div>
          </div>
          <Sparkles className="w-6 h-6 text-amber-500/60" />
        </div>
      </div>

      {/* Quadro Kanban de Fila de Preparo */}
      <div
        className={`grid grid-cols-1 md:grid-cols-2 ${
          showDelivered ? 'lg:grid-cols-4' : 'lg:grid-cols-3'
        } gap-4 items-start pb-8`}
      >
        {STATUS_COLUMNS.filter((col) => showDelivered || col.key !== 'entregue').map((col) => {
          const ColIcon = col.icon
          const itemsInCol = filteredItems.filter((i) => i.status === col.key)

          return (
            <div
              key={col.key}
              className="p-4 rounded-2xl bg-[#292524] border border-[#44403C] flex flex-col min-h-[460px]"
            >
              {/* Header da coluna */}
              <div className="flex items-center justify-between pb-3 border-b border-[#44403C] mb-3">
                <div className="flex items-center gap-2">
                  <ColIcon className="w-4 h-4 text-amber-500" />
                  <span className="font-bold text-sm text-stone-100">{col.label}</span>
                </div>
                <Badge variant="outline" className={col.badgeClass}>
                  {itemsInCol.length}
                </Badge>
              </div>

              {/* Lista de itens na coluna */}
              <div className="space-y-3 flex-1 overflow-y-auto max-h-[620px] pr-1">
                {itemsInCol.length === 0 ? (
                  <div className="py-12 text-center text-stone-500 text-xs border border-dashed border-[#44403C] rounded-xl">
                    Nenhum pedido {col.label.toLowerCase()}
                  </div>
                ) : (
                  itemsInCol.map((item) => {
                    const nextStatus = getNextStatus(item.status)
                    const nextLabel = getNextStatusActionLabel(item.status)
                    const isRecentPulse = lastOnlineOrderId === item.id

                    return (
                      <div
                        key={item.id}
                        className={`p-3.5 rounded-xl bg-[#1C1917] border transition-all flex flex-col justify-between space-y-3 shadow-sm group ${
                          isRecentPulse
                            ? 'border-amber-500 ring-2 ring-amber-500/50 animate-pulse'
                            : 'border-[#44403C] hover:border-amber-500/40'
                        }`}
                      >
                        {/* Topo do card: Mesa, Praça e Tempo */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2 py-0.5 rounded-md bg-amber-500 text-stone-950 font-black text-xs">
                              Mesa {item.mesaNumero ?? '?'}
                            </span>
                            {item.origemOnline && (
                              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/40 text-[10px] font-bold">
                                Pedido On-line
                              </Badge>
                            )}
                            <Badge
                              variant="outline"
                              className={`text-[10px] uppercase font-bold flex items-center gap-1 ${
                                item.areaPreparo === 'bar'
                                  ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                                  : 'bg-orange-500/10 text-orange-400 border-orange-500/30'
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

                          <span className="text-[11px] text-stone-400 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-stone-500" />
                            {formatElapsedTime(item.createdAt)}
                          </span>
                        </div>

                        {/* Nome do Produto e Quantidade */}
                        <div>
                          <div className="flex items-baseline gap-2">
                            <span className="text-base font-black text-amber-400 tabular-nums">
                              {item.quantidade ?? 1}x
                            </span>
                            <h4 className="font-bold text-sm text-stone-100 leading-tight">
                              {item.nomeProduto || 'Item da Comanda'}
                            </h4>
                          </div>

                          {item.clienteNome && (
                            <p className="text-[11px] text-stone-400 mt-0.5">
                              Cliente: {item.clienteNome}
                            </p>
                          )}

                          {item.observacoes && (
                            <div className="mt-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px]">
                              <strong>Obs:</strong> {item.observacoes}
                            </div>
                          )}
                        </div>

                        {/* Botões de avanço de status e botão Imprimir Comanda */}
                        <div className="pt-2 border-t border-stone-800 flex items-center justify-between gap-2">
                          {/* Botão Imprimir Ticket Cozinha/Bar 80mm */}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleManualPrint(item)}
                            className="bg-[#292524] hover:bg-[#44403C] border-[#44403C] text-stone-300 hover:text-white text-[11px] h-7 px-2 flex items-center gap-1"
                            title="Imprimir ticket térmico 80mm para cozinha/bar"
                          >
                            <Printer className="w-3 h-3 text-amber-500" />
                            <span>Imprimir</span>
                          </Button>

                          {/* Botão de retrocesso (se aplicável) */}
                          <div className="flex items-center gap-1.5 ml-auto">
                            {item.status === 'preparando' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => updateFilaStatus(item.id, 'pendente')}
                                className="text-[11px] text-stone-400 hover:text-stone-200 h-7 px-2"
                                title="Retornar para Pendente"
                              >
                                Voltar
                              </Button>
                            )}
                            {item.status === 'pronto' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => updateFilaStatus(item.id, 'preparando')}
                                className="text-[11px] text-stone-400 hover:text-stone-200 h-7 px-2"
                                title="Retornar para Preparando"
                              >
                                Voltar
                              </Button>
                            )}

                            {/* Botão principal de avanço */}
                            {nextStatus ? (
                              <Button
                                size="sm"
                                onClick={() => updateFilaStatus(item.id, nextStatus)}
                                className={`text-xs font-bold h-7 px-3 flex items-center gap-1.5 shadow-sm ${
                                  nextStatus === 'preparando'
                                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                    : nextStatus === 'pronto'
                                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                      : 'bg-amber-500 hover:bg-amber-600 text-stone-950'
                                }`}
                              >
                                <span>{nextLabel}</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                              </Button>
                            ) : (
                              <span className="text-[11px] text-stone-500 flex items-center gap-1 font-semibold">
                                <Check className="w-3.5 h-3.5 text-emerald-400" /> Concluído
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
