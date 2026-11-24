import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { buildMask, MASK_SIZE } from './masks.js'

const S = MASK_SIZE
const C = S / 2
const CUT_MASK = './masks/mascara-cd.png'
const SAFE_MASK = './masks/mascara-cd-segura.png'

const INITIAL = { x: 0, y: 0, scale: 1, rotation: 0, flip: false }

export default function App() {
  const [masks, setMasks] = useState(null)
  const [image, setImage] = useState(null) // { el, url, w, h, name }
  const [t, setT] = useState(INITIAL)
  const [mode, setMode] = useState('edit') // 'edit' | 'preview'
  const [showSafe, setShowSafe] = useState(true)
  const [showCut, setShowCut] = useState(true)
  const [previewBg, setPreviewBg] = useState('dark')
  const [dragOver, setDragOver] = useState(false)
  const [busy, setBusy] = useState(false)

  const stageRef = useRef(null)
  const fileRef = useRef(null)
  const [stage, setStage] = useState({ w: 800, h: 600 })

  // ---------- máscaras ----------
  useEffect(() => {
    Promise.all([
      buildMask(CUT_MASK, { color: '#00e5ff', thickness: 6 }),
      buildMask(SAFE_MASK, { color: '#ffcc00', thickness: 5, dashed: true }),
    ]).then(([cut, safe]) => setMasks({ cut, safe }))
  }, [])

  // ---------- tamanho do palco ----------
  useLayoutEffect(() => {
    const el = stageRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => {
      const r = e.contentRect
      setStage({ w: r.width, h: r.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const disc = Math.max(100, Math.min(stage.w, stage.h) * (mode === 'edit' ? 0.78 : 0.86))
  const k = disc / S
  const worldLeft = (stage.w - disc) / 2
  const worldTop = (stage.h - disc) / 2

  const coverScale = image ? S / Math.min(image.w, image.h) : 1

  // ---------- carregar imagem ----------
  const loadFile = useCallback((file) => {
    if (!file || !file.type.startsWith('image/')) return
    const url = URL.createObjectURL(file)
    const el = new Image()
    el.onload = () => {
      setImage((prev) => {
        if (prev) URL.revokeObjectURL(prev.url)
        return { el, url, w: el.naturalWidth, h: el.naturalHeight, name: file.name }
      })
      setT({ ...INITIAL, scale: S / Math.min(el.naturalWidth, el.naturalHeight) })
    }
    el.src = url
  }, [])

  // ---------- helpers de transformação ----------
  const toWorld = useCallback(
    (clientX, clientY) => {
      const r = stageRef.current.getBoundingClientRect()
      return {
        x: (clientX - r.left - worldLeft) / k - C,
        y: (clientY - r.top - worldTop) / k - C,
      }
    },
    [k, worldLeft, worldTop]
  )

  const zoomAt = useCallback(
    (factor, px = 0, py = 0) => {
      setT((p) => {
        const min = coverScale / 8
        const max = coverScale * 8
        const scale = Math.min(max, Math.max(min, p.scale * factor))
        const f = scale / p.scale
        return { ...p, scale, x: px - (px - p.x) * f, y: py - (py - p.y) * f }
      })
    },
    [coverScale]
  )

  // ---------- arrastar ----------
  const drag = useRef(null)
  const onPointerDown = (e) => {
    if (!image || e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { sx: e.clientX, sy: e.clientY, ox: t.x, oy: t.y }
  }
  const onPointerMove = (e) => {
    const d = drag.current
    if (!d) return
    setT((p) => ({ ...p, x: d.ox + (e.clientX - d.sx) / k, y: d.oy + (e.clientY - d.sy) / k }))
  }
  const onPointerUp = () => (drag.current = null)

  // ---------- zoom com scroll (no ponto do cursor) ----------
  useEffect(() => {
    const el = stageRef.current
    const onWheel = (e) => {
      if (!image) return
      e.preventDefault()
      const p = toWorld(e.clientX, e.clientY)
      zoomAt(Math.exp(-e.deltaY * 0.0015), p.x, p.y)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [image, toWorld, zoomAt])

  // ---------- atalhos de teclado ----------
  useEffect(() => {
    const onKey = (e) => {
      if (!image || e.target.tagName === 'INPUT') return
      const step = e.shiftKey ? 10 : 1
      const map = {
        ArrowLeft: () => setT((p) => ({ ...p, x: p.x - step })),
        ArrowRight: () => setT((p) => ({ ...p, x: p.x + step })),
        ArrowUp: () => setT((p) => ({ ...p, y: p.y - step })),
        ArrowDown: () => setT((p) => ({ ...p, y: p.y + step })),
        '+': () => zoomAt(1.1),
        '=': () => zoomAt(1.1),
        '-': () => zoomAt(1 / 1.1),
        '0': () => fit(),
        e: () => setMode('edit'),
        p: () => setMode('preview'),
      }
      const fn = map[e.key]
      if (fn) {
        e.preventDefault()
        fn()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const fit = () => setT((p) => ({ ...p, x: 0, y: 0, scale: coverScale }))
  const reset = () => setT({ ...INITIAL, scale: coverScale })
  const rotateBy = (deg) =>
    setT((p) => {
      let r = p.rotation + deg
      r = ((((r + 180) % 360) + 360) % 360) - 180
      return { ...p, rotation: r }
    })

  // ---------- exportar ----------
  const download = async () => {
    if (!image || !masks) return
    setBusy(true)
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = S
    const ctx = canvas.getContext('2d')
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.save()
    ctx.translate(C + t.x, C + t.y)
    ctx.rotate((t.rotation * Math.PI) / 180)
    ctx.scale(t.scale * (t.flip ? -1 : 1), t.scale)
    ctx.drawImage(image.el, -image.w / 2, -image.h / 2)
    ctx.restore()
    ctx.globalCompositeOperation = 'destination-in'
    ctx.drawImage(masks.cut.alphaCanvas, 0, 0)
    canvas.toBlob((blob) => {
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `cd-${image.name.replace(/\.[^.]+$/, '')}.png`
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 1000)
      setBusy(false)
    }, 'image/png')
  }

  // ---------- render ----------
  const imgStyle = image && {
    position: 'absolute',
    left: C - image.w / 2,
    top: C - image.h / 2,
    width: image.w,
    height: image.h,
    maxWidth: 'none',
    transform: `translate(${t.x}px, ${t.y}px) rotate(${t.rotation}deg) scale(${t.scale * (t.flip ? -1 : 1)}, ${t.scale})`,
    transformOrigin: 'center',
    pointerEvents: 'none',
    userSelect: 'none',
  }

  const maskStyle = masks && {
    WebkitMaskImage: `url(${masks.cut.alphaUrl})`,
    maskImage: `url(${masks.cut.alphaUrl})`,
    WebkitMaskSize: '100% 100%',
    maskSize: '100% 100%',
  }

  const zoomLog = Math.log2(t.scale / coverScale)

  return (
    <div
      className="app"
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={(e) => e.currentTarget === e.target && setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        loadFile(e.dataTransfer.files?.[0])
      }}
    >
      <header className="topbar">
        <div className="brand">
          <span className="logo" /> Editor de Máscara de CD
        </div>

        <div className="segmented">
          <button className={mode === 'edit' ? 'on' : ''} onClick={() => setMode('edit')} title="Atalho: E">
            Editar
          </button>
          <button className={mode === 'preview' ? 'on' : ''} onClick={() => setMode('preview')} title="Atalho: P">
            Preview
          </button>
        </div>

        <div className="actions">
          <button className="btn" onClick={() => fileRef.current.click()}>
            Abrir imagem
          </button>
          <button className="btn primary" disabled={!image || !masks || busy} onClick={download}>
            {busy ? 'Gerando…' : 'Baixar PNG'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              loadFile(e.target.files?.[0])
              e.target.value = ''
            }}
          />
        </div>
      </header>

      <main className="workspace">
        <div
          ref={stageRef}
          className={`stage mode-${mode} bg-${previewBg} ${image ? 'has-image' : ''}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onDoubleClick={() => !image && fileRef.current.click()}
        >
          {masks && (
            <div
              className="world"
              style={{ left: worldLeft, top: worldTop, width: S, height: S, transform: `scale(${k})` }}
            >
              {/* imagem fora da máscara (fantasma), só no modo edição */}
              {image && mode === 'edit' && <img src={image.url} alt="" style={{ ...imgStyle, opacity: 0.28 }} draggable={false} />}

              {/* área recortada */}
              <div className={`masked ${mode === 'edit' ? 'checker' : ''}`} style={maskStyle}>
                {image && <img src={image.url} alt="" style={imgStyle} draggable={false} />}
              </div>

              {/* guias */}
              {mode === 'edit' && showCut && <img className="guide" src={masks.cut.guideUrl} alt="" draggable={false} />}
              {showSafe && <img className="guide" src={masks.safe.guideUrl} alt="" draggable={false} />}
            </div>
          )}

          {!image && (
            <div className="empty">
              <p>Arraste uma imagem aqui</p>
              <span>ou clique em “Abrir imagem”</span>
            </div>
          )}
          {dragOver && <div className="drop">Solte para carregar</div>}
          {!masks && <div className="empty">Carregando máscaras…</div>}
        </div>

        <aside className="panel">
          <section>
            <h3>Transformar</h3>
            <label className="row">
              <span>Zoom</span>
              <output>{image ? Math.round((t.scale / coverScale) * 100) : 100}%</output>
            </label>
            <input
              type="range"
              min={-3}
              max={3}
              step={0.01}
              value={zoomLog}
              disabled={!image}
              onChange={(e) => setT((p) => ({ ...p, scale: coverScale * 2 ** +e.target.value }))}
            />

            <label className="row">
              <span>Rotação</span>
              <output>{t.rotation.toFixed(1)}°</output>
            </label>
            <input
              type="range"
              min={-180}
              max={180}
              step={0.1}
              value={t.rotation}
              disabled={!image}
              onChange={(e) => setT((p) => ({ ...p, rotation: +e.target.value }))}
            />

            <div className="grid">
              <button className="btn" disabled={!image} onClick={() => rotateBy(-90)}>⟲ 90°</button>
              <button className="btn" disabled={!image} onClick={() => rotateBy(90)}>⟳ 90°</button>
              <button className="btn" disabled={!image} onClick={() => setT((p) => ({ ...p, flip: !p.flip }))}>
                Espelhar
              </button>
              <button className="btn" disabled={!image} onClick={() => setT((p) => ({ ...p, x: 0, y: 0 }))}>
                Centralizar
              </button>
              <button className="btn" disabled={!image} onClick={fit}>Preencher</button>
              <button className="btn" disabled={!image} onClick={reset}>Resetar</button>
            </div>
          </section>

          <section>
            <h3>Guias</h3>
            <label className="check">
              <input type="checkbox" checked={showSafe} onChange={(e) => setShowSafe(e.target.checked)} />
              <i className="swatch safe" /> Área segura
            </label>
            <label className="check">
              <input type="checkbox" checked={showCut} onChange={(e) => setShowCut(e.target.checked)} />
              <i className="swatch cut" /> Linha de corte <small>(modo editar)</small>
            </label>
          </section>

          <section>
            <h3>Fundo do preview</h3>
            <div className="segmented small">
              {[
                ['dark', 'Escuro'],
                ['light', 'Claro'],
                ['checker', 'Xadrez'],
              ].map(([v, l]) => (
                <button key={v} className={previewBg === v ? 'on' : ''} onClick={() => setPreviewBg(v)}>
                  {l}
                </button>
              ))}
            </div>
          </section>

          <section className="help">
            <h3>Atalhos</h3>
            <p><kbd>Arrastar</kbd> mover</p>
            <p><kbd>Scroll</kbd> zoom no cursor</p>
            <p><kbd>←↑→↓</kbd> mover 1px (<kbd>Shift</kbd> 10px)</p>
            <p><kbd>+</kbd> <kbd>-</kbd> zoom · <kbd>0</kbd> preencher</p>
            <p><kbd>E</kbd> editar · <kbd>P</kbd> preview</p>
          </section>

          {image && (
            <footer className="meta">
              {image.name}
              <br />
              {image.w}×{image.h}px → saída {S}×{S}px
            </footer>
          )}
        </aside>
      </main>
    </div>
  )
}
