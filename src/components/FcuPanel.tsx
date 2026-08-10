import { useRef, useState, type WheelEvent } from 'react'
import ap1OffUrl from '../assets/fcu/buttons/ap1/off.svg'
import ap1OnUrl from '../assets/fcu/buttons/ap1/on.svg'
import ap2OffUrl from '../assets/fcu/buttons/ap2/off.svg'
import ap2OnUrl from '../assets/fcu/buttons/ap2/on.svg'
import apprOffUrl from '../assets/fcu/buttons/appr/off.svg'
import apprOnUrl from '../assets/fcu/buttons/appr/on.svg'
import athrOffUrl from '../assets/fcu/buttons/athr/off.svg'
import athrOnUrl from '../assets/fcu/buttons/athr/on.svg'
import expedOffUrl from '../assets/fcu/buttons/exped/off.svg'
import expedOnUrl from '../assets/fcu/buttons/exped/on.svg'
import locOffUrl from '../assets/fcu/buttons/loc/off.svg'
import locOnUrl from '../assets/fcu/buttons/loc/on.svg'
import altitudeKnobUrl from '../assets/fcu/knobs/altitude/handle.svg'
import altitudeSelectorFrameUrl from '../assets/fcu/knobs/altitude/selector-frame.svg'
import altitudeSelectorRotorUrl from '../assets/fcu/knobs/altitude/selector-rotor.svg'
import headingKnobBaseUrl from '../assets/fcu/knobs/common/base.svg'
import headingKnobUrl from '../assets/fcu/knobs/heading/handle.svg'
import speedVerticalKnobUrl from '../assets/fcu/knobs/speed-vertical/handle.svg'
import verticalSpeedBackUrl from '../assets/fcu/knobs/vertical-speed/vs back.svg'
import verticalSpeedUpDnUrl from '../assets/fcu/knobs/vertical-speed/updn.svg'
import switchButtonUrl from '../assets/fcu/switches/common/button.svg'
import type { CockpitCommand, FcuButton, FcuKnob, FcuState } from '../types'
import './fcu.css'

function FcuDisplay({ state }: { state: FcuState }) {
  const speed = state.mach
    ? state.speedDashed ? '-.--' : state.speed.toFixed(2)
    : state.speedDashed ? '---' : Math.round(state.speed).toString().padStart(3, '0')
  const heading = state.headingDashed ? '---' : Math.round(state.heading).toString().padStart(3, '0')
  const verticalSign = state.verticalSpeed >= 0 ? '+' : '~'
  const verticalMagnitude = Math.abs(state.verticalSpeed)
  const vertical = state.fpaMode
    ? state.verticalSpeedDashed ? '~-.-' : `${verticalSign}${(verticalMagnitude / 1000).toFixed(1)}`
    : state.verticalSpeedDashed ? '~----' : `${verticalSign}${Math.floor(verticalMagnitude * .01).toString().padStart(2, '0')}oo`
  const displayLabel = `${state.mach ? 'Mach' : 'Speed'} ${speed}, ${state.trackMode ? 'track' : 'heading'} ${heading}, altitude ${state.altitude}, ${state.fpaMode ? 'flight path angle' : 'vertical speed'} ${vertical}`

  // FBW renders the AFS display as two 1280 x 224 atlas rows. In the model
  // those rows are placed next to each other across the physical FCU window.
  return <div className="rf-glass">
    <svg className="rf-display-svg" viewBox="0 0 2560 224" preserveAspectRatio="none" role="img" aria-label={displayLabel}>
      <g className="rf-display-labels" aria-hidden="true">
        <text className={!state.mach ? 'active' : 'inactive'} x="77" y="57.6">SPD</text>
        <text className={state.mach ? 'active' : 'inactive'} x="205" y="57.6">MACH</text>

        <text className={!state.trackMode ? 'active' : 'inactive'} x="589" y="57.6">HDG</text>
        <text className={state.trackMode ? 'active' : 'inactive'} x="722" y="57.6">TRK</text>
        <text className="active" x="840" y="57.6">LAT</text>

        <text className={!state.trackMode ? 'active' : 'inactive'} x="1229" y="96" textAnchor="end">HDG</text>
        <text className={state.trackMode ? 'active' : 'inactive'} x="1229" y="163" textAnchor="end">TRK</text>
        <text className={!state.fpaMode ? 'active' : 'inactive'} x="1331" y="96">V/S</text>
        <text className={state.fpaMode ? 'active' : 'inactive'} x="1331" y="163">FPA</text>

        <text className="active" x="1792" y="57.6">ALT</text>
        <path className="rf-lvl-bracket" d="M 1905 34.5 V 57.6 M 1905 38.4 H 1976 M 2283.5 34.5 V 57.6 M 2283.5 38.4 H 2212" />
        <text className="active" x="1986.5" y="57.6">LVL/CH</text>
        <text className={!state.fpaMode ? 'active' : 'inactive'} x="2396" y="57.6" textAnchor="end">V/S</text>
        <text className={state.fpaMode ? 'active' : 'inactive'} x="2509" y="57.6" textAnchor="end">FPA</text>
      </g>

      <g className="rf-display-values" aria-hidden="true">
        <g className="rf-display-ghosts">
          <text x="92" y="196">8.88</text>
          <text x="599" y="196">888</text>
          <text x="1632" y="196">88888</text>
          <text x="2125" y="196">+8.888</text>
        </g>
        <text x="92" y="196">{speed}</text>
        <circle className={state.speedManaged ? 'visible' : ''} cx="374" cy="119" r="28" />
        <text x="599" y="196">{heading}</text>
        <circle className={state.headingManaged ? 'visible' : ''} cx="886" cy="119" r="28" />
        <text x="1632" y="196">{Math.round(state.altitude).toString().padStart(5, '0')}</text>
        <circle className={state.altitudeManaged ? 'visible' : ''} cx="2080" cy="119" r="28" />
        <text x="2125" y="196">{vertical}</text>
      </g>
    </svg>
  </div>
}

type KorryArtwork = { off: string; on: string; aspectRatio: string }

const KORRY_ARTWORK: Partial<Record<FcuButton, KorryArtwork>> = {
  ap1: { off: ap1OffUrl, on: ap1OnUrl, aspectRatio: '112 / 109' },
  ap2: { off: ap2OffUrl, on: ap2OnUrl, aspectRatio: '112 / 109' },
  athr: { off: athrOffUrl, on: athrOnUrl, aspectRatio: '112 / 109' },
  loc: { off: locOffUrl, on: locOnUrl, aspectRatio: '120 / 92' },
  exped: { off: expedOffUrl, on: expedOnUrl, aspectRatio: '120 / 92' },
  appr: { off: apprOffUrl, on: apprOnUrl, aspectRatio: '120 / 92' },
}

function Korry({ control, label, active, onClick, className }: { control: FcuButton; label: string; active?: boolean; onClick: () => void; className: string }) {
  const artwork = KORRY_ARTWORK[control]
  return <button className={`rf-korry ${className} ${artwork ? 'has-art' : ''} ${active ? 'is-active' : ''}`} style={artwork ? { '--rf-korry-aspect': artwork.aspectRatio } as React.CSSProperties : undefined} onClick={onClick} aria-label={label} aria-pressed={active}>
    {artwork
      ? <><img className="rf-korry-face rf-korry-face-off" src={artwork.off} alt="" /><img className="rf-korry-face rf-korry-face-on" src={artwork.on} alt="" /></>
      : <><span className="rf-korry-bars" /><strong>{label}</strong></>}
  </button>
}

function SwitchButton({ label, onClick, className }: { label: string; onClick: () => void; className: string }) {
  return <button className={`rf-switch-button ${className}`} onClick={onClick} aria-label={label}>
    <img className="rf-switch-button-outer" src={switchButtonUrl} alt="" />
    <span className="rf-switch-button-inner" aria-hidden="true"><img src={switchButtonUrl} alt="" /></span>
  </button>
}

function ControlKnob({ variant, control, send, children }: {
  variant: 'speed' | 'heading' | 'altitude' | 'vertical'; control: FcuKnob; send: (command: CockpitCommand) => void; children?: React.ReactNode
}) {
  const [visualRotation, setVisualRotation] = useState(0)
  const [axialMotion, setAxialMotion] = useState<'push' | 'pull' | null>(null)
  const axialTimer = useRef<number | undefined>(undefined)
  const rotate = (direction: 1 | -1) => {
    setVisualRotation(rotation => rotation + direction * 6)
    send({ type: 'fcu.rotate', control, direction })
  }
  const wheel = (event: WheelEvent<HTMLDivElement>) => { event.preventDefault(); rotate(event.deltaY < 0 ? 1 : -1) }
  const actuateAxial = (action: 'push' | 'pull') => {
    if (axialTimer.current !== undefined) window.clearTimeout(axialTimer.current)
    setAxialMotion(action)
    axialTimer.current = window.setTimeout(() => setAxialMotion(null), 180)
    send({ type: `fcu.${action}`, control })
  }
  return <div className={`rf-knob rf-knob-${variant} ${axialMotion ? `is-${axialMotion}ing` : ''}`} onWheel={wheel} style={{ '--rf-rotation': `${visualRotation}deg` } as React.CSSProperties}>
    {children}
    <button className="rf-turn-hit rf-turn-left" onClick={() => rotate(-1)} aria-label={`Decrease ${control}`} />
    <button className="rf-turn-hit rf-turn-right" onClick={() => rotate(1)} aria-label={`Increase ${control}`} />
    {variant === 'heading'
      ? <div className="rf-heading-assets" aria-hidden="true">
        <img className="rf-heading-base-asset" src={headingKnobBaseUrl} alt="" />
        <span className="rf-heading-knob-shadow"><img className="rf-heading-knob-asset" src={headingKnobUrl} alt="" /></span>
      </div>
      : variant === 'altitude'
        ? <div className="rf-altitude-knob-asset" aria-hidden="true">
          <img src={altitudeKnobUrl} alt="" />
        </div>
        : <div className={`rf-standard-assets ${variant === 'vertical' ? 'rf-vs-assets' : ''}`} aria-hidden="true">
          <img className="rf-standard-base-asset" src={variant === 'vertical' ? verticalSpeedBackUrl : headingKnobBaseUrl} alt="" />
          {variant === 'vertical'
            ? <><img className="rf-vs-updn-asset" src={verticalSpeedUpDnUrl} alt="" /><span className="rf-vs-knob-mount"><span className="rf-standard-knob-shadow"><img className="rf-standard-knob-asset" src={speedVerticalKnobUrl} alt="" /></span></span></>
            : <span className="rf-standard-knob-shadow"><img className="rf-standard-knob-asset" src={speedVerticalKnobUrl} alt="" /></span>}
        </div>}
    <div className="rf-axial-actions">
      <button className="rf-axial rf-push" onClick={() => actuateAxial('push')} aria-label={`Push ${control}`} />
      <button className="rf-axial rf-pull" onClick={() => actuateAxial('pull')} aria-label={`Pull ${control}`} />
    </div>
  </div>
}

function AltitudeKnob({ state, send }: { state: FcuState; send: (command: CockpitCommand) => void }) {
  return <ControlKnob variant="altitude" control="altitude" send={send}>
    <button className={`rf-alt-selector ${state.altitudeStep === 1000 ? 'at-1000' : ''}`} onClick={() => send({ type: 'fcu.toggle', control: 'altitudeStep' })} aria-label={`Altitude increment ${state.altitudeStep} feet`}>
      <img className="rf-alt-selector-rotor" src={altitudeSelectorRotorUrl} alt="" />
      <img className="rf-alt-selector-frame" src={altitudeSelectorFrameUrl} alt="" />
    </button>
  </ControlKnob>
}

export function FcuPanel({ state, send, schematic = false }: { state: FcuState; send: (command: CockpitCommand) => void; schematic?: boolean }) {
  const press = (control: FcuButton) => send({ type: 'fcu.button', control })

  return <section className={`real-fcu ${schematic ? 'is-schematic' : ''}`} aria-label="Airbus A320 Flight Control Unit">
    <div className="rf-surface-noise" />
    <div className="rf-control-wear" />
    <span className="rf-screw rf-screw-tl" /><span className="rf-screw rf-screw-tr" /><span className="rf-screw rf-screw-bl" /><span className="rf-screw rf-screw-br" /><span className="rf-screw rf-screw-b1" /><span className="rf-screw rf-screw-b2" />

    <FcuDisplay state={state} />

    <span className="rf-divider rf-divider-1" /><span className="rf-divider rf-divider-2" />
    <SwitchButton className="rf-switch-spd-mach" label="Toggle speed and Mach" onClick={() => send({ type: 'fcu.toggle', control: 'mach' })} />
    <span className="rf-control-label rf-label-spd-mach" aria-hidden="true">SPD<br />MACH</span>
    <ControlKnob variant="speed" control="speed" send={send} />
    <ControlKnob variant="heading" control="heading" send={send} />
    <SwitchButton className="rf-switch-hdg-vs" label="Toggle heading/track and vertical speed/flight path angle" onClick={() => send({ type: 'fcu.toggle', control: 'headingTrack' })} />
    <span className="rf-control-label rf-label-hdg-trk" aria-hidden="true">HDG<br />TRK</span>
    <span className="rf-control-label rf-label-vs-fpa" aria-hidden="true">V/S<br />FPA</span>
    <AltitudeKnob state={state} send={send} />
    <SwitchButton className="rf-switch-metric-alt" label="Metric altitude" onClick={() => send({ type: 'fcu.toggle', control: 'metricAltitude' })} />
    <span className="rf-control-label rf-label-metric-alt" aria-hidden="true">METRIC<br />ALT</span>
    <ControlKnob variant="vertical" control="verticalSpeed" send={send} />
    <span className="rf-control-label rf-label-level-off" aria-hidden="true">PUSH<br />TO<br />LEVEL<br />OFF</span>

    <Korry control="ap1" label="AP 1" active={state.buttons.ap1} onClick={() => press('ap1')} className="rf-ap1" />
    <Korry control="ap2" label="AP 2" active={state.buttons.ap2} onClick={() => press('ap2')} className="rf-ap2" />
    <Korry control="athr" label="A/THR" active={state.buttons.athr} onClick={() => press('athr')} className="rf-athr" />
    <Korry control="loc" label="LOC" active={state.buttons.loc} onClick={() => press('loc')} className="rf-loc" />
    <Korry control="exped" label="EXPED" active={state.buttons.exped} onClick={() => press('exped')} className="rf-exped" />
    <Korry control="appr" label="APPR" active={state.buttons.appr} onClick={() => press('appr')} className="rf-appr" />
  </section>
}
