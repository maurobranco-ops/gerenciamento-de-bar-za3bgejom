import React, { useState } from 'react'
import {
  Users,
  Plus,
  Edit2,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Layers,
  ArrowUpDown,
  Search,
  Sparkles,
  Info,
  ShieldAlert,
} from 'lucide-react'
import { useBar } from '../context/BarContext'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog'
import { TableStatus } from '../types/bar'

export default function MesasConfig() {
  const {
    role,
    mesas,
    comandas,
    addMesa,
    updateMesaCapacidade,
    deleteMesa,
    checkRoleAccess,
    isSyncing,
  } = useBar()

  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('Todos')

  // Modal nova mesa
  const [newModalOpen, setNewModalOpen] = useState(false)
  const [newNumero, setNewNumero] = useState<number>(() => {
    const maxNum = mesas.reduce((max, m) => Math.max(max, m.numero), 0)
    return maxNum + 1
  })
  const [newCapacidade, setNewCapacidade] = useState<number>(4)
  const [isSubmittingNew, setIsSubmittingNew] = useState(false)

  // Modal editar capacidade
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingMesa, setEditingMesa] = useState<{
    id: string
    numero: number
    capacidade: number
  } | null>(null)
  const [editCapacidade, setEditCapacidade] = useState<number>(4)
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false)

  // Modal confirmação de exclusão
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deletingMesa, setDeletingMesa] = useState<{ id: string; numero: number } | null>(null)
  const [isSubmittingDelete, setIsSubmittingDelete] = useState(false)

  // Proteção: apenas Gerente
  if (role !== 'Gerente') {
    return (
      <div className="p-8 rounded-2xl bg-[#292524] border border-[#44403C] text-center max-w-lg mx-auto mt-12 space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center mx-auto border border-red-500/40">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-stone-100">Acesso Restrito ao Gerente</h2>
        <p className="text-xs text-stone-400 leading-relaxed">
          A configuração e expansão de mesas é exclusiva para o perfil Gerente. Garçons e Caixas não
          possuem permissão para criar, alterar capacidade ou remover mesas do salão.
        </p>
      </div>
    )
  }

  // Mesas combinadas com comandas
  const tableRows = mesas.map((m) => {
    const cmd = comandas.find((c) => c.tableNumber === m.numero)
    const status: TableStatus = cmd ? cmd.status : m.status
    const isFree = status === 'Livre' && (!cmd || cmd.items.length === 0)
    return {
      ...m,
      currentStatus: status,
      isFree,
      guestCount: cmd?.guestCount || 0,
      clientName: cmd?.clientName,
      itemsCount: cmd?.items?.length || 0,
    }
  })

  const filteredTables = tableRows.filter((t) => {
    const matchesSearch =
      searchQuery.trim() === '' ||
      t.numero.toString().includes(searchQuery.trim()) ||
      (t.clientName && t.clientName.toLowerCase().includes(searchQuery.toLowerCase()))

    const matchesStatus = filterStatus === 'Todos' || t.currentStatus === filterStatus

    return matchesSearch && matchesStatus
  })

  const handleOpenNewModal = () => {
    const maxNum = mesas.reduce((max, m) => Math.max(max, m.numero), 0)
    setNewNumero(maxNum + 1)
    setNewCapacidade(4)
    setNewModalOpen(true)
  }

  const handleConfirmNewMesa = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newNumero <= 0 || newCapacidade <= 0) return

    setIsSubmittingNew(true)
    try {
      const ok = await addMesa(newNumero, newCapacidade)
      if (ok) {
        setNewModalOpen(false)
      }
    } finally {
      setIsSubmittingNew(false)
    }
  }

  const handleOpenEdit = (mesa: { id: string; numero: number; capacidade: number }) => {
    setEditingMesa(mesa)
    setEditCapacidade(mesa.capacidade)
    setEditModalOpen(true)
  }

  const handleConfirmEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingMesa || editCapacidade <= 0) return

    setIsSubmittingEdit(true)
    try {
      const ok = await updateMesaCapacidade(editingMesa.id, editCapacidade)
      if (ok) {
        setEditModalOpen(false)
        setEditingMesa(null)
      }
    } finally {
      setIsSubmittingEdit(false)
    }
  }

  const handleOpenDelete = (mesa: { id: string; numero: number }) => {
    setDeletingMesa(mesa)
    setDeleteModalOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!deletingMesa) return

    setIsSubmittingDelete(true)
    try {
      const ok = await deleteMesa(deletingMesa.id, deletingMesa.numero)
      if (ok) {
        setDeleteModalOpen(false)
        setDeletingMesa(null)
      }
    } finally {
      setIsSubmittingDelete(false)
    }
  }

  const getStatusBadge = (status: TableStatus) => {
    switch (status) {
      case 'Livre':
        return (
          <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-xs">
            Livre
          </Badge>
        )
      case 'Ocupada':
        return (
          <Badge className="bg-amber-500/20 text-amber-400 border border-amber-500/40 text-xs">
            Ocupada
          </Badge>
        )
      case 'Aguardando Pagamento':
        return (
          <Badge className="bg-purple-500/20 text-purple-400 border border-purple-500/40 text-xs">
            Aguardando Pagamento
          </Badge>
        )
      case 'Fechada':
        return (
          <Badge className="bg-red-500/20 text-red-400 border border-red-500/40 text-xs">
            Fechada
          </Badge>
        )
    }
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Top Banner & Control */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-[#292524] border border-[#44403C]">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-stone-100 flex items-center gap-2">
              Configuração & Expansão de Mesas
            </h2>
            <Badge className="bg-amber-500/20 text-amber-400 border border-amber-500/40 text-xs font-bold">
              {mesas.length} Mesas no Banco
            </Badge>
          </div>
          <p className="text-xs text-stone-400 mt-1">
            As mesas são dinâmicas no Supabase: expanda para qualquer quantidade (ex: 15, 20, 30
            mesas), edite capacidades e gerencie o salão.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={handleOpenNewModal}
            className="bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold text-xs shadow-md shadow-amber-950/20"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Adicionar Nova Mesa
          </Button>
        </div>
      </div>

      {/* Info Notice Box */}
      <div className="p-4 rounded-xl bg-[#1C1917] border border-[#44403C] flex items-start gap-3 text-xs text-stone-300">
        <Info className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-bold text-stone-200">Regras de negócio do salão:</span>
          <p className="text-stone-400">
            • Apenas mesas com status <strong className="text-emerald-400">Livre</strong> e sem
            consumo aberto podem ser removidas para evitar perda de lançamentos contábeis.
            <br />• O número da mesa é único no banco de dados. Bloqueio automático de duplicidade.
            <br />• A grade de Comandas & Salão renderiza automaticamente qualquer quantidade de
            mesas adicionadas.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-xl bg-[#292524] border border-[#44403C] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-stone-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por número de mesa ou cliente..."
            className="pl-9 bg-[#1C1917] border-[#44403C] text-stone-100 text-xs h-9"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-stone-400 font-medium whitespace-nowrap">Status:</span>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-[#1C1917] border border-[#44403C] rounded-lg px-3 py-1.5 text-stone-200 text-xs focus:outline-none focus:border-amber-500"
          >
            <option value="Todos">Todos os Status</option>
            <option value="Livre">Livre</option>
            <option value="Ocupada">Ocupada</option>
            <option value="Aguardando Pagamento">Aguardando Pagamento</option>
            <option value="Fechada">Fechada</option>
          </select>
        </div>
      </div>

      {/* Mesas Table */}
      <div className="rounded-2xl bg-[#292524] border border-[#44403C] overflow-hidden shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#44403C] bg-[#1C1917]/70 text-stone-400 uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4 font-semibold">Mesa</th>
                <th className="py-3 px-4 font-semibold">Capacidade</th>
                <th className="py-3 px-4 font-semibold">Status Atual</th>
                <th className="py-3 px-4 font-semibold">Cliente / Ocupação</th>
                <th className="py-3 px-4 font-semibold">Consumo Atual</th>
                <th className="py-3 px-4 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#44403C]/40">
              {filteredTables.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-stone-400 text-xs">
                    Nenhuma mesa encontrada com os filtros aplicados.
                  </td>
                </tr>
              ) : (
                filteredTables.map((mesa) => (
                  <tr key={mesa.id} className="hover:bg-[#44403C]/30 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-[#1C1917] border border-amber-500/40 flex items-center justify-center font-black text-amber-500 text-sm shadow">
                          {mesa.numero}
                        </div>
                        <div>
                          <span className="font-bold text-stone-100 text-sm">
                            Mesa {mesa.numero}
                          </span>
                          <span className="block text-[10px] text-stone-500 font-mono">
                            ID: {mesa.id.substring(0, 8)}...
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1.5 font-bold text-stone-200">
                        <Users className="w-3.5 h-3.5 text-amber-500" />
                        {mesa.capacidade} pessoas
                      </span>
                    </td>

                    <td className="py-3.5 px-4">{getStatusBadge(mesa.currentStatus)}</td>

                    <td className="py-3.5 px-4 text-stone-300">
                      {mesa.currentStatus !== 'Livre' ? (
                        <div>
                          <span className="font-semibold text-stone-100">
                            {mesa.clientName || `Mesa ${mesa.numero}`}
                          </span>
                          <span className="block text-[11px] text-stone-400">
                            {mesa.guestCount} pessoa(s) no local
                          </span>
                        </div>
                      ) : (
                        <span className="text-stone-500 italic">Nenhum cliente ativo</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-stone-300">
                      {mesa.itemsCount > 0 ? (
                        <Badge
                          variant="outline"
                          className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-[10px]"
                        >
                          {mesa.itemsCount} itens lançados
                        </Badge>
                      ) : (
                        <span className="text-stone-500 text-[11px]">Sem itens</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenEdit(mesa)}
                          className="bg-[#1C1917] hover:bg-[#44403C] border-[#44403C] text-stone-300 text-xs h-7 px-2.5"
                          title="Editar capacidade"
                        >
                          <Edit2 className="w-3.5 h-3.5 mr-1 text-amber-500" />
                          Editar
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!mesa.isFree}
                          onClick={() => handleOpenDelete(mesa)}
                          className="bg-[#1C1917] hover:bg-red-500 hover:text-white border-[#44403C] text-red-400 text-xs h-7 px-2.5 disabled:opacity-30 disabled:cursor-not-allowed"
                          title={
                            mesa.isFree
                              ? 'Excluir mesa'
                              : 'Não é possível excluir mesa ocupada ou com consumo'
                          }
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1" />
                          Excluir
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Adicionar Nova Mesa */}
      <Dialog open={newModalOpen} onOpenChange={setNewModalOpen}>
        <DialogContent className="max-w-md bg-[#292524] border-[#44403C] text-stone-100 p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black text-stone-100 flex items-center gap-2">
              <Plus className="w-5 h-5 text-amber-500" />
              Adicionar Nova Mesa ao Bar
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleConfirmNewMesa} className="space-y-4 pt-2 text-xs">
            <div>
              <Label className="text-xs text-stone-400">Número da Mesa</Label>
              <Input
                type="number"
                min={1}
                value={newNumero}
                onChange={(e) => setNewNumero(parseInt(e.target.value) || 0)}
                className="mt-1 bg-[#1C1917] border-[#44403C] text-stone-100 text-sm font-bold"
                required
              />
              <span className="text-[11px] text-stone-500 mt-1 block">
                O número identifica a mesa no salão e deve ser exclusivo.
              </span>
            </div>

            <div>
              <Label className="text-xs text-stone-400">Capacidade de Assentos</Label>
              <div className="flex items-center gap-3 mt-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setNewCapacidade(Math.max(1, newCapacidade - 1))}
                  className="bg-[#1C1917] border-[#44403C] text-stone-200 h-9 w-9 p-0"
                >
                  -
                </Button>
                <span className="font-black text-xl tabular-nums w-12 text-center text-amber-400">
                  {newCapacidade}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setNewCapacidade(newCapacidade + 1)}
                  className="bg-[#1C1917] border-[#44403C] text-stone-200 h-9 w-9 p-0"
                >
                  +
                </Button>
                <span className="text-stone-400 text-xs">lugares</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#44403C]">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setNewModalOpen(false)}
                className="text-stone-400 text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmittingNew}
                className="bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold text-xs"
              >
                {isSubmittingNew ? 'Gravando...' : 'Salvar Mesa no Banco'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Editar Capacidade */}
      {editingMesa && (
        <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
          <DialogContent className="max-w-md bg-[#292524] border-[#44403C] text-stone-100 p-6">
            <DialogHeader>
              <DialogTitle className="text-base font-black text-stone-100 flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-amber-500" />
                Editar Mesa {editingMesa.numero}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleConfirmEdit} className="space-y-4 pt-2 text-xs">
              <div>
                <Label className="text-xs text-stone-400">Número da Mesa</Label>
                <Input
                  value={`Mesa ${editingMesa.numero}`}
                  disabled
                  className="mt-1 bg-[#1C1917] border-[#44403C] text-stone-400 text-xs opacity-75"
                />
              </div>

              <div>
                <Label className="text-xs text-stone-400">Capacidade de Assentos</Label>
                <div className="flex items-center gap-3 mt-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEditCapacidade(Math.max(1, editCapacidade - 1))}
                    className="bg-[#1C1917] border-[#44403C] text-stone-200 h-9 w-9 p-0"
                  >
                    -
                  </Button>
                  <span className="font-black text-xl tabular-nums w-12 text-center text-amber-400">
                    {editCapacidade}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEditCapacidade(editCapacidade + 1)}
                    className="bg-[#1C1917] border-[#44403C] text-stone-200 h-9 w-9 p-0"
                  >
                    +
                  </Button>
                  <span className="text-stone-400 text-xs">lugares</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#44403C]">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setEditModalOpen(false)}
                  className="text-stone-400 text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmittingEdit}
                  className="bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold text-xs"
                >
                  {isSubmittingEdit ? 'Atualizando...' : 'Confirmar Alteração'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal: Confirmar Exclusão de Mesa */}
      {deletingMesa && (
        <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
          <DialogContent className="max-w-md bg-[#292524] border-[#44403C] text-stone-100 p-6">
            <DialogHeader>
              <DialogTitle className="text-base font-black text-red-400 flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-red-500" />
                Excluir Mesa {deletingMesa.numero}?
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3 pt-2 text-xs">
              <p className="text-stone-300 leading-relaxed">
                Tem certeza que deseja remover a <strong>Mesa {deletingMesa.numero}</strong> do
                cadastro? Esta operação é irreversível no Supabase.
              </p>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#44403C]">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setDeleteModalOpen(false)}
                  className="text-stone-400 text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleConfirmDelete}
                  disabled={isSubmittingDelete}
                  className="bg-red-500 hover:bg-red-600 text-white font-bold text-xs"
                >
                  {isSubmittingDelete ? 'Excluindo...' : 'Sim, Excluir Mesa'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
