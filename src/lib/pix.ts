/**
 * Gerador de payload Pix Copia e Cola / BR Code (Padrão EMV QRCPS-MPM do Banco Central do Brasil)
 * Especificações:
 * - ID 00: Payload Format Indicator = "01"
 * - ID 01: Point of Initiation Method = "11" (QR estático com uso múltiplo) ou "12" (dinâmico)
 * - ID 26: Merchant Account Information
 *     - Sub-ID 00: GUI = "BR.GOV.BCB.PIX"
 *     - Sub-ID 01: Chave Pix (chave do recebedor, CNPJ, CPF, e-mail, telefone ou EVP)
 *     - Sub-ID 02: Descrição da cobrança (opcional)
 * - ID 52: Merchant Category Code = "0000"
 * - ID 53: Transaction Currency = "986" (BRL)
 * - ID 54: Transaction Amount = ex: "15.00" (opcional se aberta, obrigatória aqui com valor da comanda)
 * - ID 58: Country Code = "BR"
 * - ID 59: Merchant Name = Nome do recebedor (máx 25 chars, sem acentos por segurança EMV)
 * - ID 60: Merchant City = Cidade do recebedor (máx 15 chars, sem acentos por segurança EMV)
 * - ID 62: Additional Data Field Template
 *     - Sub-ID 05: Reference Label / txid (padrão "***" para QR estático ou identificador alfanumérico)
 * - ID 63: CRC16 = Polinômio 0x1021 (CCITT-FALSE), 4 caracteres hexadecimais maiúsculos
 */

export interface PixPayloadParams {
  pixKey: string
  merchantName: string
  merchantCity: string
  amount: number
  txid?: string
  description?: string
}

/**
 * Remove diacríticos e caracteres especiais para conformidade estrita com o padrão EMV
 */
export function sanitizeEMVString(text: string, maxLength: number): string {
  if (!text) return ''
  // Normaliza NFD e remove marcas diacríticas (acentos, cedilha, til)
  const normalized = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s.,\-_*]/g, '')
    .trim()

  return normalized.substring(0, maxLength)
}

/**
 * Limpa chave Pix CNPJ/CPF/Telefone mantendo apenas dígitos se for puramente numérico com pontuação
 */
export function formatPixKey(rawKey: string): string {
  if (!rawKey) return ''
  const trimmed = rawKey.trim()

  // Se parecer um CNPJ ou CPF formatado (ex: 14.293.842/0001-84 ou 123.456.789-00), remove pontuação
  if (/^\d{2,3}\.?\d{3}\.?\d{3}\/?\d{0,4}-?\d{2}$/.test(trimmed)) {
    return trimmed.replace(/\D/g, '')
  }

  // Se parecer um telefone BR formatado (+55 (11) 99999-9999 ou (11) 99999-9999)
  if (/^(\+?55\s?)?\(?\d{2}\)?\s?\d{4,5}-?\d{4}$/.test(trimmed)) {
    const onlyDigits = trimmed.replace(/\D/g, '')
    return onlyDigits.startsWith('55') ? `+${onlyDigits}` : `+55${onlyDigits}`
  }

  return trimmed
}

/**
 * Formata um campo no formato TLV (Tag, Length de 2 dígitos com zero à esquerda, Value)
 */
export function formatTLV(tag: string, value: string): string {
  const len = value.length.toString().padStart(2, '0')
  return `${tag}${len}${value}`
}

/**
 * Calcula o CRC16-CCITT (Polinômio 0x1021, valor inicial 0xFFFF) conforme especificação EMV
 */
export function calculateCRC16(payload: string): string {
  let crc = 0xffff
  const polynomial = 0x1021

  for (let i = 0; i < payload.length; i++) {
    const charCode = payload.charCodeAt(i)
    crc ^= (charCode & 0xff) << 8
    for (let bit = 0; bit < 8; bit++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ polynomial) & 0xffff
      } else {
        crc = (crc << 1) & 0xffff
      }
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, '0')
}

/**
 * Monta a string completa do Pix Copia e Cola (BR Code)
 */
export function generatePixBRCode(params: PixPayloadParams): string {
  const rawKey = formatPixKey(params.pixKey)
  if (!rawKey) {
    throw new Error('Chave Pix não informada')
  }

  const merchantName = sanitizeEMVString(params.merchantName || 'Rachide Bar', 25) || 'RACHIDE BAR'
  const merchantCity = sanitizeEMVString(params.merchantCity || 'SAO PAULO', 15) || 'SAO PAULO'

  // Tag 00: Payload Format Indicator (fixo "01")
  const id00 = formatTLV('00', '01')

  // Tag 01: Point of Initiation Method ("12" para QR com valor pré-definido ou "11" para reutilizável)
  const id01 = formatTLV('01', '12')

  // Tag 26: Merchant Account Information - PIX
  // Subtag 00: "BR.GOV.BCB.PIX"
  let subtags26 = formatTLV('00', 'BR.GOV.BCB.PIX')
  // Subtag 01: Chave Pix
  subtags26 += formatTLV('01', rawKey)
  // Subtag 02: Descrição (opcional, máx 25 chars)
  if (params.description) {
    const sanitizedDesc = sanitizeEMVString(params.description, 25)
    if (sanitizedDesc) {
      subtags26 += formatTLV('02', sanitizedDesc)
    }
  }
  const id26 = formatTLV('26', subtags26)

  // Tag 52: Merchant Category Code (fixo "0000")
  const id52 = formatTLV('52', '0000')

  // Tag 53: Transaction Currency (986 = Real brasileiro BRL)
  const id53 = formatTLV('53', '986')

  // Tag 54: Transaction Amount (formatado 0.00 com ponto)
  const amountStr = Math.max(0, params.amount).toFixed(2)
  const id54 = formatTLV('54', amountStr)

  // Tag 58: Country Code (fixo "BR")
  const id58 = formatTLV('58', 'BR')

  // Tag 59: Merchant Name (máximo 25 caracteres)
  const id59 = formatTLV('59', merchantName)

  // Tag 60: Merchant City (máximo 15 caracteres)
  const id60 = formatTLV('60', merchantCity)

  // Tag 62: Additional Data Field Template
  // Subtag 05: Reference Label / txid (para estático sem txid específico, o padrão BCB aceita '***')
  const rawTxid = params.txid ? sanitizeEMVString(params.txid, 25) : '***'
  const subtags62 = formatTLV('05', rawTxid || '***')
  const id62 = formatTLV('62', subtags62)

  // Montagem do payload prévio para cálculo do CRC16 (Tag 63 length 04)
  const payloadWithoutCRC = `${id00}${id01}${id26}${id52}${id53}${id54}${id58}${id59}${id60}${id62}6304`

  // Tag 63: CRC16
  const crc = calculateCRC16(payloadWithoutCRC)

  return `${payloadWithoutCRC}${crc}`
}

/**
 * Validação simplificada se os dados Pix do bar estão configurados
 */
export function isPixConfigured(settings?: {
  pixChave?: string
  pixBeneficiarioNome?: string
  pixCidade?: string
}): boolean {
  if (!settings) return false
  const key = (settings.pixChave || '').trim()
  const name = (settings.pixBeneficiarioNome || '').trim()
  const city = (settings.pixCidade || '').trim()
  return key.length > 0 && name.length > 0 && city.length > 0
}
