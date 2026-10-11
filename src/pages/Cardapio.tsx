import React, { useState } from 'react'
import {
  Beer,
  Utensils,
  Wine,
  GlassWater,
  Flame,
  Search,
  Plus,
  Scale,
  Sparkles,
  AlertCircle,
  ChefHat,
} from 'lucide-react'
import { useBar } from '../context/BarContext'
import { MenuItem, ProductCategory } from '../types/bar'
import { Link } from 'react-router-dom'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Input } from '../components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog'
import { Settings } from 'lucide-react'
import { useToast } from '../hooks/use-toast'

const CATEGORIES: ProductCategory[] = [
  'Cervejas',
  'Petiscos',
  'Destilados',
  'Refrigerantes',
  'Porções',
  'Drinks',
]

export default function Cardapio() {
  const { menuItems, comandas, addItemToComanda, role } = useBar()
  const { toast } = useToast()

  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | 'Todos'>('Todos')
  const [searchQuery, setSearchQuery] = useState('')
  const [detailProduct, setDetailProduct] = useState<MenuItem | null>(null)
  const [selectedTableForAdd, setSelectedTableForAdd] = useState<number>(1)
  const [itemQuantityToAdd, setItemQuantityToAdd] = useState<number>(1)

  // Filter products
  const filteredProducts = menuItems.filter((p) => {
    const matchesCategory = selectedCategory === 'Todos' || p.category === selectedCategory
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

  const getCategoryIcon = (category: ProductCategory) => {
    switch (category) {
      case 'Cervejas':
        return <Beer className="w-5 h-5 text-amber-500" />
      case 'Petiscos':
        return <Utensils className="w-5 h-5 text-orange-500" />
      case 'Porções':
        return <Flame className="w-5 h-5 text-red-500" />
      case 'Drinks':
        return <Wine className="w-5 h-5 text-purple-500" />
      case 'Destilados':
        return <Wine className="w-5 h-5 text-amber-600" />
      case 'Refrigerantes':
        return <GlassWater className="w-5 h-5 text-blue-500" />
    }
  }

  const getStockStatusBadge = (item: MenuItem) => {
    if (item.stock <= 0) {
      return (
        <Badge
          variant="outline"
          className="bg-red-500/10 text-red-400 border-red-500/30 text-[10px]"
        >
          Esgotado
        </Badge>
      )
    }
    if (item.stock <= item.minStock) {
      return (
        <Badge
          variant="outline"
          className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-[10px]"
        >
          Baixo: {item.stock} {item.unit}
        </Badge>
      )
    }
    return (
      <Badge
        variant="outline"
        className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px]"
      >
        Estoque: {item.stock} {item.unit}
      </Badge>
    )
  }

  const handleOpenDetail = (prod: MenuItem) => {
    setDetailProduct(prod)
    setItemQuantityToAdd(1)
  }

  const handleConfirmAddToComanda = () => {
    if (!detailProduct) return
    addItemToComanda(selectedTableForAdd, detailProduct, itemQuantityToAdd)
    setDetailProduct(null)
  }

  const handleQuickAdd = (e: React.MouseEvent, prod: MenuItem) => {
    e.stopPropagation()
    // Open detail asking for table
    setDetailProduct(prod)
    setItemQuantityToAdd(1)
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-[#292524] border border-[#44403C]">
        <div>
          <h2 className="text-xl font-black text-stone-100 flex items-center gap-2">
            Cardápio do Bar
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-stone-800 text-stone-300 font-semibold border border-stone-700">
              {menuItems.length} Itens
            </span>
          </h2>
          <p className="text-xs text-stone-400 mt-1">
            Consulte preços, estoques fracionados e lance pedidos diretamente nas mesas.
          </p>
        </div>

        {/* Actions & Search */}
        <div className="flex flex-wrap items-center gap-2">
          {role === 'Gerente' && (
            <Link to="/produtos-admin">
              <Button
                variant="outline"
                size="sm"
                className="bg-[#1C1917] border-[#44403C] text-amber-400 hover:text-white text-xs h-10"
              >
                <Settings className="w-3.5 h-3.5 mr-1.5" />
                Gerenciar Preços & Cadastros
              </Button>
            </Link>
          )}

          <Link to="/fila-cozinha">
            <Button
              variant="outline"
              size="sm"
              className="bg-[#1C1917] border-[#44403C] text-stone-300 hover:text-white text-xs h-10"
            >
              <ChefHat className="w-3.5 h-3.5 mr-1.5 text-amber-500" />
              Ver Fila KDS
            </Button>
          </Link>

          {/* Search */}
          <div className="relative w-full md:w-60">
            <Search className="w-4 h-4 absolute left-3 top-3 text-stone-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar no cardápio..."
              className="pl-9 bg-[#1C1917] border-[#44403C] text-stone-100 text-xs h-10"
            />
          </div>
        </div>
      </div>

      {/* Categories Tabs in Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        <button
          onClick={() => setSelectedCategory('Todos')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            selectedCategory === 'Todos'
              ? 'bg-amber-500 text-stone-950 shadow-md shadow-amber-950/30'
              : 'bg-[#292524] text-stone-300 hover:bg-[#44403C] border border-[#44403C]'
          }`}
        >
          Todos ({menuItems.length})
        </button>
        {CATEGORIES.map((cat) => {
          const count = menuItems.filter((m) => m.category === cat).length
          const isSelected = selectedCategory === cat
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                isSelected
                  ? 'bg-amber-500 text-stone-950 shadow-md shadow-amber-950/30'
                  : 'bg-[#292524] text-stone-300 hover:bg-[#44403C] border border-[#44403C]'
              }`}
            >
              <span>{cat}</span>
              <span className="text-[10px] opacity-75">({count})</span>
            </button>
          )
        })}
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filteredProducts.map((prod) => {
          const isOutOfStock = prod.stock <= 0

          return (
            <div
              key={prod.id}
              onClick={() => handleOpenDetail(prod)}
              className="p-4 rounded-2xl bg-[#292524] border border-[#44403C] hover:border-amber-500/50 hover:-translate-y-1 transition-all duration-200 cursor-pointer flex flex-col justify-between group shadow-sm"
            >
              <div>
                {/* Category Icon & Stock Badge */}
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2.5 rounded-xl bg-[#1C1917] border border-[#44403C] group-hover:border-amber-500/40 transition-colors">
                    {getCategoryIcon(prod.category)}
                  </div>
                  {getStockStatusBadge(prod)}
                </div>

                <h3 className="font-bold text-sm text-stone-100 group-hover:text-amber-400 transition-colors leading-tight">
                  {prod.name}
                </h3>
                <p className="text-xs text-stone-400 line-clamp-2 mt-1.5 leading-relaxed">
                  {prod.description}
                </p>
              </div>

              {/* Price & Quick Add Button */}
              <div className="mt-4 pt-3 border-t border-[#44403C] flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase text-stone-400 block font-semibold">
                    Preço
                  </span>
                  <span className="text-base font-extrabold text-amber-400 tabular-nums">
                    R$ {prod.price.toFixed(2)}
                  </span>
                </div>

                <Button
                  size="sm"
                  disabled={isOutOfStock}
                  onClick={(e) => handleQuickAdd(e, prod)}
                  className="h-8 w-8 p-0 rounded-full bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold disabled:opacity-30 disabled:cursor-not-allowed shadow-md shadow-amber-950/20"
                  title="Adicionar à Mesa"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Product Detail Modal */}
      {detailProduct && (
        <Dialog open={!!detailProduct} onOpenChange={(open) => !open && setDetailProduct(null)}>
          <DialogContent className="max-w-md bg-[#292524] border-[#44403C] text-stone-100 p-6">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-[#1C1917] border border-[#44403C]">
                  {getCategoryIcon(detailProduct.category)}
                </div>
                <div>
                  <DialogTitle className="text-base font-black text-stone-100">
                    {detailProduct.name}
                  </DialogTitle>
                  <span className="text-xs text-amber-500 font-semibold">
                    {detailProduct.category}
                  </span>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4 pt-2 text-xs">
              <p className="text-stone-300 leading-relaxed">{detailProduct.description}</p>

              {/* Fractional Stock Info Card */}
              <div className="p-3.5 rounded-xl bg-[#1C1917] border border-[#44403C] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-stone-400 flex items-center gap-1.5 font-medium">
                    <Scale className="w-4 h-4 text-amber-500" />
                    Estoque Atual (Fracionado):
                  </span>
                  <span className="font-extrabold text-stone-100 text-sm tabular-nums">
                    {detailProduct.stock} {detailProduct.unit}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-stone-400">Estoque Mínimo de Alerta:</span>
                  <span className="font-semibold text-stone-300 tabular-nums">
                    {detailProduct.minStock} {detailProduct.unit}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-stone-800">
                  <span className="text-stone-400">Preço Unitário:</span>
                  <span className="text-base font-black text-amber-400 tabular-nums">
                    R$ {detailProduct.price.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Order configuration: table selector & quantity */}
              <div className="space-y-3 pt-2">
                <div>
                  <label className="text-stone-300 font-semibold mb-1 block">
                    Selecione a Mesa para Adicionar:
                  </label>
                  <select
                    value={selectedTableForAdd}
                    onChange={(e) => setSelectedTableForAdd(Number(e.target.value))}
                    className="w-full bg-[#1C1917] border border-[#44403C] rounded-lg px-3 py-2 text-xs text-stone-100 focus:outline-none focus:border-amber-500"
                  >
                    {comandas.map((c) => (
                      <option key={c.tableNumber} value={c.tableNumber}>
                        Mesa {c.tableNumber} ({c.status} {c.clientName ? `- ${c.clientName}` : ''})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-stone-300 font-semibold mb-1 block">Quantidade:</label>
                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setItemQuantityToAdd(Math.max(1, itemQuantityToAdd - 1))}
                      className="bg-[#1C1917] border-[#44403C] text-stone-200 h-8 w-8 p-0"
                    >
                      -
                    </Button>
                    <span className="font-bold text-base tabular-nums w-8 text-center text-stone-100">
                      {itemQuantityToAdd}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setItemQuantityToAdd(itemQuantityToAdd + 1)}
                      className="bg-[#1C1917] border-[#44403C] text-stone-200 h-8 w-8 p-0"
                    >
                      +
                    </Button>
                    <span className="text-stone-400 ml-auto font-bold tabular-nums">
                      Total: R$ {(detailProduct.price * itemQuantityToAdd).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action */}
              <div className="flex justify-end gap-2 pt-3 border-t border-[#44403C]">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setDetailProduct(null)}
                  className="text-stone-400 text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleConfirmAddToComanda}
                  disabled={detailProduct.stock <= 0}
                  className="bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold text-xs"
                >
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  Adicionar à Comanda
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
