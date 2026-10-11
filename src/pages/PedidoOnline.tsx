import React, { useState, useEffect } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import {
  Beer,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  Loader2,
  UtensilsCrossed,
  Sparkles,
  QrCode,
  Smartphone,
  CreditCard,
  MessageSquare,
  AlertCircle,
  X,
  Search,
} from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { MenuItem, ProductCategory } from '@/types/bar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { QRCodeSVG } from '@/components/QRCodeSVG'
import { useToast } from '@/hooks/use-toast'

interface CartItem {
  product: MenuItem
  quantity: number
  observations: string
}

export default function PedidoOnline() {
  const { mesaNumero } = useParams<{ mesaNumero?: string }>()
  const [searchParams] = useSearchParams()
  const mesaParam = mesaNumero
    ? parseInt(mesaNumero, 10)
    : parseInt(searchParams.get('mesa') || '0', 10)

  const [mesaNum, setMesaNum] = useState<number>(!isNaN(mesaParam) ? mesaParam : 0)
  const isDelivery = mesaNum === 0

  const { toast } = useToast()

  const [products, setProducts] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas')
  const [searchQuery, setSearchQuery] = useState('')

  // Cart
  const [cart, setCart] = useState<CartItem[]>([])
  const [cartOpen, setCartOpen] = useState(false)
  const [clientName, setClientName] = useState('')

  // Item customization modal
  const [editingItem, setEditingItem] = useState<{
    product: MenuItem
    quantity: number
    observations: string
  } | null>(null)

  // Status de envio e cobrança simulada
  const [submitting, setSubmitting] = useState(false)
  const [orderSuccess, setOrderSuccess] = useState<{
    comandaId: string
    mesaNumero: number
    total: number
  } | null>(null)

  // Fluxo de cobrança Pix simulada pós pedido
  const [pixModalOpen, setPixModalOpen] = useState(false)
  const [pixStatus, setPixStatus] = useState<'pending' | 'checking' | 'paid'>('pending')

  const [deliveryFee, setDeliveryFee] = useState<number>(7.5)

  // Carrega cardápio público ativo do banco e taxa de entrega das configurações
  useEffect(() => {
    const fetchMenu = async () => {
      try {
        setLoading(true)
        const [prodRes, configRes] = await Promise.all([
          supabase
            .from('produtos')
            .select('*')
            .eq('ativo', true)
            .order('categoria', { ascending: true }),
          (supabase as any)
            .from('configuracoes_bar')
            .select('taxa_entrega_delivery')
            .eq('id', 'principal')
            .maybeSingle(),
        ])

        if (configRes.data && configRes.data.taxa_entrega_delivery !== undefined) {
          setDeliveryFee(Number(configRes.data.taxa_entrega_delivery))
        }

        const data = prodRes.data
        const error = prodRes.error

        if (!error && data) {
          const mapped: MenuItem[] = data.map((p: any) => ({
            id: p.id,
            name: p.nome,
            category: p.categoria as ProductCategory,
            price: Number(p.preco),
            description: p.descricao || '',
            unit: p.unidade,
            stock: Number(p.estoque),
            minStock: Number(p.estoque_minimo),
            areaPreparo: p.area_preparo,
            ativo: p.ativo,
            imageUrl: p.image_url,
          }))
          setProducts(mapped)
        }
      } catch (err) {
        console.error('Erro ao carregar cardápio on-line:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchMenu()
  }, [])

  // Categorias únicas
  const categories = ['Todas', ...Array.from(new Set(products.map((p) => p.category)))]

  // Filtra produtos por busca e categoria
  const filteredProducts = products.filter((p) => {
    const matchesCategory = selectedCategory === 'Todas' || p.category === selectedCategory
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

  // Totais do carrinho
  const cartSubtotal = cart.reduce((acc, item) => acc + item.product.price * item.quantity, 0)
  const effectiveDeliveryFee = isDelivery ? deliveryFee : 0
  const cartTotal = cartSubtotal + effectiveDeliveryFee
  const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0)

  // Adicionar item direto ou abrir personalização
  const handleOpenItem = (prod: MenuItem) => {
    setEditingItem({
      product: prod,
      quantity: 1,
      observations: '',
    })
  }

  const handleConfirmAddToCart = () => {
    if (!editingItem) return
    const { product, quantity, observations } = editingItem

    setCart((prev) => {
      // Checa se o mesmo item já está no carrinho com mesma observação
      const idx = prev.findIndex(
        (ci) => ci.product.id === product.id && ci.observations === observations,
      )
      if (idx > -1) {
        const updated = [...prev]
        updated[idx].quantity += quantity
        return updated
      }
      return [...prev, { product, quantity, observations }]
    })

    toast({
      title: `${quantity}x ${product.name} adicionado`,
      description: 'Item no carrinho. Você pode enviar para a cozinha quando quiser!',
    })
    setEditingItem(null)
  }

  const handleRemoveFromCart = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index))
  }

  const handleUpdateCartQuantity = (index: number, delta: number) => {
    setCart((prev) => {
      const updated = [...prev]
      const newQty = updated[index].quantity + delta
      if (newQty <= 0) {
        return prev.filter((_, i) => i !== index)
      }
      updated[index].quantity = newQty
      return updated
    })
  }

  // Enviar pedido via RPC do Supabase
  const handleSendOrder = async () => {
    if (cart.length === 0) return

    setSubmitting(true)
    try {
      const itensPayload = cart.map((item) => ({
        produto_id: item.product.id,
        quantidade: item.quantity,
        observacoes: item.observations || undefined,
      }))

      const { data, error } = await (supabase.rpc as any)('enviar_pedido_online', {
        p_mesa_numero: mesaNum > 0 ? mesaNum : 10,
        p_cliente_nome:
          clientName.trim() || (isDelivery ? 'Cliente Delivery' : `Cliente Mesa ${mesaNum}`),
        p_itens: itensPayload,
      })

      if (error) {
        throw error
      }

      const res = data as any
      const totalCalculado = cartTotal
      setOrderSuccess({
        comandaId: res?.comanda_id || `cmd-${mesaNum}`,
        mesaNumero: mesaNum > 0 ? mesaNum : 10,
        total: totalCalculado,
      })
      setCart([])
      setCartOpen(false)

      toast({
        title: 'Pedido enviado com sucesso!',
        description: 'Seus itens já estão na fila de preparo do bar/cozinha.',
      })
    } catch (err: any) {
      console.error('Falha ao enviar pedido online:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao enviar pedido',
        description: err.message || 'Tente novamente em instantes.',
      })
    } finally {
      setSubmitting(false)
    }
  }

  // Simulação de pagamento Pix
  const handleSimulatePixPayment = () => {
    setPixStatus('checking')
    setTimeout(() => {
      setPixStatus('paid')
      toast({
        title: 'Pagamento Pix Aprovado!',
        description: 'Recebimento simulado confirmado. Obrigado pela preferência no Rachide Bar!',
      })
    }, 2000)
  }

  return (
    <div className="min-h-screen bg-[#1C1917] text-[#F5F5F4] flex flex-col font-sans">
      {/* Top Header do Cardápio On-line */}
      <header className="sticky top-0 z-30 bg-[#292524] border-b border-[#44403C] px-4 py-3 shadow-md">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-[#1C1917] shadow-md shadow-amber-950/40">
              <Beer className="w-5 h-5 fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-base text-stone-100">
                  Rachide <span className="text-amber-500">Bar</span>
                </span>
                <Badge
                  variant="outline"
                  className="bg-amber-500/10 text-amber-400 border-amber-500/40 text-[10px] font-bold"
                >
                  {isDelivery ? 'Delivery / Retirada' : `Mesa ${mesaNum}`}
                </Badge>
              </div>
              <p className="text-[10px] text-stone-400">Cardápio Digital & Pedido Direto</p>
            </div>
          </div>

          {/* Carrinho Trigger */}
          <Button
            onClick={() => setCartOpen(true)}
            size="sm"
            className="relative bg-amber-500 hover:bg-amber-600 text-stone-950 font-black text-xs h-9 px-3.5 shadow-md shadow-amber-950/40"
          >
            <ShoppingCart className="w-4 h-4 mr-1.5" />
            <span>Ver Pedido</span>
            {cartCount > 0 && (
              <span className="ml-1.5 px-1.5 py-0.2 rounded-full bg-stone-950 text-amber-400 text-[10px] font-extrabold tabular-nums">
                {cartCount}
              </span>
            )}
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-5 space-y-5">
        {/* Banner de Boas-Vindas */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-[#292524] to-[#342D26] border border-amber-500/30 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <h2 className="font-extrabold text-sm sm:text-base text-stone-100">
                {isDelivery
                  ? 'Faça seu pedido para entrega ou retirada'
                  : `Você está na Mesa ${mesaNum}`}
              </h2>
            </div>
            <p className="text-xs text-stone-300 mt-1">
              Peça direto do seu celular: seu pedido vai em tempo real para a cozinha e bar do
              Rachide Bar.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {!isDelivery ? (
              <span className="text-[11px] text-emerald-400 bg-emerald-500/15 border border-emerald-500/40 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Mesa Conectada
              </span>
            ) : (
              <div className="flex items-center gap-1.5 bg-[#1C1917] px-2.5 py-1 rounded-lg border border-[#44403C] text-xs">
                <span className="text-stone-400">Trocar mesa:</span>
                <input
                  type="number"
                  min="1"
                  max="50"
                  placeholder="Nº"
                  onChange={(e) => setMesaNum(parseInt(e.target.value, 10) || 0)}
                  className="w-12 bg-transparent text-amber-400 font-bold focus:outline-none text-center"
                />
              </div>
            )}
          </div>
        </div>

        {/* Busca e Categorias */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-stone-500" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar no cardápio: Heineken, bolinho, picanha, drinks..."
              className="pl-9 bg-[#292524] border-[#44403C] text-stone-100 text-xs sm:text-sm focus:border-amber-500 h-10"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-3 text-stone-400 hover:text-stone-200"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Categorias Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  selectedCategory === cat
                    ? 'bg-amber-500 text-stone-950 shadow-md shadow-amber-950/30'
                    : 'bg-[#292524] text-stone-300 hover:bg-[#44403C] border border-[#44403C]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Lista de Produtos */}
        {loading ? (
          <div className="py-16 text-center space-y-2">
            <Loader2 className="w-8 h-8 text-amber-500 animate-spin mx-auto" />
            <p className="text-xs text-stone-400">Carregando cardápio fresco...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-16 text-center text-stone-400 text-sm border border-dashed border-[#44403C] rounded-2xl">
            Nenhum item encontrado no momento.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {filteredProducts.map((prod) => (
              <div
                key={prod.id}
                onClick={() => handleOpenItem(prod)}
                className="p-4 rounded-2xl bg-[#292524] border border-[#44403C] hover:border-amber-500/60 transition-all cursor-pointer flex flex-col justify-between shadow-sm hover:shadow-md group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-sm text-stone-100 group-hover:text-amber-400 transition-colors">
                      {prod.name}
                    </h3>
                    <Badge
                      variant="outline"
                      className="bg-[#1C1917] text-stone-300 border-stone-700 text-[10px] whitespace-nowrap"
                    >
                      {prod.category}
                    </Badge>
                  </div>
                  {prod.description && (
                    <p className="text-xs text-stone-400 mt-1 line-clamp-2 leading-relaxed">
                      {prod.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between pt-3 mt-2 border-t border-[#44403C]/50">
                  <div className="text-amber-400 font-extrabold text-base tabular-nums">
                    R$ {prod.price.toFixed(2)}
                  </div>
                  <Button
                    size="sm"
                    className="bg-amber-500/20 group-hover:bg-amber-500 text-amber-400 group-hover:text-stone-950 font-bold text-xs h-8 px-3 rounded-lg transition-all"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Adicionar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Floating Bottom Bar if Cart has items */}
      {cartCount > 0 && !cartOpen && (
        <div className="sticky bottom-3 px-4 max-w-4xl mx-auto w-full z-20">
          <button
            onClick={() => setCartOpen(true)}
            className="w-full p-4 rounded-2xl bg-amber-500 hover:bg-amber-600 text-stone-950 font-black shadow-xl shadow-amber-950/60 flex items-center justify-between transition-all"
          >
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-stone-950 text-amber-400 text-xs flex items-center justify-center font-bold">
                {cartCount}
              </span>
              <span className="text-sm">Ver carrinho do pedido</span>
            </div>
            <div className="text-base tabular-nums">R$ {cartTotal.toFixed(2)}</div>
          </button>
        </div>
      )}

      {/* Modal: Personalizar / Observação do Item */}
      <Dialog open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)}>
        <DialogContent className="max-w-md bg-[#292524] border-[#44403C] text-stone-100 p-6">
          {editingItem && (
            <div className="space-y-4">
              <DialogHeader>
                <DialogTitle className="text-base font-black text-stone-100 flex items-start justify-between">
                  <span>{editingItem.product.name}</span>
                </DialogTitle>
                <div className="text-amber-400 font-black text-lg tabular-nums">
                  R$ {editingItem.product.price.toFixed(2)}
                </div>
              </DialogHeader>

              {editingItem.product.description && (
                <p className="text-xs text-stone-300 leading-relaxed">
                  {editingItem.product.description}
                </p>
              )}

              {/* Quantidade */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#1C1917] border border-[#44403C]">
                <span className="text-xs font-semibold text-stone-300">Quantidade:</span>
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setEditingItem((prev) =>
                        prev ? { ...prev, quantity: Math.max(1, prev.quantity - 1) } : null,
                      )
                    }
                    className="h-8 w-8 p-0 bg-[#292524] border-[#44403C] text-stone-200"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </Button>
                  <span className="font-extrabold text-base tabular-nums w-8 text-center">
                    {editingItem.quantity}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setEditingItem((prev) =>
                        prev ? { ...prev, quantity: prev.quantity + 1 } : null,
                      )
                    }
                    className="h-8 w-8 p-0 bg-[#292524] border-[#44403C] text-stone-200"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              {/* Observações */}
              <div className="space-y-1.5">
                <Label className="text-xs text-stone-300 font-semibold">
                  Observações para a cozinha/bar (opcional):
                </Label>
                <Textarea
                  value={editingItem.observations}
                  onChange={(e) =>
                    setEditingItem((prev) =>
                      prev ? { ...prev, observations: e.target.value } : null,
                    )
                  }
                  placeholder="Ex: Ponto da carne bem passado, pouco gelo, sem cebola, limão à parte..."
                  className="bg-[#1C1917] border-[#44403C] text-xs text-stone-100 placeholder:text-stone-500 h-20"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#44403C]">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setEditingItem(null)}
                  className="text-stone-400 text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleConfirmAddToCart}
                  className="bg-amber-500 hover:bg-amber-600 text-stone-950 font-black text-xs px-5"
                >
                  Adicionar • R$ {(editingItem.product.price * editingItem.quantity).toFixed(2)}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Drawer/Modal do Carrinho */}
      <Dialog open={cartOpen} onOpenChange={setCartOpen}>
        <DialogContent className="max-w-lg bg-[#292524] border-[#44403C] text-stone-100 p-6 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-stone-100 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-amber-500" />
                Seu Pedido {mesaNum > 0 ? `(Mesa ${mesaNum})` : '(Delivery)'}
              </span>
              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/40 text-xs font-bold">
                {cartCount} item(s)
              </Badge>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Identificação do Cliente */}
            <div>
              <Label className="text-xs text-stone-300 font-semibold">
                Seu nome (para a comanda):
              </Label>
              <Input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Ex: João da Silva, Turma do Happy Hour..."
                className="mt-1 bg-[#1C1917] border-[#44403C] text-xs text-stone-100"
              />
            </div>

            {/* Itens */}
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {cart.length === 0 ? (
                <div className="py-8 text-center text-xs text-stone-400 border border-dashed border-[#44403C] rounded-xl">
                  Seu carrinho está vazio. Adicione bebidas e petiscos!
                </div>
              ) : (
                cart.map((item, idx) => (
                  <div
                    key={`${item.product.id}-${idx}`}
                    className="p-3 rounded-xl bg-[#1C1917] border border-[#44403C] flex items-center justify-between text-xs"
                  >
                    <div className="flex-1 mr-2">
                      <div className="font-bold text-stone-100">{item.product.name}</div>
                      <div className="text-stone-400 tabular-nums">
                        R$ {item.product.price.toFixed(2)} un
                      </div>
                      {item.observations && (
                        <div className="text-[11px] text-amber-400/90 italic mt-0.5">
                          Obs: {item.observations}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUpdateCartQuantity(idx, -1)}
                        className="h-6 w-6 p-0 bg-[#292524] border-[#44403C] text-stone-300"
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                      <span className="font-bold tabular-nums w-5 text-center text-stone-100">
                        {item.quantity}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUpdateCartQuantity(idx, 1)}
                        className="h-6 w-6 p-0 bg-[#292524] border-[#44403C] text-stone-300"
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                      <button
                        onClick={() => handleRemoveFromCart(idx)}
                        className="text-stone-500 hover:text-red-400 ml-1 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="w-20 text-right font-extrabold text-amber-400 tabular-nums ml-2">
                      R$ {(item.product.price * item.quantity).toFixed(2)}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Total */}
            <div className="p-4 rounded-xl bg-[#1C1917] border border-[#44403C] space-y-2 text-xs">
              <div className="flex items-center justify-between text-stone-400">
                <span>Subtotal Itens:</span>
                <span className="font-bold tabular-nums text-stone-200">
                  R$ {cartSubtotal.toFixed(2)}
                </span>
              </div>
              {isDelivery && (
                <div className="flex items-center justify-between text-stone-400">
                  <span>Taxa de Entrega:</span>
                  <span className="font-bold tabular-nums text-amber-400">
                    + R$ {deliveryFee.toFixed(2)}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between pt-2 border-t border-[#44403C] font-black text-base">
                <span className="text-stone-100">Total do Pedido:</span>
                <span className="text-xl text-amber-400 tabular-nums">
                  R$ {cartTotal.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Botão de Enviar */}
            <Button
              onClick={handleSendOrder}
              disabled={submitting || cart.length === 0}
              className="w-full bg-amber-500 hover:bg-amber-600 text-stone-950 font-black text-sm h-11 shadow-lg shadow-amber-950/40 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Enviando para a cozinha...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Confirmar e Enviar Pedido
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Pedido Enviado com Sucesso + Opção de Pix Simulado */}
      <Dialog open={!!orderSuccess} onOpenChange={(open) => !open && setOrderSuccess(null)}>
        <DialogContent className="max-w-md bg-[#292524] border-[#44403C] text-stone-100 p-6 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/40">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div>
            <h3 className="text-lg font-black text-stone-100">Pedido Enviado com Sucesso!</h3>
            <p className="text-xs text-stone-300 mt-1">
              Seu pedido já entrou na comanda da <strong>Mesa {orderSuccess?.mesaNumero}</strong> e
              está na fila da cozinha & bar com badge de <strong>Pedido On-line</strong>.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#1C1917] border border-[#44403C] text-left text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-stone-400">Comanda ID:</span>
              <span className="font-bold text-stone-200">{orderSuccess?.comandaId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-400">Total do Lançamento:</span>
              <span className="font-extrabold text-amber-400 tabular-nums">
                R$ {orderSuccess?.total.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <Button
              onClick={() => {
                setPixStatus('pending')
                setPixModalOpen(true)
              }}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-stone-950 font-black text-xs h-10 flex items-center justify-center gap-2"
            >
              <QrCode className="w-4 h-4" />
              Pagar agora via Pix (Simulado)
            </Button>

            <Button
              variant="outline"
              onClick={() => setOrderSuccess(null)}
              className="w-full bg-[#1C1917] border-[#44403C] text-stone-300 hover:text-white text-xs"
            >
              Continuar pedindo no cardápio
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Cobrança Pix Simulada */}
      <Dialog open={pixModalOpen} onOpenChange={setPixModalOpen}>
        <DialogContent className="max-w-md bg-[#292524] border-[#44403C] text-stone-100 p-6 text-center space-y-4">
          <DialogHeader>
            <DialogTitle className="text-base font-black text-stone-100 flex items-center justify-center gap-2">
              <QrCode className="w-5 h-5 text-emerald-400" />
              Cobrança Pix Instantânea (Simulada)
            </DialogTitle>
          </DialogHeader>

          {pixStatus !== 'paid' ? (
            <div className="space-y-4">
              <div className="flex justify-center py-2">
                <QRCodeSVG
                  value={`00020126580014br.gov.bcb.pix0136rachidebar-online@pix.com.br520400005303986540${orderSuccess?.total.toFixed(2)}5802BR5915Rachide Bar Ltda`}
                  size={190}
                />
              </div>

              <div className="text-xs text-stone-300">
                Aponte o app do seu banco para o QR Code acima ou simule a aprovação automática do
                TEP.
              </div>

              <div className="p-3 rounded-xl bg-[#1C1917] border border-[#44403C] text-xs flex items-center justify-between">
                <span className="text-stone-400">Valor a Pagar:</span>
                <span className="text-base font-black text-emerald-400 tabular-nums">
                  R$ {orderSuccess?.total.toFixed(2)}
                </span>
              </div>

              <Button
                onClick={handleSimulatePixPayment}
                disabled={pixStatus === 'checking'}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-stone-950 font-black text-xs h-10 flex items-center justify-center gap-2"
              >
                {pixStatus === 'checking' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Validando transação Pix no TEP...
                  </>
                ) : (
                  <>
                    <Smartphone className="w-4 h-4" />
                    Simular Aprovação de Pagamento Pix
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/50 space-y-3 animate-fade-in-up">
              <div className="w-12 h-12 rounded-full bg-emerald-500 text-stone-950 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-emerald-300">Pagamento Pix Confirmado!</h4>
                <p className="text-xs text-stone-300 mt-1">
                  Transação liquidada com sucesso via TEP Rachide. Seu comprovante foi emitido.
                </p>
              </div>
              <Button
                onClick={() => {
                  setPixModalOpen(false)
                  setOrderSuccess(null)
                }}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-stone-950 font-bold text-xs"
              >
                Concluir
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
