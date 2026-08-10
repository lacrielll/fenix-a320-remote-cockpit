import { useRef, useState, type CSSProperties, type WheelEvent } from 'react'
import arptOffUrl from '../assets/efis/buttons/arpt/off.svg'
import arptOnUrl from '../assets/efis/buttons/arpt/on.svg'
import cstrOffUrl from '../assets/efis/buttons/cstr/off.svg'
import cstrOnUrl from '../assets/efis/buttons/cstr/on.svg'
import fdOffUrl from '../assets/efis/buttons/fd/off.svg'
import fdOnUrl from '../assets/efis/buttons/fd/on.svg'
import lsOffUrl from '../assets/efis/buttons/ls/off.svg'
import lsOnUrl from '../assets/efis/buttons/ls/on.svg'
import ndbOffUrl from '../assets/efis/buttons/ndb/off.svg'
import ndbOnUrl from '../assets/efis/buttons/ndb/on.svg'
import vordOffUrl from '../assets/efis/buttons/vord/off.svg'
import vordOnUrl from '../assets/efis/buttons/vord/on.svg'
import wptOffUrl from '../assets/efis/buttons/wpt/off.svg'
import wptOnUrl from '../assets/efis/buttons/wpt/on.svg'
import baroHandleUrl from '../assets/efis/knobs/baro/handle.svg'
import baroSelectorFrameUrl from '../assets/efis/knobs/baro/selector-frame.svg'
import baroSelectorRotorUrl from '../assets/efis/knobs/baro/selector-rotor.svg'
import modeHandleUrl from '../assets/efis/knobs/mode/handle.svg'
import modeSelectorFrameUrl from '../assets/efis/knobs/mode/selector-frame.svg'
import rangeSelectorFrameUrl from '../assets/efis/knobs/range/selector-frame.svg'
import navaidBaseUrl from '../assets/efis/switches/navaid/base.svg'
import navaidCenterUrl from '../assets/efis/switches/navaid/center.svg'
import navaidLeftUrl from '../assets/efis/switches/navaid/left.svg'
import navaidRightUrl from '../assets/efis/switches/navaid/right.svg'
import type { CockpitCommand, EfisFilter, EfisSide, EfisState } from '../types'
import './efis.css'

type PositionedPlaceholder = {
  id: string
  label: string
  x: number
  y: number
}

type PositionedStyle = CSSProperties & {
  '--efis-x': string
  '--efis-y': string
}

const at = (x: number, y: number): PositionedStyle => ({
  '--efis-x': `${x / 5.39}cqw`,
  '--efis-y': `${y / 5.39}cqw`,
})

/*
 * Normalized from the captain-side control origins in FBW's
 * A320_NEO_INTERIOR_LOD01.gltf. The placeholders deliberately keep their
 * own coordinate space so finished artwork can replace them without
 * changing the FCU layout.
 */
const optionButtons: PositionedPlaceholder[] = [
  { id: 'cstr', label: 'CSTR', x: 197, y: 57 },
  { id: 'wpt', label: 'WPT', x: 261, y: 57 },
  { id: 'vord', label: 'VOR.D', x: 325, y: 57 },
  { id: 'ndb', label: 'NDB', x: 389, y: 57 },
  { id: 'arpt', label: 'ARPT', x: 453, y: 57 },
]

const lowerButtons: PositionedPlaceholder[] = [
  { id: 'fd', label: 'FD', x: 55, y: 264 },
  { id: 'ls', label: 'LS', x: 120, y: 264 },
]

const efisButtonArtwork: Record<string, { off: string; on: string }> = {
  arpt: { off: arptOffUrl, on: arptOnUrl },
  cstr: { off: cstrOffUrl, on: cstrOnUrl },
  fd: { off: fdOffUrl, on: fdOnUrl },
  ls: { off: lsOffUrl, on: lsOnUrl },
  ndb: { off: ndbOffUrl, on: ndbOnUrl },
  vord: { off: vordOffUrl, on: vordOnUrl },
  wpt: { off: wptOffUrl, on: wptOnUrl },
}

function ButtonPlaceholder({ item, active, onPress }: { item: PositionedPlaceholder; active: boolean; onPress: () => void }) {
  const artwork = efisButtonArtwork[item.id]
  return <button className={`re-placeholder re-button ${active ? 'is-active' : ''}`} style={at(item.x, item.y)} data-control={item.id} onClick={onPress} aria-label={item.label} aria-pressed={active}>
    <img className="re-button-face re-button-face-off" src={artwork.off} alt="" />
    <img className="re-button-face re-button-face-on" src={artwork.on} alt="" />
  </button>
}

function NavSelectorPlaceholder({ id, index, x, y, position, onMove }: { id: 'nav1' | 'nav2'; index: number; x: number; y: number; position: number; onMove: (direction: 1 | -1) => void }) {
  const actuator = [navaidLeftUrl, navaidCenterUrl, navaidRightUrl][position]
  return <div className="re-placeholder re-centered re-nav-selector" style={at(x, y)} data-control={id}>
    <span className="re-nav-label re-nav-label-adf">ADF</span><span className="re-nav-label re-nav-label-off">OFF</span><span className="re-nav-label re-nav-label-vor">VOR</span>
    <img className="re-nav-base" src={navaidBaseUrl} alt="" />
    <img className="re-nav-actuator" src={actuator} alt="" />
    <button className="re-nav-hit re-nav-hit-left" onClick={() => onMove(-1)} aria-label={`Move navigation aid ${index} selector left`} />
    <button className="re-nav-hit re-nav-hit-right" onClick={() => onMove(1)} aria-label={`Move navigation aid ${index} selector right`} />
    <strong className="re-nav-index">{index}</strong>
  </div>
}

function BaroDisplay({ inHg, std, baro }: { inHg: boolean; std: boolean; baro: number }) {
  const value = std ? 'Std' : inHg ? baro.toFixed(2) : Math.round(baro).toString().padStart(4, '0')
  const digits = value.replace('.', '')
  const digitCenters = [65, 171, 277, 383]
  const renderDigits = (characters: string, className?: string) => <g className={className}>
    {characters.split('').map((digit, index) => <g key={`${index}-${digit}`} transform={`translate(${digitCenters[index]} 0) scale(1.55 1)`}>
      <text x="-28.82" y="196">{digit}</text>
    </g>)}
  </g>
  return <div className="re-baro-glass" data-control="baro-display">
    <svg className="re-display-svg" viewBox="0 0 448 224" preserveAspectRatio="none" role="img" aria-label={`QNH ${value} ${inHg ? 'inches of mercury' : 'hectopascals'}`}>
      <g className="re-display-labels" aria-hidden="true">
        <text className="inactive" x="118" y="57.6">QFE</text>
        <text className="active" x="244" y="57.6">QNH</text>
      </g>
      <g className="re-display-values" aria-hidden="true">
        {renderDigits('8888', 're-baro-digit-row re-display-ghost')}
        {inHg && <rect className="re-baro-decimal re-display-ghost" x="218" y="196.5" width="12" height="12" rx="2" />}
        {std
          ? <text className="re-display-std" x="224" y="196" textAnchor="middle">{value}</text>
          : <>
              {renderDigits(digits, 're-baro-digit-row')}
              {inHg && <rect className="re-baro-decimal" x="218" y="196.5" width="12" height="12" rx="2" />}
            </>}
      </g>
    </svg>
  </div>
}

function BaroControl({ inHg, onRotate, onToggleUnit, onPush, onPull }: { inHg: boolean; onRotate: (direction: 1 | -1) => void; onToggleUnit: () => void; onPush: () => void; onPull: () => void }) {
  const [rotation, setRotation] = useState(0)
  const [axialMotion, setAxialMotion] = useState<'push' | 'pull' | null>(null)
  const axialTimer = useRef<number | undefined>(undefined)
  const rotate = (direction: 1 | -1) => {
    setRotation(current => current + direction * 6)
    onRotate(direction)
  }
  const wheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault()
    rotate(event.deltaY < 0 ? 1 : -1)
  }
  const actuateAxial = (action: 'push' | 'pull') => {
    if (axialTimer.current !== undefined) window.clearTimeout(axialTimer.current)
    setAxialMotion(action)
    axialTimer.current = window.setTimeout(() => setAxialMotion(null), 180)
    if (action === 'push') onPush()
    else onPull()
  }

  return <div className={`re-baro-control ${axialMotion ? `is-${axialMotion}ing` : ''}`} data-control="baro">
    <button className={`re-baro-selector ${inHg ? 'is-inhg' : 'is-hpa'}`} onClick={onToggleUnit} aria-label={`Switch pressure units to ${inHg ? 'hPa' : 'in Hg'}`}>
      <img className="re-baro-selector-rotor" src={baroSelectorRotorUrl} alt="" />
      <img className="re-baro-selector-frame" src={baroSelectorFrameUrl} alt="" />
    </button>
    <div className="re-baro-handle-zone" onWheel={wheel} style={{ '--re-baro-rotation': `${rotation}deg` } as CSSProperties}>
      <span className="re-baro-handle-shadow"><img className="re-baro-handle" src={baroHandleUrl} alt="" /></span>
      <button className="re-baro-turn re-baro-turn-left" onClick={() => rotate(-1)} aria-label="Decrease barometric pressure" />
      <button className="re-baro-turn re-baro-turn-right" onClick={() => rotate(1)} aria-label="Increase barometric pressure" />
      <div className="re-baro-axial-actions">
        <button className="re-baro-axial re-baro-push" onClick={() => actuateAxial('push')} aria-label="Push barometric pressure knob" />
        <button className="re-baro-axial re-baro-pull" onClick={() => actuateAxial('pull')} aria-label="Pull barometric pressure knob" />
      </div>
    </div>
  </div>
}

const efisModes = ['ILS', 'VOR', 'NAV', 'ARC', 'PLAN']
const modeAngles = [180, 135, 90, 45, 0]
const rangeAngles = [180, 135, 90, 45, 0, -45]
const svgRotationForAngle = (angle: number) => 90 - angle

function ModeControl({ mode, onRotate }: { mode: number; onRotate: (direction: 1 | -1) => void }) {
  const wheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault()
    onRotate(event.deltaY < 0 ? 1 : -1)
  }

  return <div className="re-mode-control" data-control="mode" onWheel={wheel} style={{ '--re-mode-rotation': `${svgRotationForAngle(modeAngles[mode])}deg` } as CSSProperties}>
    <img className="re-mode-selector-frame" src={modeSelectorFrameUrl} alt="" />
    <span className="re-mode-handle-wrap"><img className="re-mode-handle" src={modeHandleUrl} alt="" /></span>
    <button className="re-mode-turn re-mode-turn-left" onClick={() => onRotate(-1)} aria-label="Previous EFIS mode" />
    <button className="re-mode-turn re-mode-turn-right" onClick={() => onRotate(1)} aria-label="Next EFIS mode" />
    <span className="re-visually-hidden" aria-live="polite">{efisModes[mode]}</span>
  </div>
}

const efisRanges = ['10', '20', '40', '80', '160', '320']

function RangeControl({ range, onRotate }: { range: number; onRotate: (direction: 1 | -1) => void }) {
  const wheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault()
    onRotate(event.deltaY < 0 ? 1 : -1)
  }

  return <div className="re-range-control" data-control="range" onWheel={wheel} style={{ '--re-range-rotation': `${svgRotationForAngle(rangeAngles[range])}deg` } as CSSProperties}>
    <img className="re-range-selector-frame" src={rangeSelectorFrameUrl} alt="" />
    <span className="re-range-handle-wrap"><img className="re-range-handle" src={modeHandleUrl} alt="" /></span>
    <button className="re-range-turn re-range-turn-left" onClick={() => onRotate(-1)} aria-label="Previous EFIS range" />
    <button className="re-range-turn re-range-turn-right" onClick={() => onRotate(1)} aria-label="Next EFIS range" />
    <span className="re-visually-hidden" aria-live="polite">{efisRanges[range]}</span>
  </div>
}

export function EfisPanel({ state, send, side = 'captain', mirrored = false, schematic = false }: { state: EfisState; send: (command: CockpitCommand) => void; side?: EfisSide; mirrored?: boolean; schematic?: boolean }) {
  const efisRotate = (control: 'baro' | 'mode' | 'range' | 'nav1' | 'nav2', direction: 1 | -1) => send({ type: 'efis.rotate', side, control, direction })
  const pressButton = (control: 'fd' | 'ls' | EfisFilter) => send({ type: 'efis.button', side, control })

  return <section className={`real-efis ${mirrored ? 'is-mirrored' : ''} ${schematic ? 'is-schematic' : ''}`} aria-label={`${side === 'captain' ? 'Captain' : 'First officer'} EFIS control panel`}>
    <div className="re-surface-noise" />
    <i className="re-screw re-screw-tl" /><i className="re-screw re-screw-tr" />
    <i className="re-screw re-screw-bl" /><i className="re-screw re-screw-br" />

    <BaroDisplay inHg={state.baroInHg} std={state.baroStd} baro={state.baro} />
    <span className="re-divider" aria-hidden="true" />

    {optionButtons.map(item => <ButtonPlaceholder key={item.id} item={item} active={state.filters[item.id as EfisFilter]} onPress={() => pressButton(item.id as EfisFilter)} />)}
    {lowerButtons.map(item => <ButtonPlaceholder key={item.id} item={item} active={item.id === 'fd' ? state.fd : state.ls} onPress={() => pressButton(item.id as 'fd' | 'ls')} />)}

    <BaroControl inHg={state.baroInHg} onRotate={direction => efisRotate('baro', direction)} onToggleUnit={() => send({ type: 'efis.toggle', side, control: 'baroMode' })} onPush={() => send({ type: 'efis.push', side, control: 'baro' })} onPull={() => send({ type: 'efis.pull', side, control: 'baro' })} />
    <ModeControl mode={state.mode} onRotate={direction => efisRotate('mode', direction)} />
    <RangeControl range={state.range} onRotate={direction => efisRotate('range', direction)} />

    <NavSelectorPlaceholder id="nav1" index={1} x={270} y={275} position={state.nav1} onMove={direction => efisRotate('nav1', direction)} />
    <NavSelectorPlaceholder id="nav2" index={2} x={452} y={275} position={state.nav2} onMove={direction => efisRotate('nav2', direction)} />
  </section>
}
