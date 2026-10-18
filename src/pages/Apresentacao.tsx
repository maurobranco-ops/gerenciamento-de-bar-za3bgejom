import React from 'react'
import {
  FileText,
  Printer,
  Beer,
  UtensilsCrossed,
  QrCode,
  ChefHat,
  Boxes,
  BadgeDollarSign,
  FileSpreadsheet,
  ReceiptText,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export default function Apresentacao() {
  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="space-y-6 animate-fade-in-up max-w-5xl mx-auto">
      {/* Botões de Ação e Cabeçalho - Ocultos na Impressão */}
      <div className="no-print p-5 rounded-2xl bg-[#292524] border border-[#44403C] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-500">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-stone-100 flex items-center gap-2">
                Apresentação Institucional
                <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/40 text-xs font-bold">
                  Exclusivo Gerente
                </Badge>
              </h2>
              <p className="text-xs text-stone-400 mt-1">
                Resumo oficial de funcionalidades do Rachide Bar formatado para apresentação a
                clientes e parceiros.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={handlePrint}
            className="bg-amber-500 hover:bg-amber-600 text-stone-950 font-black text-xs px-5 shadow-md shadow-amber-950/40 flex items-center gap-2 h-10"
          >
            <Printer className="w-4 h-4" />
            Exportar PDF
          </Button>
        </div>
      </div>

      {/* DOCUMENTO PRINCIPAL - Formato com tema escuro na tela e limpo/claro no PDF (@media print) */}
      <article
        id="documento-apresentacao"
        className="p-6 md:p-10 rounded-2xl bg-[#292524] border border-[#44403C] shadow-lg text-stone-100 print:p-0 print:border-none print:shadow-none print:bg-white print:text-neutral-900"
      >
        {/* Topo / Capa do Documento */}
        <header className="border-b border-[#44403C] pb-6 mb-8 print:border-neutral-300 print:pb-6 print:mb-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-stone-950 shadow-md print:bg-neutral-900 print:text-white print:shadow-none">
                <Beer className="w-7 h-7 fill-current" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-stone-100 print:text-neutral-900">
                  Rachide <span className="text-amber-500 print:text-amber-700">Bar</span>
                </h1>
                <p className="text-sm font-semibold text-stone-300 print:text-neutral-700 mt-0.5">
                  Sistema de Gestão para Bares e Restaurantes
                </p>
              </div>
            </div>

            <div className="text-right">
              <Badge
                variant="outline"
                className="bg-[#1C1917] text-amber-400 border-amber-500/40 text-xs py-1 px-3 print:bg-neutral-100 print:text-neutral-800 print:border-neutral-300"
              >
                Resumo de Funcionalidades
              </Badge>
              <div className="text-[11px] text-stone-400 print:text-neutral-500 mt-1">
                Documento Oficial de Apresentação
              </div>
            </div>
          </div>
        </header>

        {/* Seção 1: Visão Geral */}
        <section className="mb-8 print:mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-5 h-5 text-amber-500 print:text-amber-700 flex-shrink-0" />
            <h2 className="text-lg font-bold text-amber-400 print:text-neutral-900 tracking-wide uppercase text-sm">
              Visão Geral
            </h2>
          </div>
          <p className="text-sm leading-relaxed text-stone-300 print:text-neutral-800 bg-[#1C1917]/70 p-4 rounded-xl border border-[#44403C]/70 print:bg-neutral-50 print:border-neutral-200">
            Sistema completo de gestão para bares, com atendimento por mesas (comandas), pedido
            on-line via QR Code, controle de estoque fracionado, fluxo de caixa, relatórios
            gerenciais e módulo fiscal. Operação em três perfis de acesso com permissões próprias:{' '}
            <strong>Garçom</strong>, <strong>Caixa</strong> e <strong>Gerente</strong>.
          </p>
        </section>

        {/* Grid de Funcionalidades */}
        <div className="space-y-6 print:space-y-5">
          {/* Atendimento e Comandas */}
          <section className="p-5 rounded-xl bg-[#1C1917]/50 border border-[#44403C]/60 print:bg-transparent print:border-neutral-200 print:p-3 print:break-inside-avoid">
            <div className="flex items-center gap-2.5 mb-2.5">
              <UtensilsCrossed className="w-4 h-4 text-amber-500 print:text-amber-700" />
              <h3 className="text-base font-bold text-stone-100 print:text-neutral-900">
                Atendimento e Comandas
              </h3>
            </div>
            <ul className="space-y-1.5 text-xs sm:text-sm text-stone-300 print:text-neutral-800 pl-1">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-amber-500/80 print:text-amber-700 flex-shrink-0 mt-0.5" />
                <span>Abertura e fechamento de comandas por mesa, com status visual do salão.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-amber-500/80 print:text-amber-700 flex-shrink-0 mt-0.5" />
                <span>Lançamento de itens com observações, baixa automática de estoque.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-amber-500/80 print:text-amber-700 flex-shrink-0 mt-0.5" />
                <span>Taxa de serviço configurável, divisão de conta por pessoas.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-amber-500/80 print:text-amber-700 flex-shrink-0 mt-0.5" />
                <span>
                  Múltiplas formas de pagamento: Dinheiro, Cartão (débito/crédito), Pix e TEP.
                </span>
              </li>
            </ul>
          </section>

          {/* Pedido On-line (QR Code) */}
          <section className="p-5 rounded-xl bg-[#1C1917]/50 border border-[#44403C]/60 print:bg-transparent print:border-neutral-200 print:p-3 print:break-inside-avoid">
            <div className="flex items-center gap-2.5 mb-2.5">
              <QrCode className="w-4 h-4 text-amber-500 print:text-amber-700" />
              <h3 className="text-base font-bold text-stone-100 print:text-neutral-900">
                Pedido On-line (QR Code)
              </h3>
            </div>
            <ul className="space-y-1.5 text-xs sm:text-sm text-stone-300 print:text-neutral-800 pl-1">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-amber-500/80 print:text-amber-700 flex-shrink-0 mt-0.5" />
                <span>
                  Cardápio digital no celular do cliente, acessado por QR Code da mesa — sem
                  instalar aplicativo.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-amber-500/80 print:text-amber-700 flex-shrink-0 mt-0.5" />
                <span>
                  Fotos dos produtos, carrinho com observações e envio direto para a comanda da
                  mesa.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-amber-500/80 print:text-amber-700 flex-shrink-0 mt-0.5" />
                <span>Cobrança via Pix (QR Code na tela do cliente).</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-amber-500/80 print:text-amber-700 flex-shrink-0 mt-0.5" />
                <span>
                  Acompanhamento do pedido em tempo real: o cliente vê cada etapa — Pedido
                  Confirmado → Em preparo → Pronto → Entregue — com tempo de espera e alerta sonoro
                  quando o pedido fica pronto.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-amber-500/80 print:text-amber-700 flex-shrink-0 mt-0.5" />
                <span>Impressão de Display de Mesa com QR Code escaneável para cada mesa.</span>
              </li>
            </ul>
          </section>

          {/* Fila de Cozinha e Bar (KDS) */}
          <section className="p-5 rounded-xl bg-[#1C1917]/50 border border-[#44403C]/60 print:bg-transparent print:border-neutral-200 print:p-3 print:break-inside-avoid">
            <div className="flex items-center gap-2.5 mb-2.5">
              <ChefHat className="w-4 h-4 text-amber-500 print:text-amber-700" />
              <h3 className="text-base font-bold text-stone-100 print:text-neutral-900">
                Fila de Cozinha e Bar (KDS)
              </h3>
            </div>
            <ul className="space-y-1.5 text-xs sm:text-sm text-stone-300 print:text-neutral-800 pl-1">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-amber-500/80 print:text-amber-700 flex-shrink-0 mt-0.5" />
                <span>
                  Painel Kanban: Pendente → Preparando → Pronto → Entregue, com avanço em um clique.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-amber-500/80 print:text-amber-700 flex-shrink-0 mt-0.5" />
                <span>
                  Separação por praça de preparo (Cozinha / Bar) conforme o cadastro do produto.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-amber-500/80 print:text-amber-700 flex-shrink-0 mt-0.5" />
                <span>
                  Tempo decorrido por pedido, observações em destaque e badge de &quot;Pedido
                  On-line&quot;.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-amber-500/80 print:text-amber-700 flex-shrink-0 mt-0.5" />
                <span>
                  Impressão térmica 80mm de comandas da cozinha, com modo impressora automática.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-amber-500/80 print:text-amber-700 flex-shrink-0 mt-0.5" />
                <span>
                  Notificações sonoras e visuais de novos pedidos, restritas às telas operacionais.
                </span>
              </li>
            </ul>
          </section>

          {/* Estoque */}
          <section className="p-5 rounded-xl bg-[#1C1917]/50 border border-[#44403C]/60 print:bg-transparent print:border-neutral-200 print:p-3 print:break-inside-avoid">
            <div className="flex items-center gap-2.5 mb-2.5">
              <Boxes className="w-4 h-4 text-amber-500 print:text-amber-700" />
              <h3 className="text-base font-bold text-stone-100 print:text-neutral-900">Estoque</h3>
            </div>
            <ul className="space-y-1.5 text-xs sm:text-sm text-stone-300 print:text-neutral-800 pl-1">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-amber-500/80 print:text-amber-700 flex-shrink-0 mt-0.5" />
                <span>
                  Controle fracionado: compra em caixa/fardo, venda em unidade, com cálculo
                  automático.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-amber-500/80 print:text-amber-700 flex-shrink-0 mt-0.5" />
                <span>
                  Alertas de estoque mínimo e histórico imutável de movimentações (segurança no
                  banco).
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-amber-500/80 print:text-amber-700 flex-shrink-0 mt-0.5" />
                <span>
                  Cadastro completo: categoria, unidade, estoque atual/mínimo, praça de preparo.
                </span>
              </li>
            </ul>
          </section>

          {/* Caixa e Financeiro */}
          <section className="p-5 rounded-xl bg-[#1C1917]/50 border border-[#44403C]/60 print:bg-transparent print:border-neutral-200 print:p-3 print:break-inside-avoid">
            <div className="flex items-center gap-2.5 mb-2.5">
              <BadgeDollarSign className="w-4 h-4 text-amber-500 print:text-amber-700" />
              <h3 className="text-base font-bold text-stone-100 print:text-neutral-900">
                Caixa e Financeiro
              </h3>
            </div>
            <ul className="space-y-1.5 text-xs sm:text-sm text-stone-300 print:text-neutral-800 pl-1">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-amber-500/80 print:text-amber-700 flex-shrink-0 mt-0.5" />
                <span>Abertura e fechamento de caixa com conferência por forma de pagamento.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-amber-500/80 print:text-amber-700 flex-shrink-0 mt-0.5" />
                <span>
                  Fluxo de caixa com entradas, saídas e saldo, filtros por tipo, período e forma de
                  pagamento.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-amber-500/80 print:text-amber-700 flex-shrink-0 mt-0.5" />
                <span>Exportação CSV no padrão Excel brasileiro.</span>
              </li>
            </ul>
          </section>

          {/* Relatórios Gerenciais (DRE) */}
          <section className="p-5 rounded-xl bg-[#1C1917]/50 border border-[#44403C]/60 print:bg-transparent print:border-neutral-200 print:p-3 print:break-inside-avoid">
            <div className="flex items-center gap-2.5 mb-2.5">
              <FileSpreadsheet className="w-4 h-4 text-amber-500 print:text-amber-700" />
              <h3 className="text-base font-bold text-stone-100 print:text-neutral-900">
                Relatórios Gerenciais (DRE)
              </h3>
            </div>
            <ul className="space-y-1.5 text-xs sm:text-sm text-stone-300 print:text-neutral-800 pl-1">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-amber-500/80 print:text-amber-700 flex-shrink-0 mt-0.5" />
                <span>
                  Demonstração do Resultado do Exercício com períodos comparáveis (hoje, 7/30 dias,
                  meses, intervalo personalizado).
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-amber-500/80 print:text-amber-700 flex-shrink-0 mt-0.5" />
                <span>Comparativo entre períodos com variação percentual linha a linha.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-amber-500/80 print:text-amber-700 flex-shrink-0 mt-0.5" />
                <span>
                  Dashboard com faturamento, ticket médio, comandas abertas, estoque crítico, formas
                  de pagamento e produtos mais vendidos.
                </span>
              </li>
            </ul>
          </section>

          {/* Módulo Fiscal */}
          <section className="p-5 rounded-xl bg-[#1C1917]/50 border border-[#44403C]/60 print:bg-transparent print:border-neutral-200 print:p-3 print:break-inside-avoid">
            <div className="flex items-center gap-2.5 mb-2.5">
              <ReceiptText className="w-4 h-4 text-amber-500 print:text-amber-700" />
              <h3 className="text-base font-bold text-stone-100 print:text-neutral-900">
                Módulo Fiscal
              </h3>
            </div>
            <ul className="space-y-1.5 text-xs sm:text-sm text-stone-300 print:text-neutral-800 pl-1">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-amber-500/80 print:text-amber-700 flex-shrink-0 mt-0.5" />
                <span>
                  Fluxo completo de NFC-e/NF-e (emissão, autorização, cancelamento, DANFE 80mm) com
                  dados do emitente configuráveis.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 print:text-neutral-700 flex-shrink-0 mt-0.5" />
                <span className="text-amber-300/90 print:text-neutral-800">
                  ⚠️ Emissão simulada (sem valor legal). Preparado para integração com emissor
                  oficial via API — para valor perante a Receita, requer certificado digital e
                  credenciamento na SEFAZ (Paraíba: NFC-e obrigatória desde 2017).
                </span>
              </li>
            </ul>
          </section>

          {/* Gestão e Segurança */}
          <section className="p-5 rounded-xl bg-[#1C1917]/50 border border-[#44403C]/60 print:bg-transparent print:border-neutral-200 print:p-3 print:break-inside-avoid">
            <div className="flex items-center gap-2.5 mb-2.5">
              <ShieldCheck className="w-4 h-4 text-amber-500 print:text-amber-700" />
              <h3 className="text-base font-bold text-stone-100 print:text-neutral-900">
                Gestão e Segurança
              </h3>
            </div>
            <ul className="space-y-1.5 text-xs sm:text-sm text-stone-300 print:text-neutral-800 pl-1">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-amber-500/80 print:text-amber-700 flex-shrink-0 mt-0.5" />
                <span>
                  Login real por usuário, com perfis e permissões aplicadas no banco de dados
                  (Supabase).
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-amber-500/80 print:text-amber-700 flex-shrink-0 mt-0.5" />
                <span>
                  Tela de Usuários (Gerente): criar contas, definir perfil e redefinir senhas.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-amber-500/80 print:text-amber-700 flex-shrink-0 mt-0.5" />
                <span>
                  Tela de Configurações: taxa de serviço/entrega, dados do emitente fiscal e
                  impressoras.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-amber-500/80 print:text-amber-700 flex-shrink-0 mt-0.5" />
                <span>
                  Mesas expansíveis: adicionar/editar mesas a qualquer momento, sem limites fixos.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-amber-500/80 print:text-amber-700 flex-shrink-0 mt-0.5" />
                <span>
                  Banco de dados na nuvem (Supabase): dados persistem entre dispositivos e sessões.
                </span>
              </li>
            </ul>
          </section>
        </div>

        {/* Rodapé do Documento */}
        <footer className="mt-10 pt-6 border-t border-[#44403C] flex items-center justify-between text-xs text-stone-400 print:text-neutral-500 print:border-neutral-300 print:mt-8">
          <div>
            <strong>Rachide Bar</strong> — v1.4.1
          </div>
          <div>Sistema de Gestão para Bares e Restaurantes</div>
        </footer>
      </article>

      {/* Regras CSS dedicadas para @media print */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 15mm 15mm 15mm 15mm;
          }
          body {
            background-color: #ffffff !important;
            color: #171717 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          header, aside, nav, footer, .no-print, [role="dialog"], section[aria-label="Notifications alt+T"] {
            display: none !important;
          }
          main {
            margin: 0 !important;
            padding: 0 !important;
            max-width: 100% !important;
            width: 100% !important;
          }
          #documento-apresentacao {
            background-color: #ffffff !important;
            color: #171717 !important;
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
        }
      `}</style>
    </div>
  )
}
