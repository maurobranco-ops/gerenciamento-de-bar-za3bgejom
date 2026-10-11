import React from 'react'
import {
  Clock,
  Flame,
  CheckCircle2,
  CheckCheck,
  ChefHat,
  Beer,
  Sparkles,
  ArrowRight,
  Volume2,
  VolumeX,
  RefreshCw,
  Info,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { KitchenStatus } from '@/types/bar'

export interface TrackedOrderItem {
  fila_id: string
  comanda_item_id: string
  comanda_id: string
  mesa_numero: number
  produto_id?: string
  nome_produto: string
  categoria?: string
  image_url?: string | null
  quantidade: number
  observacoes?: string | null
  area_preparo: 'bar' | 'cozinha' | string
  status: KitchenStatus
  origem_online: boolean
  created_at: string
  updated_at: string
}

interface StatusAcompanhamentoPedidoProps {
  items: TrackedOrderItem[]
  mesaNumero: number
  comandaId?: string
  loading?: boolean
  onRefresh?: () => void
  soundEnabled: boolean
  onToggleSound: () => void
  onAddMoreItems: () => void
}

const STATUS_CONFIG: Record<
  KitchenStatus,
  {
    step: number
    label: string
    sublabel: string
    badgeClass: string
    bgCardClass: string
    borderClass: string
    icon: React.ComponentType<{ className?: string }>
    accentColor: string
  }
> = {
  pendente: {
    step: 1,
    label: 'Pedido Confirmado',
    sublabel: 'Aguardando início na cozinha / bar',
    badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/40',
    bgCardClass: 'bg-[#24201D]',
    borderClass: 'border-amber-500/40',
    icon: Clock,
    accentColor: 'text-amber-400',
  },
  preparando: {
    step: 2,
    label: 'Em Preparo',
    sublabel: 'O chef / bartender está preparando seu pedido',
    badgeClass: 'bg-blue-500/15 text-blue-400 border-blue-500/40',
    bgCardClass: 'bg-[#1E232F]',
    borderClass: 'border-blue-500/50',
    icon: Flame,
    accentColor: 'text-blue-400',
  },
  pronto: {
    step: 3,
    label: 'Pronto p/ Servir',
    sublabel: 'Pronto — o garçom está levando à mesa!',
    badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50',
    bgCardClass: 'bg-[#1B2920]',
    borderClass: 'border-emerald-500/60 ring-1 ring-emerald-500/30',
    icon: CheckCircle2,
    accentColor: 'text-emerald-400',
  },
  entregue: {
    step: 4,
    label: 'Entregue na Mesa',
    sublabel: 'Pedido servido. Bom apetite!',
    badgeClass: 'bg-stone-800 text-stone-300 border-stone-700',
    bgCardClass: 'bg-[#1C1917]',
    borderClass: 'border-[#44403C]',
    icon: CheckCheck,
    accentColor: 'text-stone-400',
  },
}

export function formatElapsedTime(dateString: string): string {
  try {
    const timestamp = new Date(dateString).getTime()
    if (isNaN(timestamp)) return ''
    const diffMs = Date.now() - timestamp
    const diffMinutes = Math.floor(diffMs / 60000)

    if (diffMinutes < 1) return 'aguardando há instantes'
    if (diffMinutes === 1) return 'aguardando há 1 min'
    if (diffMinutes < 60) return `aguardando há ${diffMinutes} min`

    const hours = Math.floor(diffMinutes / 60)
    const mins = diffMinutes % 60
    return `aguardando há ${hours}h ${mins}m`
  } catch {
    return ''
  }
}

export const StatusAcompanhamentoPedido: React.FC<StatusAcompanhamentoPedidoProps> = ({
  items,
  mesaNumero,
  comandaId,
  loading = false,
  onRefresh,
  soundEnabled,
  onToggleSound,
  onAddMoreItems,
}) => {
  if (items.length === 0) return null

  // Contadores
  const pendentes = items.filter((i) => i.status === 'pendente').length
  const preparando = items.filter((i) => i.status === 'preparando').length
  const prontos = items.filter((i) => i.status === 'pronto').length
  const entregues = items.filter((i) => i.status === 'entregue').length

  const emAndamentoTotal = pendentes + preparando + prontos

  // Status geral para o cabeçalho
  let statusGeralTitulo = 'Acompanhamento do Pedido'
  let statusGeralDesc = 'Acompanhe em tempo real a produção de cada item'
  let statusGeralBadge = 'Sincronizado ao Vivo'
  let statusGeralColor = 'bg-amber-500/10 text-amber-400 border-amber-500/30'

  if (prontos > 0) {
    statusGeralTitulo = 'Pronto — o garçom está levando à mesa!'
    statusGeralDesc = `${prontos} item(ns) finalizado(s) e a caminho da sua mesa.`
    statusGeralBadge = 'Pronto para Servir'
    statusGeralColor = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse'
  } else if (preparando > 0) {
    statusGeralTitulo = 'Seu pedido está em preparo!'
    statusGeralDesc = `${preparando} item(ns) sendo produzidos no bar e cozinha.`
    statusGeralBadge = 'Em Preparo'
    statusGeralColor = 'bg-blue-500/20 text-blue-300 border-blue-500/40'
  } else if (pendentes > 0) {
    statusGeralTitulo = 'Pedido recebido na fila'
    statusGeralDesc = 'A cozinha e o bar já visualizaram seus pedidos.'
    statusGeralBadge = 'Na Fila'
    statusGeralColor = 'bg-amber-500/20 text-amber-300 border-amber-500/40'
  } else if (entregues > 0 && emAndamentoTotal === 0) {
    statusGeralTitulo = 'Todos os pedidos foram entregues!'
    statusGeralDesc = 'Aproveite seu momento no Rachide Bar.'
    statusGeralBadge = 'Entregues'
    statusGeralColor = 'bg-stone-800 text-stone-300 border-stone-700'
  }

  return (
    <section className="rounded-2xl bg-[#292524] border border-amber-500/40 shadow-xl overflow-hidden animate-fade-in-up">
      {/* Top Banner de Status Ao Vivo */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-[#292524] via-[#342D26] to-[#292524] border-b border-[#44403C]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping inline-block" />
              <h3 className="text-base sm:text-lg font-black text-stone-100 flex items-center gap-2">
                {statusGeralTitulo}
              </h3>
              <Badge variant="outline" className={`text-[10px] font-bold ${statusGeralColor}`}>
                {statusGeralBadge}
              </Badge>
            </div>
            <p className="text-xs text-stone-300">{statusGeralDesc}</p>
          </div>

          {/* Ações: Som, Atualizar e Pedir Mais */}
          <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={onToggleSound}
              className={`h-8 px-2.5 text-xs bg-[#1C1917] border-[#44403C] ${
                soundEnabled ? 'text-amber-400 border-amber-500/40' : 'text-stone-400'
              }`}
              title={soundEnabled ? 'Silenciar avisos sonoros' : 'Ativar avisos sonoros'}
            >
              {soundEnabled ? (
                <>
                  <Volume2 className="w-3.5 h-3.5 mr-1 text-amber-500" />
                  <span className="hidden sm:inline">Som</span>
                </>
              ) : (
                <>
                  <VolumeX className="w-3.5 h-3.5 mr-1" />
                  <span className="hidden sm:inline">Mudo</span>
                </>
              )}
            </Button>

            {onRefresh && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRefresh}
                disabled={loading}
                className="h-8 px-2.5 text-xs bg-[#1C1917] border-[#44403C] text-stone-300 hover:text-white"
                title="Atualizar status agora"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-500' : ''}`}
                />
                <span className="hidden sm:inline ml-1">Atualizar</span>
              </Button>
            )}

            <Button
              size="sm"
              onClick={onAddMoreItems}
              className="h-8 px-3 text-xs bg-amber-500 hover:bg-amber-600 text-stone-950 font-black shadow-sm"
            >
              + Pedir mais
            </Button>
          </div>
        </div>

        {/* Resumo da Mesa */}
        <div className="mt-3 pt-3 border-t border-[#44403C]/60 flex items-center justify-between text-xs text-stone-400">
          <div className="flex items-center gap-2">
            <span className="font-bold text-stone-200">
              {mesaNumero > 0 ? `Mesa ${mesaNumero}` : 'Delivery / Retirada'}
            </span>
            {comandaId && <span className="text-[11px] text-stone-400">({comandaId})</span>}
          </div>
          <div className="flex items-center gap-3">
            {emAndamentoTotal > 0 && (
              <span className="text-amber-400 font-bold">
                {emAndamentoTotal} item(ns) em produção
              </span>
            )}
            {entregues > 0 && <span className="text-stone-400">{entregues} entregue(s)</span>}
          </div>
        </div>
      </div>

      {/* Lista de Itens Acompanhados */}
      <div className="p-4 sm:p-5 space-y-3.5">
        {items.map((item) => {
          const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.pendente
          const StatusIcon = cfg.icon
          const elapsed = formatElapsedTime(item.created_at)

          return (
            <div
              key={item.fila_id}
              className={`p-3.5 sm:p-4 rounded-xl border transition-all ${cfg.bgCardClass} ${cfg.borderClass} flex flex-col sm:flex-row sm:items-center justify-between gap-3`}
            >
              {/* Esquerda: Foto (se houver), Nome, Quantidade, Área e Obs */}
              <div className="flex items-start gap-3">
                {item.image_url ? (
                  <img
                    src={item.image_url}
                    alt={item.nome_produto}
                    className="w-14 h-14 rounded-lg object-cover border border-[#44403C] flex-shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-[#1C1917] border border-[#44403C] flex items-center justify-center flex-shrink-0 text-stone-400">
                    {item.area_preparo === 'bar' ? (
                      <Beer className="w-6 h-6 text-amber-500" />
                    ) : (
                      <ChefHat className="w-6 h-6 text-amber-500" />
                    )}
                  </div>
                )}

                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-black text-stone-100">
                      {item.quantidade}x {item.nome_produto}
                    </span>
                    <Badge
                      variant="outline"
                      className="text-[10px] uppercase font-bold py-0 h-4 border-[#44403C] text-stone-300"
                    >
                      {item.area_preparo === 'bar' ? 'Bar' : 'Cozinha'}
                    </Badge>
                  </div>

                  {item.observacoes && (
                    <p className="text-[11px] text-amber-300/90 italic">Obs: {item.observacoes}</p>
                  )}

                  <div className="text-[11px] text-stone-400 flex items-center gap-1.5 pt-0.5">
                    <Clock className="w-3 h-3 text-stone-500" />
                    <span>{elapsed}</span>
                  </div>
                </div>
              </div>

              {/* Direita: Stepper Visual do Status do Item */}
              <div className="sm:text-right space-y-1.5 flex-shrink-0">
                <div className="flex items-center sm:justify-end gap-2">
                  <Badge variant="outline" className={`text-xs font-bold ${cfg.badgeClass}`}>
                    <StatusIcon className="w-3.5 h-3.5 mr-1" />
                    {cfg.label}
                  </Badge>
                </div>
                <p className="text-[11px] text-stone-300 font-medium">{cfg.sublabel}</p>

                {/* Micro barra de progresso visual (4 etapas: pendente -> preparando -> pronto -> entregue) */}
                <div className="flex items-center gap-1.5 pt-1 sm:justify-end">
                  {[1, 2, 3, 4].map((step) => {
                    const isDone = cfg.step >= step
                    const isCurrent = cfg.step === step
                    return (
                      <div
                        key={step}
                        className={`h-1.5 rounded-full transition-all ${
                          isDone
                            ? step === 3
                              ? 'bg-emerald-500 w-6'
                              : step === 2
                                ? 'bg-blue-500 w-6'
                                : step === 4
                                  ? 'bg-stone-500 w-5'
                                  : 'bg-amber-500 w-6'
                            : 'bg-stone-700 w-4'
                        } ${isCurrent ? 'animate-pulse' : ''}`}
                      />
                    )
                  })}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Rodapé informativo */}
      <div className="px-5 py-3 bg-[#1C1917] border-t border-[#44403C] flex items-center justify-between text-xs text-stone-400">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-amber-500 flex-shrink-0" />
          <span>
            Atualização automática ativa via Realtime do Supabase. A cada avanço da cozinha, sua
            tela atualiza na hora!
          </span>
        </div>
      </div>
    </section>
  )
}
