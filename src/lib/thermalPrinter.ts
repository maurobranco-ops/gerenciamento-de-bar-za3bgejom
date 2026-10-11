import { Comanda, FilaCozinhaItem, BarSettings } from '../types/bar'

/**
 * Utilitário de Impressão Térmica 80mm para Cozinha, Bar e Conta de Comanda.
 * Utiliza janela oculta/popup com window.print() estilizada com tipografia monoespaçada
 * de alta legibilidade, cabeçalhos, tracejados característicos e corte de papel.
 */

interface PrintKitchenTicketOptions {
  item: FilaCozinhaItem
  settings?: BarSettings
  printerName?: string
}

interface PrintComandaTicketOptions {
  comanda: Comanda
  settings?: BarSettings
  subtotal: number
  taxaServico: number
  taxaPercentual: number
  total: number
}

function openPrintWindow(htmlContent: string, title = 'Impressão de Comanda') {
  const printWindow = window.open('', '_blank', 'width=380,height=600')
  if (!printWindow) {
    console.warn('Bloqueador de popups impediu a janela de impressão.')
    return false
  }

  printWindow.document.open()
  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8" />
      <title>${title}</title>
      <style>
        @page {
          size: 80mm auto;
          margin: 3mm;
        }
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        body {
          font-family: 'Courier New', Courier, monospace, monospace;
          width: 74mm;
          margin: 0 auto;
          font-size: 12px;
          line-height: 1.25;
          color: #000;
          background: #fff;
          padding: 4mm 2mm;
        }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .font-bold { font-weight: bold; }
        .font-black { font-weight: 900; }
        .uppercase { text-transform: uppercase; }
        .divider {
          border-top: 1px dashed #000;
          margin: 6px 0;
        }
        .double-divider {
          border-top: 2px solid #000;
          margin: 6px 0;
        }
        .header-title {
          font-size: 16px;
          font-weight: 900;
          letter-spacing: 1px;
        }
        .header-sub {
          font-size: 10px;
          margin-top: 2px;
        }
        .badge {
          display: inline-block;
          border: 1px solid #000;
          padding: 2px 6px;
          font-size: 12px;
          font-weight: bold;
          margin: 4px 0;
        }
        .item-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 4px;
        }
        .item-name {
          flex: 1;
          word-break: break-word;
        }
        .item-obs {
          font-size: 11px;
          font-style: italic;
          margin-left: 12px;
          margin-top: 2px;
          padding: 2px 4px;
          border-left: 2px solid #000;
        }
        .big-mesa {
          font-size: 20px;
          font-weight: 900;
          border: 2px solid #000;
          padding: 4px 8px;
          display: inline-block;
          margin: 4px auto;
        }
        .cut-line {
          margin-top: 12px;
          border-top: 1px dotted #888;
          text-align: center;
          font-size: 9px;
          padding-top: 4px;
        }
      </style>
    </head>
    <body>
      ${htmlContent}
      <script>
        window.onload = function() {
          window.focus();
          window.print();
          setTimeout(function() {
            window.close();
          }, 800);
        };
      </script>
    </body>
    </html>
  `)
  printWindow.document.close()
  return true
}

/**
 * Imprime ticket da comanda de cozinha/bar para um item específico
 */
export function printKitchenTicket({ item, settings }: PrintKitchenTicketOptions) {
  const areaName = item.areaPreparo === 'cozinha' ? 'COZINHA' : 'BAR / BEBIDAS'
  const timeFormatted = new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(item.createdAt || Date.now()))

  const html = `
    <div class="text-center">
      <div class="header-title">${settings?.nomeFantasia || 'RACHIDE BAR'}</div>
      <div class="header-sub">PEDIDO DE PREPARO • VIA ${areaName}</div>
      <div class="divider"></div>
      
      <div class="big-mesa">MESA ${item.mesaNumero ?? '??'}</div>
      
      ${item.clienteNome ? `<div class="font-bold">Cliente: ${item.clienteNome}</div>` : ''}
      ${item.origemOnline ? `<div class="badge">★ PEDIDO ON-LINE (QR CODE) ★</div>` : ''}
      
      <div class="header-sub">Hora do Pedido: ${timeFormatted}</div>
      <div class="divider"></div>
    </div>

    <div style="margin: 8px 0;">
      <div class="item-row font-black" style="font-size: 15px;">
        <span style="min-width: 28px;">${item.quantidade ?? 1}x</span>
        <span class="item-name">${item.nomeProduto || 'Item do Pedido'}</span>
      </div>
      ${
        item.observacoes
          ? `<div class="item-obs"><strong>OBS:</strong> ${item.observacoes}</div>`
          : ''
      }
    </div>

    <div class="divider"></div>
    <div class="text-center" style="font-size: 10px;">
      <div>Status: ${item.status.toUpperCase()}</div>
      <div>Item #${(item.id || '').substring(0, 8)}</div>
      <div class="cut-line">-- CORTE DA BOBINA TÉRMICA 80MM --</div>
    </div>
  `

  return openPrintWindow(html, `Ticket Cozinha - Mesa ${item.mesaNumero}`)
}

/**
 * Imprime conta / conferência de mesa completa
 */
export function printComandaAccount({
  comanda,
  settings,
  subtotal,
  taxaServico,
  taxaPercentual,
  total,
}: PrintComandaTicketOptions) {
  const now = new Date()
  const dateFormatted = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(now)

  const itemsHtml = comanda.items
    .map((i) => {
      const itemTot = (i.price * i.quantity).toFixed(2)
      return `
      <div style="margin-bottom: 4px;">
        <div class="item-row">
          <span style="min-width: 24px; font-weight: bold;">${i.quantity}x</span>
          <span class="item-name">${i.name}</span>
          <span class="font-bold">R$ ${itemTot}</span>
        </div>
        ${i.observations ? `<div class="item-obs">Obs: ${i.observations}</div>` : ''}
      </div>
    `
    })
    .join('')

  const html = `
    <div class="text-center">
      <div class="header-title">${settings?.nomeFantasia || 'RACHIDE BAR'}</div>
      <div style="font-size: 10px;">${settings?.razaoSocial || 'Rachide Bar & Petiscaria EIRELI'}</div>
      <div style="font-size: 9px;">CNPJ: ${settings?.cnpj || '14.293.842/0001-84'}</div>
      <div style="font-size: 9px;">${settings?.enderecoCompleto || 'Rua dos Boêmios, 142 - SP'}</div>
      <div style="font-size: 9px;">Tel: ${settings?.telefone || '(11) 3849-2041'}</div>
      
      <div class="double-divider"></div>
      <div class="font-bold" style="font-size: 13px;">CONFERÊNCIA DE CONTA (NÃO É DOCUMENTO FISCAL)</div>
      <div class="divider"></div>
      
      <div class="big-mesa">MESA ${comanda.tableNumber}</div>
      ${comanda.clientName ? `<div><strong>Cliente:</strong> ${comanda.clientName}</div>` : ''}
      <div><strong>Pessoas:</strong> ${comanda.guestCount || 1} &bull; <strong>Data:</strong> ${dateFormatted}</div>
      <div class="divider"></div>
    </div>

    <div style="margin: 8px 0;">
      <div class="item-row font-bold" style="font-size: 10px; border-bottom: 1px solid #000; padding-bottom: 2px;">
        <span>QTD ITEM</span>
        <span>TOTAL</span>
      </div>
      ${itemsHtml || '<div class="text-center">Nenhum item consumido</div>'}
    </div>

    <div class="divider"></div>

    <div style="margin-top: 6px;">
      <div class="item-row">
        <span>Subtotal:</span>
        <span class="font-bold">R$ ${subtotal.toFixed(2)}</span>
      </div>
      <div class="item-row">
        <span>Serviço (${taxaPercentual}%):</span>
        <span class="font-bold">${taxaServico > 0 ? `+ R$ ${taxaServico.toFixed(2)}` : 'R$ 0,00'}</span>
      </div>
      <div class="double-divider"></div>
      <div class="item-row font-black" style="font-size: 16px;">
        <span>TOTAL A PAGAR:</span>
        <span>R$ ${total.toFixed(2)}</span>
      </div>
      ${
        comanda.guestCount > 1
          ? `
        <div class="item-row" style="font-size: 11px; margin-top: 4px;">
          <span>Divisão (${comanda.guestCount} pess.):</span>
          <span class="font-bold">R$ ${(total / comanda.guestCount).toFixed(2)} / cada</span>
        </div>
      `
          : ''
      }
    </div>

    <div class="divider"></div>
    <div class="text-center" style="font-size: 10px; margin-top: 8px;">
      <div>Agradecemos a preferência!</div>
      <div style="margin-top: 4px;">Para solicitar Nota Fiscal informe seu CPF ao caixa.</div>
      <div class="cut-line">-- OBRIGADO • VOLTE SEMPRE --</div>
    </div>
  `

  return openPrintWindow(html, `Conta Mesa ${comanda.tableNumber} - Rachide Bar`)
}
