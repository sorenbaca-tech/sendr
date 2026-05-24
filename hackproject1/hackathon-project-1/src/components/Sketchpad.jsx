import React, { useEffect, useMemo, useRef, useState } from 'react'
import { loadSketchpadState, saveSketchpadState, subscribeToSketchpadState } from '../firebaseModules'

const TOOL_OPTIONS = [
  { id: 'pen', label: 'Pen' },
  { id: 'pencil', label: 'Pencil' },
  { id: 'marker', label: 'Marker' },
  { id: 'eraser', label: 'Eraser' }
]

const COLOR_OPTIONS = [
  { name: 'Black', value: '#111111' },
  { name: 'White', value: '#ffffff' },
  { name: 'Brown', value: '#8b5e3c' },
  { name: 'Pink', value: '#ff7fbf' },
  { name: 'Red', value: '#ff4d4f' },
  { name: 'Orange', value: '#ff9f43' },
  { name: 'Yellow', value: '#ffd93d' },
  { name: 'Green', value: '#2ed573' },
  { name: 'Blue', value: '#1e90ff' },
  { name: 'Indigo', value: '#5f5ff0' },
  { name: 'Violet', value: '#a855f7' }
]

const TOOL_STROKE_WIDTH = {
  pen: 1,
  pencil: 0.5,
  marker: 8,
  eraser: 28
}

const storageKey = (projectKey) => `sketchpad-canvas-data:${projectKey}`

export default function Sketchpad({ projectKey = 1 }) {
  const canvasRef = useRef(null)
  const wrapperRef = useRef(null)
  const saveTimerRef = useRef(null)
  const savedDataUrlRef = useRef('')
  const lastSavedRef = useRef('')
  const [tool, setTool] = useState('pen')
  const [color, setColor] = useState('#111111')
  const [isDrawing, setIsDrawing] = useState(false)
  const [brushSize, setBrushSize] = useState(TOOL_STROKE_WIDTH.pen)

  const activeLabel = useMemo(() => {
    return TOOL_OPTIONS.find((option) => option.id === tool)?.label || 'Pen'
  }, [tool])

  useEffect(() => {
    setBrushSize(TOOL_STROKE_WIDTH[tool])
  }, [tool])

  const drawSavedImage = (dataUrl) => {
    const canvas = canvasRef.current
    const wrapper = wrapperRef.current

    if (!canvas || !wrapper) {
      return
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }

    const rect = wrapper.getBoundingClientRect()

    if (!dataUrl) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, rect.width, 320)
      return
    }

    const image = new Image()
    image.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, rect.width, 320)
      ctx.drawImage(image, 0, 0, rect.width, 320)
    }

    image.src = dataUrl
  }

  useEffect(() => {
    const canvas = canvasRef.current
    const wrapper = wrapperRef.current

    if (!canvas || !wrapper) {
      return undefined
    }

    const resizeCanvas = () => {
      const ratio = window.devicePixelRatio || 1
      const rect = wrapper.getBoundingClientRect()

      canvas.width = Math.floor(rect.width * ratio)
      canvas.height = Math.floor(320 * ratio)
      canvas.style.width = `${rect.width}px`
      canvas.style.height = '320px'

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        return
      }

      ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, rect.width, 320)
      drawSavedImage(savedDataUrlRef.current)
    }

    resizeCanvas()

    const resizeObserver = new ResizeObserver(resizeCanvas)
    resizeObserver.observe(wrapper)

    return () => resizeObserver.disconnect()
  }, [])

  useEffect(() => {
    let active = true

    const hydrate = async () => {
      const remoteDataUrl = await loadSketchpadState(projectKey)
      const localDataUrl = localStorage.getItem(storageKey(projectKey))
      const nextDataUrl = remoteDataUrl || localDataUrl || ''

      if (!active) {
        return
      }

      savedDataUrlRef.current = nextDataUrl
      lastSavedRef.current = nextDataUrl

      if (nextDataUrl) {
        localStorage.setItem(storageKey(projectKey), nextDataUrl)
      } else {
        localStorage.removeItem(storageKey(projectKey))
      }

      drawSavedImage(nextDataUrl)
    }

    hydrate()

    const unsubscribe = subscribeToSketchpadState(projectKey, (remoteDataUrl) => {
      if (!active) {
        return
      }

      const nextDataUrl = remoteDataUrl || ''

      if (nextDataUrl === savedDataUrlRef.current) {
        return
      }

      savedDataUrlRef.current = nextDataUrl
      lastSavedRef.current = nextDataUrl

      if (nextDataUrl) {
        localStorage.setItem(storageKey(projectKey), nextDataUrl)
      } else {
        localStorage.removeItem(storageKey(projectKey))
      }

      drawSavedImage(nextDataUrl)
    })

    return () => {
      active = false
      unsubscribe()
    }
  }, [projectKey])

  useEffect(() => {
    const persist = async () => {
      const canvas = canvasRef.current

      if (!canvas) {
        return
      }

      const nextDataUrl = canvas.toDataURL('image/png')

      if (nextDataUrl === lastSavedRef.current) {
        return
      }

      lastSavedRef.current = nextDataUrl
      savedDataUrlRef.current = nextDataUrl
      localStorage.setItem(storageKey(projectKey), nextDataUrl)
      await saveSketchpadState(projectKey, nextDataUrl)
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        persist()
      }
    }

    const handlePageHide = () => {
      persist()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('pagehide', handlePageHide)
    window.addEventListener('beforeunload', handlePageHide)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('pagehide', handlePageHide)
      window.removeEventListener('beforeunload', handlePageHide)
    }
  }, [projectKey])

  useEffect(() => {
    const canvas = canvasRef.current

    if (!canvas) {
      return undefined
    }

    const handlePointerDown = (event) => {
      startDrawing(event)
    }

    const handlePointerMove = (event) => {
      continueDrawing(event)
    }

    const handlePointerUp = () => {
      stopDrawing()
    }

    const handlePointerLeave = () => {
      stopDrawing()
    }

    const handlePointerCancel = () => {
      stopDrawing()
    }

    canvas.addEventListener('pointerdown', handlePointerDown)
    canvas.addEventListener('pointermove', handlePointerMove)
    canvas.addEventListener('pointerup', handlePointerUp)
    canvas.addEventListener('pointerleave', handlePointerLeave)
    canvas.addEventListener('pointercancel', handlePointerCancel)

    return () => {
      canvas.removeEventListener('pointerdown', handlePointerDown)
      canvas.removeEventListener('pointermove', handlePointerMove)
      canvas.removeEventListener('pointerup', handlePointerUp)
      canvas.removeEventListener('pointerleave', handlePointerLeave)
      canvas.removeEventListener('pointercancel', handlePointerCancel)
    }
  }, [brushSize, color, tool, isDrawing])

  const getPoint = (event) => {
    const canvas = canvasRef.current

    if (!canvas) {
      return null
    }

    const rect = canvas.getBoundingClientRect()

    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    }
  }

  const drawLine = (start, end) => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')

    if (!ctx || !start || !end) {
      return
    }

    ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : color
    ctx.lineWidth = brushSize
    ctx.beginPath()
    ctx.moveTo(start.x, start.y)
    ctx.lineTo(end.x, end.y)
    ctx.stroke()
  }

  const persistCanvas = () => {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current)
    }

    saveTimerRef.current = window.setTimeout(async () => {
      const canvas = canvasRef.current
      if (!canvas) {
        return
      }

      const nextDataUrl = canvas.toDataURL('image/png')

      if (nextDataUrl === lastSavedRef.current) {
        return
      }

      lastSavedRef.current = nextDataUrl
      savedDataUrlRef.current = nextDataUrl
      localStorage.setItem(storageKey(projectKey), nextDataUrl)
      await saveSketchpadState(projectKey, nextDataUrl)
    }, 120)
  }

  const startDrawing = (event) => {
    const point = getPoint(event)

    if (!point) {
      return
    }

    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')

    if (!ctx) {
      return
    }

    setIsDrawing(true)

    ctx.fillStyle = tool === 'eraser' ? '#ffffff' : color
    ctx.beginPath()
    ctx.arc(point.x, point.y, brushSize / 2, 0, Math.PI * 2)
    ctx.fill()
    canvas.__lastPoint = point
    persistCanvas()
  }

  const continueDrawing = (event) => {
    if (!isDrawing) {
      return
    }

    const point = getPoint(event)

    if (!point) {
      return
    }

    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')

    if (!ctx) {
      return
    }

    ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : color
    ctx.lineWidth = brushSize
    const prev = canvas?.__lastPoint

    if (prev) {
      drawLine(prev, point)
    }

    canvas.__lastPoint = point
    persistCanvas()
  }

  const stopDrawing = () => {
    setIsDrawing(false)

    if (canvasRef.current) {
      canvasRef.current.__lastPoint = null
    }

    persistCanvas()
  }

  const clearCanvas = async () => {
    const canvas = canvasRef.current
    const wrapper = wrapperRef.current

    if (!canvas || !wrapper) {
      return
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, wrapper.getBoundingClientRect().width, 320)

    savedDataUrlRef.current = ''
    lastSavedRef.current = ''
    localStorage.removeItem(storageKey(projectKey))
    await saveSketchpadState(projectKey, '')
  }

  return (
    <section className="component-card" style={{ display: 'grid', gap: '12px' }}>
      <div>
        <h3 style={{ margin: '0 0 6px' }}>Sketchpad</h3>
        <p style={{ margin: 0, color: 'var(--muted, #6b7280)' }}>
          Draw quick ideas with {activeLabel.toLowerCase()} and switch colours instantly.
        </p>
      </div>

      <div style={{ display: 'grid', gap: '12px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {TOOL_OPTIONS.map((option) => {
            const isActive = option.id === tool

            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setTool(option.id)}
                style={{
                  borderRadius: '999px',
                  border: isActive ? '1px solid #111827' : '1px solid #d1d5db',
                  background: isActive ? '#111827' : '#ffffff',
                  color: isActive ? '#ffffff' : '#111827',
                  padding: '8px 12px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                {option.label}
              </button>
            )
          })}
        </div>

        <div style={{ display: 'grid', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontWeight: 700 }}>Colour</span>
            <span style={{ fontSize: '0.9rem', color: 'var(--muted, #6b7280)' }}>
              {color}
            </span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {COLOR_OPTIONS.map((option) => {
              const isActive = option.value === color

              return (
                <button
                  key={option.name}
                  type="button"
                  aria-label={`Select ${option.name}`}
                  onClick={() => setColor(option.value)}
                  title={option.name}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '999px',
                    border: isActive ? '3px solid #111827' : '1px solid #d1d5db',
                    background: option.value,
                    cursor: 'pointer',
                    boxShadow: option.value === '#ffffff' ? 'inset 0 0 0 1px #d1d5db' : 'none'
                  }}
                />
              )
            })}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 700 }}>
              Size
              <span style={{ fontSize: '0.95rem', color: 'var(--muted, #6b7280)' }}>
                {brushSize.toFixed(1)} px
              </span>
            </label>

            <input
              type="range"
              min={tool === 'marker' ? 1 : 0.25}
              max={tool === 'eraser' ? 44 : 24}
              step={0.25}
              value={brushSize}
              onChange={(event) => setBrushSize(Number(event.target.value))}
              style={{ width: '100%' }}
            />
          </div>

          <button
            type="button"
            onClick={clearCanvas}
            style={{
              borderRadius: '999px',
              border: '1px solid #d1d5db',
              background: '#ffffff',
              color: '#111827',
              padding: '8px 12px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Clear
          </button>
        </div>
      </div>

      <div
        ref={wrapperRef}
        style={{
          border: '1px solid #d1d5db',
          borderRadius: '12px',
          overflow: 'hidden',
          background: '#ffffff',
          position: 'relative'
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            display: 'block',
            touchAction: 'none',
            width: '100%',
            height: '320px',
            background: '#ffffff'
          }}
        />

        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: Math.max(18, brushSize * 1.1),
            height: Math.max(18, brushSize * 1.1),
            borderRadius: '999px',
            background: tool === 'eraser' ? '#ffffff' : color,
            border: tool === 'eraser' ? '1px solid #d1d5db' : 'none',
            opacity: 0.4,
            pointerEvents: 'none'
          }}
        />
      </div>
    </section>
  )
}
