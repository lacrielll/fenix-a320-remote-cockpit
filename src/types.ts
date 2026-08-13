export type FcuKnob = 'speed' | 'heading' | 'altitude' | 'verticalSpeed'
export type FcuButton = 'loc' | 'exped' | 'ap1' | 'ap2' | 'athr' | 'appr'
export type EfisSide = 'captain' | 'firstOfficer'
export type EfisFilter = 'cstr' | 'wpt' | 'vord' | 'ndb' | 'arpt'
export type AdirsSystem = 1 | 2 | 3
export type OverheadButton = 'cockpitDoorVideo' | 'ir1' | 'ir2' | 'ir3' | 'adr1' | 'adr2' | 'adr3' | 'elac1' | 'sec1' | 'fac1'
export type OverheadSelector = 'ir1Mode' | 'ir2Mode' | 'ir3Mode'
export type ZoneTwoButton = 'evacCommand' | 'evacHorn' | 'emergencyGeneratorTest' | 'gen1Line' | 'ratManualOn' | 'gpwsTerr' | 'gpwsSys' | 'gpwsGsMode' | 'gpwsFlapMode' | 'gpwsLdgFlap3' | 'recorderGroundControl' | 'cvrErase' | 'cvrTest' | 'oxygenHighAlt' | 'oxygenMaskManualOn' | 'oxygenCrewSupply' | 'callsMech' | 'callsAll' | 'callsFwd' | 'callsAft' | 'callsEmergency' | 'rainRepellent'
export type ZoneTwoCover = 'evacCommand' | 'emergencyGeneratorTest' | 'ratManualOn' | 'oxygenHighAlt' | 'oxygenMaskManualOn' | 'callsEmergency'

export interface FcuState {
  powered: boolean
  speed: number
  heading: number
  altitude: number
  verticalSpeed: number
  speedManaged: boolean
  headingManaged: boolean
  altitudeManaged: boolean
  verticalSpeedManaged: boolean
  speedDashed: boolean
  headingDashed: boolean
  verticalSpeedDashed: boolean
  mach: boolean
  trackMode: boolean
  fpaMode: boolean
  metricAltitude: boolean
  altitudeStep: 100 | 1000
  buttons: Record<FcuButton, boolean>
}

export interface EfisState {
  baro: number
  baroStd: boolean
  baroInHg: boolean
  fd: boolean
  ls: boolean
  mode: number
  range: number
  nav1: number
  nav2: number
  filters: Record<EfisFilter, boolean>
}

export interface KorryState {
  pushed: boolean
  upperLight: boolean
  lowerLight: boolean
}

export interface OverheadState {
  cockpitDoorVideo: KorryState
  adirs: {
    onBat: boolean
    ir: [KorryState, KorryState, KorryState]
    adr: [KorryState, KorryState, KorryState]
    selectors: [number, number, number]
  }
  flightControls: {
    elac1: KorryState
    sec1: KorryState
    fac1: KorryState
  }
  zoneTwo: {
    evacCaptPurser: boolean
    evacCommand: KorryState
    gen1Line: KorryState
    emergencyGeneratorFault: boolean
    gpws: Record<'terr' | 'sys' | 'gsMode' | 'flapMode' | 'ldgFlap3', KorryState>
    recorderGroundControl: KorryState
    oxygenPassengerUpper: boolean
    oxygenCrew: KorryState
    oxygenHighAlt: KorryState
    callsEmergency: KorryState
    wiperCaptain: 0 | 1 | 2
    covers: Record<ZoneTwoCover, boolean>
  }
}

export type CockpitCommand =
  | { type: 'fcu.rotate'; control: FcuKnob; direction: 1 | -1 }
  | { type: 'fcu.push'; control: FcuKnob }
  | { type: 'fcu.pull'; control: FcuKnob }
  | { type: 'fcu.button'; control: FcuButton }
  | { type: 'fcu.toggle'; control: 'mach' | 'headingTrack' | 'verticalFpa' | 'metricAltitude' | 'altitudeStep' }
  | { type: 'efis.button'; side: EfisSide; control: 'fd' | 'ls' | 'baroStd' | EfisFilter }
  | { type: 'efis.rotate'; side: EfisSide; control: 'baro' | 'mode' | 'range' | 'nav1' | 'nav2'; direction: 1 | -1 }
  | { type: 'efis.push' | 'efis.pull'; side: EfisSide; control: 'baro' }
  | { type: 'efis.toggle'; side: EfisSide; control: 'baroMode' }
  | { type: 'overhead.button'; control: OverheadButton }
  | { type: 'overhead.rotate'; control: OverheadSelector; direction: 1 | -1 }
  | { type: 'overhead.set'; control: OverheadSelector; value: 0 | 1 | 2 }
  | { type: 'overhead.zone2.button'; control: ZoneTwoButton }
  | { type: 'overhead.zone2.cover'; control: ZoneTwoCover; open: boolean }
  | { type: 'overhead.zone2.set'; control: 'evacCaptPurser' | 'wiperCaptain'; value: 0 | 1 | 2 }
