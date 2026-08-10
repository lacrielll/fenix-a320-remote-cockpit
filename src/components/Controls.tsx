import { useRef } from 'react'
import type { KeyboardEvent, PointerEvent, WheelEvent } from 'react'

export function Screw({ className = '' }: { className?: string }) {
  return <span className={`screw ${className}`} aria-hidden="true" />
}

export function PanelButton({ label, active, onClick, compact = false }: { label: string; active?: boolean; onClick: () => void; compact?: boolean }) {
  return <button className={`panel-button ${active ? 'is-active' : ''} ${compact ? 'is-compact' : ''}`} onClick={onClick} aria-pressed={active}>
    <span className="button-lamp" /><span>{label}</span>
  </button>
}

export function Rotary({ label, sublabel, rotation = 0, size = 'normal', onTurn, onPush, onPull }: {
  label?: string; sublabel?: string; rotation?: number; size?: 'small' | 'normal' | 'large'
  onTurn: (direction: 1 | -1) => void; onPush?: () => void; onPull?: () => void
}) {
  const start = useRef({ x: 0, y: 0 })
  const pointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    start.current = { x: event.clientX, y: event.clientY }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const pointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    const dx = event.clientX - start.current.x
    const dy = event.clientY - start.current.y
    if (Math.abs(dx) > 18 && Math.abs(dx) > Math.abs(dy)) onTurn(dx > 0 ? 1 : -1)
    else if (Math.abs(dy) > 20) dy < 0 ? onPull?.() : onPush?.()
    else onPush?.()
  }
  const wheel = (event: WheelEvent<HTMLButtonElement>) => { event.preventDefault(); onTurn(event.deltaY < 0 ? 1 : -1) }
  const keyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') { event.preventDefault(); onTurn(1) }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') { event.preventDefault(); onTurn(-1) }
    if (event.key === 'Enter') { event.preventDefault(); event.shiftKey ? onPull?.() : onPush?.() }
  }
  return <div className={`rotary-wrap rotary-${size}`}>
    {label && <span className="rotary-label">{label}</span>}
    <button className="rotary" style={{ '--rotation': `${rotation}deg` } as React.CSSProperties} onPointerDown={pointerDown} onPointerUp={pointerUp} onWheel={wheel} onKeyDown={keyDown} aria-label={`${label ?? 'rotary'} knob`}>
      <span className="rotary-cap"><i /></span>
    </button>
    {sublabel && <span className="rotary-sublabel">{sublabel}</span>}
  </div>
}
