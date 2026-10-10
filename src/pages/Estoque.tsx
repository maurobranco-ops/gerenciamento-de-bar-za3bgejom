import React, { useState } from 'react'
import {
  Boxes,
  Plus,
  Edit2,
  FileDown,
  ArrowUpDown,
  AlertTriangle,
  CheckCircle2,
  Package,
  Layers,
  History,
  Search,
  Filter,
} from 'lucide-react'
import { useBar } from '../context/BarContext'
import { MenuItem, StockMovement, StockUnit } from '../types/bar'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog'
import { useToast } from '../hooks/use-toast'

export default function Estoque() {
  const { menuItems, stockMovements, updateStockItem, addStockSupply, role, checkRoleAccess } =
    useBar()
  const { toast } = useToast()

  const [viewTab, setViewTab] = useState<'estoque' | 'movimentacoes'>('estoque')
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('Todas')

  // Edit stock modal
  const [editItem, setEditItem] = useState<MenuItem | null>(null)
  const [editStockVal, setEditStockVal] = useState<string>('')
  const [editMinStockVal, setEditMinStockVal] = useState<string>('')
  const [editUnitVal, setEditUnitVal] = useState<StockUnit>('un')

  // Repor / Entrada de estoque modal
  const [reporItem, setReporItem] = useState<MenuItem | null>(null)
  const [reporQty, setReporQty] = useState<string>('10')
  const [reporSupplier, setReporSupplier] = useState<string>('Distribuidora Pirajá Bebidas')
  const [reporNotes, setReporNotes] = useState<string>('')

  // Filtered current items
  const filteredItems = menuItems.filter((item) => {
    const matchesCat = categoryFilter === 'Todas' || item.category === categoryFilter
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCat && matchesSearch
  })

  // Stock status logic
  const getStatusBadge = (item: MenuItem) => {
    if (item.stock <= 0) {
      return (
        <Badge className="bg-red-500/20 text-red-400 border border-red-500/40 text-xs font-bold">
          Esgotado
        </Badge>
      )
    }
    if (item.stock <= item.minStock * 0.5) {
      return (
        <Badge className="bg-red-500/15 text-red-400 border border-red-500/30 text-xs">
          Crítico
        </Badge>
      )
    }
    if (item.stock <= item.minStock) {
      return (
        <Badge className="bg-amber-500/15 text-amber-400 border border-amber-500/30 text-xs">
          Baixo
        </Badge>
      )
    }
    return (
      <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-xs">
        OK
      </Badge>
    )
  }

  // Handle open edit
  const handleOpenEdit = (item: MenuItem) => {
    setEditItem(item)
    setEditStockVal(item.stock.toString())
    setEditMinStockVal(item.minStock.toString())
    setEditUnitVal(item.unit)
  }

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editItem) return
    const cur = parseFloat(editStockVal)
    const min = parseFloat(editMinStockVal)
    if (isNaN(cur) || isNaN(min)) return

    updateStockItem(editItem.id, cur, min, editUnitVal)
    setEditItem(null)
  }

  // Handle open repor
  const handleOpenRepor = (item: MenuItem) => {
    setReporItem(item)
    setReporQty('10')
    setReporSupplier('Distribuidora Pirajá Bebidas')
    setReporNotes('')
  }

  const handleSaveRepor = (e: React.FormEvent) => {
    e.preventDefault()
    if (!reporItem) return
    const qty = parseFloat(reporQty)
    if (isNaN(qty) || qty <= 0) return

    addStockSupply(reporItem.id, qty, reporSupplier, reporNotes)
    setReporItem(null)
  }

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      'ID',
      'Produto',
      'Categoria',
      'Unidade',
      'Estoque Atual',
      'Estoque Mínimo',
      'Preço BRL',
    ]
    const rows = menuItems.map((m) => [
      m.id,
      `"${m.name.replace(/"/g, '""')}"`,
      m.category,
      m.unit,
      m.stock,
      m.minStock,
      m.price.toFixed(2),
    ])

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute(
      'download',
      `estoque_rachide_bar_${new Date().toISOString().split('T')[0]}.csv`,
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast({
      title: 'CSV Exportado com Sucesso',
      description: 'O relatório completo do estoque foi baixado no seu dispositivo.',
    })
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Top Banner & Control */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-[#292524] border border-[#44403C]">
        <div>
          <h2 className="text-xl font-black text-stone-100 flex items-center gap-2">
            Controle de Estoque Fracionado
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-stone-800 text-stone-300 font-semibold border border-stone-700">
              {menuItems.length} Produtos
            </span>
          </h2>
          <p className="text-xs text-stone-400 mt-1">
            Gestão precisa com suporte a decimais (kg, litros, unidades) e registro de
            entradas/saídas.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Toggle View */}
          <div className="p-1 rounded-xl bg-[#1C1917] border border-[#44403C] flex items-center text-xs">
            <button
              onClick={() => setViewTab('estoque')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                viewTab === 'estoque'
                  ? 'bg-amber-500 text-stone-950 shadow'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              Estoque Atual
            </button>
            <button
              onClick={() => setViewTab('movimentacoes')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                viewTab === 'movimentacoes'
                  ? 'bg-amber-500 text-stone-950 shadow'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              Movimentações
            </button>
          </div>

          <Button
            onClick={handleExportCSV}
            variant="outline"
            size="sm"
            className="bg-[#1C1917] border-[#44403C] text-stone-200 hover:bg-[#44403C] text-xs font-semibold"
          >
            <FileDown className="w-4 h-4 mr-1.5 text-amber-500" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {viewTab === 'estoque' ? (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="p-4 rounded-xl bg-[#292524] border border-[#44403C] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-stone-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filtrar por nome do produto..."
                className="pl-9 bg-[#1C1917] border-[#44403C] text-stone-100 text-xs h-9"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-stone-400 font-medium whitespace-nowrap">Categoria:</span>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-[#1C1917] border border-[#44403C] rounded-lg px-3 py-1.5 text-stone-200 text-xs focus:outline-none focus:border-amber-500"
              >
                <option value="Todas">Todas as Categorias</option>
                <option value="Cervejas">Cervejas</option>
                <option value="Petiscos">Petiscos</option>
                <option value="Porções">Porções</option>
                <option value="Drinks">Drinks</option>
                <option value="Destilados">Destilados</option>
                <option value="Refrigerantes">Refrigerantes</option>
              </select>
            </div>
          </div>

          {/* Inventory Table */}
          <div className="rounded-2xl bg-[#292524] border border-[#44403C] overflow-hidden shadow-md">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#44403C] bg-[#1C1917]/70 text-stone-400 uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4 font-semibold">Produto</th>
                    <th className="py-3 px-4 font-semibold">Categoria</th>
                    <th className="py-3 px-4 font-semibold">Unidade</th>
                    <th className="py-3 px-4 font-semibold">Qtd Atual</th>
                    <th className="py-3 px-4 font-semibold">Estoque Mínimo</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 font-semibold text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#44403C]/40">
                  {filteredItems.map((item) => (
                    <tr key={item.id} className="hover:bg-[#44403C]/30 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-stone-100">
                        {item.name}
                        <span className="block text-[11px] text-stone-400 font-normal truncate max-w-xs">
                          {item.description}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge
                          variant="outline"
                          className="bg-[#1C1917] text-stone-300 border-stone-700 text-[10px]"
                        >
                          {item.category}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-stone-300">{item.unit}</td>
                      <td className="py-3.5 px-4">
                        <span className="font-extrabold text-sm text-stone-100 tabular-nums">
                          {item.stock} {item.unit}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-stone-400 tabular-nums font-medium">
                        {item.minStock} {item.unit}
                      </td>
                      <td className="py-3.5 px-4">{getStatusBadge(item)}</td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenRepor(item)}
                            className="bg-[#1C1917] hover:bg-emerald-500 hover:text-stone-950 border-[#44403C] text-emerald-400 text-xs h-7 px-2.5 font-semibold transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5 mr-1" />
                            Repor
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenEdit(item)}
                            className="bg-[#1C1917] hover:bg-[#44403C] border-[#44403C] text-stone-300 text-xs h-7 px-2.5"
                          >
                            <Edit2 className="w-3.5 h-3.5 mr-1 text-amber-500" />
                            Editar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* Movements View */
        <div className="rounded-2xl bg-[#292524] border border-[#44403C] overflow-hidden shadow-md">
          <div className="p-4 bg-[#1C1917]/70 border-b border-[#44403C] flex items-center justify-between">
            <h3 className="font-bold text-sm text-stone-100 flex items-center gap-2">
              <History className="w-4 h-4 text-amber-500" />
              Histórico Cronológico de Movimentações
            </h3>
            <span className="text-xs text-stone-400">{stockMovements.length} Registros</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#44403C] text-stone-400 uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4 font-semibold">Data/Hora</th>
                  <th className="py-3 px-4 font-semibold">Produto</th>
                  <th className="py-3 px-4 font-semibold">Tipo</th>
                  <th className="py-3 px-4 font-semibold">Quantidade</th>
                  <th className="py-3 px-4 font-semibold">Usuário</th>
                  <th className="py-3 px-4 font-semibold">Fornecedor / Observação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#44403C]/40">
                {stockMovements.map((m) => (
                  <tr key={m.id} className="hover:bg-[#44403C]/30 transition-colors">
                    <td className="py-3.5 px-4 text-stone-400 tabular-nums">
                      {m.datetime.replace('T', ' ').substring(0, 16)}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-stone-100">{m.productName}</td>
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
                    <td className="py-3.5 px-4 font-extrabold tabular-nums text-stone-100">
                      {m.type === 'Entrada' ? '+' : '-'}
                      {m.quantity} {m.unit}
                    </td>
                    <td className="py-3.5 px-4 text-stone-300 font-medium">{m.user}</td>
                    <td className="py-3.5 px-4 text-stone-400">
                      {m.supplier ? (
                        <span className="text-stone-300 font-semibold">{m.supplier}</span>
                      ) : null}
                      {m.notes ? (
                        <span className="block text-[11px] text-stone-400">{m.notes}</span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Editar Produto de Estoque */}
      {editItem && (
        <Dialog open={!!editItem} onOpenChange={(open) => !open && setEditItem(null)}>
          <DialogContent className="max-w-md bg-[#292524] border-[#44403C] text-stone-100 p-6">
            <DialogHeader>
              <DialogTitle className="text-base font-black text-stone-100">
                Editar Estoque: {editItem.name}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSaveEdit} className="space-y-4 pt-2">
              <div>
                <Label className="text-xs text-stone-400">Produto (Somente Leitura)</Label>
                <Input
                  value={editItem.name}
                  disabled
                  className="mt-1 bg-[#1C1917] border-[#44403C] text-stone-300 text-xs opacity-75"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-stone-400">Quantidade Atual</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editStockVal}
                    onChange={(e) => setEditStockVal(e.target.value)}
                    className="mt-1 bg-[#1C1917] border-[#44403C] text-stone-100 text-xs tabular-nums"
                    required
                  />
                </div>

                <div>
                  <Label className="text-xs text-stone-400">Estoque Mínimo</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editMinStockVal}
                    onChange={(e) => setEditMinStockVal(e.target.value)}
                    className="mt-1 bg-[#1C1917] border-[#44403C] text-stone-100 text-xs tabular-nums"
                    required
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs text-stone-400">Unidade de Medida</Label>
                <select
                  value={editUnitVal}
                  onChange={(e) => setEditUnitVal(e.target.value as StockUnit)}
                  className="w-full mt-1 bg-[#1C1917] border border-[#44403C] rounded-lg px-3 py-2 text-xs text-stone-100 focus:outline-none focus:border-amber-500"
                >
                  <option value="un">Unidade (un)</option>
                  <option value="kg">Quilograma (kg)</option>
                  <option value="L">Litro (L)</option>
                  <option value="g">Grama (g)</option>
                  <option value="ml">Mililitro (ml)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#44403C]">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setEditItem(null)}
                  className="text-stone-400 text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold text-xs"
                >
                  Salvar Alterações
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal: Entrada de Estoque / Repor */}
      {reporItem && (
        <Dialog open={!!reporItem} onOpenChange={(open) => !open && setReporItem(null)}>
          <DialogContent className="max-w-md bg-[#292524] border-[#44403C] text-stone-100 p-6">
            <DialogHeader>
              <DialogTitle className="text-base font-black text-stone-100 flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-500" />
                Registrar Entrada: {reporItem.name}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSaveRepor} className="space-y-4 pt-2">
              <div className="p-3 rounded-xl bg-[#1C1917] border border-[#44403C] flex items-center justify-between text-xs">
                <span className="text-stone-400">Estoque Atual:</span>
                <span className="font-bold text-stone-100 tabular-nums">
                  {reporItem.stock} {reporItem.unit}
                </span>
              </div>

              <div>
                <Label className="text-xs text-stone-400">
                  Quantidade a Adicionar ({reporItem.unit})
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  value={reporQty}
                  onChange={(e) => setReporQty(e.target.value)}
                  className="mt-1 bg-[#1C1917] border-[#44403C] text-stone-100 text-xs tabular-nums"
                  required
                />
              </div>

              <div>
                <Label className="text-xs text-stone-400">Fornecedor</Label>
                <Input
                  value={reporSupplier}
                  onChange={(e) => setReporSupplier(e.target.value)}
                  placeholder="Ex: Distribuidora Pirajá, Ambev..."
                  className="mt-1 bg-[#1C1917] border-[#44403C] text-stone-100 text-xs"
                  required
                />
              </div>

              <div>
                <Label className="text-xs text-stone-400">Observações / NF de Entrada</Label>
                <Input
                  value={reporNotes}
                  onChange={(e) => setReporNotes(e.target.value)}
                  placeholder="Ex: NF-e 45912, Chegada de lote..."
                  className="mt-1 bg-[#1C1917] border-[#44403C] text-stone-100 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#44403C]">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setReporItem(null)}
                  className="text-stone-400 text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="bg-emerald-500 hover:bg-emerald-600 text-stone-950 font-bold text-xs"
                >
                  Registrar Entrada
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
