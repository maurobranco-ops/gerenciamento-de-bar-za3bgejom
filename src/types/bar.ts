export type UserRole = 'Garçom' | 'Caixa' | 'Gerente' | 'Cozinha'

export type TableStatus = 'Livre' | 'Ocupada' | 'Aguardando Pagamento' | 'Fechada'

export type ProductCategory =
  | 'Cervejas'
  | 'Petiscos'
  | 'Destilados'
  | 'Refrigerantes'
  | 'Porções'
  | 'Drinks'

export type StockUnit = 'un' | 'kg' | 'L' | 'g' | 'ml'

export type AreaPreparo = 'bar' | 'cozinha'

export type KitchenStatus = 'pendente' | 'preparando' | 'pronto' | 'entregue'

export interface MenuItem {
  id: string
  name: string
  category: ProductCategory
  price: number
  description: string
  unit: StockUnit
  stock: number // e.g., 24 un or 2.5 kg
  minStock: number
  areaPreparo?: AreaPreparo
  ativo?: boolean
  imageUrl?: string
}

export interface FilaCozinhaItem {
  id: string
  comandaItemId?: string
  areaPreparo: AreaPreparo
  status: KitchenStatus
  observacoes?: string
  origemOnline?: boolean
  createdAt: string
  updatedAt: string
  // Dados enriquecidos da comanda e produto
  nomeProduto?: string
  quantidade?: number
  precoUnitario?: number
  mesaNumero?: number
  clienteNome?: string
  comandaId?: string
}

export interface ComandaItem {
  id: string
  menuItemId: string
  name: string
  price: number
  quantity: number
  observations?: string
  origemOnline?: boolean
}

export type StatusContaCliente =
  | 'nenhum'
  | 'solicitada'
  | 'autorizada'
  | 'em_processamento_pix'
  | 'fechada'
  | 'recusada'

export interface TableRecord {
  id: string
  numero: number
  status: TableStatus
  capacidade: number
  createdAt?: string
  updatedAt?: string
}

export interface Comanda {
  id: string
  tableNumber: number
  clientName?: string
  guestCount: number
  status: TableStatus
  items: ComandaItem[]
  openedAt: string
  closedAt?: string
  includeServiceFee?: boolean
  capacity?: number
  contaSolicitada?: boolean
  contaSolicitadaEm?: string
  formaPagamentoSolicitada?: PaymentMethod
  statusConta?: StatusContaCliente
  motivoRecusaConta?: string
}

export interface DetalhesContaMesa {
  encontrada: boolean
  comandaId?: string
  mesaNumero?: number
  clienteNome?: string
  pessoas?: number
  statusMesa?: TableStatus
  contaSolicitada?: boolean
  contaSolicitadaEm?: string
  formaPagamentoSolicitada?: PaymentMethod
  statusConta?: StatusContaCliente
  motivoRecusaConta?: string
  subtotal?: number
  taxaPercentual?: number
  taxaServico?: number
  incluiTaxaServico?: boolean
  total?: number
  itens?: Array<{
    id: string
    nome_produto: string
    preco_unitario: number
    quantidade: number
    observacoes?: string
    origem_online?: boolean
  }>
  pixChave?: string
  pixBeneficiarioNome?: string
  pixCidade?: string
}

export type PaymentMethod = 'Dinheiro' | 'Cartão Débito' | 'Cartão Crédito' | 'Pix' | 'TEP'

export interface CashMovement {
  id: string
  datetime: string
  description: string
  type: 'Entrada' | 'Saída'
  paymentMethod?: PaymentMethod
  value: number
  user: string
  comandaId?: string
}

export interface StockMovement {
  id: string
  datetime: string
  productId: string
  productName: string
  type: 'Entrada' | 'Saída'
  quantity: number
  unit: StockUnit
  user: string
  supplier?: string
  notes?: string
}

export type FiscalDocType = 'NFC-e' | 'NF-e'

export interface FiscalDocument {
  id: string
  number: string // e.g. "NFC-e 000.001"
  serie: string
  type: FiscalDocType
  issuedAt: string
  value: number
  status: 'Autorizada' | 'Cancelada'
  clientName?: string
  docNumber?: string // CPF/CNPJ
  comandaId?: string
  accessKey?: string
}

export interface CashRegisterDay {
  date: string
  openingBalance: number
  isClosed: boolean
  closedAt?: string
  closedBy?: string
}

export interface BarSettings {
  id: string
  taxaServicoPadrao: number // ex: 10
  taxaEntregaDelivery: number // ex: 7.50
  razaoSocial: string
  nomeFantasia: string
  cnpj: string
  inscricaoEstadual: string
  enderecoCompleto: string
  telefone: string
  impressoraFiscalNome: string
  impressoraFiscalAtiva: boolean
  impressoraCozinhaNome: string
  impressoraCozinhaAtiva: boolean
  pixChave: string
  pixBeneficiarioNome: string
  pixCidade: string
  updatedAt?: string
}
