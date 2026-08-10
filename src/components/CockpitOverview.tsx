import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react'
import { EfisPanel } from './EfisPanel'
import { FcuPanel } from './FcuPanel'
import { OverheadPanel, overheadZoneBounds, type OverheadZone } from './OverheadPanel'
import cockpitLayoutUrl from '../assets/cockpit/cockpit-layout.svg'
import cockpitBackgroundUrl from '../assets/cockpit/airport-background.jpg'
import type { CockpitCommand, EfisState, FcuState } from '../types'
import './cockpit-overview.css'

export type CockpitPanelTarget = 'captain' | 'fcu' | 'first-officer'
type ZoomTarget = CockpitPanelTarget | `overhead-${OverheadZone}`
type OverheadZoom = {
  zone: OverheadZone
  active: boolean
  startLeft: number
  startTop: number
  startWidth: number
  startHeight: number
  targetLeft: number
  targetTop: number
  targetWidth: number
  targetHeight: number
}

const BACKGROUND_POSITION_KEY = 'a320-boards-cockpit-background-offset-x'
const BACKGROUND_POSITION_Y_KEY = 'a320-boards-cockpit-background-offset-y'

type Props = {
  fcu: FcuState
  efisCaptain: EfisState
  efisFirstOfficer: EfisState
  send: (command: CockpitCommand) => void
  onOpenPanel: (target: CockpitPanelTarget) => void
  onOpenOverhead: (zone: OverheadZone) => void
}

export function CockpitOverview({ fcu, efisCaptain, efisFirstOfficer, send, onOpenPanel, onOpenOverhead }: Props) {
  const [zoomTarget, setZoomTarget] = useState<ZoomTarget | null>(null)
  const [overheadZoom, setOverheadZoom] = useState<OverheadZoom | null>(null)
  const [backgroundMoving, setBackgroundMoving] = useState(false)
  const [backgroundPosition, setBackgroundPosition] = useState(() => {
    const stored = Number(window.localStorage.getItem(BACKGROUND_POSITION_KEY))
    return Number.isFinite(stored) ? stored : 0
  })
  const [backgroundPositionY, setBackgroundPositionY] = useState(() => {
    const stored = Number(window.localStorage.getItem(BACKGROUND_POSITION_Y_KEY))
    return Number.isFinite(stored) ? stored : 0
  })
  const overview = useRef<HTMLElement>(null)
  const timer = useRef<number | undefined>(undefined)
  const animationFrame = useRef<number | undefined>(undefined)
  const backgroundDrag = useRef<{ pointerId: number; startX: number; startY: number; startPositionX: number; startPositionY: number } | null>(null)

  useEffect(() => () => {
    if (timer.current !== undefined) window.clearTimeout(timer.current)
    if (animationFrame.current !== undefined) window.cancelAnimationFrame(animationFrame.current)
  }, [])

  useEffect(() => {
    window.localStorage.setItem(BACKGROUND_POSITION_KEY, backgroundPosition.toFixed(3))
  }, [backgroundPosition])

  useEffect(() => {
    window.localStorage.setItem(BACKGROUND_POSITION_Y_KEY, backgroundPositionY.toFixed(3))
  }, [backgroundPositionY])

  const beginBackgroundDrag = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = overview.current?.getBoundingClientRect()
    if (!bounds) return
    event.currentTarget.setPointerCapture(event.pointerId)
    backgroundDrag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startPositionX: backgroundPosition,
      startPositionY: backgroundPositionY,
    }
  }

  const moveBackground = (event: PointerEvent<HTMLDivElement>) => {
    const drag = backgroundDrag.current
    if (!drag || drag.pointerId !== event.pointerId) return
    setBackgroundPosition(drag.startPositionX + event.clientX - drag.startX)
    setBackgroundPositionY(drag.startPositionY + event.clientY - drag.startY)
  }

  const endBackgroundDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (backgroundDrag.current?.pointerId !== event.pointerId) return
    backgroundDrag.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const zoomTo = (target: CockpitPanelTarget) => {
    if (zoomTarget) return
    setZoomTarget(target)
    timer.current = window.setTimeout(() => onOpenPanel(target), 520)
  }

  const zoomToOverhead = (zone: OverheadZone, event: MouseEvent<HTMLButtonElement>) => {
    if (zoomTarget) return
    const overviewRect = overview.current?.getBoundingClientRect()
    const zoneRect = event.currentTarget.getBoundingClientRect()
    if (!overviewRect) return

    const bounds = overheadZoneBounds[zone]
    const aspectRatio = bounds.width / bounds.height
    const targetWidth = Math.min(overviewRect.width * .82, overviewRect.height * .88 * aspectRatio)
    const targetHeight = targetWidth / aspectRatio

    setOverheadZoom({
      zone,
      active: false,
      startLeft: zoneRect.left - overviewRect.left,
      startTop: zoneRect.top - overviewRect.top,
      startWidth: zoneRect.width,
      startHeight: zoneRect.height,
      targetLeft: (overviewRect.width - targetWidth) / 2,
      targetTop: (overviewRect.height - targetHeight) / 2,
      targetWidth,
      targetHeight,
    })
    setZoomTarget(`overhead-${zone}`)
    animationFrame.current = window.requestAnimationFrame(() => {
      animationFrame.current = window.requestAnimationFrame(() => {
        setOverheadZoom(current => current ? { ...current, active: true } : current)
      })
    })
    timer.current = window.setTimeout(() => onOpenOverhead(zone), 580)
  }

  const keyboardOpen = (event: KeyboardEvent<HTMLDivElement>, target: CockpitPanelTarget) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    zoomTo(target)
  }

  const overheadZoomStyle = overheadZoom ? {
    '--oz-start-left': `${overheadZoom.startLeft}px`,
    '--oz-start-top': `${overheadZoom.startTop}px`,
    '--oz-start-width': `${overheadZoom.startWidth}px`,
    '--oz-start-height': `${overheadZoom.startHeight}px`,
    '--oz-target-left': `${overheadZoom.targetLeft}px`,
    '--oz-target-top': `${overheadZoom.targetTop}px`,
    '--oz-target-width': `${overheadZoom.targetWidth}px`,
    '--oz-target-height': `${overheadZoom.targetHeight}px`,
  } as CSSProperties : undefined

  return <section ref={overview} className={`cockpit-overview ${zoomTarget ? `is-zooming zoom-${zoomTarget}` : ''} ${overheadZoom ? 'is-overhead-zooming' : ''}`} aria-label="Schematic Airbus A320 cockpit">
    <div className="co-shell">
      <div className="co-cockpit-background-viewport" aria-hidden="true">
        <img className="co-cockpit-background" src={cockpitBackgroundUrl} alt="" style={{ transform: `translate(${backgroundPosition}px, ${backgroundPositionY}px)` }} />
      </div>
      <img className="co-cockpit-art" src={cockpitLayoutUrl} alt="" aria-hidden="true" />

      <div className="co-overhead" aria-label="Overhead panel zones">
        <div className="co-overhead-visual-clip" aria-hidden="true">
          <div className="co-overhead-projection-squash">
            <div className="co-overhead-panel-frame"><OverheadPanel schematic /></div>
          </div>
        </div>
        <div className="co-overhead-zone-clip">
          <div className="co-overhead-projection-squash">
            <div className="co-overhead-zone-plane">
              <button className="co-zone co-overhead-zone co-overhead-zone-1" type="button" onClick={event => zoomToOverhead(1, event)} data-tooltip="ZONE 1 · BLOCKS 1–5" aria-label="Open overhead zone 1, blocks 1 through 5" />
              <button className="co-zone co-overhead-zone co-overhead-zone-3" type="button" onClick={event => zoomToOverhead(3, event)} data-tooltip="ZONE 3 · BLOCK 6" aria-label="Open overhead zone 3, block 6" />
              <button className="co-zone co-overhead-zone co-overhead-zone-4" type="button" onClick={event => zoomToOverhead(4, event)} data-tooltip="ZONE 4 · BLOCKS 7–8" aria-label="Open overhead zone 4, blocks 7 and 8" />
              <button className="co-zone co-overhead-zone co-overhead-zone-5" type="button" onClick={event => zoomToOverhead(5, event)} data-tooltip="ZONE 5 · BLOCKS 9–10" aria-label="Open overhead zone 5, blocks 9 and 10" />
              <button className="co-zone co-overhead-zone co-overhead-zone-6" type="button" onClick={event => zoomToOverhead(6, event)} data-tooltip="ZONE 6 · BLOCKS 11–12" aria-label="Open overhead zone 6, blocks 11 and 12" />
              <button className="co-zone co-overhead-zone co-overhead-zone-7" type="button" onClick={event => zoomToOverhead(7, event)} data-tooltip="ZONE 7 · BLOCKS 13–14" aria-label="Open overhead zone 7, blocks 13 and 14" />
              <button className="co-zone co-overhead-zone co-overhead-zone-8" type="button" onClick={event => zoomToOverhead(8, event)} data-tooltip="ZONE 8 · BLOCKS 15–16" aria-label="Open overhead zone 8, blocks 15 and 16" />
              <button className="co-zone co-overhead-zone co-overhead-zone-9" type="button" onClick={event => zoomToOverhead(9, event)} data-tooltip="ZONE 9 · BLOCK 17" aria-label="Open overhead zone 9, block 17" />
            </div>
          </div>
        </div>
      </div>

      <div className="co-main-panel">
        <div className="co-glareshield" aria-label="Glareshield schematic">
          <div className="co-panel-rack">
            <div className="co-zone co-panel-preview co-panel-efis" role="button" tabIndex={0} onClick={() => zoomTo('captain')} onKeyDown={event => keyboardOpen(event, 'captain')} data-tooltip="CAPTAIN EFIS · OPEN PANEL" inert={zoomTarget !== null}>
              <EfisPanel state={efisCaptain} send={send} schematic />
            </div>
            <div className="co-zone co-panel-preview co-panel-fcu" role="button" tabIndex={0} onClick={() => zoomTo('fcu')} onKeyDown={event => keyboardOpen(event, 'fcu')} data-tooltip="FCU · OPEN PANEL" inert={zoomTarget !== null}>
              <FcuPanel state={fcu} send={send} schematic />
            </div>
            <div className="co-zone co-panel-preview co-panel-efis" role="button" tabIndex={0} onClick={() => zoomTo('first-officer')} onKeyDown={event => keyboardOpen(event, 'first-officer')} data-tooltip="FIRST OFFICER EFIS · OPEN PANEL" inert={zoomTarget !== null}>
              <EfisPanel state={efisFirstOfficer} send={send} side="firstOfficer" mirrored schematic />
            </div>
          </div>
        </div>

      </div>

      <button className="co-zone co-pedestal" type="button" aria-disabled="true" data-tooltip="PEDESTAL · INOP">
        <span className="co-inop">INOP</span>
        <span className="co-pedestal-panels"><i /><i /><i /><i /><i /><i /></span>
        <strong>PEDESTAL</strong>
      </button>
      <div className="co-floor-plane" aria-hidden="true" />

    </div>
    {backgroundMoving && <div className="co-background-drag-surface" onPointerDown={beginBackgroundDrag} onPointerMove={moveBackground} onPointerUp={endBackgroundDrag} onPointerCancel={endBackgroundDrag} aria-label="Drag to move the exterior background" />}
    <button className={`co-background-move-toggle ${backgroundMoving ? 'is-active' : ''}`} type="button" aria-pressed={backgroundMoving} onClick={() => setBackgroundMoving(active => !active)} onDoubleClick={() => { setBackgroundPosition(0); setBackgroundPositionY(0) }}>
      <span aria-hidden="true">↔</span> MOVE BACKGROUND
    </button>
    {overheadZoom && <div className={`co-overhead-zoom-layer ${overheadZoom.active ? 'is-active' : ''}`} style={overheadZoomStyle} aria-hidden="true">
      <OverheadPanel schematic focusZone={overheadZoom.zone} />
    </div>}
    <p className="co-hint">Select a panel to open it</p>
  </section>
}
