// Carrega as máscaras (PNG preto/branco) e gera:
//  - alphaCanvas: máscara convertida para canal alpha (branco = visível)
//  - alphaUrl:    a mesma máscara como URL, para usar em CSS mask-image
//  - guideUrl:    contorno da máscara desenhado como linha (guia visual)

export const MASK_SIZE = 2048

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function canvasToUrl(canvas) {
  return new Promise((resolve) =>
    canvas.toBlob((blob) => resolve(URL.createObjectURL(blob)), 'image/png')
  )
}

export async function buildMask(src, { color = '#00e5ff', dashed = false, thickness = 6 } = {}) {
  const img = await loadImage(src)
  const S = MASK_SIZE

  const src2d = document.createElement('canvas')
  src2d.width = src2d.height = S
  const sctx = src2d.getContext('2d', { willReadFrequently: true })
  sctx.drawImage(img, 0, 0, S, S)
  const data = sctx.getImageData(0, 0, S, S).data

  // 1) máscara alpha
  const alphaCanvas = document.createElement('canvas')
  alphaCanvas.width = alphaCanvas.height = S
  const actx = alphaCanvas.getContext('2d')
  const out = actx.createImageData(S, S)
  const bin = new Uint8Array(S * S)
  for (let i = 0, p = 0; p < S * S; p++, i += 4) {
    const lum = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000
    out.data[i] = out.data[i + 1] = out.data[i + 2] = 255
    out.data[i + 3] = lum
    bin[p] = lum > 127 ? 1 : 0
  }
  actx.putImageData(out, 0, 0)

  // 2) contorno (pixels onde a máscara muda de valor)
  const guide = document.createElement('canvas')
  guide.width = guide.height = S
  const gctx = guide.getContext('2d')
  gctx.fillStyle = color
  const half = thickness / 2
  const c = S / 2
  for (let y = 0; y < S - 1; y++) {
    for (let x = 0; x < S - 1; x++) {
      const p = y * S + x
      if (bin[p] !== bin[p + 1] || bin[p] !== bin[p + S]) {
        if (dashed) {
          const r = Math.hypot(x - c, y - c)
          const arc = (Math.atan2(y - c, x - c) + Math.PI) * r
          if (Math.floor(arc / 22) % 2) continue
        }
        gctx.fillRect(x - half, y - half, thickness, thickness)
      }
    }
  }

  const [alphaUrl, guideUrl] = await Promise.all([canvasToUrl(alphaCanvas), canvasToUrl(guide)])
  return { alphaCanvas, alphaUrl, guideUrl }
}
