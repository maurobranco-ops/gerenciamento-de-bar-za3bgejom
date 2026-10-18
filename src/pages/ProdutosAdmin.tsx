import React, { useState, useMemo } from 'react'
import {
  PackagePlus,
  Edit3,
  Power,
  Search,
  Filter,
  DollarSign,
  Boxes,
  Beer,
  Utensils,
  Wine,
  GlassWater,
  Flame,
  ChefHat,
  Scale,
  Sparkles,
  Check,
  X,
  AlertTriangle,
  Camera,
  UploadCloud,
  Image as ImageIcon,
  Trash2,
  Loader2,
} from 'lucide-react'
import { useBar } from '../context/BarContext'
import { MenuItem, ProductCategory, StockUnit, AreaPreparo } from '../types/bar'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Badge } from '../components/ui/badge'
import { Switch } from '../components/ui/switch'
import { Label } from '../components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog'
import { SaveProductPayload } from '../services/barService'
import { compressImage, uploadProductImage, deleteProductImageByUrl } from '../lib/imageCompression'
import { useToast } from '../hooks/use-toast'

const CATEGORIES: ProductCategory[] = [
  'Cervejas',
  'Petiscos',
  'Destilados',
  'Refrigerantes',
  'Porções',
  'Drinks',
]

const UNITS: StockUnit[] = ['un', 'kg', 'L', 'g', 'ml']

export default function ProdutosAdmin() {
  const { allProducts, createProduct, updateProduct, toggleProductStatus, role } = useBar()
  const { toast } = useToast()

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | 'Todos'>('Todos')
  const [filterStatus, setFilterStatus] = useState<'todos' | 'ativos' | 'inativos'>('todos')

  // Estado do Modal de Edição / Criação
  const [modalOpen, setModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<MenuItem | null>(null)

  // Campos do formulário
  const [formNome, setFormNome] = useState('')
  const [formCategoria, setFormCategoria] = useState<ProductCategory>('Cervejas')
  const [formPreco, setFormPreco] = useState('0.00')
  const [formDescricao, setFormDescricao] = useState('')
  const [formUnidade, setFormUnidade] = useState<StockUnit>('un')
  const [formEstoque, setFormEstoque] = useState('0')
  const [formEstoqueMinimo, setFormEstoqueMinimo] = useState('5')
  const [formAreaPreparo, setFormAreaPreparo] = useState<AreaPreparo>('bar')
  const [formAtivo, setFormAtivo] = useState(true)
  const [formImageUrl, setFormImageUrl] = useState<string>('')
  const [selectedFileToUpload, setSelectedFileToUpload] = useState<Blob | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string>('')
  const [imageCompressedSizeKb, setImageCompressedSizeKb] = useState<number | null>(null)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Abrir modal de criação
  const handleOpenCreate = () => {
    setEditingProduct(null)
    setFormNome('')
    setFormCategoria('Cervejas')
    setFormPreco('0.00')
    setFormDescricao('')
    setFormUnidade('un')
    setFormEstoque('20')
    setFormEstoqueMinimo('5')
    setFormAreaPreparo('bar')
    setFormAtivo(true)
    setFormImageUrl('')
    setSelectedFileToUpload(null)
    setImagePreviewUrl('')
    setImageCompressedSizeKb(null)
    setModalOpen(true)
  }

  // Abrir modal de edição
  const handleOpenEdit = (prod: MenuItem) => {
    setEditingProduct(prod)
    setFormNome(prod.name)
    setFormCategoria(prod.category)
    setFormPreco(prod.price.toFixed(2))
    setFormDescricao(prod.description || '')
    setFormUnidade(prod.unit)
    setFormEstoque(String(prod.stock))
    setFormEstoqueMinimo(String(prod.minStock))
    setFormAreaPreparo(
      prod.areaPreparo ||
        (['Cervejas', 'Drinks', 'Destilados', 'Refrigerantes'].includes(prod.category)
          ? 'bar'
          : 'cozinha'),
    )
    setFormAtivo(prod.ativo !== false)
    setFormImageUrl(prod.imageUrl || '')
    setSelectedFileToUpload(null)
    setImagePreviewUrl(prod.imageUrl || '')
    setImageCompressedSizeKb(null)
    setModalOpen(true)
  }

  // Handler de seleção e compressão de foto no cliente
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setIsUploadingImage(true)
      const compressed = await compressImage(file, {
        maxWidth: 800,
        maxHeight: 800,
        quality: 0.82,
        mimeType: 'image/jpeg',
      })

      const sizeKb = Math.round(compressed.blob.size / 1024)
      setSelectedFileToUpload(compressed.blob)
      setImagePreviewUrl(compressed.dataUrl)
      setImageCompressedSizeKb(sizeKb)

      toast({
        title: 'Foto comprimida com sucesso!',
        description: `Tamanho otimizado para ${sizeKb} KB (~máx 800px). Pronta para salvar.`,
      })
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao processar foto',
        description: err.message || 'Selecione uma imagem válida (PNG, JPG, WebP).',
      })
    } finally {
      setIsUploadingImage(false)
    }
  }

  // Remover foto atual
  const handleRemovePhoto = () => {
    setSelectedFileToUpload(null)
    setImagePreviewUrl('')
    setFormImageUrl('')
    setImageCompressedSizeKb(null)
  }

  // Submissão do formulário
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formNome.trim()) return

    setIsSubmitting(true)
    try {
      const targetId = editingProduct?.id || `prod-${Date.now()}`
      let finalImageUrl = formImageUrl

      // Se há um arquivo novo para upload comprimido
      if (selectedFileToUpload) {
        setIsUploadingImage(true)
        try {
          finalImageUrl = await uploadProductImage(selectedFileToUpload, targetId)
          // Se havia imagem anterior diferente, limpa opcionalmente
          if (editingProduct?.imageUrl && editingProduct.imageUrl !== finalImageUrl) {
            deleteProductImageByUrl(editingProduct.imageUrl).catch(() => {})
          }
        } catch (uploadErr: any) {
          toast({
            variant: 'destructive',
            title: 'Erro no envio da foto',
            description: uploadErr.message || 'Não foi possível gravar a foto no Storage.',
          })
          setIsSubmitting(false)
          setIsUploadingImage(false)
          return
        }
      } else if (!imagePreviewUrl && editingProduct?.imageUrl) {
        // Usuário removeu a foto existente
        deleteProductImageByUrl(editingProduct.imageUrl).catch(() => {})
        finalImageUrl = ''
      }

      const payload: SaveProductPayload = {
        nome: formNome.trim(),
        categoria: formCategoria,
        preco: Math.max(0, Number(parseFloat(formPreco.replace(',', '.') || '0').toFixed(2))),
        descricao: formDescricao.trim(),
        unidade: formUnidade,
        estoque: Math.max(0, Number(parseFloat(formEstoque.replace(',', '.') || '0').toFixed(2))),
        estoque_minimo: Math.max(
          0,
          Number(parseFloat(formEstoqueMinimo.replace(',', '.') || '0').toFixed(2)),
        ),
        area_preparo: formAreaPreparo,
        ativo: formAtivo,
        image_url: finalImageUrl || undefined,
      }

      let success = false
      if (editingProduct) {
        success = await updateProduct(editingProduct.id, payload)
      } else {
        success = await createProduct(payload)
      }

      if (success) {
        setModalOpen(false)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  // Filtragem dos produtos
  const filteredProducts = useMemo(() => {
    return allProducts.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesCategory = selectedCategory === 'Todos' || p.category === selectedCategory
      const isAtivo = p.ativo !== false
      const matchesStatus =
        filterStatus === 'todos' ||
        (filterStatus === 'ativos' && isAtivo) ||
        (filterStatus === 'inativos' && !isAtivo)

      return matchesSearch && matchesCategory && matchesStatus
    })
  }, [allProducts, searchQuery, selectedCategory, filterStatus])

  // Resumo de contagens
  const stats = useMemo(() => {
    const total = allProducts.length
    const ativos = allProducts.filter((p) => p.ativo !== false).length
    const inativos = allProducts.filter((p) => p.ativo === false).length
    const bar = allProducts.filter((p) => (p.areaPreparo || 'bar') === 'bar').length
    const cozinha = allProducts.filter((p) => p.areaPreparo === 'cozinha').length
    return { total, ativos, inativos, bar, cozinha }
  }, [allProducts])

  const getCategoryIcon = (category: ProductCategory) => {
    switch (category) {
      case 'Cervejas':
        return <Beer className="w-4 h-4 text-amber-500" />
      case 'Petiscos':
        return <Utensils className="w-4 h-4 text-orange-500" />
      case 'Porções':
        return <Flame className="w-4 h-4 text-red-500" />
      case 'Drinks':
        return <Wine className="w-4 h-4 text-purple-500" />
      case 'Destilados':
        return <Wine className="w-4 h-4 text-amber-600" />
      case 'Refrigerantes':
        return <GlassWater className="w-4 h-4 text-blue-500" />
    }
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Top Banner Gerencial */}
      <div className="p-5 rounded-2xl bg-[#292524] border border-[#44403C] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-500">
              <PackagePlus className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-stone-100 flex items-center gap-2">
                Cadastros de Produtos & Preços
                <Badge
                  variant="outline"
                  className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-[10px]"
                >
                  Exclusivo Gerente
                </Badge>
              </h2>
              <p className="text-xs text-stone-400 mt-1">
                Cadastre novos itens, altere preços de venda, defina a área de preparo (Bar/Cozinha)
                e ative ou desative produtos no Supabase em tempo real.
              </p>
            </div>
          </div>
        </div>

        {/* Botão Novo Produto */}
        <Button
          onClick={handleOpenCreate}
          className="bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold text-xs h-10 px-4 shadow-md shadow-amber-950/30 self-start md:self-auto"
        >
          <PackagePlus className="w-4 h-4 mr-1.5" />
          Novo Produto
        </Button>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-[#292524] border border-[#44403C] flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-stone-400 font-semibold">
              Total Cadastrados
            </div>
            <div className="text-xl font-black text-stone-100 mt-0.5">{stats.total}</div>
          </div>
          <Boxes className="w-6 h-6 text-stone-500" />
        </div>

        <div className="p-3.5 rounded-xl bg-[#292524] border border-[#44403C] flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-stone-400 font-semibold">
              Ativos no Cardápio
            </div>
            <div className="text-xl font-black text-emerald-400 mt-0.5">{stats.ativos}</div>
          </div>
          <Check className="w-6 h-6 text-emerald-500/60" />
        </div>

        <div className="p-3.5 rounded-xl bg-[#292524] border border-[#44403C] flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-stone-400 font-semibold">
              Inativos / Ocultos
            </div>
            <div className="text-xl font-black text-stone-400 mt-0.5">{stats.inativos}</div>
          </div>
          <Power className="w-6 h-6 text-stone-600" />
        </div>

        <div className="p-3.5 rounded-xl bg-[#292524] border border-[#44403C] flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-stone-400 font-semibold">
              Distribuição
            </div>
            <div className="text-xs font-bold text-amber-400 mt-1">
              Bar: {stats.bar} • Cozinha: {stats.cozinha}
            </div>
          </div>
          <Sparkles className="w-6 h-6 text-amber-500/60" />
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="p-4 rounded-xl bg-[#292524] border border-[#44403C] flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Busca */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-3 text-stone-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filtrar por nome ou descrição..."
            className="pl-9 bg-[#1C1917] border-[#44403C] text-xs text-stone-100 h-9"
          />
        </div>

        {/* Filtro Status (Todos / Ativos / Inativos) */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-[#1C1917] p-1 rounded-lg border border-[#44403C] text-xs">
            <button
              onClick={() => setFilterStatus('todos')}
              className={`px-3 py-1 rounded-md font-semibold transition-all ${
                filterStatus === 'todos'
                  ? 'bg-amber-500 text-stone-950 font-bold'
                  : 'text-stone-300'
              }`}
            >
              Todos ({stats.total})
            </button>
            <button
              onClick={() => setFilterStatus('ativos')}
              className={`px-3 py-1 rounded-md font-semibold transition-all ${
                filterStatus === 'ativos'
                  ? 'bg-amber-500 text-stone-950 font-bold'
                  : 'text-stone-300'
              }`}
            >
              Ativos ({stats.ativos})
            </button>
            <button
              onClick={() => setFilterStatus('inativos')}
              className={`px-3 py-1 rounded-md font-semibold transition-all ${
                filterStatus === 'inativos'
                  ? 'bg-amber-500 text-stone-950 font-bold'
                  : 'text-stone-300'
              }`}
            >
              Inativos ({stats.inativos})
            </button>
          </div>
        </div>
      </div>

      {/* Pílulas de Categorias */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => setSelectedCategory('Todos')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
            selectedCategory === 'Todos'
              ? 'bg-amber-500 text-stone-950'
              : 'bg-[#292524] text-stone-300 hover:bg-[#44403C] border border-[#44403C]'
          }`}
        >
          Todas Categorias
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              selectedCategory === cat
                ? 'bg-amber-500 text-stone-950'
                : 'bg-[#292524] text-stone-300 hover:bg-[#44403C] border border-[#44403C]'
            }`}
          >
            {getCategoryIcon(cat)}
            <span>{cat}</span>
          </button>
        ))}
      </div>

      {/* Tabela Gerencial de Produtos */}
      <div className="rounded-2xl bg-[#292524] border border-[#44403C] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#1C1917] border-b border-[#44403C] text-stone-400 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Produto & Categoria</th>
                <th className="py-3 px-4">Área de Preparo</th>
                <th className="py-3 px-4 text-right">Preço de Venda</th>
                <th className="py-3 px-4 text-right">Estoque / Mínimo</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#44403C]/60 text-stone-200">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-stone-400 text-xs">
                    Nenhum produto encontrado para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((prod) => {
                  const isAtivo = prod.ativo !== false
                  const area =
                    prod.areaPreparo ||
                    (['Cervejas', 'Drinks', 'Destilados', 'Refrigerantes'].includes(prod.category)
                      ? 'bar'
                      : 'cozinha')

                  return (
                    <tr
                      key={prod.id}
                      className={`hover:bg-[#1C1917]/50 transition-colors ${
                        !isAtivo ? 'opacity-60 bg-[#1C1917]/20' : ''
                      }`}
                    >
                      {/* Produto & Categoria */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {prod.imageUrl ? (
                            <div className="w-10 h-10 rounded-lg overflow-hidden bg-stone-900 border border-amber-500/40 flex-shrink-0 relative">
                              <img
                                src={prod.imageUrl}
                                alt={prod.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-[#1C1917] border border-[#44403C] flex items-center justify-center flex-shrink-0">
                              {getCategoryIcon(prod.category)}
                            </div>
                          )}
                          <div>
                            <div className="font-bold text-sm text-stone-100 flex items-center gap-2">
                              {prod.name}
                              {!isAtivo && (
                                <Badge
                                  variant="outline"
                                  className="bg-stone-800 text-stone-400 border-stone-700 text-[10px]"
                                >
                                  Inativo
                                </Badge>
                              )}
                              {prod.imageUrl && (
                                <span title="Possui foto para o cardápio on-line">
                                  <Camera className="w-3 h-3 text-amber-400" />
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-stone-400">{prod.category}</span>
                          </div>
                        </div>
                      </td>

                      {/* Área de Preparo */}
                      <td className="py-3 px-4">
                        <Badge
                          variant="outline"
                          className={`text-[10px] uppercase font-bold flex items-center gap-1 w-fit ${
                            area === 'bar'
                              ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                              : 'bg-orange-500/10 text-orange-400 border-orange-500/30'
                          }`}
                        >
                          {area === 'bar' ? (
                            <>
                              <Beer className="w-3 h-3" /> Bar
                            </>
                          ) : (
                            <>
                              <ChefHat className="w-3 h-3" /> Cozinha
                            </>
                          )}
                        </Badge>
                      </td>

                      {/* Preço de Venda */}
                      <td className="py-3 px-4 text-right">
                        <span className="font-black text-amber-400 text-sm tabular-nums">
                          R$ {prod.price.toFixed(2)}
                        </span>
                      </td>

                      {/* Estoque / Mínimo */}
                      <td className="py-3 px-4 text-right">
                        <div className="tabular-nums font-semibold">
                          <span
                            className={
                              prod.stock <= 0
                                ? 'text-red-400 font-bold'
                                : prod.stock <= prod.minStock
                                  ? 'text-amber-400 font-bold'
                                  : 'text-stone-200'
                            }
                          >
                            {prod.stock} {prod.unit}
                          </span>
                          <span className="text-[11px] text-stone-500 block">
                            Mín: {prod.minStock} {prod.unit}
                          </span>
                        </div>
                      </td>

                      {/* Status Toggle */}
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => toggleProductStatus(prod.id)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors ${
                            isAtivo
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                              : 'bg-stone-800 text-stone-400 border-stone-700 hover:bg-stone-700'
                          }`}
                          title={isAtivo ? 'Clique para desativar' : 'Clique para ativar'}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isAtivo ? 'bg-emerald-500 animate-pulse' : 'bg-stone-500'
                            }`}
                          />
                          {isAtivo ? 'Ativo' : 'Inativo'}
                        </button>
                      </td>

                      {/* Ações */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenEdit(prod)}
                            className="bg-[#1C1917] hover:bg-[#44403C] border-[#44403C] text-stone-200 hover:text-white h-7 px-2 text-xs"
                            title="Editar produto"
                          >
                            <Edit3 className="w-3.5 h-3.5 mr-1 text-amber-500" />
                            Editar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DE CRIAÇÃO / EDIÇÃO */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="w-[calc(100%-1rem)] sm:max-w-lg bg-[#292524] border-[#44403C] text-stone-100 p-4 sm:p-6 pb-20 sm:pb-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-stone-100 flex items-center gap-2">
              <PackagePlus className="w-5 h-5 text-amber-500" />
              {editingProduct ? `Editar Produto: ${editingProduct.name}` : 'Cadastrar Novo Produto'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 pt-2 text-xs">
            {/* Foto do Produto (Upload com Compressão) */}
            <div className="p-3.5 rounded-xl bg-[#1C1917] border border-[#44403C] space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-stone-200 font-bold flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-amber-500" />
                    Foto do Produto (Apenas no Cardápio On-line)
                  </Label>
                  <p className="text-[11px] text-stone-400 mt-0.5">
                    Comprimida no navegador (~50KB, máx. 800px) e exibida exclusivamente no QR Code
                    das mesas.
                  </p>
                </div>
                {imageCompressedSizeKb !== null && (
                  <Badge
                    variant="outline"
                    className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px]"
                  >
                    {imageCompressedSizeKb} KB
                  </Badge>
                )}
              </div>

              {imagePreviewUrl ? (
                <div className="flex items-center gap-3 p-2 rounded-lg bg-[#292524] border border-[#44403C]">
                  <div className="w-16 h-16 rounded-lg overflow-hidden bg-stone-900 border border-stone-700 flex-shrink-0 relative">
                    <img
                      src={imagePreviewUrl}
                      alt="Preview do produto"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-stone-200 truncate">
                      {selectedFileToUpload ? 'Nova foto selecionada' : 'Foto atual salva'}
                    </div>
                    <p className="text-[10px] text-stone-400 mt-0.5">
                      {selectedFileToUpload
                        ? 'Será enviada e vinculada ao salvar.'
                        : 'Exibida no cardápio público dos clientes.'}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <label className="cursor-pointer text-[11px] text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1">
                        <UploadCloud className="w-3.5 h-3.5" />
                        Substituir Foto
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={handleRemovePhoto}
                        className="text-[11px] text-red-400 hover:text-red-300 font-semibold flex items-center gap-1 ml-2"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Remover Foto
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <label className="border-2 border-dashed border-[#44403C] hover:border-amber-500/60 transition-colors rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer bg-[#292524]/50 group">
                  <div className="p-2 rounded-full bg-[#1C1917] group-hover:bg-amber-500/20 text-stone-400 group-hover:text-amber-400 transition-colors">
                    {isUploadingImage ? (
                      <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
                    ) : (
                      <UploadCloud className="w-5 h-5" />
                    )}
                  </div>
                  <span className="text-xs font-semibold text-stone-300 mt-2">
                    {isUploadingImage
                      ? 'Comprimindo foto...'
                      : 'Clique para selecionar foto do dispositivo'}
                  </span>
                  <span className="text-[10px] text-stone-500 mt-0.5">
                    PNG, JPG, WebP (auto-redimensionada e comprimida para ~50 KB)
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    disabled={isUploadingImage}
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {/* Nome */}
            <div>
              <Label className="text-stone-300 font-semibold mb-1 block">Nome do Produto *</Label>
              <Input
                required
                value={formNome}
                onChange={(e) => setFormNome(e.target.value)}
                placeholder="Ex: Cerveja IPA Artesanal 500ml"
                className="bg-[#1C1917] border-[#44403C] text-stone-100 text-xs h-9"
              />
            </div>

            {/* Categoria & Área de Preparo */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-stone-300 font-semibold mb-1 block">Categoria *</Label>
                <select
                  value={formCategoria}
                  onChange={(e) => {
                    const newCat = e.target.value as ProductCategory
                    setFormCategoria(newCat)
                    // Auto sugere a área de preparo se ainda não alterada manualmente
                    if (['Cervejas', 'Drinks', 'Destilados', 'Refrigerantes'].includes(newCat)) {
                      setFormAreaPreparo('bar')
                    } else {
                      setFormAreaPreparo('cozinha')
                    }
                  }}
                  className="w-full bg-[#1C1917] border border-[#44403C] rounded-lg px-3 py-2 text-xs text-stone-100 focus:outline-none focus:border-amber-500"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-stone-300 font-semibold mb-1 block">
                  Praça de Preparo (KDS) *
                </Label>
                <select
                  value={formAreaPreparo}
                  onChange={(e) => setFormAreaPreparo(e.target.value as AreaPreparo)}
                  className="w-full bg-[#1C1917] border border-[#44403C] rounded-lg px-3 py-2 text-xs text-stone-100 focus:outline-none focus:border-amber-500"
                >
                  <option value="bar">Bar (Bebidas, Chopp, Coquetéis)</option>
                  <option value="cozinha">Cozinha (Petiscos, Porções, Pratos)</option>
                </select>
              </div>
            </div>

            {/* Preço de Venda & Unidade */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-stone-300 font-semibold mb-1 block">
                  Preço de Venda (R$) *
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-stone-400 font-bold">R$</span>
                  <Input
                    required
                    type="number"
                    step="0.01"
                    min="0"
                    value={formPreco}
                    onChange={(e) => setFormPreco(e.target.value)}
                    className="pl-9 bg-[#1C1917] border-[#44403C] text-stone-100 text-xs h-9 font-bold text-amber-400"
                  />
                </div>
              </div>

              <div>
                <Label className="text-stone-300 font-semibold mb-1 block">
                  Unidade de Medida *
                </Label>
                <select
                  value={formUnidade}
                  onChange={(e) => setFormUnidade(e.target.value as StockUnit)}
                  className="w-full bg-[#1C1917] border border-[#44403C] rounded-lg px-3 py-2 text-xs text-stone-100 focus:outline-none focus:border-amber-500"
                >
                  {UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u} (
                      {u === 'un' ? 'Unidade' : u === 'kg' ? 'Quilos' : u === 'L' ? 'Litros' : u})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Estoque Inicial & Mínimo */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-stone-300 font-semibold mb-1 block">
                  Estoque Inicial / Atual
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formEstoque}
                  onChange={(e) => setFormEstoque(e.target.value)}
                  className="bg-[#1C1917] border-[#44403C] text-stone-100 text-xs h-9"
                />
              </div>

              <div>
                <Label className="text-stone-300 font-semibold mb-1 block">
                  Estoque Mínimo (Alerta)
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formEstoqueMinimo}
                  onChange={(e) => setFormEstoqueMinimo(e.target.value)}
                  className="bg-[#1C1917] border-[#44403C] text-stone-100 text-xs h-9"
                />
              </div>
            </div>

            {/* Descrição */}
            <div>
              <Label className="text-stone-300 font-semibold mb-1 block">
                Descrição no Cardápio (Opcional)
              </Label>
              <textarea
                rows={2}
                value={formDescricao}
                onChange={(e) => setFormDescricao(e.target.value)}
                placeholder="Ex: Cerveja artesanal estilo IPA, 500ml, lúpulo cítrico e amargor marcante."
                className="w-full bg-[#1C1917] border border-[#44403C] rounded-lg p-2 text-xs text-stone-100 focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Toggle Ativo */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#1C1917] border border-[#44403C]">
              <div>
                <Label className="text-stone-200 font-semibold cursor-pointer">
                  Produto Ativo para Vendas
                </Label>
                <p className="text-[11px] text-stone-400">
                  Produtos inativos ficam ocultos no cardápio e não podem ser adicionados em
                  comandas.
                </p>
              </div>
              <Switch
                checked={formAtivo}
                onCheckedChange={setFormAtivo}
                className="data-[state=checked]:bg-emerald-500"
              />
            </div>

            {/* Rodapé com Ações */}
            <div className="flex justify-end gap-2 pt-3 border-t border-[#44403C]">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setModalOpen(false)}
                className="text-stone-400 text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !formNome.trim()}
                className="bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold text-xs"
              >
                {isSubmitting
                  ? 'Salvando...'
                  : editingProduct
                    ? 'Salvar Alterações'
                    : 'Cadastrar Produto'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
