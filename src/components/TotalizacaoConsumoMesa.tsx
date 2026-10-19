import React from 'react'
import { Receipt, Clock, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { DetalhesContaMesa } from '@/types/bar'

interface TotalizacaoConsumoMesaProps {
  mesaNumero: number
  detalhesConta: DetalhesContaMesa | null
  loading?: boolean
}

export const TotalizacaoConsumoMesa: React.FC<TotalizacaoConsumoMesaProps> = ({
  mesaNumero,
  detalhesConta,
  loading = false,
}) => {
  // Itens confirmados na comanda do bar/banco
  const itens = detalhesConta?.itens || []
  const quantidadeItens = itens.reduce((acc, item) => acc + (Number(item.quantidade) || 0), 0)
  const subtotal = detalhesConta?.subtotal || 0
  const taxaPercentual = detalhesConta?.taxaPercentual ?? 10
  const taxaServico = detalhesConta?.taxaServico || 0
  const total = detalhesConta?.total || subtotal + taxaServico

  return (
    <section
      aria-label="Totalização parcial do consumo da mesa"
      className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-br from-[#24201D] via-[#2A241F] to-[#1C1917] border border-amber-500/40 shadow-lg space-y-3"
    >
      {/* Top Header do Card de Totalização */}
      <div className="flex items-center justify-between gap-2 border-b border-[#44403C]/60 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30 shrink-0">
            <Receipt className="w-4 h-4 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs sm:text-sm font-black text-stone-100 uppercase tracking-wider">
                Consumo da Mesa {mesaNumero}
              </h3>
              <Badge
                variant="outline"
                className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[9px] font-bold py-0 h-4"
              >
                Confirmado
              </Badge>
            </div>
            <p className="text-[10px] text-stone-400">
              Itens já enviados à comanda • Atualização em tempo real
            </p>
          </div>
        </div>

        <div className="text-right">
          <span className="text-[10px] text-stone-400 uppercase font-bold block">
            Itens Pedidos
          </span>
          <span className="text-xs sm:text-sm font-black text-amber-400 tabular-nums">
            {loading ? '...' : `${quantidadeItens} un`}
          </span>
        </div>
      </div>

      {/* Grid de Valores: Subtotal, Taxa de Serviço e Total Parcial */}
      <div className="grid grid-cols-3 gap-2 text-center">
        {/* Subtotal */}
        <div className="p-2 sm:p-2.5 rounded-xl bg-[#1C1917]/90 border border-[#44403C]/70">
          <span className="text-[10px] text-stone-400 block font-medium">Subtotal</span>
          <span className="text-xs sm:text-sm font-bold text-stone-200 tabular-nums block mt-0.5">
            R$ {subtotal.toFixed(2)}
          </span>
        </div>

        {/* Taxa de Serviço */}
        <div className="p-2 sm:p-2.5 rounded-xl bg-[#1C1917]/90 border border-[#44403C]/70">
          <span className="text-[10px] text-stone-400 block font-medium">
            Taxa ({taxaPercentual}%)
          </span>
          <span className="text-xs sm:text-sm font-bold text-stone-300 tabular-nums block mt-0.5">
            + R$ {taxaServico.toFixed(2)}
          </span>
        </div>

        {/* Total Parcial */}
        <div className="p-2 sm:p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/50 shadow-inner">
          <span className="text-[10px] text-amber-400 block font-extrabold uppercase tracking-wide">
            Total Parcial
          </span>
          <span className="text-sm sm:text-base font-black text-amber-400 tabular-nums block mt-0.5">
            R$ {total.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Rodapé explicativo para diferenciar claramente do carrinho de compras local */}
      <div className="flex items-center justify-between text-[10px] text-stone-400 pt-0.5">
        <span className="flex items-center gap-1 text-stone-400">
          <Clock className="w-3 h-3 text-amber-500" />
          <span>Lançado na comanda do bar</span>
        </span>
        <span className="text-stone-500 italic">O carrinho local abaixo ainda não foi enviado</span>
      </div>
    </section>
  )
}
