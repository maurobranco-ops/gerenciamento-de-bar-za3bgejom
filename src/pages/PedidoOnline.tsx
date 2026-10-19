import React, { useState, useEffect } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
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
  Wine,
  GlassWater,
  Flame,
  ChefHat,
  Utensils,
  ArrowLeft,
} from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { MenuItem, ProductCategory, TableRecord } from '@/types/bar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { QRCodeSVG } from '@/components/QRCodeSVG'
import { MesaSelector } from '@/components/MesaSelector'
import { PainelPedirContaCliente } from '@/components/PainelPedirContaCliente'
import { useToast } from '@/hooks/use-toast'
import {
  StatusAcompanhamentoPedido,
  TrackedOrderItem,
} from '@/components/StatusAcompanhamentoPedido'
import { DetalhesContaMesa, PaymentMethod } from '@/types/bar'
import { BarService } from '@/services/barService'
import { SoundEffects } from '@/lib/soundEffects'
import { AtendimentoStorage, AtendimentoAtivoLocal } from '@/lib/atendimentoStorage'

interface CartItem {
  product: MenuItem
  quantity: number
  observations: string
}

export default function PedidoOnline() {
  const { mesaNumero } = useParams<{ mesaNumero?: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const mesaParam = mesaNumero
    ? parseInt(mesaNumero, 10)
    : parseInt(searchParams.get('mesa') || '0', 10)

  const [mesaNum, setMesaNum] = useState<number>(!isNaN(mesaParam) ? mesaParam : 0)

  // Sincroniza mesaNum caso a URL mude (ex: navegação externa ou popstate)
  useEffect(() => {
    const parsed = mesaNumero
      ? parseInt(mesaNumero, 10)
      : parseInt(searchParams.get('mesa') || '0', 10)
    if (!isNaN(parsed)) {
      setMesaNum(parsed)
    }
  }, [mesaNumero, searchParams])

  const isDelivery = mesaNum === 0

  // Estado das mesas cadastradas no bar para seleção e validação em tempo real
  const [mesasBanco, setMesasBanco] = useState<TableRecord[]>([])
  const [loadingMesas, setLoadingMesas] = useState(true)
  const [mesaBlockedError, setMesaBlockedError] = useState<string | null>(null)

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

  // Acompanhamento do status do pedido em tempo real
  const [trackedItems, setTrackedItems] = useState<TrackedOrderItem[]>([])
  const [activeComandaId, setActiveComandaId] = useState<string>(() => {
    return (
      AtendimentoStorage.getComandaIdForMesa(mesaParam || 0) ||
      localStorage.getItem(`rachide_active_cmd_mesa_${mesaParam || 0}`) ||
      ''
    )
  })
  const [trackingLoading, setTrackingLoading] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('rachide_bar_client_sound')
    return saved !== null ? saved === 'true' : true
  })

  // Estado da sessão local ativa de atendimento
  const [atendimentoAtivo, setAtendimentoAtivo] = useState<AtendimentoAtivoLocal | null>(() => {
    return AtendimentoStorage.get()
  })

  // Modal de confirmação ao sair da tela da mesa (trocar mesa / voltar)
  const [modalConfirmarSaidaOpen, setModalConfirmarSaidaOpen] = useState(false)

  // Estado do fluxo Pedir a Conta
  const [detalhesConta, setDetalhesConta] = useState<DetalhesContaMesa | null>(null)
  const [loadingDetalhesConta, setLoadingDetalhesConta] = useState(false)
  const [submittingConta, setSubmittingConta] = useState(false)

  const toggleSound = () => {
    setSoundEnabled((prev) => {
      const next = !prev
      localStorage.setItem('rachide_bar_client_sound', String(next))
      if (next) {
        SoundEffects.playSuccessAlert()
      }
      return next
    })
  }

  // Ícone e estilo de placeholder por categoria para itens sem foto
  const renderCategoryPlaceholder = (category: string) => {
    switch (category) {
      case 'Cervejas':
        return (
          <div className="w-full h-full bg-gradient-to-br from-amber-950/40 via-stone-900 to-amber-900/20 flex flex-col items-center justify-center text-amber-500/70 border-b border-[#44403C]/40">
            <Beer className="w-10 h-10 stroke-[1.5]" />
            <span className="text-[10px] font-bold text-amber-400/60 uppercase tracking-widest mt-1.5">
              Cerveja Gelada
            </span>
          </div>
        )
      case 'Drinks':
        return (
          <div className="w-full h-full bg-gradient-to-br from-purple-950/40 via-stone-900 to-pink-900/20 flex flex-col items-center justify-center text-purple-400/70 border-b border-[#44403C]/40">
            <Wine className="w-10 h-10 stroke-[1.5]" />
            <span className="text-[10px] font-bold text-purple-300/60 uppercase tracking-widest mt-1.5">
              Coquetelaria
            </span>
          </div>
        )
      case 'Destilados':
        return (
          <div className="w-full h-full bg-gradient-to-br from-amber-950/50 via-stone-900 to-stone-900 flex flex-col items-center justify-center text-amber-600/70 border-b border-[#44403C]/40">
            <Wine className="w-10 h-10 stroke-[1.5]" />
            <span className="text-[10px] font-bold text-amber-500/60 uppercase tracking-widest mt-1.5">
              Destilados
            </span>
          </div>
        )
      case 'Petiscos':
        return (
          <div className="w-full h-full bg-gradient-to-br from-orange-950/40 via-stone-900 to-amber-950/30 flex flex-col items-center justify-center text-orange-500/70 border-b border-[#44403C]/40">
            <Utensils className="w-10 h-10 stroke-[1.5]" />
            <span className="text-[10px] font-bold text-orange-400/60 uppercase tracking-widest mt-1.5">
              Petisco da Casa
            </span>
          </div>
        )
      case 'Porções':
        return (
          <div className="w-full h-full bg-gradient-to-br from-red-950/40 via-stone-900 to-orange-950/30 flex flex-col items-center justify-center text-red-500/70 border-b border-[#44403C]/40">
            <Flame className="w-10 h-10 stroke-[1.5]" />
            <span className="text-[10px] font-bold text-red-400/60 uppercase tracking-widest mt-1.5">
              Porção Quente
            </span>
          </div>
        )
      case 'Refrigerantes':
        return (
          <div className="w-full h-full bg-gradient-to-br from-blue-950/40 via-stone-900 to-cyan-950/30 flex flex-col items-center justify-center text-blue-400/70 border-b border-[#44403C]/40">
            <GlassWater className="w-10 h-10 stroke-[1.5]" />
            <span className="text-[10px] font-bold text-blue-300/60 uppercase tracking-widest mt-1.5">
              Sem Álcool
            </span>
          </div>
        )
      default:
        return (
          <div className="w-full h-full bg-gradient-to-br from-stone-800 via-stone-900 to-stone-950 flex flex-col items-center justify-center text-stone-500 border-b border-[#44403C]/40">
            <UtensilsCrossed className="w-10 h-10 stroke-[1.5]" />
            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mt-1.5">
              Rachide Bar
            </span>
          </div>
        )
    }
  }

  // Carrega lista de mesas do banco para validação de status em tempo real
  const fetchMesas = React.useCallback(async () => {
    try {
      setLoadingMesas(true)
      const { data, error } = await supabase
        .from('mesas')
        .select('*')
        .order('numero', { ascending: true })

      if (!error && data) {
        const mappedMesas: TableRecord[] = data.map((m: any) => ({
          id: m.id,
          numero: m.numero,
          status: m.status,
          capacidade: m.capacidade,
          createdAt: m.created_at,
          updatedAt: m.updated_at,
        }))
        setMesasBanco(mappedMesas)

        // Se uma mesa veio na URL (ex: /pedido/4), validar se ela está livre
        if (mesaParam > 0) {
          const currentMesa = mappedMesas.find((m) => m.numero === mesaParam)
          const storedAtendimento = AtendimentoStorage.get()
          const isMinhaMesa = storedAtendimento && storedAtendimento.mesaNumero === mesaParam

          // Se a mesa estiver ocupada por OUTRO aparelho, bloqueia; se for deste aparelho, permite continuar!
          if (currentMesa && currentMesa.status !== 'Livre' && !isMinhaMesa) {
            const motivo =
              currentMesa.status === 'Ocupada'
                ? 'já está ocupada'
                : currentMesa.status === 'Aguardando Pagamento'
                  ? 'está em fechamento de conta'
                  : 'está fechada'

            setMesaBlockedError(
              `A Mesa ${mesaParam} não está disponível (${motivo}). Por favor, escolha uma mesa desocupada ou solicite auxílio ao garçom.`,
            )
            setMesaNum(0)
          } else if (isMinhaMesa) {
            // Mesa é do cliente: garante que erros anteriores sejam limpos e o atendimento mantido
            setMesaBlockedError(null)
          } else if (
            currentMesa &&
            currentMesa.status === 'Livre' &&
            (!storedAtendimento || storedAtendimento.mesaNumero !== mesaParam)
          ) {
            // Acesso direto por link/QR a uma mesa livre sem atendimento prévio deste aparelho:
            // Deve voltar ao seletor para que o cliente informe seu nome antes de iniciar!
            setMesaNum(0)
          }
        }
      }
    } catch (err) {
      console.warn('Erro ao carregar mesas:', err)
    } finally {
      setLoadingMesas(false)
    }
  }, [mesaParam])

  useEffect(() => {
    fetchMesas()
  }, [fetchMesas])

  // Ouvir alterações de status de mesas em tempo real (caso uma mesa seja liberada ou ocupada)
  useEffect(() => {
    const channel = supabase
      .channel('pedido-mesas-status-sync')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mesas',
        },
        () => {
          fetchMesas()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchMesas])

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

  // Buscar status ao vivo da fila da mesa/comanda
  const fetchOrderStatus = React.useCallback(
    async (silent = false) => {
      if (mesaNum <= 0 && !activeComandaId) return

      if (!silent) setTrackingLoading(true)
      try {
        const { data, error } = await (supabase.rpc as any)('obter_status_pedido_mesa', {
          p_mesa_numero: mesaNum > 0 ? mesaNum : null,
          p_comanda_id: activeComandaId || null,
        })

        if (!error && data) {
          const mapped: TrackedOrderItem[] = data.map((row: any) => ({
            fila_id: row.fila_id,
            comanda_item_id: row.comanda_item_id,
            comanda_id: row.comanda_id,
            mesa_numero: row.mesa_numero,
            produto_id: row.produto_id,
            nome_produto: row.nome_produto,
            categoria: row.categoria,
            image_url: row.image_url,
            quantidade: Number(row.quantidade || 1),
            observacoes: row.observacoes,
            area_preparo: row.area_preparo,
            status: row.status,
            origem_online: Boolean(row.origem_online),
            created_at: row.created_at,
            updated_at: row.updated_at,
          }))

          setTrackedItems((prev) => {
            // Detectar se algum item acabou de virar "pronto" para disparar bip sonoro
            if (prev.length > 0) {
              const prevReadyIds = new Set(
                prev.filter((p) => p.status === 'pronto').map((p) => p.fila_id),
              )
              const newlyReady = mapped.some(
                (curr) => curr.status === 'pronto' && !prevReadyIds.has(curr.fila_id),
              )

              if (newlyReady) {
                const soundSaved = localStorage.getItem('rachide_bar_client_sound')
                const isSoundOn = soundSaved !== null ? soundSaved === 'true' : true
                if (isSoundOn) {
                  SoundEffects.playOrderAlert()
                }
                toast({
                  title: '🔔 Pedido Pronto!',
                  description:
                    'Um ou mais itens do seu pedido estão prontos — o garçom está levando à sua mesa!',
                })
              }
            }

            return mapped
          })
        }
      } catch (err) {
        console.warn('Erro ao atualizar status do pedido da mesa:', err)
      } finally {
        if (!silent) setTrackingLoading(false)
      }
    },
    [mesaNum, activeComandaId, toast],
  )

  // Carga inicial do status da mesa
  useEffect(() => {
    fetchOrderStatus()
  }, [fetchOrderStatus])

  // Carregar detalhes da conta da mesa (saldo, itens, status da conta)
  const fetchDetalhesConta = React.useCallback(
    async (silent = false) => {
      if (mesaNum <= 0) return
      if (!silent) setLoadingDetalhesConta(true)
      try {
        const dados = await BarService.obterDetalhesContaMesa(mesaNum)
        setDetalhesConta(dados)
      } catch (err) {
        console.warn('Erro ao carregar detalhes da conta da mesa:', err)
      } finally {
        if (!silent) setLoadingDetalhesConta(false)
      }
    },
    [mesaNum],
  )

  useEffect(() => {
    if (mesaNum > 0) {
      fetchDetalhesConta()
    }
  }, [mesaNum, fetchDetalhesConta])

  // Supabase Realtime Subscription + Polling de fallback (4s)
  useEffect(() => {
    if (mesaNum <= 0 && !activeComandaId) return

    // 1. Canal Realtime Supabase ouvindo mudanças em fila_cozinha e comandas
    const channel = supabase
      .channel(`pedido-tracking-mesa-${mesaNum || 'delivery'}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'fila_cozinha',
        },
        () => {
          // Atualiza na hora que qualquer status da cozinha mudar
          fetchOrderStatus(true)
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'comandas',
        },
        () => {
          // Atualiza dados da conta e fechamento em tempo real
          fetchDetalhesConta(true)
        },
      )
      .subscribe()

    // 2. Polling curto de segurança (4s) para garantir sincronia mesmo se realtime oscilar
    const interval = setInterval(() => {
      fetchOrderStatus(true)
      fetchDetalhesConta(true)
    }, 4000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(interval)
    }
  }, [mesaNum, activeComandaId, fetchOrderStatus, fetchDetalhesConta])

  // Ação de solicitar a conta da mesa
  const handlePedirConta = async (forma: PaymentMethod) => {
    if (mesaNum <= 0) return
    setSubmittingConta(true)
    try {
      const res = await BarService.solicitarContaMesa(mesaNum, forma)
      if (res.sucesso) {
        toast({
          title: 'Conta solicitada com sucesso!',
          description: `O Caixa já foi avisado sobre a Mesa ${mesaNum} (${forma}).`,
        })
        SoundEffects.playOrderAlert()
        await fetchDetalhesConta(true)
      } else {
        toast({
          variant: 'destructive',
          title: 'Não foi possível solicitar a conta',
          description: res.mensagem || 'Tente novamente.',
        })
      }
    } catch (err: any) {
      console.error('Erro ao pedir conta:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao solicitar conta',
        description: err.message || 'Falha na comunicação com o servidor.',
      })
    } finally {
      setSubmittingConta(false)
    }
  }

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

  // Persistência do carrinho em localStorage vinculado à mesa para manter intacto ao sair/voltar
  useEffect(() => {
    if (mesaNum > 0) {
      try {
        const key = `rachide_cart_mesa_${mesaNum}`
        const saved = localStorage.getItem(key)
        if (saved) {
          const parsed = JSON.parse(saved)
          if (Array.isArray(parsed) && parsed.length > 0 && cart.length === 0) {
            setCart(parsed)
          }
        }
      } catch (err) {
        console.warn('Erro ao carregar carrinho salvo da mesa:', err)
      }
    }
  }, [mesaNum])

  useEffect(() => {
    if (mesaNum > 0) {
      try {
        const key = `rachide_cart_mesa_${mesaNum}`
        if (cart.length > 0) {
          localStorage.setItem(key, JSON.stringify(cart))
        } else {
          localStorage.removeItem(key)
        }
      } catch (err) {
        console.warn('Erro ao salvar carrinho no localStorage:', err)
      }
    }
  }, [cart, mesaNum])

  // Persiste atendimento localmente sempre que o cliente entrar numa mesa mantendo o nome do AtendimentoStorage
  useEffect(() => {
    if (mesaNum > 0) {
      const defaultComandaId = `cmd-${mesaNum < 10 ? `0${mesaNum}` : mesaNum}`
      const targetComanda = activeComandaId || defaultComandaId
      const currentStored = AtendimentoStorage.get()
      AtendimentoStorage.set({
        mesaNumero: mesaNum,
        comandaId: targetComanda,
        clienteNome:
          currentStored?.clienteNome || (isDelivery ? clientName || undefined : undefined),
      })
      setAtendimentoAtivo(AtendimentoStorage.get())
    }
  }, [mesaNum, activeComandaId, clientName, isDelivery])

  // Interceptar botão Voltar do navegador via popstate quando estiver dentro de uma mesa ativa
  useEffect(() => {
    if (mesaNum <= 0) return

    // Adiciona uma entrada extra no histórico para interceptar o primeiro clique de "Voltar"
    const currentState = window.history.state || {}
    if (!currentState.inMesa) {
      window.history.pushState({ inMesa: true, mesaNum }, '', window.location.href)
    }

    const handlePopState = (e: PopStateEvent) => {
      // Se o cliente tentar voltar e estiver em uma mesa ativa, interrompe e abre confirmação
      e.preventDefault()
      // Empurra o estado novamente para reter a tela até confirmação
      window.history.pushState({ inMesa: true, mesaNum }, '', window.location.href)
      setModalConfirmarSaidaOpen(true)
    }

    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [mesaNum])

  // Executa a saída da tela da mesa de forma segura (preservando o atendimento no localStorage)
  const executarSaidaMesa = () => {
    setModalConfirmarSaidaOpen(false)
    setMesaBlockedError(null)
    setMesaNum(0)
    setAtendimentoAtivo(AtendimentoStorage.get())
    navigate('/pedido', { replace: true })
    toast({
      title: `Atendimento na Mesa ${mesaNum} permanece aberto`,
      description: 'Você pode voltar a qualquer momento selecionando "Continuar meu atendimento".',
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

      // Para mesa: não sobrescreve cliente_nome. O nome já foi informado e gravado na abertura da mesa.
      const nomeParaEnvio = isDelivery
        ? clientName.trim() || 'Cliente Delivery'
        : AtendimentoStorage.get()?.clienteNome || ''

      const { data, error } = await (supabase.rpc as any)('enviar_pedido_online', {
        p_mesa_numero: mesaNum > 0 ? mesaNum : 10,
        p_cliente_nome: nomeParaEnvio,
        p_itens: itensPayload,
      })

      if (error) {
        throw error
      }

      const res = data as any
      const totalCalculado = cartTotal
      const targetComandaId = res?.comanda_id || `cmd-${mesaNum > 0 ? mesaNum : 10}`

      setActiveComandaId(targetComandaId)
      AtendimentoStorage.set({
        mesaNumero: mesaNum > 0 ? mesaNum : 10,
        comandaId: targetComandaId,
        clienteNome: AtendimentoStorage.get()?.clienteNome || clientName.trim() || undefined,
      })
      setAtendimentoAtivo(AtendimentoStorage.get())

      setOrderSuccess({
        comandaId: targetComandaId,
        mesaNumero: mesaNum > 0 ? mesaNum : 10,
        total: totalCalculado,
      })
      setCart([])
      try {
        localStorage.removeItem(`rachide_cart_mesa_${mesaNum}`)
      } catch {
        /* intentionally ignored */
      }
      setCartOpen(false)

      // Atualiza imediatamente o acompanhamento ao vivo do pedido
      setTimeout(() => {
        fetchOrderStatus(true)
      }, 300)

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

  // Se nenhuma mesa estiver selecionada ou se a mesa atual tiver sido bloqueada, exibe a tela de Seleção de Mesa
  if (mesaNum <= 0) {
    return (
      <MesaSelector
        mesas={mesasBanco}
        loadingMesas={loadingMesas}
        errorBanner={mesaBlockedError}
        atendimentoAtivo={atendimentoAtivo}
        onClearError={() => setMesaBlockedError(null)}
        onContinuarAtendimento={(num) => {
          setMesaBlockedError(null)
          setMesaNum(num)
          navigate(`/pedido/${num}`, { replace: true })
          toast({
            title: `Bem-vindo de volta à Mesa ${num}!`,
            description: 'Seu atendimento, consumo e pedidos continuam intactos.',
          })
        }}
        onSelectMesa={(num) => {
          setMesaBlockedError(null)
          setDetalhesConta(null)
          setTrackedItems([])
          setMesaNum(num)
          setAtendimentoAtivo(AtendimentoStorage.get())
          navigate(`/pedido/${num}`, { replace: true })
        }}
      />
    )
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
            <span className="text-[11px] text-emerald-400 bg-emerald-500/15 border border-emerald-500/40 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Mesa Conectada
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                // Intercepta a saída da mesa com confirmação acolhedora
                setModalConfirmarSaidaOpen(true)
              }}
              className="bg-[#1C1917] hover:bg-[#342D26] border-[#44403C] text-stone-300 text-[11px] h-7 px-2"
            >
              <ArrowLeft className="w-3 h-3 mr-1" />
              Trocar mesa
            </Button>
          </div>
        </div>

        {/* FLUXO PEDIR A CONTA (EXCLUSIVO PARA CLIENTES EM MESA) */}
        {!isDelivery && mesaNum > 0 && (
          <PainelPedirContaCliente
            mesaNumero={mesaNum}
            detalhesConta={detalhesConta}
            loadingDetalhes={loadingDetalhesConta}
            submittingConta={submittingConta}
            onPedirConta={handlePedirConta}
            onRefresh={() => fetchDetalhesConta(false)}
          />
        )}

        {/* ACOMPANHAMENTO AO VIVO DO STATUS DO PEDIDO */}
        {trackedItems.length > 0 && (
          <StatusAcompanhamentoPedido
            items={trackedItems}
            mesaNumero={mesaNum}
            comandaId={activeComandaId}
            loading={trackingLoading}
            onRefresh={() => fetchOrderStatus(false)}
            soundEnabled={soundEnabled}
            onToggleSound={toggleSound}
            onAddMoreItems={() => {
              const menuSection = document.getElementById('secao-cardapio')
              if (menuSection) {
                menuSection.scrollIntoView({ behavior: 'smooth' })
              }
            }}
          />
        )}

        {/* Busca e Categorias */}
        <div id="secao-cardapio" className="space-y-3 pt-1">
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
                className="rounded-2xl bg-[#292524] border border-[#44403C] hover:border-amber-500/60 transition-all cursor-pointer flex flex-col justify-between shadow-sm hover:shadow-md group overflow-hidden"
              >
                {/* Imagem do Produto ou Placeholder Elegante */}
                <div className="w-full h-36 relative bg-stone-900 overflow-hidden">
                  {prod.imageUrl ? (
                    <img
                      src={prod.imageUrl}
                      alt={prod.name}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    renderCategoryPlaceholder(prod.category)
                  )}

                  {/* Categoria Badge sobre a foto */}
                  <div className="absolute top-2.5 right-2.5">
                    <Badge
                      variant="outline"
                      className="bg-[#1C1917]/85 backdrop-blur-sm text-stone-200 border-[#44403C] text-[10px] font-bold shadow-sm"
                    >
                      {prod.category}
                    </Badge>
                  </div>
                </div>

                {/* Conteúdo do Card */}
                <div className="p-4 flex flex-col flex-1 justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-stone-100 group-hover:text-amber-400 transition-colors leading-snug">
                      {prod.name}
                    </h3>
                    {prod.description && (
                      <p className="text-xs text-stone-400 mt-1 line-clamp-2 leading-relaxed">
                        {prod.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-3 mt-3 border-t border-[#44403C]/50">
                    <div>
                      <span className="text-[10px] text-stone-400 uppercase font-semibold block">
                        Preço
                      </span>
                      <div className="text-amber-400 font-extrabold text-base tabular-nums">
                        R$ {prod.price.toFixed(2)}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className="bg-amber-500/20 group-hover:bg-amber-500 text-amber-400 group-hover:text-stone-950 font-bold text-xs h-8 px-3 rounded-lg transition-all"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Pedir
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Floating Bottom Bar if Cart has items (com margem de segurança para o Skip badge no canto inferior direito) */}
      {cartCount > 0 && !cartOpen && (
        <div className="sticky bottom-4 sm:bottom-3 px-3 sm:px-4 max-w-4xl mx-auto w-full z-20 mb-8 sm:mb-2">
          <button
            onClick={() => setCartOpen(true)}
            className="w-full p-3.5 sm:p-4 rounded-2xl bg-amber-500 hover:bg-amber-600 text-stone-950 font-black shadow-xl shadow-amber-950/60 flex items-center justify-between transition-all"
          >
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-stone-950 text-amber-400 text-xs flex items-center justify-center font-bold">
                {cartCount}
              </span>
              <span className="text-xs sm:text-sm">Ver carrinho do pedido</span>
            </div>
            <div className="text-sm sm:text-base tabular-nums">R$ {cartTotal.toFixed(2)}</div>
          </button>
        </div>
      )}
      {/* Modal: Personalizar / Observação do Item */}
      <Dialog open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)}>
        <DialogContent className="max-w-md bg-[#292524] border-[#44403C] text-stone-100 p-6">
          {editingItem && (
            <div className="space-y-4">
              {/* Foto ou Placeholder no topo do modal */}
              <div className="w-full h-40 rounded-xl overflow-hidden bg-stone-900 border border-[#44403C] relative">
                {editingItem.product.imageUrl ? (
                  <img
                    src={editingItem.product.imageUrl}
                    alt={editingItem.product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  renderCategoryPlaceholder(editingItem.product.category)
                )}
                <div className="absolute top-2.5 right-2.5">
                  <Badge className="bg-amber-500 text-stone-950 font-bold text-[10px]">
                    {editingItem.product.category}
                  </Badge>
                </div>
              </div>

              <DialogHeader>
                <DialogTitle className="text-base font-black text-stone-100">
                  {editingItem.product.name}
                </DialogTitle>
                <div className="text-amber-400 font-black text-lg tabular-nums">
                  R$ {editingItem.product.price.toFixed(2)}
                </div>
              </DialogHeader>

              {editingItem.product.description && (
                <p className="text-xs text-stone-300 leading-relaxed -mt-1">
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
        <DialogContent className="w-[calc(100%-1rem)] sm:max-w-lg bg-[#292524] border-[#44403C] text-stone-100 p-4 sm:p-6 max-h-[92dvh] overflow-y-auto pb-20 sm:pb-6">
          <DialogHeader className="pr-6 sm:pr-0">
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
            {/* Identificação do Cliente: exibido apenas para Delivery (no salão, o nome é definido na abertura da mesa) */}
            {isDelivery ? (
              <div>
                <Label className="text-xs text-stone-300 font-semibold">
                  Seu nome (para o pedido delivery):
                </Label>
                <Input
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Ex: João da Silva..."
                  className="mt-1 bg-[#1C1917] border-[#44403C] text-xs text-stone-100"
                />
              </div>
            ) : (
              atendimentoAtivo?.clienteNome && (
                <div className="p-2.5 rounded-lg bg-[#1C1917] border border-[#44403C] flex items-center justify-between text-xs">
                  <span className="text-stone-400">Comanda em nome de:</span>
                  <span className="font-bold text-amber-400">{atendimentoAtivo.clienteNome}</span>
                </div>
              )
            )}

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
                setOrderSuccess(null)
                // Rola suave até a seção de acompanhamento no topo
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
              className="w-full bg-amber-500 hover:bg-amber-600 text-stone-950 font-black text-xs h-10 flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Acompanhar Preparo ao Vivo
            </Button>

            <Button
              onClick={() => {
                setPixStatus('pending')
                setPixModalOpen(true)
              }}
              variant="outline"
              className="w-full bg-emerald-500/10 border-emerald-500/40 hover:bg-emerald-500 hover:text-stone-950 text-emerald-400 font-black text-xs h-10 flex items-center justify-center gap-2"
            >
              <QrCode className="w-4 h-4" />
              Pagar agora via Pix (Simulado)
            </Button>

            <Button
              variant="ghost"
              onClick={() => setOrderSuccess(null)}
              className="w-full text-stone-400 hover:text-stone-200 text-xs"
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

      {/* Modal de Confirmação ao Sair da Tela da Mesa */}
      <Dialog open={modalConfirmarSaidaOpen} onOpenChange={setModalConfirmarSaidaOpen}>
        <DialogContent className="w-[calc(100%-1rem)] sm:max-w-md bg-[#292524] border-[#44403C] text-stone-100 p-5 sm:p-6">
          <DialogHeader>
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-2 border border-amber-500/40">
              <Beer className="w-6 h-6" />
            </div>
            <DialogTitle className="text-center text-lg font-black text-stone-100">
              Seu atendimento na Mesa {mesaNum} está aberto
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-1 text-center">
            <p className="text-xs sm:text-sm text-stone-300 leading-relaxed">
              Deseja realmente sair da tela da mesa? Seu consumo, pedidos e carrinho{' '}
              <strong className="text-amber-400">permanecem salvos</strong> e você poderá voltar a
              qualquer momento selecionando a <strong>Mesa {mesaNum}</strong> ou pelo atalho{' '}
              <strong className="text-amber-400">"Continuar meu atendimento"</strong>.
            </p>

            <div className="p-3 rounded-xl bg-[#1C1917] border border-[#44403C] text-left text-xs space-y-1">
              <div className="flex items-center justify-between text-stone-400">
                <span>Mesa conectada:</span>
                <span className="font-bold text-amber-400">Mesa {mesaNum}</span>
              </div>
              <div className="flex items-center justify-between text-stone-400">
                <span>Status da comanda:</span>
                <span className="text-emerald-400 font-semibold">Em andamento</span>
              </div>
            </div>

            <div className="flex gap-2.5 pt-2 border-t border-[#44403C]">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalConfirmarSaidaOpen(false)}
                className="flex-1 bg-[#1C1917] hover:bg-[#342D26] border-[#44403C] text-stone-200 text-xs h-10"
              >
                Continuar na Mesa {mesaNum}
              </Button>
              <Button
                type="button"
                onClick={executarSaidaMesa}
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-stone-950 font-black text-xs h-10 shadow-md shadow-amber-950/40"
              >
                Sair mesmo assim
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
