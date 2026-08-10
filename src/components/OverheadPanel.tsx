import { useState, type CSSProperties, type WheelEvent } from 'react'
import overheadButtonTemplateUrl from '../assets/overhead/buttons/korry/template.svg'
import overheadButtonOffUrl from '../assets/overhead/buttons/korry/off-lit.svg'
import onBatLampSvg from '../assets/overhead/adirs/on-bat.svg?raw'
import adirsSelectorMarkingsUrl from '../assets/overhead/adirs/selector-markings.svg'
import adirsSelectorHandleUrl from '../assets/efis/knobs/mode/handle.svg'
import type { CockpitCommand, KorryState, OverheadButton, OverheadSelector, OverheadState } from '../types'
import './overhead.css'

const WIDTH = 1860
const HEIGHT = 1410
const CAMERA_WIDTH = 1388
const CAMERA_HEIGHT = 340
const ADIRS_WIDTH = 1534
const ADIRS_HEIGHT = 1344
const FLIGHT_CONTROLS_WIDTH = 2244
const FLIGHT_CONTROLS_HEIGHT = 1314
const CAMERA_TYPE1_FASTENER_DIAMETER = 60
const CAMERA_TYPE2_FASTENER_DIAMETER = 76
const ADIRS_TYPE1_FASTENER_RADIUS = CAMERA_TYPE1_FASTENER_DIAMETER * ADIRS_WIDTH / CAMERA_WIDTH / 2
const ADIRS_TYPE2_FASTENER_RADIUS = CAMERA_TYPE2_FASTENER_DIAMETER * ADIRS_WIDTH / CAMERA_WIDTH / 2
const FLIGHT_CONTROLS_TYPE1_DIAMETER = CAMERA_TYPE1_FASTENER_DIAMETER * FLIGHT_CONTROLS_WIDTH / CAMERA_WIDTH
const FLIGHT_CONTROLS_TYPE2_DIAMETER = CAMERA_TYPE2_FASTENER_DIAMETER * FLIGHT_CONTROLS_WIDTH / CAMERA_WIDTH
const FLIGHT_CONTROLS_KORRY_SIZE = 190 * FLIGHT_CONTROLS_WIDTH / CAMERA_WIDTH
// Align the FAC 1 centre to ADR2 in world coordinates. The ADIRS host starts
// one panel unit farther right and is two units narrower than the FLT CTL host.
const FLIGHT_CONTROLS_RIGHT_KORRY_X = 1614.83585109713
const FLIGHT_CONTROLS_KORRY_GAP = 100

export type OverheadZone = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

export const overheadZoneBounds: Record<OverheadZone, { x: number; y: number; width: number; height: number }> = {
  1: { x: 0, y: 0, width: 424, height: 709 },
  2: { x: 0, y: 0, width: 424, height: 709 },
  3: { x: 0, y: 709, width: 424, height: 701 },
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
  { id: 'evac-emergency-gpws-recorder-oxygen-calls-rain-wipers', points: [[1, 710], [1, 1257], [423, 1409], [423, 710]] },
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
  { x: 212, y: 936, lines: ['EVAC · EMER ELEC · GPWS', 'RCDR · OXYGEN · CALLS', 'RAIN RPLNT · WIPERS'] },
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
  const rotateWithWheel = (event: WheelEvent<HTMLButtonElement>) => {
    event.preventDefault()
    const direction: 1 | -1 = event.deltaY > 0 ? 1 : -1
    if (onRotate) onRotate(direction)
    else setFallbackPosition(value => Math.max(0, Math.min(2, value + direction)))
  }
  const cycle = () => {
    const next = (selectedPosition + 1) % 3 as 0 | 1 | 2
    if (onSet) onSet(next)
    else setFallbackPosition(next)
  }

  return <>
    <img className="ov-adirs-selector-markings" src={adirsSelectorMarkingsUrl} alt="" style={adirsRect(x - 204.381, 649.048, 373.778, 139.937)} />
    <button className="ov-adirs-selector" type="button" style={{ ...adirsCenter(x, 854, 120), '--selector-rotation': `${rotation}deg` } as CSSProperties} onClick={cycle} onWheel={rotateWithWheel} aria-label="Rotate ADIRS selector">
      <img src={adirsSelectorHandleUrl} alt="" style={{ transform: `rotate(${rotation}deg)` }} />
    </button>
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
          {polygonBlocks.map(block => <polygon key={block.id} data-block={block.id} data-block-number={blockNumbers[block.id]} points={points(block.points)} />)}
        </g>
        {schematic && <><ZoneOneSchematic /><ZoneTwoSchematic /></>}
        {!schematic && <g className="ov-block-labels" aria-hidden="true">
          {blockLabels.map(label => <text key={`${label.x}-${label.y}`} x={label.x} y={label.y} textAnchor="middle">
            {label.lines.map((line, index) => <tspan key={line} x={label.x} dy={index === 0 ? 0 : 34}>{line}</tspan>)}
          </text>)}
        </g>}
      </svg>
      {!schematic && <CameraDoorPanel state={state?.cockpitDoorVideo} send={send} />}
      {!schematic && <AdirsPanel state={state?.adirs} send={send} />}
      {!schematic && <FlightControlsPanel state={state?.flightControls} send={send} />}
    </div>
  </section>
}
