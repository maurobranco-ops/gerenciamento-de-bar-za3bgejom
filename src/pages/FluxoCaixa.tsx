import React, { useState } from 'react'
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
} from 'lucide-react'
import { useBar } from '../context/BarContext'
import { CashMovement, PaymentMethod } from '../types/bar'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog'
import { useToast } from '../hooks/use-toast'

export default function FluxoCaixa() {
  const { cashMovements, cashDays, addCashMovement, closeCashRegister, role } = useBar()
  const { toast } = useToast()

  const [filterDate, setFilterDate] = useState<string>('2025-03-17')
  const [filterType, setFilterType] = useState<'Todos' | 'Entrada' | 'Saída'>('Todos')

  // New Movement Modal
  const [newMovementOpen, setNewMovementOpen] = useState(false)
  const [movType, setMovType] = useState<'Entrada' | 'Saída'>('Entrada')
  const [movDesc, setMovDesc] = useState('')
  const [movValue, setMovValue] = useState('')
  const [movPaymentMethod, setMovPaymentMethod] = useState<PaymentMethod>('Dinheiro')

  // Fechar Caixa Modal
  const [fecharCaixaOpen, setFecharCaixaOpen] = useState(false)

  // Cash day info for the selected day
  const currentDayInfo = cashDays.find((d) => d.date === filterDate) || {
    date: filterDate,
    openingBalance: 400.0,
    isClosed: false,
  }

  // Movements of selected day
  const dayMovements = cashMovements.filter((m) => m.datetime.startsWith(filterDate))

  // Calculations
  const totalEntradas = dayMovements
    .filter((m) => m.type === 'Entrada')
    .reduce((sum, m) => sum + m.value, 0)

  const totalSaidas = dayMovements
    .filter((m) => m.type === 'Saída')
    .reduce((sum, m) => sum + m.value, 0)

  const saldoAtual = currentDayInfo.openingBalance + totalEntradas - totalSaidas

  // Filtered movements for table
  const displayedMovements = dayMovements.filter((m) => {
    if (filterType === 'Todos') return true
    return m.type === filterType
  })

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
    closeCashRegister(filterDate)
    setFecharCaixaOpen(false)
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Top Banner & Control */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-[#292524] border border-[#44403C]">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-stone-100 flex items-center gap-2">
              Fluxo de Caixa Operacional
            </h2>
            {currentDayInfo.isClosed ? (
              <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/40 text-xs flex items-center gap-1 font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Caixa Fechado
              </Badge>
            ) : (
              <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/40 text-xs flex items-center gap-1 font-bold animate-pulse-subtle">
                <Clock className="w-3.5 h-3.5" />
                Caixa Aberto
              </Badge>
            )}
          </div>
          <p className="text-xs text-stone-400 mt-1">
            Controle de entradas, sangrias, despesas diárias e conciliação de pagamentos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Date Picker Filter */}
          <div className="flex items-center gap-1.5 bg-[#1C1917] border border-[#44403C] rounded-xl px-3 py-1.5 text-xs">
            <Calendar className="w-3.5 h-3.5 text-amber-500" />
            <select
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="bg-transparent text-stone-200 focus:outline-none cursor-pointer"
            >
              <option value="2025-03-17">17/03/2025 (Hoje)</option>
              <option value="2025-03-16">16/03/2025 (Domingo)</option>
              <option value="2025-03-15">15/03/2025 (Sábado)</option>
            </select>
          </div>

          <Button
            onClick={() => setNewMovementOpen(true)}
            size="sm"
            className="bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold text-xs"
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
            <span>Abertura de Caixa</span>
            <Wallet className="w-4 h-4 text-stone-400" />
          </div>
          <div className="mt-3 text-2xl font-extrabold text-stone-200 tabular-nums">
            R$ {currentDayInfo.openingBalance.toFixed(2)}
          </div>
          <div className="text-[11px] text-stone-400 mt-1">Fundo inicial de troco</div>
        </div>

        {/* Entradas */}
        <div className="p-5 rounded-2xl bg-[#292524] border border-[#44403C] shadow-md">
          <div className="flex items-center justify-between text-xs text-stone-400 font-semibold uppercase tracking-wider">
            <span>Total de Entradas</span>
            <ArrowUpRight className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-3 text-2xl font-extrabold text-emerald-400 tabular-nums">
            + R$ {totalEntradas.toFixed(2)}
          </div>
          <div className="text-[11px] text-stone-400 mt-1">
            {dayMovements.filter((m) => m.type === 'Entrada').length} recebimentos
          </div>
        </div>

        {/* Saídas */}
        <div className="p-5 rounded-2xl bg-[#292524] border border-[#44403C] shadow-md">
          <div className="flex items-center justify-between text-xs text-stone-400 font-semibold uppercase tracking-wider">
            <span>Total de Saídas</span>
            <ArrowDownLeft className="w-4 h-4 text-red-400" />
          </div>
          <div className="mt-3 text-2xl font-extrabold text-red-400 tabular-nums">
            - R$ {totalSaidas.toFixed(2)}
          </div>
          <div className="text-[11px] text-stone-400 mt-1">
            {dayMovements.filter((m) => m.type === 'Saída').length} sangrias/despesas
          </div>
        </div>

        {/* Saldo Atual Grande */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-[#292524] to-[#342D26] border border-amber-500/50 shadow-lg">
          <div className="flex items-center justify-between text-xs text-amber-400 font-bold uppercase tracking-wider">
            <span>Saldo Atual em Caixa</span>
            <BadgeDollarSign className="w-5 h-5 text-amber-500" />
          </div>
          <div className="mt-2 text-3xl font-black text-amber-400 tabular-nums">
            R$ {saldoAtual.toFixed(2)}
          </div>
          <div className="text-[11px] text-stone-400 mt-1">Conciliação em tempo real</div>
        </div>
      </div>

      {/* Movements Table with Filters */}
      <div className="space-y-4">
        <div className="p-4 rounded-xl bg-[#292524] border border-[#44403C] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-stone-200">
              Movimentações do Dia ({displayedMovements.length})
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-stone-400 font-medium">Filtrar por tipo:</span>
            <div className="p-1 rounded-lg bg-[#1C1917] border border-[#44403C] flex items-center text-xs">
              {(['Todos', 'Entrada', 'Saída'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setFilterType(t)}
                  className={`px-3 py-1 rounded-md font-semibold transition-all ${
                    filterType === t
                      ? 'bg-amber-500 text-stone-950 font-bold'
                      : 'text-stone-400 hover:text-stone-200'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-2xl bg-[#292524] border border-[#44403C] overflow-hidden shadow-md">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#44403C] bg-[#1C1917]/70 text-stone-400 uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4 font-semibold">Data/Hora</th>
                  <th className="py-3 px-4 font-semibold">Descrição</th>
                  <th className="py-3 px-4 font-semibold">Tipo</th>
                  <th className="py-3 px-4 font-semibold">Forma de Pagamento</th>
                  <th className="py-3 px-4 font-semibold">Valor</th>
                  <th className="py-3 px-4 font-semibold">Operador</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#44403C]/40">
                {displayedMovements.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-stone-400 text-xs">
                      Nenhuma movimentação registrada para os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  displayedMovements.map((m) => (
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
                      <td className="py-3.5 px-4 text-stone-300 font-medium">
                        {m.paymentMethod || 'Dinheiro'}
                      </td>
                      <td
                        className={`py-3.5 px-4 font-extrabold tabular-nums text-sm ${
                          m.type === 'Entrada' ? 'text-emerald-400' : 'text-red-400'
                        }`}
                      >
                        {m.type === 'Entrada' ? '+' : '-'} R$ {m.value.toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 text-stone-400 font-medium">{m.user}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
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
              Fechamento de Caixa: {filterDate}
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
                  R$ {saldoAtual.toFixed(2)}
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
