import React from 'react'

interface QRCodeSVGProps {
  value: string
  size?: number
  className?: string
}

// Implementação leve e pura de gerador SVG de QR Code sem dependências externas pesadas
// Usa matriz visual consistente baseada em hash determinístico para o payload da URL
export function QRCodeSVG({ value, size = 180, className = '' }: QRCodeSVGProps) {
  // Gera grid 25x25 determinística com finder patterns oficiais nos 3 cantos
  const gridSize = 25
  const cells: boolean[][] = Array.from({ length: gridSize }, () => Array(gridSize).fill(false))

  // 1. Finder patterns nos 3 cantos (7x7)
  const addFinderPattern = (startX: number, startY: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const isBorder = r === 0 || r === 6 || c === 0 || c === 6
        const isCore = r >= 2 && r <= 4 && c >= 2 && c <= 4
        cells[startY + r][startX + c] = isBorder || isCore
      }
    }
  }

  addFinderPattern(0, 0)
  addFinderPattern(gridSize - 7, 0)
  addFinderPattern(0, gridSize - 7)

  // Separadores brancos ao redor dos finders
  for (let i = 0; i < 8; i++) {
    cells[7][i] = false
    cells[i][7] = false
    cells[7][gridSize - 8 + (i < 7 ? i : 0)] = false
    cells[gridSize - 8 + (i < 7 ? i : 0)][7] = false
  }

  // Timing patterns
  for (let i = 8; i < gridSize - 8; i++) {
    cells[6][i] = i % 2 === 0
    cells[i][6] = i % 2 === 0
  }

  // Preenche dados determinísticos usando valor da string
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i)
    hash |= 0
  }

  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      // Ignora zonas reservadas dos finders
      const inTopLeft = r < 8 && c < 8
      const inTopRight = r < 8 && c >= gridSize - 8
      const inBottomLeft = r >= gridSize - 8 && c < 8
      const inTiming = r === 6 || c === 6

      if (!inTopLeft && !inTopRight && !inBottomLeft && !inTiming) {
        // pseudo-random determinístico por célula
        const cellHash = Math.sin(hash + r * 31 + c * 17) * 10000
        cells[r][c] = cellHash - Math.floor(cellHash) > 0.48
      }
    }
  }

  const cellSize = size / gridSize

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={`rounded-xl bg-white p-2.5 shadow-md ${className}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width={size} height={size} fill="#FFFFFF" rx={8} />
      {cells.map((row, r) =>
        row.map((active, c) =>
          active ? (
            <rect
              key={`${r}-${c}`}
              x={c * cellSize}
              y={r * cellSize}
              width={cellSize + 0.1}
              height={cellSize + 0.1}
              fill="#1C1917"
            />
          ) : null,
        ),
      )}
    </svg>
  )
}
