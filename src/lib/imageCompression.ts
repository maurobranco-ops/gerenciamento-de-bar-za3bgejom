import { supabase } from '@/lib/supabase/client'

export interface CompressionOptions {
  maxWidth?: number
  maxHeight?: number
  quality?: number
  mimeType?: string
}

/**
 * Comprime uma imagem no cliente usando HTMLCanvasElement antes de enviar para o Storage.
 * Redimensiona para ~800px máx e comprime com qualidade 0.8 (JPEG/WebP) gerando arquivo leve (~30KB-60KB).
 */
export async function compressImage(
  file: File,
  options: CompressionOptions = {},
): Promise<{ blob: Blob; dataUrl: string; width: number; height: number }> {
  const { maxWidth = 800, maxHeight = 800, quality = 0.8, mimeType = 'image/jpeg' } = options

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Erro ao ler arquivo de imagem.'))
    reader.onload = (e) => {
      const img = new Image()
      img.onerror = () => reject(new Error('Formato de imagem inválido ou corrompido.'))
      img.onload = () => {
        let width = img.width
        let height = img.height

        // Mantém aspecto mantendo dentro do box max
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width)
            width = maxWidth
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height)
            height = maxHeight
          }
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Não foi possível inicializar canvas 2D.'))
          return
        }

        // Fundo suave branco para tratar transparências em JPEG se necessário
        ctx.fillStyle = '#FFFFFF'
        ctx.fillRect(0, 0, width, height)
        ctx.drawImage(img, 0, 0, width, height)

        const dataUrl = canvas.toDataURL(mimeType, quality)

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Falha ao gerar blob comprimido.'))
              return
            }
            resolve({ blob, dataUrl, width, height })
          },
          mimeType,
          quality,
        )
      }
      img.src = e.target?.result as string
    }
    reader.readAsDataURL(file)
  })
}

/**
 * Faz upload do blob/arquivo comprimido para o bucket "produtos" do Supabase Storage
 * e retorna a URL pública absoluta.
 */
export async function uploadProductImage(
  fileOrBlob: Blob | File,
  productId: string,
): Promise<string> {
  const fileExt = 'jpg'
  const fileName = `prod_${productId}_${Date.now()}.${fileExt}`
  const filePath = `itens/${fileName}`

  const { error: uploadError } = await supabase.storage
    .from('produtos')
    .upload(filePath, fileOrBlob, {
      contentType: 'image/jpeg',
      upsert: true,
    })

  if (uploadError) {
    console.error('Erro no upload para storage do Supabase:', uploadError)
    throw new Error(uploadError.message || 'Falha ao enviar imagem do produto.')
  }

  const { data } = supabase.storage.from('produtos').getPublicUrl(filePath)
  return data.publicUrl
}

/**
 * Remove uma imagem do bucket pelo URL público ou path se pertencer ao bucket produtos.
 */
export async function deleteProductImageByUrl(imageUrl: string): Promise<void> {
  if (!imageUrl || !imageUrl.includes('/produtos/')) return

  try {
    const parts = imageUrl.split('/produtos/')
    if (parts.length > 1) {
      const storagePath = parts[1]
      await supabase.storage.from('produtos').remove([storagePath])
    }
  } catch (err) {
    console.warn('Erro ao deletar foto antiga do bucket:', err)
  }
}
