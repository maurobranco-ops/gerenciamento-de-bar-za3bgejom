import React, { useEffect, useRef, useState, useCallback } from 'react'
import { Camera, X, AlertCircle, RefreshCw, FlipHorizontal, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface QRScannerProps {
  onScan: (scannedText: string) => void
  onClose: () => void
}

declare global {
  interface Window {
    BarcodeDetector?: {
      new (options?: { formats?: string[] }): {
        detect: (image: ImageBitmapSource) => Promise<Array<{ rawValue: string }>>
      }
      getSupportedFormats?: () => Promise<string[]>
    }
    jsQR?: (
      data: Uint8ClampedArray,
      width: number,
      height: number,
      options?: { inversionAttempts?: 'dontInvert' | 'onlyInvert' | 'both' | 'invertFirst' },
    ) => { data: string } | null
  }
}

export function QRScanner({ onScan, onClose }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const detectorRef = useRef<any>(null)
  const isScanningRef = useRef<boolean>(true)

  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment')
  const [fallbackInput, setFallbackInput] = useState<string>('')
  const [showManualInput, setShowManualInput] = useState<boolean>(false)

  // Para garantir suporte universal mesmo em navegadores sem BarcodeDetector nativo,
  // carregamos jsQR de CDN como fallback transparente se BarcodeDetector não existir.
  useEffect(() => {
    if (typeof window !== 'undefined' && !window.BarcodeDetector && !window.jsQR) {
      const script = document.createElement('script')
      script.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js'
      script.async = true
      document.body.appendChild(script)
      return () => {
        if (script.parentNode) {
          script.parentNode.removeChild(script)
        }
      }
    }
  }, [])

  // Inicializa a câmera
  const startCamera = useCallback(async (mode: 'environment' | 'user') => {
    setErrorMessage(null)
    setHasPermission(null)

    // Interrompe stream anterior se houver
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErrorMessage(
        'Seu navegador não oferece suporte direto à câmera web. Use o leitor de fotos ou digite o número da mesa.',
      )
      setHasPermission(false)
      setShowManualInput(true)
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      })

      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.setAttribute('playsinline', 'true')
        await videoRef.current.play()
      }
      setHasPermission(true)
    } catch (err: any) {
      console.warn('Erro ao acessar câmera:', err)
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMessage(
          'Permissão de câmera negada. Habilite o acesso à câmera nas permissões do navegador ou escolha o número da mesa.',
        )
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setErrorMessage('Nenhuma câmera encontrada no seu dispositivo.')
      } else {
        setErrorMessage(
          `Não foi possível iniciar a câmera (${err.message || 'Erro desconhecido'}).`,
        )
      }
      setHasPermission(false)
      setShowManualInput(true)
    }
  }, [])

  // Inicia câmera ao montar
  useEffect(() => {
    isScanningRef.current = true

    if (typeof window !== 'undefined' && window.BarcodeDetector) {
      try {
        detectorRef.current = new window.BarcodeDetector({ formats: ['qr_code'] })
      } catch {
        detectorRef.current = null
      }
    }

    startCamera(facingMode)

    return () => {
      isScanningRef.current = false
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }
    }
  }, [facingMode, startCamera])

  // Loop de detecção contínua por frame
  useEffect(() => {
    if (!hasPermission) return

    let isChecking = false

    const scanFrame = async () => {
      if (!isScanningRef.current) return

      const video = videoRef.current
      if (
        video &&
        video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
        !video.paused &&
        !video.ended
      ) {
        if (!isChecking) {
          isChecking = true
          try {
            // Tentativa 1: BarcodeDetector nativo (Chrome Android / Samsung S23 possui suporte nativo ultra-rápido)
            if (detectorRef.current) {
              const barcodes = await detectorRef.current.detect(video)
              if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                const raw = barcodes[0].rawValue.trim()
                if (raw) {
                  isScanningRef.current = false
                  onScan(raw)
                  return
                }
              }
            } else if (window.jsQR) {
              // Tentativa 2: jsQR fallback via canvas
              let canvas = canvasRef.current
              if (!canvas) {
                canvas = document.createElement('canvas')
                canvasRef.current = canvas
              }
              const width = video.videoWidth
              const height = video.videoHeight
              if (width > 0 && height > 0) {
                canvas.width = width
                canvas.height = height
                const ctx = canvas.getContext('2d', { willReadFrequently: true })
                if (ctx) {
                  ctx.drawImage(video, 0, 0, width, height)
                  const imageData = ctx.getImageData(0, 0, width, height)
                  const code = window.jsQR(imageData.data, imageData.width, imageData.height, {
                    inversionAttempts: 'dontInvert',
                  })
                  if (code && code.data) {
                    const raw = code.data.trim()
                    if (raw) {
                      isScanningRef.current = false
                      onScan(raw)
                      return
                    }
                  }
                }
              }
            }
          } catch {
            // Continua no próximo frame
          } finally {
            isChecking = false
          }
        }
      }

      animationFrameRef.current = requestAnimationFrame(scanFrame)
    }

    animationFrameRef.current = requestAnimationFrame(scanFrame)

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [hasPermission, onScan])

  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))
  }

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (fallbackInput.trim()) {
      onScan(fallbackInput.trim())
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-between p-4 sm:p-6 animate-fade-in text-stone-100">
      {/* Header do Scanner */}
      <div className="w-full max-w-md flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
            <Camera className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-stone-100">Leitor de QR Code</h3>
            <p className="text-[11px] text-stone-400">Aponte para o QR da sua mesa</p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="text-stone-400 hover:text-stone-100 h-9 w-9 p-0 rounded-full bg-stone-900/60"
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Visor da Câmera */}
      <div className="w-full max-w-md my-auto relative flex flex-col items-center">
        {hasPermission === false ? (
          <div className="w-full p-6 rounded-2xl bg-[#292524] border border-red-500/40 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-stone-200">Câmera indisponível</h4>
              <p className="text-xs text-stone-400 mt-1">{errorMessage}</p>
            </div>
            <div className="pt-2 flex flex-col gap-2">
              <Button
                size="sm"
                onClick={() => startCamera(facingMode)}
                className="bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold text-xs"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Tentar Câmera Novamente
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onClose}
                className="border-[#44403C] text-stone-300 text-xs"
              >
                Voltar e escolher pelo número da mesa
              </Button>
            </div>
          </div>
        ) : (
          <div className="relative w-full aspect-square max-w-[340px] rounded-3xl overflow-hidden border-2 border-amber-500/60 shadow-2xl bg-stone-950 flex items-center justify-center">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />

            {/* Overlay com Mira de Enquadramento */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-56 h-56 border-2 border-amber-400 rounded-2xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                {/* Cantoneiras estilizadas */}
                <span className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-amber-400 rounded-tl" />
                <span className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-amber-400 rounded-tr" />
                <span className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-amber-400 rounded-bl" />
                <span className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-amber-400 rounded-br" />

                {/* Linha animada de scanner */}
                <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent absolute top-1/2 -translate-y-1/2 animate-pulse" />
              </div>
            </div>

            <div className="absolute bottom-3 inset-x-0 text-center px-4">
              <span className="bg-stone-900/80 backdrop-blur-sm text-amber-400 text-[11px] font-semibold px-3 py-1 rounded-full border border-amber-500/30">
                Posicione o QR Code no centro
              </span>
            </div>
          </div>
        )}

        {/* Alternar câmera (frontal/traseira) se ativo */}
        {hasPermission === true && (
          <div className="flex items-center gap-3 mt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={toggleFacingMode}
              className="bg-stone-900/80 border-[#44403C] text-stone-200 text-xs h-9 px-3 rounded-xl flex items-center gap-1.5"
            >
              <FlipHorizontal className="w-4 h-4 text-amber-400" />
              Inverter Câmera
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowManualInput((prev) => !prev)}
              className="text-stone-400 hover:text-stone-200 text-xs h-9"
            >
              <Eye className="w-3.5 h-3.5 mr-1" />
              Digitar link/código
            </Button>
          </div>
        )}

        {/* Input manual opcional se a câmera falhar ou para colar URL */}
        {showManualInput && (
          <form
            onSubmit={handleManualSubmit}
            className="w-full mt-4 p-3 rounded-xl bg-[#292524] border border-[#44403C] space-y-2 animate-fade-in"
          >
            <div className="text-[11px] text-stone-400">
              Cole o link do QR Code ou digite a mesa (ex: /pedido/3 ou 3):
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={fallbackInput}
                onChange={(e) => setFallbackInput(e.target.value)}
                placeholder="Ex: https://.../pedido/3 ou apenas 3"
                className="flex-1 bg-stone-900 border border-stone-700 rounded-lg px-3 py-2 text-xs text-stone-100 focus:outline-none focus:border-amber-500"
              />
              <Button
                type="submit"
                size="sm"
                className="bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold text-xs"
              >
                Confirmar
              </Button>
            </div>
          </form>
        )}
      </div>

      {/* Footer com botão de fechar e escolher número */}
      <div className="w-full max-w-md pb-2 text-center space-y-2">
        <Button
          variant="outline"
          onClick={onClose}
          className="w-full bg-[#1C1917] border-[#44403C] hover:bg-[#292524] text-stone-300 font-bold text-xs h-10"
        >
          Escolher mesa digitando o número
        </Button>
      </div>
    </div>
  )
}
