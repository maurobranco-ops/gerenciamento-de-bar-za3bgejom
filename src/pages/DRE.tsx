import React, { useState, useMemo } from 'react'
import {
  FileSpreadsheet,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  Percent,
  Download,
  ArrowRightLeft,
  Layers,
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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useBar } from '@/context/BarContext'
import { useToast } from '@/hooks/use-toast'

type PeriodPreset = 'hoje' | '7dias' | '30dias' | 'mes_atual' | 'mes_anterior' | 'custom'

const HISTORIC_BASE = [
  { mes: 'Out/24', receita: 71000, despesas: 57000 },
  { mes: 'Nov/24', receita: 74200, despesas: 58200 },
  { mes: 'Dez/24', receita: 112000, despesas: 80400 },
  { mes: 'Jan/25', receita: 78500, despesas: 60500 },
  { mes: 'Fev/25', receita: 82100, despesas: 62100 },
  { mes: 'Mar/25', receita: 89400, despesas: 64900 },
]

export default function DRE() {
  const { cashMovements } = useBar()
  const { toast } = useToast()

  const [preset, setPreset] = useState<PeriodPreset>('mes_atual')
  const [compareEnabled, setCompareEnabled] = useState(true)

  // Custom date range
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date()
    d.setDate(1)
    return d.toISOString().substring(0, 10)
  })
  const [customEnd, setCustomEnd] = useState(() => new Date().toISOString().substring(0, 10))

  // Calcula limites do período
  const { startDate, endDate, prevStartDate, prevEndDate, labelPeriodo, labelAnterior } =
    useMemo(() => {
      const now = new Date()
      let s = new Date()
      let e = new Date()
      let label = ''

      if (preset === 'hoje') {
        s = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
        e = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
        label = 'Hoje'
      } else if (preset === '7dias') {
        s = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        e = now
        label = 'Últimos 7 dias'
      } else if (preset === '30dias') {
        s = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        e = now
        label = 'Últimos 30 dias'
      } else if (preset === 'mes_anterior') {
        s = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        e = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)
        label = 'Mês Anterior'
      } else if (preset === 'custom') {
        s = new Date(customStart + 'T00:00:00')
        e = new Date(customEnd + 'T23:59:59')
        label = `${customStart} a ${customEnd}`
      } else {
        // mes_atual
        s = new Date(now.getFullYear(), now.getMonth(), 1)
        e = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
        label = 'Mês Atual'
      }

      const duration = e.getTime() - s.getTime()
      const ps = new Date(s.getTime() - duration)
      const pe = new Date(s.getTime() - 1)

      return {
        startDate: s,
        endDate: e,
        prevStartDate: ps,
        prevEndDate: pe,
        labelPeriodo: label,
        labelAnterior: 'Período Anterior Equivalente',
      }
    }, [preset, customStart, customEnd])

  // Helper de cálculo dinâmico a partir do banco
  const computeMetrics = (sDate: Date, eDate: Date) => {
    const movs = cashMovements.filter((m) => {
      const dt = new Date(m.datetime)
      return dt >= sDate && dt <= eDate
    })

    const receitaBruta = movs
      .filter((m) => m.type === 'Entrada')
      .reduce((acc, m) => acc + (m.value || 0), 0)

    const devolucoes = receitaBruta * 0.015
    const taxasOperacionais = receitaBruta * 0.035
    const deducoes = devolucoes + taxasOperacionais
    const receitaLiquida = Math.max(0, receitaBruta - deducoes)

    const isCmv = (desc: string) => {
      const d = desc.toLowerCase()
      return (
        d.includes('estoque') ||
        d.includes('mercadoria') ||
        d.includes('fornecedor') ||
        d.includes('cerveja') ||
        d.includes('bebida') ||
        d.includes('carne') ||
        d.includes('compra') ||
        d.includes('barril') ||
        d.includes('refrigerante') ||
        d.includes('alimento')
      )
    }

    const cmv = movs
      .filter((m) => m.type === 'Saída' && isCmv(m.description))
      .reduce((acc, m) => acc + (m.value || 0), 0)

    const lucroBruto = receitaLiquida - cmv

    const despesasOperacionais = movs
      .filter((m) => m.type === 'Saída' && !isCmv(m.description))
      .reduce((acc, m) => acc + (m.value || 0), 0)

    const folha = despesasOperacionais * 0.45
    const aluguel = despesasOperacionais * 0.3
    const utilidades = despesasOperacionais * 0.25

    const lucroLiquido = lucroBruto - despesasOperacionais
    const margemLiquida = receitaLiquida > 0 ? (lucroLiquido / receitaLiquida) * 100 : 0
    const margemBruta = receitaLiquida > 0 ? (lucroBruto / receitaLiquida) * 100 : 0
    const cmvPct = receitaLiquida > 0 ? (cmv / receitaLiquida) * 100 : 0

    return {
      receitaBruta,
      devolucoes,
      taxasOperacionais,
      deducoes,
      receitaLiquida,
      cmv,
      cmvPct,
      lucroBruto,
      margemBruta,
      despesasOperacionais,
      folha,
      aluguel,
      utilidades,
      lucroLiquido,
      margemLiquida,
      totalCustos: cmv + despesasOperacionais,
      count: movs.length,
    }
  }

  const current = useMemo(
    () => computeMetrics(startDate, endDate),
    [cashMovements, startDate, endDate],
  )

  const previous = useMemo(
    () => computeMetrics(prevStartDate, prevEndDate),
    [cashMovements, prevStartDate, prevEndDate],
  )

  const calcDiff = (curr: number, prev: number) => {
    if (prev === 0) return curr > 0 ? '+100%' : '0%'
    const pct = ((curr - prev) / Math.abs(prev)) * 100
    const sign = pct > 0 ? '+' : ''
    return `${sign}${pct.toFixed(1)}%`
  }

  // Exportação CSV formatada Excel BR (BOM, ;, pt-BR)
  const handleExportCSV = () => {
    const rows = [
      ['DEMONSTRATIVO DO RESULTADO DO EXERCÍCIO (DRE) - RACHIDE BAR'],
      [`Período Selecionado:;${labelPeriodo}`],
      [`Gerado em:;${new Date().toLocaleString('pt-BR')}`],
      [''],
      ['Estrutura DRE;Período Atual (R$);% Rec. Líquida;Período Anterior (R$);Variação (%)'],
      [
        '(=) RECEITA OPERACIONAL BRUTA',
        current.receitaBruta.toFixed(2).replace('.', ','),
        '-',
        previous.receitaBruta.toFixed(2).replace('.', ','),
        calcDiff(current.receitaBruta, previous.receitaBruta),
      ],
      [
        '(-) Deduções & Impostos sobre Vendas',
        current.deducoes.toFixed(2).replace('.', ','),
        '-',
        previous.deducoes.toFixed(2).replace('.', ','),
        calcDiff(current.deducoes, previous.deducoes),
      ],
      [
        '(=) RECEITA OPERACIONAL LÍQUIDA',
        current.receitaLiquida.toFixed(2).replace('.', ','),
        '100,0%',
        previous.receitaLiquida.toFixed(2).replace('.', ','),
        calcDiff(current.receitaLiquida, previous.receitaLiquida),
      ],
      [
        '(-) Custos das Mercadorias Vendidas (CMV)',
        current.cmv.toFixed(2).replace('.', ','),
        current.cmvPct.toFixed(1).replace('.', ',') + '%',
        previous.cmv.toFixed(2).replace('.', ','),
        calcDiff(current.cmv, previous.cmv),
      ],
      [
        '(=) LUCRO BRUTO',
        current.lucroBruto.toFixed(2).replace('.', ','),
        current.margemBruta.toFixed(1).replace('.', ',') + '%',
        previous.lucroBruto.toFixed(2).replace('.', ','),
        calcDiff(current.lucroBruto, previous.lucroBruto),
      ],
      [
        '(-) Despesas Operacionais Fixas & Variáveis',
        current.despesasOperacionais.toFixed(2).replace('.', ','),
        '-',
        previous.despesasOperacionais.toFixed(2).replace('.', ','),
        calcDiff(current.despesasOperacionais, previous.despesasOperacionais),
      ],
      [
        '   Folha de Pagamento & Salários',
        current.folha.toFixed(2).replace('.', ','),
        '-',
        previous.folha.toFixed(2).replace('.', ','),
        calcDiff(current.folha, previous.folha),
      ],
      [
        '   Aluguel & Ponto Comercial',
        current.aluguel.toFixed(2).replace('.', ','),
        '-',
        previous.aluguel.toFixed(2).replace('.', ','),
        calcDiff(current.aluguel, previous.aluguel),
      ],
      [
        '   Energia, Água & Outras Despesas',
        current.utilidades.toFixed(2).replace('.', ','),
        '-',
        previous.utilidades.toFixed(2).replace('.', ','),
        calcDiff(current.utilidades, previous.utilidades),
      ],
      [
        '(=) LUCRO LÍQUIDO DO EXERCÍCIO',
        current.lucroLiquido.toFixed(2).replace('.', ','),
        current.margemLiquida.toFixed(1).replace('.', ',') + '%',
        previous.lucroLiquido.toFixed(2).replace('.', ','),
        calcDiff(current.lucroLiquido, previous.lucroLiquido),
      ],
    ]

    const csvContent = '\uFEFF' + rows.map((r) => r.join(';')).join('\r\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `DRE_Rachide_Bar_${preset}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast({
      title: 'DRE Exportado com Sucesso',
      description: 'Arquivo CSV gerado com padrão Excel BR (;).',
    })
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Top Banner & Control */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 rounded-2xl bg-[#292524] border border-[#44403C]">
        <div>
          <h2 className="text-xl font-black text-stone-100 flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-amber-500" />
            Demonstração do Resultado do Exercício (DRE)
          </h2>
          <p className="text-xs text-stone-400 mt-1">
            Visão contábil e gerencial com filtros dinâmicos de período e análise comparativa lado a
            lado.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            onClick={() => setCompareEnabled(!compareEnabled)}
            variant="outline"
            size="sm"
            className={`text-xs font-semibold ${
              compareEnabled
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                : 'bg-[#1C1917] text-stone-400 border-[#44403C]'
            }`}
          >
            <ArrowRightLeft className="w-3.5 h-3.5 mr-1.5" />
            {compareEnabled ? 'Comparativo Ativo' : 'Ativar Comparativo'}
          </Button>

          <Button
            onClick={handleExportCSV}
            size="sm"
            className="bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold text-xs shadow-md shadow-amber-950/40"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* Barra de Filtros por Período */}
      <div className="p-4 rounded-xl bg-[#292524] border border-[#44403C] space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-stone-400 font-semibold flex items-center gap-1.5 mr-1">
            <Calendar className="w-3.5 h-3.5 text-amber-500" />
            Filtrar Período:
          </span>

          {(
            [
              { id: 'hoje', label: 'Hoje' },
              { id: '7dias', label: 'Últimos 7 dias' },
              { id: '30dias', label: 'Últimos 30 dias' },
              { id: 'mes_atual', label: 'Mês Atual' },
              { id: 'mes_anterior', label: 'Mês Anterior' },
              { id: 'custom', label: 'Personalizado' },
            ] as Array<{ id: PeriodPreset; label: string }>
          ).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPreset(p.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                preset === p.id
                  ? 'bg-amber-500 text-stone-950 shadow-sm'
                  : 'bg-[#1C1917] text-stone-300 hover:bg-[#44403C] border border-[#44403C]'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {preset === 'custom' && (
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-[#44403C]/60 text-xs">
            <span className="text-stone-400 font-medium">De:</span>
            <Input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="w-36 bg-[#1C1917] border-[#44403C] text-stone-100 text-xs h-8"
            />
            <span className="text-stone-400 font-medium">Até:</span>
            <Input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="w-36 bg-[#1C1917] border-[#44403C] text-stone-100 text-xs h-8"
            />
          </div>
        )}
      </div>

      {/* 3 Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Receita Total */}
        <div className="p-5 rounded-2xl bg-[#292524] border border-[#44403C] shadow-md">
          <div className="flex items-center justify-between text-xs text-stone-400 font-semibold uppercase tracking-wider">
            <span>Receita Bruta</span>
            <DollarSign className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-3 text-2xl font-black text-stone-100 tabular-nums">
            R$ {current.receitaBruta.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-stone-400 mt-1 flex items-center justify-between">
            <span>{current.count} lançamentos</span>
            {compareEnabled && (
              <span
                className={`font-bold ${
                  current.receitaBruta >= previous.receitaBruta
                    ? 'text-emerald-400'
                    : 'text-red-400'
                }`}
              >
                {calcDiff(current.receitaBruta, previous.receitaBruta)}
              </span>
            )}
          </div>
        </div>

        {/* Custos Totais */}
        <div className="p-5 rounded-2xl bg-[#292524] border border-[#44403C] shadow-md">
          <div className="flex items-center justify-between text-xs text-stone-400 font-semibold uppercase tracking-wider">
            <span>Custos & Despesas (CMV + Op)</span>
            <TrendingDown className="w-4 h-4 text-red-400" />
          </div>
          <div className="mt-3 text-2xl font-black text-red-400 tabular-nums">
            R$ {current.totalCustos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-stone-400 mt-1 flex items-center justify-between">
            <span>
              CMV: R$ {current.cmv.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (
              {current.cmvPct.toFixed(1)}%)
            </span>
            {compareEnabled && (
              <span className="text-stone-300 font-semibold">
                Ant: R$ {previous.totalCustos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            )}
          </div>
        </div>

        {/* Lucro Líquido */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-[#292524] to-[#2D372E] border border-emerald-500/50 shadow-md">
          <div className="flex items-center justify-between text-xs text-emerald-400 font-bold uppercase tracking-wider">
            <span>Lucro Líquido do Bar</span>
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40 text-xs font-bold">
              Margem: {current.margemLiquida.toFixed(1)}%
            </Badge>
          </div>
          <div className="mt-3 text-2xl font-black text-emerald-400 tabular-nums">
            R$ {current.lucroLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-stone-400 mt-1 flex items-center justify-between">
            <span>Margem operacional positiva</span>
            {compareEnabled && (
              <span
                className={`font-black ${
                  current.lucroLiquido >= previous.lucroLiquido
                    ? 'text-emerald-400'
                    : 'text-red-400'
                }`}
              >
                {calcDiff(current.lucroLiquido, previous.lucroLiquido)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* DRE Structured Financial Statement */}
      <div className="rounded-2xl bg-[#292524] border border-[#44403C] overflow-hidden shadow-md">
        <div className="p-4 bg-[#1C1917]/70 border-b border-[#44403C] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <h3 className="font-bold text-sm text-stone-100 flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-amber-500" />
            Estrutura Detalhada de Resultados (DRE) {compareEnabled && '— Modo Comparativo'}
          </h3>
          <span className="text-xs text-stone-400">
            Período: <strong className="text-stone-200">{labelPeriodo}</strong>
            {compareEnabled && (
              <>
                {' '}
                vs. <strong className="text-stone-400">{labelAnterior}</strong>
              </>
            )}
          </span>
        </div>

        <div className="p-6 space-y-4">
          {/* 1. Receita Bruta */}
          <div className="flex items-center justify-between py-2 border-b border-[#44403C]/40 text-sm">
            <span className="font-bold text-stone-100">(+) RECEITA BRUTA DE VENDAS</span>
            <div className="flex items-center gap-4">
              {compareEnabled && (
                <span className="text-stone-400 text-xs tabular-nums">
                  Ant: R${' '}
                  {previous.receitaBruta.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              )}
              <span className="font-extrabold text-stone-100 tabular-nums">
                R$ {current.receitaBruta.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Devoluções */}
          <div className="flex items-center justify-between py-1 text-xs text-stone-400 pl-4">
            <span>(-) Deduções, Devoluções & Impostos sobre Vendas</span>
            <div className="flex items-center gap-4">
              {compareEnabled && (
                <span className="text-stone-500 tabular-nums">
                  Ant: - R${' '}
                  {previous.deducoes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              )}
              <span className="text-red-400 tabular-nums font-semibold">
                - R$ {current.deducoes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Receita Líquida */}
          <div className="flex items-center justify-between py-2 border-t border-dashed border-[#44403C] text-sm font-semibold text-stone-200 pl-4">
            <span>(=) RECEITA OPERACIONAL LÍQUIDA</span>
            <div className="flex items-center gap-4">
              {compareEnabled && (
                <span className="text-stone-400 text-xs tabular-nums">
                  Ant: R${' '}
                  {previous.receitaLiquida.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              )}
              <span className="tabular-nums font-bold">
                R$ {current.receitaLiquida.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* 2. CMV */}
          <div className="flex items-center justify-between py-2 border-b border-[#44403C]/40 text-sm">
            <span className="font-bold text-stone-100">
              (-) CUSTO DAS MERCADORIAS VENDIDAS (CMV)
            </span>
            <div className="flex items-center gap-4">
              {compareEnabled && (
                <span className="text-stone-400 text-xs tabular-nums">
                  Ant: - R$ {previous.cmv.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              )}
              <span className="font-extrabold text-red-400 tabular-nums">
                - R$ {current.cmv.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Lucro Bruto Highlight */}
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-sm font-bold text-amber-400">
            <span>(=) LUCRO BRUTO (Margem Bruta {current.margemBruta.toFixed(1)}%)</span>
            <div className="flex items-center gap-4">
              {compareEnabled && (
                <span className="text-amber-500/70 text-xs tabular-nums">
                  Ant: R${' '}
                  {previous.lucroBruto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (
                  {calcDiff(current.lucroBruto, previous.lucroBruto)})
                </span>
              )}
              <span className="tabular-nums text-base">
                R$ {current.lucroBruto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* 3. Despesas Operacionais */}
          <div className="py-2 text-sm font-bold text-stone-100">(-) DESPESAS OPERACIONAIS</div>

          <div className="space-y-1 pl-4 text-xs text-stone-300">
            <div className="flex items-center justify-between py-1 border-b border-[#44403C]/20">
              <span>Folha de Pagamento & Garçons</span>
              <span className="tabular-nums font-medium text-red-400">
                - R$ {current.folha.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-[#44403C]/20">
              <span>Aluguel do Ponto & Condomínio</span>
              <span className="tabular-nums font-medium text-red-400">
                - R$ {current.aluguel.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-[#44403C]/20">
              <span>Energia, Água, Gás & Outras Despesas</span>
              <span className="tabular-nums font-medium text-red-400">
                - R$ {current.utilidades.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Total Despesas */}
          <div className="flex items-center justify-between py-1 text-xs text-stone-400 pl-4 font-semibold">
            <span>Total de Despesas Operacionais</span>
            <div className="flex items-center gap-4">
              {compareEnabled && (
                <span className="text-stone-500 tabular-nums">
                  Ant: - R${' '}
                  {previous.despesasOperacionais.toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                  })}
                </span>
              )}
              <span className="text-red-400 tabular-nums">
                - R${' '}
                {current.despesasOperacionais.toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                })}
              </span>
            </div>
          </div>

          {/* Lucro Líquido Highlight */}
          <div
            className={`p-4 rounded-xl border flex items-center justify-between text-base font-black ${
              current.lucroLiquido >= 0
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
            <div className="text-right">
              <span className="text-2xl tabular-nums">
                R$ {current.lucroLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
              {compareEnabled && (
                <div className="text-xs font-bold text-stone-400">
                  Variação vs Ant: {calcDiff(current.lucroLiquido, previous.lucroLiquido)}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Chart: Receita vs Despesas Histórico */}
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
            <BarChart data={HISTORIC_BASE} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
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
