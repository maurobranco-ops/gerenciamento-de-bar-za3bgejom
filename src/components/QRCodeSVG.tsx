import React, { useEffect, useState } from 'react'
import QRCode from 'qrcode'

interface QRCodeSVGProps {
  value: string
  size?: number
  className?: string
  margin?: number
}

/**
 * Componente para renderizar QR Code REAL e escaneável em SVG.
 * Utiliza o algoritmo padrão do pacote `qrcode` com correção de erro de nível M.
 */
export function QRCodeSVG({ value, size = 180, className = '', margin = 2 }: QRCodeSVGProps) {
  const [svgString, setSvgString] = useState<string>('')

  useEffect(() => {
    let isMounted = true

    if (!value) {
      setSvgString('')
      return
    }

    QRCode.toString(value, {
      type: 'svg',
      width: size,
      margin: margin,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#1C1917',
        light: '#FFFFFF',
      },
    })
      .then((svg) => {
        if (isMounted) {
          setSvgString(svg)
        }
      })
      .catch((err) => {
        console.error('Erro ao gerar SVG do QR Code:', err)
      })

    return () => {
      isMounted = false
    }
  }, [value, size, margin])

  if (!svgString) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`flex items-center justify-center bg-white rounded-xl shadow-md ${className}`}
      >
        <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div
      className={`inline-flex items-center justify-center rounded-xl bg-white p-2 shadow-md overflow-hidden ${className}`}
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: svgString }}
    />
  )
}

/**
 * Função utilitária para gerar Data URL (PNG) ou SVG string de QR code real,
 * útil para janelas de impressão ou tags <img>.
 */
export async function generateQRCodeDataURL(
  value: string,
  options?: QRCode.QRCodeToDataURLOptions,
): Promise<string> {
  return QRCode.toDataURL(value, {
    margin: 2,
    width: options?.width || 300,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#1C1917',
      light: '#FFFFFF',
    },
    ...options,
  })
}

export async function generateQRCodeSVGString(
  value: string,
  options?: QRCode.QRCodeToStringOptions,
): Promise<string> {
  return QRCode.toString(value, {
    type: 'svg',
    margin: 2,
    width: options?.width || 300,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#1C1917',
      light: '#FFFFFF',
    },
    ...options,
  })
}
