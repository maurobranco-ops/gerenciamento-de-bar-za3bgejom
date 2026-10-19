import React, { useState } from 'react'
import {
  BellRing,
  Receipt,
  QrCode,
  CreditCard,
  Banknote,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  Loader2,
  AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Comanda } from '@/types/bar'

interface FilaComandasAguardandoPagamentoProps {
  comandasAguardando: Comanda[]
  onAtender: (comanda: Comanda) => void
  onRecusarAdiar: (comanda: Comanda) => void
}

export const FilaComandasAguardandoPagamento: React.FC<FilaComandasAguardandoPagamentoProps> = ({
  comandasAguardando,
  onAtender,
  onRecusarAdiar,
}) => {
  if (comandasAguardando.length === 0) return null

  const getFormaIcon = (forma?: string) => {
    switch (forma) {
      case 'Pix':
        return <QrCode className="w-3.5 h-3.5 text-emerald-400" />
      case 'Cartão Crédito':
      case 'Cartão Débito':
        return <CreditCard className="w-3.5 h-3.5 text-blue-400" />
      case 'Dinheiro':
        return <Banknote className="w-3.5 h-3.5 text-amber-400" />
      default:
        return <Receipt className="w-3.5 h-3.5 text-stone-300" />
    }
  }

  const getFormaBadgeCls = (forma?: string) => {
    switch (forma) {
      case 'Pix':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
      case 'Cartão Crédito':
      case 'Cartão Débito':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/40'
      case 'Dinheiro':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/40'
      default:
        return 'bg-stone-800 text-stone-300 border-stone-700'
    }
  }

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-purple-950/40 via-[#292524] to-[#1C1917] border-2 border-purple-500/60 shadow-xl shadow-purple-950/20 space-y-3 animate-fade-in-up">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center border border-purple-500/40 animate-bounce">
            <BellRing className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-black text-sm sm:text-base text-stone-100">
                Fila de Fechamento — Pedidos de Conta
              </h3>
              <Badge className="bg-purple-500 text-stone-950 font-black text-xs px-2 py-0.5">
                {comandasAguardando.length} mesa(s)
              </Badge>
            </div>
            <p className="text-xs text-stone-300">
              Clientes que solicitaram a conta pelo celular aguardando fechamento no Caixa.
            </p>
          </div>
        </div>

        <span className="text-[11px] text-purple-300 font-semibold flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping inline-block" />
          Aviso em tempo real
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
        {comandasAguardando.map((cmd) => {
          const subtotal = cmd.items.reduce((acc, i) => acc + i.price * i.quantity, 0)
          const taxa = cmd.includeServiceFee ? subtotal * 0.1 : 0
          const total = subtotal + taxa

          return (
            <div
              key={cmd.tableNumber}
              className="p-3.5 rounded-xl bg-[#1C1917] border border-purple-500/40 hover:border-purple-400 transition-all flex flex-col justify-between gap-3 shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-purple-500/20 text-purple-300 flex items-center justify-center font-black text-xs border border-purple-500/40">
                      M{cmd.tableNumber}
                    </span>
                    <span className="font-extrabold text-sm text-stone-100">
                      Mesa {cmd.tableNumber}
                    </span>
                  </div>
                  <div className="text-xs text-stone-400 mt-1">
                    Cliente: {cmd.clientName || 'Consumidor'} • {cmd.items.length} itens
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[10px] text-stone-400 uppercase tracking-wider">Total</div>
                  <div className="text-base font-black text-amber-400 tabular-nums">
                    R$ {total.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Forma solicitada */}
              <div className="flex items-center justify-between text-xs pt-2 border-t border-[#292524]">
                <span className="text-stone-400">Forma Solicitada:</span>
                <Badge
                  className={`text-[11px] font-bold flex items-center gap-1 ${getFormaBadgeCls(
                    cmd.formaPagamentoSolicitada,
                  )}`}
                >
                  {getFormaIcon(cmd.formaPagamentoSolicitada)}
                  <span>{cmd.formaPagamentoSolicitada || 'Pix'}</span>
                </Badge>
              </div>

              {/* Ações do Caixa */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onRecusarAdiar(cmd)}
                  className="bg-[#292524] hover:bg-stone-800 border-[#44403C] hover:border-red-500/50 text-stone-300 hover:text-red-400 text-xs h-8 px-2"
                >
                  <XCircle className="w-3.5 h-3.5 mr-1 text-red-400 shrink-0" />
                  <span className="truncate">Adiar / Recusar</span>
                </Button>

                <Button
                  type="button"
                  size="sm"
                  onClick={() => onAtender(cmd)}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs h-8 px-2 shadow-md shadow-purple-950/40 flex items-center justify-center gap-1"
                >
                  <span>Atender & Fechar</span>
                  <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                </Button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
