import { useState, type CSSProperties, type WheelEvent } from 'react'
import overheadButtonTemplateUrl from '../assets/overhead/buttons/korry/template.svg'
import overheadButtonOffUrl from '../assets/overhead/buttons/korry/off-lit.svg'
import onBatLampSvg from '../assets/overhead/adirs/on-bat.svg?raw'
import adirsSelectorMarkingsUrl from '../assets/overhead/adirs/selector-markings.svg'
import adirsSelectorHandleUrl from '../assets/efis/knobs/mode/handle.svg'
import zoneTwoRoundButtonUrl from '../assets/overhead/zone-two/buttons/round.svg'
import zoneTwoGuardButtonUrl from '../assets/overhead/zone-two/guards/button.svg'
import zoneTwoSolidBlackClosedUrl from '../assets/overhead/zone-two/guards/solid-black-closed.svg'
import zoneTwoSolidBlackOpenUrl from '../assets/overhead/zone-two/guards/solid-black-open.svg'
import zoneTwoSolidRedClosedUrl from '../assets/overhead/zone-two/guards/solid-red-closed.svg'
import zoneTwoSolidRedOpenUrl from '../assets/overhead/zone-two/guards/solid-red-open.svg'
import zoneTwoWindowBlackClosedUrl from '../assets/overhead/zone-two/guards/window-black-closed.svg'
import zoneTwoWindowBlackOpenUrl from '../assets/overhead/zone-two/guards/window-black-open.svg'
import zoneTwoWindowRedClosedUrl from '../assets/overhead/zone-two/guards/window-red-closed.svg'
import zoneTwoWindowRedOpenUrl from '../assets/overhead/zone-two/guards/window-red-open.svg'
import zoneTwoToggleBaseUrl from '../assets/overhead/zone-two/toggle/base.svg'
import zoneTwoToggleUrl from '../assets/overhead/zone-two/toggle/switch.svg'
import zoneTwoWiperMarkingsUrl from '../assets/overhead/zone-two/wiper/markings.svg'
import type { CockpitCommand, KorryState, OverheadButton, OverheadSelector, OverheadState, ZoneTwoButton, ZoneTwoCover } from '../types'
import './overhead.css'

const WIDTH = 1860
const HEIGHT = 1410
const CAMERA_WIDTH = 1388
const CAMERA_HEIGHT = 340
const ADIRS_WIDTH = 1534
const ADIRS_HEIGHT = 1344
const FLIGHT_CONTROLS_WIDTH = 2244
const FLIGHT_CONTROLS_HEIGHT = 1314
const EVAC_RASTER_SPACE = { width: 587, height: 1213 } as const
const EVAC_DRAW_SPACE = {
  x: 1,
  y: 710,
  height: 700,
  width: 700 * EVAC_RASTER_SPACE.width / EVAC_RASTER_SPACE.height,
} as const
const EVAC_PANEL_WIDTH = EVAC_RASTER_SPACE.width
const EVAC_PANEL_HEIGHT = EVAC_RASTER_SPACE.height
const CAMERA_TYPE1_FASTENER_DIAMETER = 60
const CAMERA_TYPE2_FASTENER_DIAMETER = 76
const ADIRS_TYPE1_FASTENER_RADIUS = CAMERA_TYPE1_FASTENER_DIAMETER * ADIRS_WIDTH / CAMERA_WIDTH / 2
const ADIRS_TYPE2_FASTENER_RADIUS = CAMERA_TYPE2_FASTENER_DIAMETER * ADIRS_WIDTH / CAMERA_WIDTH / 2
const FLIGHT_CONTROLS_TYPE1_DIAMETER = CAMERA_TYPE1_FASTENER_DIAMETER * FLIGHT_CONTROLS_WIDTH / CAMERA_WIDTH
const FLIGHT_CONTROLS_TYPE2_DIAMETER = CAMERA_TYPE2_FASTENER_DIAMETER * FLIGHT_CONTROLS_WIDTH / CAMERA_WIDTH
const EVAC_TYPE1_FASTENER_DIAMETER = CAMERA_TYPE1_FASTENER_DIAMETER * EVAC_PANEL_WIDTH / CAMERA_WIDTH
const EVAC_TYPE2_FASTENER_DIAMETER = CAMERA_TYPE2_FASTENER_DIAMETER * EVAC_PANEL_WIDTH / CAMERA_WIDTH
const EVAC_KORRY_LAYOUT_SIZE = 84
const EVAC_KORRY_SIZE = 78
const EVAC_GUARD_LAYOUT_WIDTH = 88
const EVAC_GUARD_WIDTH = 82
const EVAC_WINDOW_GUARD_LAYOUT_HEIGHT = 92
const EVAC_WINDOW_GUARD_HEIGHT = 86
const EVAC_SOLID_GUARD_LAYOUT_HEIGHT = 104
const EVAC_SOLID_GUARD_HEIGHT = 97
const EVAC_ROUND_SCALE = 0.92
const EVAC_ROUND_DIAMETER = 66
const FLIGHT_CONTROLS_KORRY_SIZE = 190 * FLIGHT_CONTROLS_WIDTH / CAMERA_WIDTH
// Align the FAC 1 centre to ADR2 in world coordinates. The ADIRS host starts
// one panel unit farther right and is two units narrower than the FLT CTL host.
const FLIGHT_CONTROLS_RIGHT_KORRY_X = 1614.83585109713
const FLIGHT_CONTROLS_KORRY_GAP = 100

export type OverheadZone = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

export const overheadZoneBounds: Record<OverheadZone, { x: number; y: number; width: number; height: number }> = {
  1: { x: 0, y: 0, width: 424, height: 709 },
  2: { x: 0, y: 0, width: 424, height: 709 },
  3: { x: 0, y: 709, width: Math.ceil(EVAC_DRAW_SPACE.x + EVAC_DRAW_SPACE.width), height: 701 },
  4: { x: 426, y: 0, width: 1010, height: 332 },
  5: { x: 426, y: 332, width: 1010, height: 532 },
  6: { x: 426, y: 864, width: 1010, height: 546 },
  7: { x: 1436, y: 0, width: 424, height: 394 },
  8: { x: 1436, y: 394, width: 424, height: 350 },
  9: { x: 1436, y: 744, width: 424, height: 666 },
}

type RectBlock = { id: string; x: number; y: number; width: number; height: number }
type PolygonBlock = { id: string; points: Array<[number, number]> }

const rectangleBlocks: RectBlock[] = [
  { id: 'empty-upper-left', x: 0, y: 0, width: 424, height: 40 },
  { id: 'pa-cockpit-door-video', x: 0, y: 40, width: 424, height: 105 },
  { id: 'adirs', x: 0, y: 145, width: 424, height: 372 },
  { id: 'empty-left-divider', x: 0, y: 517, width: 424, height: 86 },
  { id: 'left-flight-controls', x: 0, y: 603, width: 424, height: 106 },

  { id: 'empty-upper-center', x: 426, y: 0, width: 1010, height: 164 },
  { id: 'engine-fire', x: 426, y: 164, width: 1010, height: 168 },
  { id: 'hydraulic-fuel', x: 426, y: 332, width: 1010, height: 296 },
  { id: 'electrical', x: 426, y: 628, width: 1010, height: 236 },
  { id: 'air-conditioning', x: 426, y: 864, width: 1010, height: 254 },
  { id: 'ice-apu-heat-lights-pressurization', x: 426, y: 1118, width: 1010, height: 292 },

  { id: 'radio-controls', x: 1436, y: 0, width: 424, height: 202 },
  { id: 'empty-upper-right', x: 1436, y: 202, width: 424, height: 192 },
  { id: 'empty-right-center', x: 1436, y: 394, width: 424, height: 244 },
  { id: 'right-flight-controls', x: 1436, y: 638, width: 424, height: 106 },
]

const polygonBlocks: PolygonBlock[] = [
  {
    id: 'evac-emergency-gpws-recorder-oxygen-calls-rain-wipers',
    points: [
      [EVAC_DRAW_SPACE.x, EVAC_DRAW_SPACE.y],
      [EVAC_DRAW_SPACE.x, EVAC_DRAW_SPACE.y + 547],
      [EVAC_DRAW_SPACE.x + EVAC_DRAW_SPACE.width, EVAC_DRAW_SPACE.y + EVAC_DRAW_SPACE.height - 1],
      [EVAC_DRAW_SPACE.x + EVAC_DRAW_SPACE.width, EVAC_DRAW_SPACE.y],
    ],
  },
  { id: 'ventilation', points: [[1437, 745], [1437, 1409], [1859, 1257], [1859, 745]] },
]

const blockNumbers: Record<string, number> = {
  'empty-upper-left': 1,
  'pa-cockpit-door-video': 2,
  adirs: 3,
  'empty-left-divider': 4,
  'left-flight-controls': 5,
  'evac-emergency-gpws-recorder-oxygen-calls-rain-wipers': 6,
  'empty-upper-center': 7,
  'engine-fire': 8,
  'hydraulic-fuel': 9,
  electrical: 10,
  'air-conditioning': 11,
  'ice-apu-heat-lights-pressurization': 12,
  'radio-controls': 13,
  'empty-upper-right': 14,
  'empty-right-center': 15,
  'right-flight-controls': 16,
  ventilation: 17,
}

const blockLabels = [
  { x: 212, y: 331, lines: ['ADIRS'] },
  { x: 931, y: 253, lines: ['ENG FIRE'] },
  { x: 931, y: 487, lines: ['HYD · FUEL'] },
  { x: 931, y: 752, lines: ['ELEC'] },
  { x: 931, y: 999, lines: ['AIR COND'] },
  { x: 931, y: 1248, lines: ['A-ICE · APU · WINDOW HEAT', 'LIGHTS · CABIN PRESS'] },
  { x: 1648, y: 105, lines: ['RADIO CONTROLS'] },
  { x: 1648, y: 696, lines: ['FLT CTL'] },
  { x: 1648, y: 1006, lines: ['VENTILATION'] },
]

function points(pointsValue: Array<[number, number]>) {
  return pointsValue.map(([x, y]) => `${x},${y}`).join(' ')
}

function cameraRect(x: number, y: number, width: number, height: number): CSSProperties {
  return { left: `${x / CAMERA_WIDTH * 100}%`, top: `${y / CAMERA_HEIGHT * 100}%`, width: `${width / CAMERA_WIDTH * 100}%`, height: `${height / CAMERA_HEIGHT * 100}%` }
}

function cameraCenter(x: number, y: number, diameter: number): CSSProperties {
  return { left: `${x / CAMERA_WIDTH * 100}%`, top: `${y / CAMERA_HEIGHT * 100}%`, width: `${diameter / CAMERA_WIDTH * 100}%`, aspectRatio: '1' }
}

function adirsCenter(x: number, y: number, radius: number): CSSProperties {
  return { left: `${x / ADIRS_WIDTH * 100}%`, top: `${y / ADIRS_HEIGHT * 100}%`, width: `${radius * 2 / ADIRS_WIDTH * 100}%`, aspectRatio: '1' }
}

function adirsRect(x: number, y: number, width: number, height: number): CSSProperties {
  return { left: `${x / ADIRS_WIDTH * 100}%`, top: `${y / ADIRS_HEIGHT * 100}%`, width: `${width / ADIRS_WIDTH * 100}%`, height: `${height / ADIRS_HEIGHT * 100}%` }
}

function flightControlsCenter(x: number, y: number, diameter: number): CSSProperties {
  return { left: `${x / FLIGHT_CONTROLS_WIDTH * 100}%`, top: `${y / FLIGHT_CONTROLS_HEIGHT * 100}%`, width: `${diameter / FLIGHT_CONTROLS_WIDTH * 100}%`, aspectRatio: '1' }
}

function flightControlsSquare(x: number, y: number, size: number): CSSProperties {
  return { left: `${x / FLIGHT_CONTROLS_WIDTH * 100}%`, top: `${y / FLIGHT_CONTROLS_HEIGHT * 100}%`, width: `${size / FLIGHT_CONTROLS_WIDTH * 100}%`, aspectRatio: '1' }
}

function evacRasterPointToDraw(x: number, y: number) {
  return {
    x: x / EVAC_RASTER_SPACE.width * EVAC_DRAW_SPACE.width,
    y: y / EVAC_RASTER_SPACE.height * EVAC_DRAW_SPACE.height,
  }
}

function evacRasterRectToDraw(x: number, y: number, width: number, height: number) {
  const origin = evacRasterPointToDraw(x, y)
  return {
    ...origin,
    width: width / EVAC_RASTER_SPACE.width * EVAC_DRAW_SPACE.width,
    height: height / EVAC_RASTER_SPACE.height * EVAC_DRAW_SPACE.height,
  }
}

function evacPanelRect(x: number, y: number, width: number, height: number): CSSProperties {
  const drawRect = evacRasterRectToDraw(x, y, width, height)
  return {
    left: `${drawRect.x / EVAC_DRAW_SPACE.width * 100}%`,
    top: `${drawRect.y / EVAC_DRAW_SPACE.height * 100}%`,
    width: `${drawRect.width / EVAC_DRAW_SPACE.width * 100}%`,
    height: `${drawRect.height / EVAC_DRAW_SPACE.height * 100}%`,
  }
}

function evacPanelCenter(x: number, y: number, diameter: number): CSSProperties {
  const drawPoint = evacRasterPointToDraw(x, y)
  const drawSize = evacRasterRectToDraw(0, 0, diameter, diameter)
  return {
    left: `${drawPoint.x / EVAC_DRAW_SPACE.width * 100}%`,
    top: `${drawPoint.y / EVAC_DRAW_SPACE.height * 100}%`,
    width: `${drawSize.width / EVAC_DRAW_SPACE.width * 100}%`,
    height: `${drawSize.height / EVAC_DRAW_SPACE.height * 100}%`,
  }
}

const evacHostStyle: CSSProperties = {
  left: `${EVAC_DRAW_SPACE.x / WIDTH * 100}%`,
  top: `${EVAC_DRAW_SPACE.y / HEIGHT * 100}%`,
  width: `${EVAC_DRAW_SPACE.width / WIDTH * 100}%`,
  height: `${EVAC_DRAW_SPACE.height / HEIGHT * 100}%`,
}

function evacPanelChannel(x: number, y: number, diameter: number, side: 'left' | 'right'): CSSProperties {
  const drawPoint = evacRasterPointToDraw(x, y)
  const drawDiameter = evacRasterRectToDraw(0, 0, diameter, diameter).height
  const width = side === 'left' ? drawPoint.x : EVAC_DRAW_SPACE.width - drawPoint.x
  return {
    left: side === 'left' ? '-1px' : `${drawPoint.x / EVAC_DRAW_SPACE.width * 100}%`,
    top: `${drawPoint.y / EVAC_DRAW_SPACE.height * 100}%`,
    width: `calc(${width / EVAC_DRAW_SPACE.width * 100}% + 1px)`,
    height: `${drawDiameter / EVAC_DRAW_SPACE.height * 100}%`,
    transform: 'translateY(-50%)',
  }
}

function flightControlsChannel(x: number, y: number, diameter: number, side: 'left' | 'right'): CSSProperties {
  const width = (side === 'left' ? x : FLIGHT_CONTROLS_WIDTH - x) / FLIGHT_CONTROLS_WIDTH * 100
  return {
    left: side === 'left' ? '-1px' : `${x / FLIGHT_CONTROLS_WIDTH * 100}%`,
    top: `${y / FLIGHT_CONTROLS_HEIGHT * 100}%`,
    width: `calc(${width}% + 1px)`,
    height: `${diameter / FLIGHT_CONTROLS_WIDTH * 100}cqw`,
    transform: 'translateY(-50%)',
  }
}

function edgeChannel(x: number, y: number, radius: number, panelWidth: number, panelHeight: number, side: 'left' | 'right'): CSSProperties {
  const channelWidth = (side === 'left' ? x : panelWidth - x) / panelWidth * 100
  return {
    left: side === 'left' ? '-1px' : `${x / panelWidth * 100}%`,
    top: `${(y - radius) / panelHeight * 100}%`,
    width: `calc(${channelWidth}% + 1px)`,
    height: `${radius * 2 / panelHeight * 100}%`,
  }
}

function CameraDoorPanel({ state, send }: { state?: KorryState; send?: (command: CockpitCommand) => void }) {
  const [fallbackOff, setFallbackOff] = useState(false)
  const pushed = state?.pushed ?? !fallbackOff
  const lowerLight = state?.lowerLight ?? fallbackOff
  const upperLight = state?.upperLight ?? false
  const press = () => send ? send({ type: 'overhead.button', control: 'cockpitDoorVideo' }) : setFallbackOff(value => !value)

  return <div className="ov-camera-host" data-block="pa-cockpit-door-video">
    <div className="ov-camera-panel">
      <span className="ov-camera-divider" aria-hidden="true" />
      <span className="ov-camera-title">COCKPIT<br />DOOR VIDEO</span>

      <i className="ov-fastener ov-fastener-type1" style={cameraCenter(158, 256, CAMERA_TYPE1_FASTENER_DIAMETER)} />
      <i className="ov-fastener ov-fastener-type1" style={cameraCenter(1266, 68, CAMERA_TYPE1_FASTENER_DIAMETER)} />
      <span className="ov-type2-channel" style={edgeChannel(46, 94, CAMERA_TYPE2_FASTENER_DIAMETER / 2, CAMERA_WIDTH, CAMERA_HEIGHT, 'left')} aria-hidden="true" />
      <span className="ov-type2-channel" style={edgeChannel(1342, 248, CAMERA_TYPE2_FASTENER_DIAMETER / 2, CAMERA_WIDTH, CAMERA_HEIGHT, 'right')} aria-hidden="true" />
      <i className="ov-fastener ov-fastener-type2" style={cameraCenter(46, 94, CAMERA_TYPE2_FASTENER_DIAMETER)} />
      <i className="ov-fastener ov-fastener-type2" style={cameraCenter(1342, 248, CAMERA_TYPE2_FASTENER_DIAMETER)} />

      <button className={`ov-camera-korry ${lowerLight ? 'is-off' : ''} ${pushed ? 'is-pushed' : ''} ${upperLight ? 'has-fault' : ''}`} style={cameraRect(1018, 110, 190, 190)} onClick={press} aria-pressed={pushed} aria-label="Cockpit door video">
        <img src={lowerLight ? overheadButtonOffUrl : overheadButtonTemplateUrl} alt="" />
        <span className="ov-korry-fault">FAULT</span>
        <span className="ov-korry-off">OFF</span>
      </button>
    </div>
  </div>
}

function AdirsKorry({ x, y, state, onPress }: { x: number; y: number; state?: KorryState; onPress?: () => void }) {
  const [fallbackOff, setFallbackOff] = useState(false)
  const pushed = state?.pushed ?? !fallbackOff
  const lowerLight = state?.lowerLight ?? fallbackOff
  const upperLight = state?.upperLight ?? false
  const press = () => onPress ? onPress() : setFallbackOff(value => !value)

  return <button className={`ov-camera-korry ov-adirs-korry ${lowerLight ? 'is-off' : ''} ${pushed ? 'is-pushed' : ''} ${upperLight ? 'has-fault' : ''}`} type="button" style={adirsRect(x, y, 210, 210)} onClick={press} aria-pressed={pushed}>
    <img src={lowerLight ? overheadButtonOffUrl : overheadButtonTemplateUrl} alt="" />
    <span className="ov-korry-fault">FAULT</span>
    <span className="ov-korry-off">OFF</span>
  </button>
}

function AdirsSelector({ x, position, onRotate, onSet }: { x: number; position?: number; onRotate?: (direction: 1 | -1) => void; onSet?: (position: 0 | 1 | 2) => void }) {
  const [fallbackPosition, setFallbackPosition] = useState(1)
  const selectedPosition = Math.max(0, Math.min(2, Math.round(position ?? fallbackPosition))) as 0 | 1 | 2
  const rotation = [-45, 0, 45][selectedPosition]
  const rotate = (direction: 1 | -1) => {
    if (onRotate) onRotate(direction)
    else setFallbackPosition(value => Math.max(0, Math.min(2, value + direction)))
  }
  const rotateWithWheel = (event: WheelEvent<HTMLElement>) => {
    event.preventDefault()
    rotate(event.deltaY < 0 ? 1 : -1)
  }
  const cycle = () => {
    const next = (selectedPosition + 1) % 3 as 0 | 1 | 2
    if (onSet) onSet(next)
    else setFallbackPosition(next)
  }

  return <>
    <img className="ov-adirs-selector-markings" src={adirsSelectorMarkingsUrl} alt="" style={adirsRect(x - 204.381, 649.048, 373.778, 139.937)} />
    <div className="ov-adirs-selector" style={{ ...adirsCenter(x, 854, 120), '--selector-rotation': `${rotation}deg` } as CSSProperties} onWheel={rotateWithWheel}>
      <img src={adirsSelectorHandleUrl} alt="" style={{ transform: `rotate(${rotation}deg)` }} />
      <button className="control-direction-hit is-left" type="button" onClick={() => rotate(-1)} disabled={selectedPosition === 0} aria-label="Rotate ADIRS selector left" />
      <button className="control-direction-hit is-right" type="button" onClick={() => rotate(1)} disabled={selectedPosition === 2} aria-label="Rotate ADIRS selector right" />
    </div>
  </>
}

function AdirsPanel({ state, send }: { state?: OverheadState['adirs']; send?: (command: CockpitCommand) => void }) {
  const columns = [225, 665.5, 1106]
  const systemOrder = [1, 3, 2] as const
  const onBat = state?.onBat ?? false
  const press = (control: OverheadButton) => send?.({ type: 'overhead.button', control })
  const rotate = (control: OverheadSelector, direction: 1 | -1) => send?.({ type: 'overhead.rotate', control, direction })
  const set = (control: OverheadSelector, value: 0 | 1 | 2) => send?.({ type: 'overhead.set', control, value })

  return <div className="ov-adirs-host" data-block="adirs">
    <div className="ov-adirs-panel">
      <span className="ov-adirs-title">ADIRS</span>
      <span className={`ov-adirs-on-bat ${onBat ? 'is-on' : ''}`} style={adirsRect(632, 112, 270, 132)} role="status" aria-label={`ON BAT annunciator ${onBat ? 'on' : 'off'}`}>
        <span className="ov-adirs-on-bat-art" dangerouslySetInnerHTML={{ __html: onBatLampSvg }} />
      </span>

      {columns.map((x, index) => <span key={`ir-label-${index}`} className="ov-adirs-control-label ov-adirs-ir-label" style={adirsRect(x, 323, 210, 40)}>IR{systemOrder[index]}</span>)}
      {columns.map((x, index) => {
        const system = systemOrder[index]
        return <AdirsKorry key={`ir-${system}`} x={x} y={371} state={state?.ir[system - 1]} onPress={send ? () => press(`ir${system}` as OverheadButton) : undefined} />
      })}
      {columns.map((x, index) => {
        const system = systemOrder[index]
        const control = `ir${system}Mode` as OverheadSelector
        return <AdirsSelector key={`selector-${system}`} x={x + 105} position={state?.selectors[system - 1]} onRotate={send ? direction => rotate(control, direction) : undefined} onSet={send ? value => set(control, value) : undefined} />
      })}
      {columns.map((x, index) => {
        const system = systemOrder[index]
        return <AdirsKorry key={`adr-${system}`} x={x} y={1080} state={state?.adr[system - 1]} onPress={send ? () => press(`adr${system}` as OverheadButton) : undefined} />
      })}
      {columns.map((x, index) => <span key={`adr-label-${index}`} className="ov-adirs-control-label ov-adirs-adr-label" style={adirsRect(x, 1032, 210, 40)}>ADR{systemOrder[index]}</span>)}

      <i className="ov-fastener ov-fastener-type1" style={adirsCenter(564, 76, ADIRS_TYPE1_FASTENER_RADIUS)} />
      <i className="ov-fastener ov-fastener-type1" style={adirsCenter(1014, 338, ADIRS_TYPE1_FASTENER_RADIUS)} />
      <i className="ov-fastener ov-fastener-type1" style={adirsCenter(168, 662, ADIRS_TYPE1_FASTENER_RADIUS)} />
      <i className="ov-fastener ov-fastener-type1" style={adirsCenter(1372, 662, ADIRS_TYPE1_FASTENER_RADIUS)} />
      <i className="ov-fastener ov-fastener-type1" style={adirsCenter(1014, 1282, ADIRS_TYPE1_FASTENER_RADIUS)} />

      <span className="ov-adirs-cutout" style={edgeChannel(40, 132, ADIRS_TYPE2_FASTENER_RADIUS, ADIRS_WIDTH, ADIRS_HEIGHT, 'left')} aria-hidden="true" />
      <span className="ov-adirs-cutout" style={edgeChannel(1494, 132, ADIRS_TYPE2_FASTENER_RADIUS, ADIRS_WIDTH, ADIRS_HEIGHT, 'right')} aria-hidden="true" />
      <span className="ov-adirs-cutout" style={edgeChannel(40, 1216, ADIRS_TYPE2_FASTENER_RADIUS, ADIRS_WIDTH, ADIRS_HEIGHT, 'left')} aria-hidden="true" />
      <span className="ov-adirs-cutout" style={edgeChannel(1494, 1216, ADIRS_TYPE2_FASTENER_RADIUS, ADIRS_WIDTH, ADIRS_HEIGHT, 'right')} aria-hidden="true" />
      <i className="ov-fastener ov-fastener-type2" style={adirsCenter(40, 132, ADIRS_TYPE2_FASTENER_RADIUS)} />
      <i className="ov-fastener ov-fastener-type2" style={adirsCenter(1494, 132, ADIRS_TYPE2_FASTENER_RADIUS)} />
      <i className="ov-fastener ov-fastener-type2" style={adirsCenter(40, 1216, ADIRS_TYPE2_FASTENER_RADIUS)} />
      <i className="ov-fastener ov-fastener-type2" style={adirsCenter(1494, 1216, ADIRS_TYPE2_FASTENER_RADIUS)} />
    </div>
  </div>
}

function FlightControlsKorry({ x, label, state, onPress }: { x: number; label: string; state?: KorryState; onPress?: () => void }) {
  const [fallbackPushed, setFallbackPushed] = useState(true)
  const pushed = state?.pushed ?? fallbackPushed
  const lowerLight = state?.lowerLight ?? !fallbackPushed
  const upperLight = state?.upperLight ?? false
  const press = () => onPress ? onPress() : setFallbackPushed(value => !value)

  return <>
    <span className="ov-flight-controls-button-label" style={{ left: `${(x + FLIGHT_CONTROLS_KORRY_SIZE / 2) / FLIGHT_CONTROLS_WIDTH * 100}%` }}>{label}</span>
    <button className={`ov-camera-korry ov-flight-controls-korry ${lowerLight ? 'is-off' : ''} ${pushed ? 'is-pushed' : ''} ${upperLight ? 'has-fault' : ''}`} type="button" style={flightControlsSquare(x, 858, FLIGHT_CONTROLS_KORRY_SIZE)} onClick={press} aria-pressed={pushed} aria-label={label}>
      <img src={lowerLight ? overheadButtonOffUrl : overheadButtonTemplateUrl} alt="" />
      <span className="ov-korry-fault">FAULT</span>
      <span className="ov-korry-off">OFF</span>
    </button>
  </>
}

function FlightControlsPanel({ state, send }: { state?: OverheadState['flightControls']; send?: (command: CockpitCommand) => void }) {
  const buttonPitch = FLIGHT_CONTROLS_KORRY_SIZE + FLIGHT_CONTROLS_KORRY_GAP
  const buttonXs = [FLIGHT_CONTROLS_RIGHT_KORRY_X - buttonPitch * 2, FLIGHT_CONTROLS_RIGHT_KORRY_X - buttonPitch, FLIGHT_CONTROLS_RIGHT_KORRY_X]
  const controls: Array<{ label: string; control: Extract<OverheadButton, 'elac1' | 'sec1' | 'fac1'>; state?: KorryState }> = [
    { label: 'ELAC 1', control: 'elac1', state: state?.elac1 },
    { label: 'SEC 1', control: 'sec1', state: state?.sec1 },
    { label: 'FAC 1', control: 'fac1', state: state?.fac1 },
  ]

  return <div className="ov-flight-controls-host" data-block="left-flight-controls">
    <div className="ov-flight-controls-panel">
      <span className="ov-flight-controls-title">FLT CTL</span>
      {controls.map((item, index) => <FlightControlsKorry key={item.control} x={buttonXs[index]} label={item.label} state={item.state} onPress={send ? () => send({ type: 'overhead.button', control: item.control }) : undefined} />)}

      <span className="ov-flight-controls-cutout" style={flightControlsChannel(2162, 204, FLIGHT_CONTROLS_TYPE2_DIAMETER, 'right')} aria-hidden="true" />
      <span className="ov-flight-controls-cutout" style={flightControlsChannel(78, 334, FLIGHT_CONTROLS_TYPE2_DIAMETER, 'left')} aria-hidden="true" />
      <span className="ov-flight-controls-cutout" style={flightControlsChannel(78, 812, FLIGHT_CONTROLS_TYPE2_DIAMETER, 'left')} aria-hidden="true" />
      <span className="ov-flight-controls-cutout" style={flightControlsChannel(2162, 1042, FLIGHT_CONTROLS_TYPE2_DIAMETER, 'right')} aria-hidden="true" />
      <i className="ov-fastener ov-fastener-type2" style={flightControlsCenter(2162, 204, FLIGHT_CONTROLS_TYPE2_DIAMETER)} />
      <i className="ov-fastener ov-fastener-type2" style={flightControlsCenter(78, 334, FLIGHT_CONTROLS_TYPE2_DIAMETER)} />
      <i className="ov-fastener ov-fastener-type2" style={flightControlsCenter(78, 812, FLIGHT_CONTROLS_TYPE2_DIAMETER)} />
      <i className="ov-fastener ov-fastener-type2" style={flightControlsCenter(2162, 1042, FLIGHT_CONTROLS_TYPE2_DIAMETER)} />
      <i className="ov-fastener ov-fastener-type1" style={flightControlsCenter(296, 1190, FLIGHT_CONTROLS_TYPE1_DIAMETER)} />
      <i className="ov-fastener ov-fastener-type1" style={flightControlsCenter(2018, 688, FLIGHT_CONTROLS_TYPE1_DIAMETER)} />
    </div>
  </div>
}

function EvacLabel({ x, y, width, height, lines, className = '' }: { x: number; y: number; width: number; height: number; lines: string[]; className?: string }) {
  return <span className={`ov-evac-label ${className}`} style={evacPanelRect(x, y, width, height)}>{lines.map(line => <span key={line}>{line}</span>)}</span>
}

function EvacControlLabel({ x, width, controlTop, lines }: { x: number; width: number; controlTop: number; lines: string[] }) {
  const lineHeight = 15
  const gap = 2
  const height = lineHeight * lines.length
  return <EvacLabel x={x} y={controlTop - gap - height} width={width} height={height} lines={lines} className="is-control-label" />
}

function EvacKorry({ x, y, upper, lower, blank = false, framelessBlank = false, upperLit = false, defaultActive = false, interactive = true, state, onPress, label, className: extraClassName = '' }: { x: number; y: number; upper?: string; lower?: string; blank?: boolean; framelessBlank?: boolean; upperLit?: boolean; defaultActive?: boolean; interactive?: boolean; state?: KorryState; onPress?: () => void; label: string; className?: string }) {
  const [active, setActive] = useState(defaultActive)
  const pushed = state?.pushed ?? active
  const resolvedUpperLit = state?.upperLight ?? upperLit
  const inset = (EVAC_KORRY_LAYOUT_SIZE - EVAC_KORRY_SIZE) / 2
  const lowerLit = state?.lowerLight ?? false
  const blueLowerLight = extraClassName.split(/\s+/).includes('is-blue-lower')
  const className = `ov-camera-korry ov-evac-korry ${lowerLit ? 'is-off' : ''} ${pushed ? 'is-pushed' : ''} ${resolvedUpperLit ? 'has-fault' : ''} ${blank ? 'is-blank' : ''} ${framelessBlank ? 'is-frameless-blank' : ''} ${interactive ? '' : 'is-static'} ${extraClassName}`
  const style = evacPanelRect(x + inset, y + inset, EVAC_KORRY_SIZE, EVAC_KORRY_SIZE)
  const contents = <>
    {!framelessBlank && <img src={lowerLit && lower && !blueLowerLight ? overheadButtonOffUrl : overheadButtonTemplateUrl} alt="" />}
    {upper && <span className="ov-korry-fault">{upper}</span>}
    {lower && <span className="ov-korry-off">{lower}</span>}
    {blank && !framelessBlank && <span className="ov-evac-korry-blank" />}
  </>

  if (!interactive) return <div className={className} style={style} role="img" aria-label={label}>{contents}</div>

  return <button className={className} type="button" style={style} onClick={onPress ?? (() => setActive(value => !value))} aria-pressed={pushed} aria-label={label}>{contents}</button>
}

function EvacRoundButton({ x, y, label, diameter = EVAC_ROUND_DIAMETER, onPress }: { x: number; y: number; label: string; diameter?: number; onPress?: () => void }) {
  return <div className="ov-evac-round" style={evacPanelCenter(x, y, diameter * EVAC_ROUND_SCALE)}>
    <img src={zoneTwoRoundButtonUrl} alt="" />
    <button className="ov-evac-round-hit" type="button" onClick={onPress} aria-label={label} />
  </div>
}

type EvacGuardKind = 'window' | 'solid'
type EvacGuardColor = 'black' | 'red'

function EvacGuardedButton({ x, y, kind, color, lower = '', label, latching = true, open: controlledOpen, pressed: controlledPressed, lowerLit: controlledLowerLit, onOpenChange, onPress }: { x: number; y: number; kind: EvacGuardKind; color: EvacGuardColor; lower?: string; label: string; latching?: boolean; open?: boolean; pressed?: boolean; lowerLit?: boolean; onOpenChange?: (open: boolean) => void; onPress?: () => void }) {
  const [open, setOpen] = useState(false)
  const [pressed, setPressed] = useState(false)
  const [momentaryPressed, setMomentaryPressed] = useState(false)
  const layoutHeight = kind === 'window' ? EVAC_WINDOW_GUARD_LAYOUT_HEIGHT : EVAC_SOLID_GUARD_LAYOUT_HEIGHT
  const height = kind === 'window' ? EVAC_WINDOW_GUARD_HEIGHT : EVAC_SOLID_GUARD_HEIGHT
  const leftInset = (EVAC_GUARD_LAYOUT_WIDTH - EVAC_GUARD_WIDTH) / 2
  const topInset = (layoutHeight - height) / 2
  const capUrls = kind === 'window'
    ? color === 'red'
      ? { closed: zoneTwoWindowRedClosedUrl, open: zoneTwoWindowRedOpenUrl }
      : { closed: zoneTwoWindowBlackClosedUrl, open: zoneTwoWindowBlackOpenUrl }
    : color === 'red'
      ? { closed: zoneTwoSolidRedClosedUrl, open: zoneTwoSolidRedOpenUrl }
      : { closed: zoneTwoSolidBlackClosedUrl, open: zoneTwoSolidBlackOpenUrl }

  const isOpen = controlledOpen ?? open
  const changeOpen = (value: boolean) => onOpenChange ? onOpenChange(value) : setOpen(value)
  const visuallyPressed = controlledPressed ?? (latching ? pressed : momentaryPressed)
  const lowerLit = controlledLowerLit ?? (controlledPressed === undefined && latching ? pressed : false)

  return <div
    className={`ov-evac-guard ${kind === 'solid' ? 'is-solid' : 'is-window'} ${latching ? 'is-latching' : 'is-momentary'} ${isOpen ? 'is-open' : ''} ${visuallyPressed ? 'is-pressed' : ''} ${lowerLit ? 'is-lower-lit' : ''}`}
    style={evacPanelRect(x + leftInset, y + topInset, EVAC_GUARD_WIDTH, height)}
  >
    <div className="ov-evac-guard-under">
      <img className="ov-evac-guard-button" src={kind === 'solid' ? zoneTwoGuardButtonUrl : lowerLit ? overheadButtonOffUrl : overheadButtonTemplateUrl} alt="" />
      {lower && <span className="ov-evac-guard-button-label">{lower}</span>}
      <button
        className="ov-evac-guard-button-hit"
        type="button"
        disabled={!isOpen}
        onClick={latching ? (onPress ?? (() => setPressed(value => !value))) : undefined}
        onPointerDown={!latching ? () => { setMomentaryPressed(true); onPress?.() } : undefined}
        onPointerUp={!latching ? () => setMomentaryPressed(false) : undefined}
        onPointerCancel={!latching ? () => setMomentaryPressed(false) : undefined}
        onPointerLeave={!latching ? () => setMomentaryPressed(false) : undefined}
        onKeyDown={!latching ? event => {
          if (event.key === 'Enter' || event.key === ' ') setMomentaryPressed(true)
        } : undefined}
        onKeyUp={!latching ? () => setMomentaryPressed(false) : undefined}
        onBlur={!latching ? () => setMomentaryPressed(false) : undefined}
        aria-label={label}
        aria-pressed={visuallyPressed}
      />
    </div>
    <button className="ov-evac-guard-cap-hit" type="button" onClick={() => changeOpen(!isOpen)} aria-label={`${isOpen ? 'Close' : 'Open'} ${label} guard`} aria-expanded={isOpen}>
      <img className="ov-evac-guard-cap" src={isOpen ? capUrls.open : capUrls.closed} alt="" />
    </button>
  </div>
}

function EvacToggle({ x, y, size = 72, value, onSet }: { x: number; y: number; size?: number; value?: boolean; onSet?: (value: boolean) => void }) {
  const [up, setUp] = useState(true)
  const selectedUp = value ?? up
  const select = (next: boolean) => onSet ? onSet(next) : setUp(next)
  return <div className="ov-evac-toggle" style={evacPanelRect(x, y, size, size)} role="group" aria-label="EVAC CAPT and PURS selector">
    <img className="ov-evac-toggle-base" src={zoneTwoToggleBaseUrl} alt="" />
    <img className={`ov-evac-toggle-handle ${selectedUp ? 'is-up' : 'is-down'}`} src={zoneTwoToggleUrl} alt="" />
    <button className="control-direction-hit is-up" type="button" onClick={() => select(true)} disabled={selectedUp} aria-label="Set EVAC selector to CAPT and PURS" />
    <button className="control-direction-hit is-down" type="button" onClick={() => select(false)} disabled={!selectedUp} aria-label="Set EVAC selector to CAPT" />
  </div>
}

function WiperControl({ separatorY, position: controlledPosition, onSet }: { separatorY: number; position?: number; onSet?: (value: 0 | 1 | 2) => void }) {
  const [position, setPosition] = useState(0)
  const selectedPosition = Math.max(0, Math.min(2, Math.round(controlledPosition ?? position))) as 0 | 1 | 2
  const rotation = [0, 60, 120][selectedPosition]
  const set = (value: 0 | 1 | 2) => onSet ? onSet(value) : setPosition(value)
  const move = (direction: 1 | -1) => set(Math.max(0, Math.min(2, selectedPosition + direction)) as 0 | 1 | 2)
  const wheel = (event: WheelEvent<HTMLButtonElement>) => {
    event.preventDefault()
    move(event.deltaY < 0 ? 1 : -1)
  }
  const centerX = 430
  const sourceScale = 2 / 3
  const sourceMarkingsWidth = 174
  const sourceMarkingsHeight = 181
  const sourceHandleSize = 162
  const sourceHandleTop = 39
  const sourceHandleRight = 71
  const handleSize = sourceHandleSize * sourceScale
  const handleTop = separatorY + 69
  const handleLeft = centerX - handleSize / 2
  const markingsWidth = sourceMarkingsWidth * sourceScale
  const markingsHeight = sourceMarkingsHeight * sourceScale
  const markingsLeft = handleLeft - (sourceMarkingsWidth - sourceHandleRight - sourceHandleSize) * sourceScale
  const markingsTop = handleTop - sourceHandleTop * sourceScale

  return <>
    <img className="ov-evac-wiper-markings" style={evacPanelRect(markingsLeft, markingsTop, markingsWidth, markingsHeight)} src={zoneTwoWiperMarkingsUrl} alt="" />
    <button className="ov-evac-wiper-handle" type="button" style={evacPanelRect(handleLeft, handleTop, handleSize, handleSize)} onClick={() => set((selectedPosition + 1) % 3 as 0 | 1 | 2)} onWheel={wheel} aria-label={`Wiper ${['OFF', 'SLOW', 'FAST'][selectedPosition]}`}>
      <svg className="ov-evac-wiper-rotor" viewBox="0 0 162 165" overflow="visible" aria-hidden="true">
        <defs>
          <linearGradient id="wiper-handle-face" x1="81" y1="0" x2="81" y2="50" gradientUnits="userSpaceOnUse">
            <stop stopColor="#595959" />
            <stop offset="1" stopColor="#939393" />
          </linearGradient>
        </defs>
        <circle className="ov-evac-wiper-base" cx="81" cy="81.983" r="81" />
        <g className="ov-evac-wiper-moving" style={{ transform: `rotate(${rotation}deg)` }}>
          <path d="M111.535 154.345C103.959 157.425 95.8125 159.393 87.2969 160.044H74.7852C66.2695 159.393 58.1227 157.425 50.5469 154.345V50.4559H111.535V154.345Z" fill="#939393" />
          <path d="M111.576 50.4561H50.5059L77.6943 4H84.3877L111.576 50.4561Z" fill="url(#wiper-handle-face)" />
          <rect x="80.0471" y="4.08002" width="1.90588" height="64.8" fill="#f8ff96" />
        </g>
      </svg>
    </button>
  </>
}

function EvacPanel({ state, send }: { state?: OverheadState['zoneTwo']; send?: (command: CockpitCommand) => void }) {
  const press = (control: ZoneTwoButton) => send?.({ type: 'overhead.zone2.button', control })
  const setCover = (control: ZoneTwoCover, open: boolean) => send?.({ type: 'overhead.zone2.cover', control, open })
  const evacSwitchSize = 72 * 1.1
  const evacHorizontalGap = 55
  const evacRightMargin = 55
  const evacControlCenterY = 86
  const evacSwitchLeft = EVAC_PANEL_WIDTH - evacRightMargin - evacSwitchSize
  const evacSwitchCenterX = evacSwitchLeft + evacSwitchSize / 2
  const evacHornLeft = evacSwitchLeft - evacHorizontalGap - 72
  const evacHornCenterX = evacHornLeft + 36
  const evacCommandLeft = evacHornLeft - evacHorizontalGap - 88
  const evacCommandCenterX = evacCommandLeft + 44
  const evacSwitchTop = evacControlCenterY - evacSwitchSize / 2
  const ratIndicatorY = 215
  const korryInset = (EVAC_KORRY_LAYOUT_SIZE - EVAC_KORRY_SIZE) / 2
  const ratIndicatorX = evacHornCenterX - EVAC_KORRY_LAYOUT_SIZE / 2
  const ratIndicatorTop = ratIndicatorY + korryInset
  const ratIndicatorRight = ratIndicatorX + korryInset + EVAC_KORRY_SIZE
  const ratIndicatorBottom = ratIndicatorY + korryInset + EVAC_KORRY_SIZE
  const solidGuardInset = (EVAC_GUARD_LAYOUT_WIDTH - EVAC_GUARD_WIDTH) / 2
  const solidGuardTopInset = (EVAC_SOLID_GUARD_LAYOUT_HEIGHT - EVAC_SOLID_GUARD_HEIGHT) / 2
  const guardedButtonSize = EVAC_GUARD_WIDTH * 84 / 88
  const guardedButtonTopOffset = solidGuardTopInset + EVAC_SOLID_GUARD_HEIGHT * 16 / 104
  const manOnGuardX = ratIndicatorRight - solidGuardInset
  const manOnGuardY = ratIndicatorBottom - guardedButtonSize - guardedButtonTopOffset
  const rcdrRoundDiameter = EVAC_ROUND_DIAMETER
  const rcdrRoundVisualDiameter = rcdrRoundDiameter * EVAC_ROUND_SCALE
  const gpwsLowerLineY = 476
  const rcdrLowerLineY = 610
  const rcdrBottomGap = 21
  const rcdrControlCenterY = rcdrLowerLineY - rcdrBottomGap - rcdrRoundVisualDiameter / 2
  const cvrTestCenterX = EVAC_PANEL_WIDTH - 54 - rcdrRoundVisualDiameter / 2
  const cvrEraseCenterX = cvrTestCenterX - rcdrRoundVisualDiameter - 54
  const groundControlCenterX = cvrEraseCenterX - rcdrRoundVisualDiameter / 2 - 54 - EVAC_KORRY_SIZE / 2
  const groundControlX = groundControlCenterX - EVAC_KORRY_LAYOUT_SIZE / 2
  const groundControlY = rcdrControlCenterY - EVAC_KORRY_LAYOUT_SIZE / 2
  const rcdrRoundTop = rcdrControlCenterY - rcdrRoundVisualDiameter / 2
  const groundControlTop = rcdrControlCenterY - EVAC_KORRY_SIZE / 2
  const oxygenShift = 6
  const oxygenControlLift = 6
  const oxygenLowerLineY = 780 - oxygenShift - oxygenControlLift
  const oxygenControlTop = rcdrLowerLineY + 77 - oxygenShift - oxygenControlLift
  const oxygenControlCenterY = oxygenControlTop + EVAC_KORRY_SIZE / 2
  const oxygenCrewCenterX = cvrTestCenterX
  const oxygenPassengerCenterX = cvrEraseCenterX
  const oxygenMaskCenterX = groundControlCenterX
  const oxygenColumnGap = oxygenPassengerCenterX - oxygenMaskCenterX
  const oxygenHighAltCenterX = oxygenMaskCenterX - oxygenColumnGap
  const oxygenCrewX = oxygenCrewCenterX - EVAC_KORRY_LAYOUT_SIZE / 2
  const oxygenPassengerX = oxygenPassengerCenterX - EVAC_KORRY_LAYOUT_SIZE / 2
  const oxygenKorryY = oxygenControlCenterY - EVAC_KORRY_LAYOUT_SIZE / 2
  const solidGuardButtonOffset = solidGuardTopInset + EVAC_SOLID_GUARD_HEIGHT * 16 / 104
  const windowGuardTopInset = (EVAC_WINDOW_GUARD_LAYOUT_HEIGHT - EVAC_WINDOW_GUARD_HEIGHT) / 2
  const windowGuardButtonOffset = windowGuardTopInset + EVAC_WINDOW_GUARD_HEIGHT * 6 / 92
  const oxygenMaskGuardX = oxygenMaskCenterX - EVAC_GUARD_LAYOUT_WIDTH / 2
  const oxygenMaskGuardY = oxygenControlTop - solidGuardButtonOffset
  const oxygenHighAltGuardX = oxygenHighAltCenterX - EVAC_GUARD_LAYOUT_WIDTH / 2
  const oxygenHighAltGuardY = oxygenControlTop - windowGuardButtonOffset
  const oxygenDividerX = (oxygenPassengerCenterX + oxygenCrewCenterX) / 2 - 1.5
  const oxygenDividerY = 639
  const oxygenDividerHeight = oxygenControlTop + EVAC_KORRY_SIZE - oxygenDividerY
  const callsLowerLift = 8
  const callsUpperLineY = oxygenLowerLineY
  const callsEmerGuardY = callsUpperLineY + 34 - windowGuardTopInset
  const callsEmerCenterX = oxygenCrewCenterX
  const callsEmerGuardX = callsEmerCenterX - EVAC_GUARD_LAYOUT_WIDTH / 2
  const callsRoundCenterY = callsEmerGuardY + windowGuardTopInset + EVAC_WINDOW_GUARD_HEIGHT * 6 / 92 + EVAC_KORRY_SIZE / 2
  const callsRoundVisualRadius = EVAC_ROUND_DIAMETER * EVAC_ROUND_SCALE / 2
  const callsFwdCenterX = EVAC_PANEL_WIDTH / 2
  const callsRoundPitch = EVAC_ROUND_DIAMETER * EVAC_ROUND_SCALE + 36
  const callsRoundCenters = [
    callsFwdCenterX - callsRoundPitch * 2,
    callsFwdCenterX - callsRoundPitch,
    callsFwdCenterX,
    callsFwdCenterX + callsRoundPitch,
  ]
  const callsLowerLineLift = 21
  const type2Fasteners = [
    { x: 22, y: 44, side: 'left' },
    { x: 562, y: 44, side: 'right' },
    { x: 22, y: 506, side: 'left' },
    { x: 562, y: 638 - oxygenShift + 6, side: 'right' },
    { x: 22, y: 916 - oxygenShift - callsLowerLift - callsLowerLineLift, side: 'left' },
    { x: 566, y: 1182 - oxygenShift - callsLowerLift, side: 'right' },
  ] as const
  const type1Fasteners = [
    { x: 166, y: 20 },
    { x: 512, y: 176 },
    { x: 86, y: 524 },
    { x: 502, y: 618 - oxygenShift + 5 },
    { x: 118, y: 961 - oxygenShift - callsLowerLift },
  ]
  const callsLowerLineY = 930 - oxygenShift - callsLowerLift - callsLowerLineLift
  const lowerSectionTitleY = callsLowerLineY + 6
  const rainButtonTop = callsLowerLineY + 40
  const rainButtonCenterY = rainButtonTop + EVAC_ROUND_DIAMETER * EVAC_ROUND_SCALE / 2
  const horizontalLines = [146, 322, gpwsLowerLineY, rcdrLowerLineY, oxygenLowerLineY]

  return <div className="ov-evac-host" style={evacHostStyle} data-block="evac-emergency-gpws-recorder-oxygen-calls-rain-wipers">
    <div className="ov-evac-panel">
      <svg className="ov-evac-separators" viewBox={`0 0 ${EVAC_PANEL_WIDTH} ${EVAC_PANEL_HEIGHT}`} preserveAspectRatio="none" aria-hidden="true">
        {horizontalLines.map(y => <line key={`evac-line-${y}`} x1="25" y1={y} x2="562" y2={y} />)}
        <line x1="48" y1={callsLowerLineY} x2="562" y2={callsLowerLineY} />
        <line x1="190" y1="168" x2="190" y2="300" />
        <line x1="150" y1="342" x2="150" y2="468" />
        <line x1={oxygenDividerX} y1={oxygenDividerY} x2={oxygenDividerX} y2={oxygenDividerY + oxygenDividerHeight} />
      </svg>

      <EvacLabel x={518} y={5} width={48} height={18} lines={['21VU']} className="is-blue is-small" />

      <EvacControlLabel x={evacCommandCenterX - 50} width={100} controlTop={41} lines={['COMMAND']} />
      <EvacGuardedButton x={evacCommandLeft} y={38} kind="window" color="black" lower="ON" label="EVAC command" open={state?.covers.evacCommand} pressed={state?.evacCommand.pushed} lowerLit={state?.evacCommand.lowerLight} onOpenChange={open => setCover('evacCommand', open)} onPress={() => press('evacCommand')} />
      <EvacLabel x={evacHornCenterX - 50} y={8} width={100} height={18} lines={['EVAC']} className="is-title" />
      <EvacControlLabel x={evacHornCenterX - 75} width={150} controlTop={evacControlCenterY - EVAC_ROUND_DIAMETER * EVAC_ROUND_SCALE / 2} lines={['HORN SHUT OFF']} />
      <EvacRoundButton x={evacHornCenterX} y={evacControlCenterY} onPress={() => press('evacHorn')} label="Horn shut off" />
      <EvacControlLabel x={evacSwitchCenterX - 75} width={150} controlTop={evacSwitchTop} lines={['CAPT & PURS']} />
      <EvacToggle x={evacSwitchLeft} y={evacSwitchTop} size={evacSwitchSize} value={state?.evacCaptPurser} onSet={send ? value => send({ type: 'overhead.zone2.set', control: 'evacCaptPurser', value: value ? 1 : 0 }) : undefined} />
      <EvacLabel x={evacSwitchCenterX - 42} y={evacSwitchTop + evacSwitchSize + 4} width={84} height={14} lines={['CAPT']} className="is-front" />

      <EvacLabel x={185} y={149} width={217} height={22} lines={['EMER ELEC PWR']} className="is-title" />
      <EvacControlLabel x={44} width={142} controlTop={manOnGuardY + solidGuardTopInset} lines={['EMERGEN TEST']} />
      <EvacGuardedButton x={71} y={manOnGuardY} kind="solid" color="black" label="Emergency generator test" latching={false} open={state?.covers.emergencyGeneratorTest} onOpenChange={open => setCover('emergencyGeneratorTest', open)} onPress={() => press('emergencyGeneratorTest')} />
      <EvacControlLabel x={195} width={92} controlTop={218} lines={['GEN 1 LINE']} />
      <EvacKorry x={199} y={215} lower="OFF" state={state?.gen1Line} onPress={() => press('gen1Line')} label="Generator 1 line" />
      <EvacControlLabel x={evacHornCenterX - 58} width={116} controlTop={ratIndicatorTop} lines={['RAT', '&', 'EMER GEN']} />
      <EvacKorry x={ratIndicatorX} y={ratIndicatorY} blank interactive={false} label="RAT and emergency generator indication" />
      <EvacControlLabel x={manOnGuardX + solidGuardInset + EVAC_GUARD_WIDTH / 2 - 47} width={94} controlTop={manOnGuardY + solidGuardTopInset} lines={['MAN ON']} />
      <EvacGuardedButton x={manOnGuardX} y={manOnGuardY} kind="solid" color="red" label="RAT manual on" latching={false} open={state?.covers.ratManualOn} onOpenChange={open => setCover('ratManualOn', open)} onPress={() => press('ratManualOn')} />
      <EvacLabel x={manOnGuardX + solidGuardInset + EVAC_GUARD_WIDTH - 3} y={242} width={26} height={66} lines={['A', 'U', 'T', 'O']} className="is-auto" />

      <EvacLabel x={238} y={330} width={112} height={22} lines={['GPWS']} className="is-title" />
      <EvacControlLabel x={57} width={84} controlTop={386} lines={['TERR']} />
      <EvacKorry x={57} y={383} upper="FAULT" lower="OFF" state={state?.gpws.terr} onPress={() => press('gpwsTerr')} label="GPWS terrain" />
      <EvacControlLabel x={157} width={84} controlTop={386} lines={['SYS']} />
      <EvacKorry x={157} y={383} upper="FAULT" lower="OFF" state={state?.gpws.sys} onPress={() => press('gpwsSys')} label="GPWS system" />
      <EvacControlLabel x={275.4} width={90} controlTop={386} lines={['G/S', 'MODE']} />
      <EvacKorry x={278.4} y={383} lower="OFF" state={state?.gpws.gsMode} onPress={() => press('gpwsGsMode')} label="Glideslope mode" />
      <EvacControlLabel x={361.4} width={90} controlTop={386} lines={['FLAP', 'MODE']} />
      <EvacKorry x={364.4} y={383} lower="OFF" state={state?.gpws.flapMode} onPress={() => press('gpwsFlapMode')} label="Flap mode" />
      <EvacControlLabel x={446.4} width={92} controlTop={386} lines={['LDG', 'FLAP 3']} />
      <EvacKorry x={450.4} y={383} lower="ON" state={state?.gpws.ldgFlap3} onPress={() => press('gpwsLdgFlap3')} label="Landing flap 3" />

      <EvacLabel x={cvrEraseCenterX - 46} y={481} width={92} height={22} lines={['RCDR']} className="is-title" />
      <EvacControlLabel x={groundControlCenterX - 50} width={100} controlTop={groundControlTop} lines={['GND CTL']} />
      <EvacKorry x={groundControlX} y={groundControlY} lower="ON" state={state?.recorderGroundControl} onPress={() => press('recorderGroundControl')} label="Recorder ground control" className="is-blue-lower" />
      <EvacControlLabel x={cvrEraseCenterX - 56} width={112} controlTop={rcdrRoundTop} lines={['CVR ERASE']} />
      <EvacRoundButton x={cvrEraseCenterX} y={rcdrControlCenterY} diameter={rcdrRoundDiameter} onPress={() => press('cvrErase')} label="CVR erase" />
      <EvacControlLabel x={cvrTestCenterX - 57} width={114} controlTop={rcdrRoundTop} lines={['CVR TEST']} />
      <EvacRoundButton x={cvrTestCenterX} y={rcdrControlCenterY} diameter={rcdrRoundDiameter} onPress={() => press('cvrTest')} label="CVR test" />

      <EvacLabel x={oxygenPassengerCenterX - 65} y={618} width={130} height={22} lines={['OXYGEN']} className="is-title" />
      <EvacControlLabel x={oxygenHighAltCenterX - 63} width={126} controlTop={oxygenHighAltGuardY + windowGuardTopInset} lines={['HIGH ALT', 'LANDING']} />
      <EvacGuardedButton x={oxygenHighAltGuardX} y={oxygenHighAltGuardY} kind="window" color="red" lower="ON" label="High altitude landing" open={state?.covers.oxygenHighAlt} pressed={state?.oxygenHighAlt.pushed} lowerLit={state?.oxygenHighAlt.lowerLight} onOpenChange={open => setCover('oxygenHighAlt', open)} onPress={() => press('oxygenHighAlt')} />
      <EvacControlLabel x={oxygenMaskCenterX - 65} width={130} controlTop={oxygenMaskGuardY + solidGuardTopInset} lines={['MASK MAN ON']} />
      <EvacGuardedButton x={oxygenMaskGuardX} y={oxygenMaskGuardY} kind="solid" color="red" label="Mask manual on" latching={false} open={state?.covers.oxygenMaskManualOn} onOpenChange={open => setCover('oxygenMaskManualOn', open)} onPress={() => press('oxygenMaskManualOn')} />
      <EvacLabel x={oxygenMaskCenterX + EVAC_GUARD_WIDTH / 2 - 3} y={701 - oxygenShift - oxygenControlLift} width={32} height={72} lines={['A', 'U', 'T', 'O']} className="is-auto" />
      <EvacControlLabel x={oxygenPassengerCenterX - 52.5} width={105} controlTop={oxygenControlTop} lines={['PASSENGER']} />
      <EvacKorry x={oxygenPassengerX} y={oxygenKorryY} blank framelessBlank upperLit={state?.oxygenPassengerUpper} interactive={false} label="Passenger oxygen indication" />
      <EvacControlLabel x={oxygenCrewCenterX - 50} width={100} controlTop={oxygenControlTop} lines={['CREW', 'SUPPLY']} />
      <EvacKorry x={oxygenCrewX} y={oxygenKorryY} lower="OFF" state={state?.oxygenCrew} onPress={() => press('oxygenCrewSupply')} label="Crew oxygen supply" />

      <EvacLabel x={(EVAC_PANEL_WIDTH - 98) / 2} y={callsUpperLineY + 4} width={98} height={22} lines={['CALLS']} className="is-title" />
      {(['MECH', 'ALL', 'FWD', 'AFT'] as const).map((label, index) => <span key={`calls-${label}`}>
        <EvacControlLabel x={callsRoundCenters[index] - 42} width={84} controlTop={callsRoundCenterY - callsRoundVisualRadius} lines={[label]} />
        <EvacRoundButton x={callsRoundCenters[index]} y={callsRoundCenterY} onPress={() => press((['callsMech', 'callsAll', 'callsFwd', 'callsAft'] as const)[index])} label={`Call ${label.toLowerCase()}`} />
      </span>)}
      <EvacControlLabel x={callsEmerCenterX - 42} width={84} controlTop={callsEmerGuardY + windowGuardTopInset} lines={['EMER']} />
      <EvacGuardedButton x={callsEmerGuardX} y={callsEmerGuardY} kind="window" color="black" lower="ON" label="Emergency call" open={state?.covers.callsEmergency} pressed={state?.callsEmergency.pushed} lowerLit={state?.callsEmergency.lowerLight} onOpenChange={open => setCover('callsEmergency', open)} onPress={() => press('callsEmergency')} />

      <EvacLabel x={116} y={lowerSectionTitleY} width={200} height={22} lines={['RAIN RPLNT']} className="is-title" />
      <EvacRoundButton x={218} y={rainButtonCenterY} onPress={() => press('rainRepellent')} label="Rain repellent" />
      <EvacLabel x={366} y={lowerSectionTitleY} width={128} height={22} lines={['WIPER']} className="is-title" />
      <WiperControl separatorY={callsLowerLineY} position={state?.wiperCaptain} onSet={send ? value => send({ type: 'overhead.zone2.set', control: 'wiperCaptain', value }) : undefined} />

      {type2Fasteners.map(({ x, y, side }) => <span key={`evac-channel-${x}-${y}`} className="ov-evac-cutout" style={evacPanelChannel(x, y, EVAC_TYPE2_FASTENER_DIAMETER, side)} />)}
      {type2Fasteners.map(({ x, y }) => <i key={`evac-type2-${x}-${y}`} className="ov-fastener ov-fastener-type2" style={evacPanelCenter(x, y, EVAC_TYPE2_FASTENER_DIAMETER)} />)}
      {type1Fasteners.map(({ x, y }) => <i key={`evac-type1-${x}-${y}`} className="ov-fastener ov-fastener-type1" style={evacPanelCenter(x, y, EVAC_TYPE1_FASTENER_DIAMETER)} />)}
    </div>
  </div>
}

function ZoneOneSchematic() {
  const buttonColumns = [64, 184.5, 305]
  const knobCenters = [92.5, 213, 333.5]

  return <g className="ov-zone-one-schematic" aria-hidden="true">
    <g className="ov-schematic-camera">
      <line x1="300" y1="49" x2="300" y2="136" />
      <circle className="ov-sch-screw" cx="48" cy="119" r="9" />
      <circle className="ov-sch-screw" cx="385" cy="61" r="9" />
      <path className="ov-sch-edge-fastener" d="M0 59H14a12 12 0 1 1 0 24H0zM424 105h-14a12 12 0 1 0 0 24h14z" />
      <g className="ov-sch-korry">
        <rect x="311" y="74" width="58" height="58" rx="4" />
        <rect x="316" y="104" width="48" height="22" rx="1" />
      </g>
    </g>
    <g className="ov-schematic-adirs">
      <text x="212" y="166" textAnchor="middle">ADIRS</text>
      <rect className="ov-sch-on-bat" x="175" y="176" width="74" height="36" rx="3" />
      {buttonColumns.map((x, index) => <g className="ov-sch-korry" key={`sch-ir-${index}`}>
        <rect x={x} y="250" width="57" height="57" rx="4" />
        <rect x={x + 5} y="280" width="47" height="21" rx="1" />
      </g>)}
      {knobCenters.map((x, index) => <g className="ov-sch-selector" key={`sch-selector-${index}`}>
        <path d={`M${x - 40} 359 Q${x} 333 ${x + 40} 359`} />
        <circle cx={x} cy="382" r="33" />
        <path className="ov-sch-selector-handle" d={`M${x - 9} 352h18l5 57h-28z`} />
      </g>)}
      {buttonColumns.map((x, index) => <g className="ov-sch-korry" key={`sch-adr-${index}`}>
        <rect x={x} y="444" width="57" height="57" rx="4" />
        <rect x={x + 5} y="474" width="47" height="21" rx="1" />
      </g>)}
      <circle className="ov-sch-screw" cx="156" cy="166" r="9" />
      <circle className="ov-sch-screw" cx="280" cy="239" r="9" />
      <circle className="ov-sch-screw" cx="48" cy="330" r="9" />
      <circle className="ov-sch-screw" cx="376" cy="330" r="9" />
      <circle className="ov-sch-screw" cx="280" cy="500" r="9" />
      <path className="ov-sch-edge-fastener" d="M0 169h14a12 12 0 1 1 0 24H0zM424 169h-14a12 12 0 1 0 0 24h14zM0 465h14a12 12 0 1 1 0 24H0zM424 465h-14a12 12 0 1 0 0 24h14z" />
    </g>
  </g>
}

function ZoneTwoSchematic() {
  return <g className="ov-zone-two-schematic" aria-hidden="true">
    <text x="212" y="616" textAnchor="middle">FLT CTL</text>
    {[152, 228.5, 305].map((x, index) => <g className="ov-sch-korry" key={`sch-fctl-${index}`}>
      <rect x={x} y="645" width="57" height="57" rx="4" />
      <rect x={x + 5} y="675" width="47" height="21" rx="1" />
    </g>)}
    <circle className="ov-sch-screw" cx="56" cy="690" r="9" />
    <circle className="ov-sch-screw" cx="381" cy="618" r="9" />
    <path className="ov-sch-edge-fastener" d="M0 532h14a12 12 0 1 1 0 24H0zM424 535h-14a12 12 0 1 0 0 24h14zM0 633h14a12 12 0 1 1 0 24H0zM424 668h-14a12 12 0 1 0 0 24h14z" />
  </g>
}

function EvacPanelSchematic() {
  const transform = `translate(0 ${EVAC_DRAW_SPACE.y}) scale(${424 / EVAC_RASTER_SPACE.width} ${EVAC_DRAW_SPACE.height / EVAC_RASTER_SPACE.height})`
  const callsPitch = EVAC_ROUND_DIAMETER * EVAC_ROUND_SCALE + 36
  const callsFwdX = EVAC_PANEL_WIDTH / 2
  const schematicCallCenters = [callsFwdX - callsPitch * 2, callsFwdX - callsPitch, callsFwdX, callsFwdX + callsPitch]
  const korryPositions = [
    [202, 218], [322.8, 218],
    [60, 386], [160, 386], [281.4, 386], [367.4, 386], [453.4, 386],
    [225.56, 519.64],
    [463.64, 675],
  ]
  const roundPositions = [[362, 86], [387.92, 558.64], [502.64, 558.64], ...schematicCallCenters.map(x => [x, 846.61]), [218, 965.36]]
  const type1Fasteners = [[166, 20], [512, 176], [86, 524], [502, 617], [118, 947]]
  const type2Fasteners = [[22, 44], [562, 44], [22, 506], [562, 638], [22, 881], [566, 1168]]

  return <g className="ov-zone-three-schematic" transform={transform} aria-hidden="true">
    {[146, 322, 476, 610, 768].map(y => <line key={`evac-sch-line-${y}`} x1="25" y1={y} x2="562" y2={y} />)}
    <line x1="48" y1="895" x2="562" y2="895" />
    <line x1="190" y1="168" x2="190" y2="300" />
    <line x1="150" y1="342" x2="150" y2="468" />
    <line x1="443.78" y1="639" x2="443.78" y2="753" />

    <rect className="ov-sch-guard" x="183" y="38" width="88" height="92" rx="4" />
    <circle className="ov-sch-round" cx="362" cy="86" r="36" />
    <circle className="ov-sch-toggle-base" cx="492" cy="86" r="40" />
    <path className="ov-sch-toggle-handle" d="M482 38h20l-5 54h-10z" />

    <rect className="ov-sch-guard" x="74" y="202.804" width="82" height="97" rx="4" />
    <rect className="ov-sch-guard is-red" x="400.8" y="202.804" width="82" height="97" rx="4" />
    <rect className="ov-sch-guard is-red" x="100.2" y="669.39" width="82" height="86" rx="4" />
    <rect className="ov-sch-guard is-red" x="223.56" y="660.08" width="82" height="97" rx="4" />
    <rect className="ov-sch-guard" x="461.64" y="802" width="82" height="86" rx="4" />

    {korryPositions.map(([x, y]) => <g className="ov-sch-korry" key={`evac-sch-korry-${x}-${y}`}>
      <rect x={x} y={y} width={EVAC_KORRY_SIZE} height={EVAC_KORRY_SIZE} rx="4" />
      <rect x={x + 7} y={y + 46} width={EVAC_KORRY_SIZE - 14} height="24" rx="1" />
    </g>)}
    <rect className="ov-sch-indicator" x="348.92" y="675" width={EVAC_KORRY_SIZE} height={EVAC_KORRY_SIZE} rx="2" />
    {roundPositions.map(([cx, cy]) => <circle className="ov-sch-round" key={`evac-sch-round-${cx}-${cy}`} cx={cx} cy={cy} r={EVAC_ROUND_DIAMETER * EVAC_ROUND_SCALE / 2} />)}

    <path className="ov-sch-wiper-scale" d="M430 974a58 58 0 0 1 51 86" />
    <circle className="ov-sch-wiper-knob" cx="430" cy="1017" r="54" />
    <path className="ov-sch-wiper-handle" d="M418 966h24l8 96h-40z" />

    {type1Fasteners.map(([cx, cy]) => <circle className="ov-sch-screw" key={`evac-sch-type1-${cx}-${cy}`} cx={cx} cy={cy} r={EVAC_TYPE1_FASTENER_DIAMETER / 2} />)}
    {type2Fasteners.map(([cx, cy]) => <g key={`evac-sch-type2-${cx}-${cy}`}>
      <rect className="ov-sch-edge-channel" x={cx < EVAC_PANEL_WIDTH / 2 ? 0 : cx} y={cy - EVAC_TYPE2_FASTENER_DIAMETER / 2} width={cx < EVAC_PANEL_WIDTH / 2 ? cx : EVAC_PANEL_WIDTH - cx} height={EVAC_TYPE2_FASTENER_DIAMETER} />
      <circle className="ov-sch-edge-fastener-circle" cx={cx} cy={cy} r={EVAC_TYPE2_FASTENER_DIAMETER / 2} />
    </g>)}
  </g>
}

export function OverheadPanel({ schematic = false, focusZone, state, send }: { schematic?: boolean; focusZone?: OverheadZone; state?: OverheadState; send?: (command: CockpitCommand) => void }) {
  const view = focusZone ? overheadZoneBounds[focusZone] : { x: 0, y: 0, width: WIDTH, height: HEIGHT }
  const worldStyle = {
    left: `${-view.x / view.width * 100}%`,
    top: `${-view.y / view.height * 100}%`,
    width: `${WIDTH / view.width * 100}%`,
    height: `${HEIGHT / view.height * 100}%`,
  }

  return <section className={`real-overhead ${schematic ? 'is-schematic' : ''} ${focusZone ? `is-zone-view zone-${focusZone}` : ''}`} style={{ aspectRatio: `${view.width}/${view.height}` }} aria-label={`Airbus A320 overhead panel${focusZone ? ` zone ${focusZone}` : ''}`}>
    <div className="ov-world" style={worldStyle}>
      <svg className="ov-layout" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Overhead panel block layout">
        <defs>
        <linearGradient id="ov-block-face" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#586c74" />
            <stop offset="0.52" stopColor="#4b6069" />
            <stop offset="1" stopColor="#3d5159" />
        </linearGradient>
        <filter id="ov-block-depth" x="-5%" y="-5%" width="110%" height="110%">
          <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#071014" floodOpacity=".72" />
        </filter>
      </defs>
        <g className="ov-blocks" filter="url(#ov-block-depth)">
        {rectangleBlocks.map(block => <rect key={block.id} data-block={block.id} data-block-number={blockNumbers[block.id]} x={block.x + 1} y={block.y + 1} width={block.width - 2} height={block.height - 2} rx="2" />)}
          {polygonBlocks.map(block => {
            const blockPoints = schematic && block.id === 'evac-emergency-gpws-recorder-oxygen-calls-rain-wipers'
              ? [[0, 710], [0, 1257], [424, 1410], [424, 710]] as Array<[number, number]>
              : block.points
            return <polygon key={block.id} data-block={block.id} data-block-number={blockNumbers[block.id]} points={points(blockPoints)} />
          })}
        </g>
        {schematic && <><ZoneOneSchematic /><ZoneTwoSchematic /><EvacPanelSchematic /></>}
        {!schematic && <g className="ov-block-labels" aria-hidden="true">
          {blockLabels.map(label => <text key={`${label.x}-${label.y}`} x={label.x} y={label.y} textAnchor="middle">
            {label.lines.map((line, index) => <tspan key={line} x={label.x} dy={index === 0 ? 0 : 34}>{line}</tspan>)}
          </text>)}
        </g>}
      </svg>
      {!schematic && <CameraDoorPanel state={state?.cockpitDoorVideo} send={send} />}
      {!schematic && <AdirsPanel state={state?.adirs} send={send} />}
      {!schematic && <FlightControlsPanel state={state?.flightControls} send={send} />}
      {!schematic && <EvacPanel state={state?.zoneTwo} send={send} />}
    </div>
  </section>
}
