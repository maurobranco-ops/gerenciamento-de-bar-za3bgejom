import React, { useState } from 'react'
import {
  FileSpreadsheet,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  Percent,
  Layers,
  ArrowRight,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { Badge } from '../components/ui/badge'

const MONTHLY_DRE_DATA: Record<
  string,
  {
    receitaBruta: number
    devolucoes: number
    cmv: number
    funcionarios: number
    aluguel: number
    outros: number
  }
> = {
  '2025-03': {
    receitaBruta: 89400.0,
    devolucoes: 1200.0,
    cmv: 31200.0,
    funcionarios: 19800.0,
    aluguel: 7500.0,
    outros: 6400.0,
  },
  '2025-02': {
    receitaBruta: 82100.0,
    devolucoes: 950.0,
    cmv: 28900.0,
    funcionarios: 19800.0,
    aluguel: 7500.0,
    outros: 5900.0,
  },
  '2025-01': {
    receitaBruta: 78500.0,
    devolucoes: 800.0,
    cmv: 27400.0,
    funcionarios: 19800.0,
    aluguel: 7500.0,
    outros: 5400.0,
  },
  '2024-12': {
    receitaBruta: 112000.0,
    devolucoes: 1600.0,
    cmv: 39500.0,
    funcionarios: 24500.0,
    aluguel: 7500.0,
    outros: 8900.0,
  },
  '2024-11': {
    receitaBruta: 74200.0,
    devolucoes: 700.0,
    cmv: 25800.0,
    funcionarios: 19800.0,
    aluguel: 7500.0,
    outros: 5100.0,
  },
  '2024-10': {
    receitaBruta: 71000.0,
    devolucoes: 650.0,
    cmv: 24900.0,
    funcionarios: 19800.0,
    aluguel: 7500.0,
    outros: 4800.0,
  },
}

const HISTORIC_CHART = [
  { mes: 'Out/24', receita: 71000, despesas: 57000 },
  { mes: 'Nov/24', receita: 74200, despesas: 58200 },
  { mes: 'Dez/24', receita: 112000, despesas: 80400 },
  { mes: 'Jan/25', receita: 78500, despesas: 60500 },
  { mes: 'Fev/25', receita: 82100, despesas: 62100 },
  { mes: 'Mar/25', receita: 89400, despesas: 64900 },
]

export default function DRE() {
  const [selectedMonth, setSelectedMonth] = useState<string>('2025-03')

  const currentDRE = MONTHLY_DRE_DATA[selectedMonth] || MONTHLY_DRE_DATA['2025-03']

  // Calculations
  const receitaLiquida = currentDRE.receitaBruta - currentDRE.devolucoes
  const lucroBruto = receitaLiquida - currentDRE.cmv
  const despesasOperacionais = currentDRE.funcionarios + currentDRE.aluguel + currentDRE.outros
  const lucroLiquido = lucroBruto - despesasOperacionais
  const margemLiquida = ((lucroLiquido / receitaLiquida) * 100).toFixed(1)
  const totalCustos = currentDRE.cmv + despesasOperacionais

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Top Banner & Control */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-[#292524] border border-[#44403C]">
        <div>
          <h2 className="text-xl font-black text-stone-100 flex items-center gap-2">
            Demonstração do Resultado do Exercício (DRE)
          </h2>
          <p className="text-xs text-stone-400 mt-1">
            Visão contábil e gerencial de receitas, custos diretos de mercadorias (CMV) e lucro
            líquido.
          </p>
        </div>

        {/* Month Selector */}
        <div className="flex items-center gap-2 bg-[#1C1917] border border-[#44403C] rounded-xl px-3 py-1.5 text-xs">
          <Calendar className="w-3.5 h-3.5 text-amber-500" />
          <span className="text-stone-400 font-medium">Período:</span>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-transparent text-stone-200 font-bold focus:outline-none cursor-pointer"
          >
            <option value="2025-03">Março / 2025</option>
            <option value="2025-02">Fevereiro / 2025</option>
            <option value="2025-01">Janeiro / 2025</option>
            <option value="2024-12">Dezembro / 2024</option>
            <option value="2024-11">Novembro / 2024</option>
            <option value="2024-10">Outubro / 2024</option>
          </select>
        </div>
      </div>

      {/* 3 Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Receita Total */}
        <div className="p-5 rounded-2xl bg-[#292524] border border-[#44403C] shadow-md">
          <div className="flex items-center justify-between text-xs text-stone-400 font-semibold uppercase tracking-wider">
            <span>Receita Bruta Total</span>
            <DollarSign className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-3 text-2xl font-black text-stone-100 tabular-nums">
            R$ {currentDRE.receitaBruta.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-stone-400 mt-1">Faturamento bruto faturado no mês</div>
        </div>

        {/* Custos Totais */}
        <div className="p-5 rounded-2xl bg-[#292524] border border-[#44403C] shadow-md">
          <div className="flex items-center justify-between text-xs text-stone-400 font-semibold uppercase tracking-wider">
            <span>Custos & Despesas (CMV + Op)</span>
            <TrendingDown className="w-4 h-4 text-red-400" />
          </div>
          <div className="mt-3 text-2xl font-black text-red-400 tabular-nums">
            R$ {totalCustos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-stone-400 mt-1">
            CMV: R$ {currentDRE.cmv.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
        </div>

        {/* Lucro Líquido */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-[#292524] to-[#2D372E] border border-emerald-500/50 shadow-md">
          <div className="flex items-center justify-between text-xs text-emerald-400 font-bold uppercase tracking-wider">
            <span>Lucro Líquido do Bar</span>
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40 text-xs font-bold">
              Margem: {margemLiquida}%
            </Badge>
          </div>
          <div className="mt-3 text-2xl font-black text-emerald-400 tabular-nums">
            R$ {lucroLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-stone-400 mt-1">Margem operacional positiva</div>
        </div>
      </div>

      {/* DRE Structured Financial Statement */}
      <div className="rounded-2xl bg-[#292524] border border-[#44403C] overflow-hidden shadow-md">
        <div className="p-4 bg-[#1C1917]/70 border-b border-[#44403C] flex items-center justify-between">
          <h3 className="font-bold text-sm text-stone-100 flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-amber-500" />
            Estrutura Detalhada de Resultados (DRE)
          </h3>
          <span className="text-xs text-stone-400">Padrão Contábil Gerencial</span>
        </div>

        <div className="p-6 space-y-4">
          {/* 1. Receita Bruta */}
          <div className="flex items-center justify-between py-2 border-b border-[#44403C]/40 text-sm">
            <span className="font-bold text-stone-100">(+) RECEITA BRUTA DE VENDAS</span>
            <span className="font-extrabold text-stone-100 tabular-nums">
              R$ {currentDRE.receitaBruta.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>

          {/* Devoluções */}
          <div className="flex items-center justify-between py-1 text-xs text-stone-400 pl-4">
            <span>(-) Deduções, Devoluções & Cancelamentos</span>
            <span className="text-red-400 tabular-nums font-semibold">
              - R$ {currentDRE.devolucoes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>

          {/* Receita Líquida */}
          <div className="flex items-center justify-between py-2 border-t border-dashed border-[#44403C] text-sm font-semibold text-stone-200 pl-4">
            <span>(=) RECEITA OPERACIONAL LÍQUIDA</span>
            <span className="tabular-nums font-bold">
              R$ {receitaLiquida.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>

          {/* 2. CMV */}
          <div className="flex items-center justify-between py-2 border-b border-[#44403C]/40 text-sm">
            <span className="font-bold text-stone-100">
              (-) CUSTO DAS MERCADORIAS VENDIDAS (CMV)
            </span>
            <span className="font-extrabold text-red-400 tabular-nums">
              - R$ {currentDRE.cmv.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>

          {/* Lucro Bruto Highlight */}
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-sm font-bold text-amber-400">
            <span>(=) LUCRO BRUTO (Margem Bruta)</span>
            <span className="tabular-nums text-base">
              R$ {lucroBruto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>

          {/* 3. Despesas Operacionais */}
          <div className="py-2 text-sm font-bold text-stone-100">(-) DESPESAS OPERACIONAIS</div>

          <div className="space-y-1 pl-4 text-xs text-stone-300">
            <div className="flex items-center justify-between py-1 border-b border-[#44403C]/20">
              <span>Folha de Pagamento & Garçons</span>
              <span className="tabular-nums font-medium text-red-400">
                - R$ {currentDRE.funcionarios.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-[#44403C]/20">
              <span>Aluguel do Ponto & Condomínio</span>
              <span className="tabular-nums font-medium text-red-400">
                - R$ {currentDRE.aluguel.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-[#44403C]/20">
              <span>Energia, Água, Gás & Outras Despesas</span>
              <span className="tabular-nums font-medium text-red-400">
                - R$ {currentDRE.outros.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Total Despesas */}
          <div className="flex items-center justify-between py-1 text-xs text-stone-400 pl-4 font-semibold">
            <span>Total de Despesas Operacionais</span>
            <span className="text-red-400 tabular-nums">
              - R$ {despesasOperacionais.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>

          {/* Lucro Líquido Highlight */}
          <div
            className={`p-4 rounded-xl border flex items-center justify-between text-base font-black ${
              lucroLiquido >= 0
                ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-400'
                : 'bg-red-500/15 border-red-500/50 text-red-400'
            }`}
          >
            <div>
              <span>(=) LUCRO LÍQUIDO DO EXERCÍCIO</span>
              <span className="block text-xs font-normal text-stone-300">
                Receita Líquida - CMV - Despesas Operacionais
              </span>
            </div>
            <span className="text-2xl tabular-nums">
              R$ {lucroLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* Chart: Receita vs Despesas Últimos 6 Meses */}
      <div className="p-5 rounded-2xl bg-[#292524] border border-[#44403C] shadow-md">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-stone-100">Receita vs. Despesas por Mês</h3>
            <p className="text-xs text-stone-400">
              Comparativo dos últimos 6 meses com barras de receita (verde) e despesas (vermelho)
            </p>
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={HISTORIC_CHART} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#44403C" vertical={false} />
              <XAxis dataKey="mes" stroke="#A8A29E" fontSize={12} tickLine={false} />
              <YAxis stroke="#A8A29E" fontSize={12} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1C1917',
                  border: '1px solid #44403C',
                  borderRadius: '8px',
                  color: '#F5F5F4',
                }}
                formatter={(val: any) => [
                  `R$ ${Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                  '',
                ]}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="receita" name="Receita Bruta" fill="#10B981" radius={[4, 4, 0, 0]} />
              <Bar
                dataKey="despesas"
                name="Custos & Despesas"
                fill="#EF4444"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
