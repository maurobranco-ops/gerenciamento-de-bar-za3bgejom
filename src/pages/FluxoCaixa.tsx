import React, { useState, useMemo } from 'react'
import {
  BadgeDollarSign,
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  Lock,
  Plus,
  Calendar,
  CheckCircle2,
  Clock,
  Filter,
  Download,
  Search,
  SlidersHorizontal,
} from 'lucide-react'
import { useBar } from '../context/BarContext'
import { CashMovement, PaymentMethod } from '../types/bar'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog'
import { useToast } from '../hooks/use-toast'

type PeriodPreset = 'hoje' | '7dias' | '30dias' | 'mes_atual' | 'mes_anterior' | 'custom'

export default function FluxoCaixa() {
  const { cashMovements, cashDays, addCashMovement, closeCashRegister, role } = useBar()
  const { toast } = useToast()

  // Filtros Avançados
  const [preset, setPreset] = useState<PeriodPreset>('30dias')
  const [filterType, setFilterType] = useState<'Todos' | 'Entrada' | 'Saída'>('Todos')
  const [filterPayment, setFilterPayment] = useState<string>('Todos')
  const [searchQuery, setSearchQuery] = useState('')

  // Intervalo customizado
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date()
    d.setDate(1)
    return d.toISOString().substring(0, 10)
  })
  const [customEnd, setCustomEnd] = useState(() => new Date().toISOString().substring(0, 10))

  // New Movement Modal
  const [newMovementOpen, setNewMovementOpen] = useState(false)
  const [movType, setMovType] = useState<'Entrada' | 'Saída'>('Entrada')
  const [movDesc, setMovDesc] = useState('')
  const [movValue, setMovValue] = useState('')
  const [movPaymentMethod, setMovPaymentMethod] = useState<PaymentMethod>('Dinheiro')

  // Fechar Caixa Modal
  const [fecharCaixaOpen, setFecharCaixaOpen] = useState(false)

  // Determina intervalo de datas ativo
  const { startDate, endDate, labelPeriodo } = useMemo(() => {
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

    return { startDate: s, endDate: e, labelPeriodo: label }
  }, [preset, customStart, customEnd])

  // Filtra movimentos pelo intervalo e filtros adicionais
  const filteredMovements = useMemo(() => {
    return cashMovements.filter((m) => {
      const dt = new Date(m.datetime)
      const inDateRange = dt >= startDate && dt <= endDate

      const matchesType = filterType === 'Todos' || m.type === filterType
      const matchesPayment =
        filterPayment === 'Todos' ||
        (m.paymentMethod || 'Dinheiro').toLowerCase() === filterPayment.toLowerCase()

      const matchesSearch =
        !searchQuery.trim() ||
        m.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.user && m.user.toLowerCase().includes(searchQuery.toLowerCase()))

      return inDateRange && matchesType && matchesPayment && matchesSearch
    })
  }, [cashMovements, startDate, endDate, filterType, filterPayment, searchQuery])

  // Cálculos consolidados do período filtrado
  const totalEntradas = useMemo(() => {
    return filteredMovements
      .filter((m) => m.type === 'Entrada')
      .reduce((sum, m) => sum + (m.value || 0), 0)
  }, [filteredMovements])

  const totalSaidas = useMemo(() => {
    return filteredMovements
      .filter((m) => m.type === 'Saída')
      .reduce((sum, m) => sum + (m.value || 0), 0)
  }, [filteredMovements])

  const saldoPeriodo = totalEntradas - totalSaidas

  // Status de fechamento do dia atual de referência
  const todayStr = new Date().toISOString().substring(0, 10)
  const currentDayInfo = cashDays.find((d) => d.date === todayStr) || {
    date: todayStr,
    openingBalance: 400.0,
    isClosed: false,
  }

  // Exportar CSV compatível com Excel BR (BOM, ;, pt-BR)
  const handleExportCSV = () => {
    const rows = [
      ['RELATÓRIO DE FLUXO DE CAIXA - RACHIDE BAR'],
      [`Período:;${labelPeriodo}`],
      [`Filtro Tipo:;${filterType}`],
      [`Filtro Meio de Pagamento:;${filterPayment}`],
      [`Total Entradas:;R$ ${totalEntradas.toFixed(2).replace('.', ',')}`],
      [`Total Saídas:;R$ ${totalSaidas.toFixed(2).replace('.', ',')}`],
      [`Saldo do Período:;R$ ${saldoPeriodo.toFixed(2).replace('.', ',')}`],
      [`Gerado em:;${new Date().toLocaleString('pt-BR')}`],
      [''],
      ['Data/Hora;Descrição;Tipo;Forma Pagamento;Valor (R$);Operador'],
      ...filteredMovements.map((m) => [
        m.datetime.replace('T', ' ').substring(0, 19),
        `"${m.description.replace(/"/g, '""')}"`,
        m.type,
        `"${m.paymentMethod || 'Dinheiro'}"`,
        (m.value || 0).toFixed(2).replace('.', ','),
        `"${m.user || 'Operador'}"`,
      ]),
    ]

    const csvContent = '\uFEFF' + rows.map((r) => r.join(';')).join('\r\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `Fluxo_Caixa_Rachide_Bar_${preset}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast({
      title: 'Fluxo de Caixa Exportado',
      description: `${filteredMovements.length} movimentos exportados com separador padrão Excel (;).`,
    })
  }

  const handleConfirmMovement = (e: React.FormEvent) => {
    e.preventDefault()
    const val = parseFloat(movValue)
    if (isNaN(val) || val <= 0 || !movDesc.trim()) {
      toast({
        variant: 'destructive',
        title: 'Dados inválidos',
        description: 'Informe uma descrição e um valor positivo.',
      })
      return
    }

    addCashMovement(movType, movDesc.trim(), val, movPaymentMethod)
    setNewMovementOpen(false)
    setMovDesc('')
    setMovValue('')
  }

  const handleConfirmFechamento = () => {
    closeCashRegister(todayStr)
    setFecharCaixaOpen(false)
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Top Banner & Control */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 rounded-2xl bg-[#292524] border border-[#44403C]">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-stone-100 flex items-center gap-2">
              <BadgeDollarSign className="w-6 h-6 text-amber-500" />
              Fluxo de Caixa Operacional & Relatórios
            </h2>
            {currentDayInfo.isClosed ? (
              <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/40 text-xs flex items-center gap-1 font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Caixa Fechado
              </Badge>
            ) : (
              <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/40 text-xs flex items-center gap-1 font-bold">
                <Clock className="w-3.5 h-3.5" />
                Caixa Aberto
              </Badge>
            )}
          </div>
          <p className="text-xs text-stone-400 mt-1">
            Controle analítico de entradas, saídas, conciliação e exportação detalhada.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            onClick={handleExportCSV}
            variant="outline"
            size="sm"
            className="bg-[#1C1917] hover:bg-[#44403C] border-[#44403C] text-stone-200 text-xs font-semibold"
          >
            <Download className="w-3.5 h-3.5 mr-1.5 text-amber-500" />
            Exportar CSV (Excel BR)
          </Button>

          <Button
            onClick={() => setNewMovementOpen(true)}
            size="sm"
            className="bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold text-xs shadow-md shadow-amber-950/40"
          >
            <Plus className="w-4 h-4 mr-1" />
            Registrar Movimento
          </Button>

          {!currentDayInfo.isClosed && (
            <Button
              onClick={() => setFecharCaixaOpen(true)}
              variant="outline"
              size="sm"
              className="bg-[#1C1917] hover:bg-red-500 hover:text-white border-[#44403C] hover:border-red-500 text-red-400 font-bold text-xs"
            >
              <Lock className="w-3.5 h-3.5 mr-1" />
              Fechar Caixa
            </Button>
          )}
        </div>
      </div>

      {/* Caixa do Dia Summary Card (4 columns) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Abertura */}
        <div className="p-5 rounded-2xl bg-[#292524] border border-[#44403C] shadow-md">
          <div className="flex items-center justify-between text-xs text-stone-400 font-semibold uppercase tracking-wider">
            <span>Fundo de Abertura</span>
            <Wallet className="w-4 h-4 text-stone-400" />
          </div>
          <div className="mt-3 text-2xl font-extrabold text-stone-200 tabular-nums">
            R$ {currentDayInfo.openingBalance.toFixed(2)}
          </div>
          <div className="text-[11px] text-stone-400 mt-1">Fundo inicial de troco</div>
        </div>

        {/* Entradas do Período */}
        <div className="p-5 rounded-2xl bg-[#292524] border border-[#44403C] shadow-md">
          <div className="flex items-center justify-between text-xs text-stone-400 font-semibold uppercase tracking-wider">
            <span>Entradas Filtradas</span>
            <ArrowUpRight className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-3 text-2xl font-extrabold text-emerald-400 tabular-nums">
            + R$ {totalEntradas.toFixed(2)}
          </div>
          <div className="text-[11px] text-stone-400 mt-1">
            {filteredMovements.filter((m) => m.type === 'Entrada').length} recebimentos
          </div>
        </div>

        {/* Saídas do Período */}
        <div className="p-5 rounded-2xl bg-[#292524] border border-[#44403C] shadow-md">
          <div className="flex items-center justify-between text-xs text-stone-400 font-semibold uppercase tracking-wider">
            <span>Saídas Filtradas</span>
            <ArrowDownLeft className="w-4 h-4 text-red-400" />
          </div>
          <div className="mt-3 text-2xl font-extrabold text-red-400 tabular-nums">
            - R$ {totalSaidas.toFixed(2)}
          </div>
          <div className="text-[11px] text-stone-400 mt-1">
            {filteredMovements.filter((m) => m.type === 'Saída').length} sangrias/despesas
          </div>
        </div>

        {/* Saldo Líquido do Período */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-[#292524] to-[#342D26] border border-amber-500/50 shadow-lg">
          <div className="flex items-center justify-between text-xs text-amber-400 font-bold uppercase tracking-wider">
            <span>Saldo do Período</span>
            <BadgeDollarSign className="w-5 h-5 text-amber-500" />
          </div>
          <div
            className={`mt-2 text-3xl font-black tabular-nums ${
              saldoPeriodo >= 0 ? 'text-amber-400' : 'text-red-400'
            }`}
          >
            {saldoPeriodo >= 0 ? '+' : ''} R$ {saldoPeriodo.toFixed(2)}
          </div>
          <div className="text-[11px] text-stone-400 mt-1">Entradas - Saídas no período</div>
        </div>
      </div>

      {/* Barra de Filtros Avançados */}
      <div className="p-5 rounded-2xl bg-[#292524] border border-[#44403C] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Presets de Período */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-stone-400 font-semibold flex items-center gap-1.5 mr-1">
              <Calendar className="w-3.5 h-3.5 text-amber-500" />
              Período:
            </span>

            {(
              [
                { id: 'hoje', label: 'Hoje' },
                { id: '7dias', label: '7 dias' },
                { id: '30dias', label: '30 dias' },
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

          {/* Toggle Tipo */}
          <div className="flex items-center gap-1.5 bg-[#1C1917] p-1 rounded-xl border border-[#44403C] text-xs">
            {(['Todos', 'Entrada', 'Saída'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`px-3 py-1 rounded-lg font-bold transition-all ${
                  filterType === t
                    ? 'bg-amber-500 text-stone-950'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Date Range if active */}
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

        {/* Linha 2 de Filtros: Busca Textual e Meio de Pagamento */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#44403C]/60">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-stone-500" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por descrição, operador ou categoria..."
              className="pl-9 bg-[#1C1917] border-[#44403C] text-stone-100 text-xs h-9"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-stone-400 font-medium whitespace-nowrap">
              Forma de Pagamento:
            </span>
            <select
              value={filterPayment}
              onChange={(e) => setFilterPayment(e.target.value)}
              className="w-full bg-[#1C1917] border border-[#44403C] rounded-lg px-3 py-2 text-xs text-stone-100 focus:outline-none focus:border-amber-500"
            >
              <option value="Todos">Todas as formas</option>
              <option value="Dinheiro">Dinheiro</option>
              <option value="Pix">Pix</option>
              <option value="Cartão Débito">Cartão Débito</option>
              <option value="Cartão Crédito">Cartão Crédito</option>
              <option value="TEP">TEP</option>
            </select>
          </div>
        </div>
      </div>

      {/* Movements Table */}
      <div className="rounded-2xl bg-[#292524] border border-[#44403C] overflow-hidden shadow-md">
        <div className="p-4 bg-[#1C1917]/70 border-b border-[#44403C] flex items-center justify-between">
          <h3 className="font-bold text-sm text-stone-100 flex items-center gap-2">
            <BadgeDollarSign className="w-4 h-4 text-amber-500" />
            Movimentações Detalhadas ({filteredMovements.length})
          </h3>
          <span className="text-xs text-stone-400">
            Período: <strong className="text-stone-200">{labelPeriodo}</strong>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#44403C] text-stone-400 uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4 font-semibold">Data/Hora</th>
                <th className="py-3 px-4 font-semibold">Descrição</th>
                <th className="py-3 px-4 font-semibold">Tipo</th>
                <th className="py-3 px-4 font-semibold">Categoria</th>
                <th className="py-3 px-4 font-semibold">Forma Pagto</th>
                <th className="py-3 px-4 font-semibold text-right">Valor</th>
                <th className="py-3 px-4 font-semibold text-right">Operador</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#44403C]/40">
              {filteredMovements.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-stone-400 text-xs">
                    Nenhuma movimentação encontrada para os filtros aplicados.
                  </td>
                </tr>
              ) : (
                filteredMovements.map((m) => (
                  <tr
                    key={m.id}
                    className={`transition-colors ${
                      m.type === 'Entrada'
                        ? 'bg-emerald-950/10 hover:bg-emerald-950/25'
                        : 'bg-red-950/10 hover:bg-red-950/25'
                    }`}
                  >
                    <td className="py-3.5 px-4 text-stone-400 tabular-nums">
                      {m.datetime.replace('T', ' ').substring(0, 16)}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-stone-100">{m.description}</td>
                    <td className="py-3.5 px-4">
                      <Badge
                        variant="outline"
                        className={
                          m.type === 'Entrada'
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40 text-[10px]'
                            : 'bg-red-500/15 text-red-400 border-red-500/40 text-[10px]'
                        }
                      >
                        {m.type}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4 text-stone-400">Geral</td>
                    <td className="py-3.5 px-4 text-stone-300 font-medium">
                      {m.paymentMethod || 'Dinheiro'}
                    </td>
                    <td
                      className={`py-3.5 px-4 font-extrabold tabular-nums text-sm text-right ${
                        m.type === 'Entrada' ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {m.type === 'Entrada' ? '+' : '-'} R$ {(m.value || 0).toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-stone-400 font-medium text-right">
                      {m.user || 'Sistema'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Registrar Movimento */}
      <Dialog open={newMovementOpen} onOpenChange={setNewMovementOpen}>
        <DialogContent className="max-w-md bg-[#292524] border-[#44403C] text-stone-100 p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black text-stone-100">
              Registrar Movimentação Manual no Caixa
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleConfirmMovement} className="space-y-4 pt-2 text-xs">
            {/* Toggle Tipo */}
            <div>
              <Label className="text-xs text-stone-400">Tipo de Movimentação</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setMovType('Entrada')}
                  className={`py-2 rounded-lg font-bold border transition-colors flex items-center justify-center gap-1.5 ${
                    movType === 'Entrada'
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500'
                      : 'bg-[#1C1917] text-stone-400 border-[#44403C]'
                  }`}
                >
                  <ArrowUpRight className="w-4 h-4" />
                  Entrada (Receita)
                </button>
                <button
                  type="button"
                  onClick={() => setMovType('Saída')}
                  className={`py-2 rounded-lg font-bold border transition-colors flex items-center justify-center gap-1.5 ${
                    movType === 'Saída'
                      ? 'bg-red-500/20 text-red-400 border-red-500'
                      : 'bg-[#1C1917] text-stone-400 border-[#44403C]'
                  }`}
                >
                  <ArrowDownLeft className="w-4 h-4" />
                  Saída (Sangria/Gasto)
                </button>
              </div>
            </div>

            <div>
              <Label className="text-xs text-stone-400">Descrição do Lançamento</Label>
              <Input
                value={movDesc}
                onChange={(e) => setMovDesc(e.target.value)}
                placeholder="Ex: Compra de gelo, Gorjeta extra, Suprimento de troco..."
                className="mt-1 bg-[#1C1917] border-[#44403C] text-stone-100 text-xs"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-stone-400">Valor (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={movValue}
                  onChange={(e) => setMovValue(e.target.value)}
                  placeholder="0,00"
                  className="mt-1 bg-[#1C1917] border-[#44403C] text-stone-100 text-xs tabular-nums"
                  required
                />
              </div>

              <div>
                <Label className="text-xs text-stone-400">Forma de Pagamento</Label>
                <select
                  value={movPaymentMethod}
                  onChange={(e) => setMovPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full mt-1 bg-[#1C1917] border border-[#44403C] rounded-lg px-3 py-2 text-xs text-stone-100 focus:outline-none focus:border-amber-500"
                >
                  <option value="Dinheiro">Dinheiro</option>
                  <option value="Pix">Pix</option>
                  <option value="Cartão Débito">Cartão Débito</option>
                  <option value="Cartão Crédito">Cartão Crédito</option>
                  <option value="TEP">TEP</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#44403C]">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setNewMovementOpen(false)}
                className="text-stone-400 text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold text-xs"
              >
                Confirmar Lançamento
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Fechar Caixa */}
      <Dialog open={fecharCaixaOpen} onOpenChange={setFecharCaixaOpen}>
        <DialogContent className="max-w-md bg-[#292524] border-[#44403C] text-stone-100 p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black text-stone-100 flex items-center gap-2">
              <Lock className="w-5 h-5 text-red-400" />
              Fechamento de Caixa: {todayStr}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 pt-2 text-xs">
            <p className="text-stone-300 leading-relaxed">
              Confira os totais consolidados antes de homologar o encerramento do turno financeiro:
            </p>

            <div className="p-4 rounded-xl bg-[#1C1917] border border-[#44403C] space-y-2">
              <div className="flex justify-between">
                <span className="text-stone-400">Fundo de Abertura:</span>
                <span className="font-bold text-stone-200 tabular-nums">
                  R$ {currentDayInfo.openingBalance.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-400">Total de Entradas:</span>
                <span className="font-bold text-emerald-400 tabular-nums">
                  + R$ {totalEntradas.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-400">Total de Saídas:</span>
                <span className="font-bold text-red-400 tabular-nums">
                  - R$ {totalSaidas.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-stone-800 text-sm font-black">
                <span className="text-amber-400">Saldo Final em Caixa:</span>
                <span className="text-amber-400 tabular-nums text-base">
                  R$ {(currentDayInfo.openingBalance + totalEntradas - totalSaidas).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px]">
              Após a confirmação, o dia será sinalizado como <strong>Fechado</strong> para auditoria
              contábil.
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#44403C]">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setFecharCaixaOpen(false)}
                className="text-stone-400 text-xs"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleConfirmFechamento}
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
