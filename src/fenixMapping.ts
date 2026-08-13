import type { CockpitCommand } from './types'

/** Mappings verified against msfs-blind-assist/FenixA320Definition.cs. */
export const fenixReadVars = {
  speed: 'N_FCU_SPEED', heading: 'N_FCU_HEADING', altitude: 'N_FCU_ALTITUDE',
  verticalSpeed: 'N_FCU_VS', powered: 'B_FCU_POWER', speedDashed: 'B_FCU_SPEED_DASHED',
  headingDashed: 'B_FCU_HEADING_DASHED', verticalSpeedDashed: 'B_FCU_VERTICALSPEED_DASHED',
  speedManaged: 'I_FCU_SPEED_MANAGED', headingManaged: 'I_FCU_HEADING_MANAGED',
  altitudeManaged: 'I_FCU_ALTITUDE_MANAGED', mach: 'I_FCU_MACH_MODE',
  combinedTrackFpa: 'I_FCU_TRACK_FPA_MODE',
  cockpitDoorVideoPosition: 'S_OH_COCKPIT_DOOR_VIDEO', cockpitDoorVideoLight: 'I_OH_DOOR_VIDEO',
  adirsOnBat: 'I_OH_NAV_ADIRS_ON_BAT',
  flightControlsElac1Position: 'S_OH_FLT_CTL_ELAC_1', flightControlsElac1Fault: 'I_OH_FLT_CTL_ELAC_1_U', flightControlsElac1Off: 'I_OH_FLT_CTL_ELAC_1_L',
  flightControlsSec1Position: 'S_OH_FLT_CTL_SEC_1', flightControlsSec1Fault: 'I_OH_FLT_CTL_SEC_1_U', flightControlsSec1Off: 'I_OH_FLT_CTL_SEC_1_L',
  flightControlsFac1Position: 'S_OH_FLT_CTL_FAC_1', flightControlsFac1Fault: 'I_OH_FLT_CTL_FAC_1_U', flightControlsFac1Off: 'I_OH_FLT_CTL_FAC_1_L',
} as const

export type FenixWrite = { name: string; operation: 'pulse' | 'increment' | 'decrement' | 'push' | 'pull' | 'toggle' | 'adjust' }

export function commandToFenixLVar(command: CockpitCommand): FenixWrite {
  if (command.type === 'fcu.button') return { name: `S_FCU_${command.control.toUpperCase()}`, operation: 'pulse' }
  if (command.type === 'fcu.toggle') {
    const names = { mach: 'S_FCU_SPD_MACH', headingTrack: 'S_FCU_HDGVS_TRKFPA', verticalFpa: 'S_FCU_HDGVS_TRKFPA', metricAltitude: 'S_FCU_METRIC_ALT', altitudeStep: 'S_FCU_ALTITUDE_SCALE' }
    return { name: names[command.control], operation: command.control === 'altitudeStep' ? 'toggle' : 'pulse' }
  }
  if (command.type === 'fcu.rotate') {
    const names = { speed: 'E_FCU_SPEED', heading: 'E_FCU_HEADING', altitude: 'E_FCU_ALTITUDE', verticalSpeed: 'E_FCU_VS' }
    return { name: names[command.control], operation: command.direction > 0 ? 'increment' : 'decrement' }
  }
  if (command.type === 'fcu.push' || command.type === 'fcu.pull') {
    const names = { speed: 'S_FCU_SPEED', heading: 'S_FCU_HEADING', altitude: 'S_FCU_ALTITUDE', verticalSpeed: 'S_FCU_VERTICAL_SPEED' }
    // Axial actions stay semantic here. Only the Fenix bridge adapter translates
    // them to the counter edge required by the corresponding S_FCU_* variable.
    return { name: names[command.control], operation: command.type === 'fcu.push' ? 'push' : 'pull' }
  }
  if (command.type === 'overhead.button') {
    const names = {
      cockpitDoorVideo: 'S_OH_COCKPIT_DOOR_VIDEO',
      ir1: 'S_OH_NAV_IR1_SWITCH', ir2: 'S_OH_NAV_IR2_SWITCH', ir3: 'S_OH_NAV_IR3_SWITCH',
      adr1: 'S_OH_NAV_ADR1', adr2: 'S_OH_NAV_ADR2', adr3: 'S_OH_NAV_ADR3',
      elac1: 'S_OH_FLT_CTL_ELAC_1', sec1: 'S_OH_FLT_CTL_SEC_1', fac1: 'S_OH_FLT_CTL_FAC_1',
    }
    return { name: names[command.control], operation: command.control === 'cockpitDoorVideo' || command.control === 'elac1' || command.control === 'sec1' || command.control === 'fac1' ? 'toggle' : 'pulse' }
  }
  if (command.type === 'overhead.rotate' || command.type === 'overhead.set') {
    const names = { ir1Mode: 'S_OH_NAV_IR1_MODE', ir2Mode: 'S_OH_NAV_IR2_MODE', ir3Mode: 'S_OH_NAV_IR3_MODE' }
    return { name: names[command.control], operation: 'adjust' }
  }
  if (command.type === 'overhead.zone2.button' || command.type === 'overhead.zone2.cover' || command.type === 'overhead.zone2.set') return { name: command.control, operation: 'adjust' }
  const side = command.side === 'captain' ? 'EFIS1' : 'EFIS2'
  if (command.type === 'efis.button') {
    const suffix = command.control === 'baroStd' ? 'BARO_STD' : command.control === 'fd' || command.control === 'ls' ? `${command.control.toUpperCase()}_PRESS` : command.control.toUpperCase()
    return { name: `S_FCU_${side}_${suffix}`, operation: 'pulse' }
  }
  if (command.type === 'efis.rotate') {
    const suffix = { baro: 'BARO', mode: 'ND_MODE', range: 'ND_ZOOM', nav1: 'NAV1', nav2: 'NAV2' }[command.control]
    return {
      name: `${command.control === 'baro' ? 'E' : 'S'}_FCU_${side}_${suffix}`,
      operation: command.control === 'baro' ? (command.direction > 0 ? 'increment' : 'decrement') : 'adjust',
    }
  }
  if (command.type === 'efis.toggle') {
    return { name: `S_FCU_${side}_BARO_MODE`, operation: 'toggle' }
  }
  return { name: `S_FCU_${side}_BARO_STD`, operation: command.type === 'efis.push' ? 'push' : 'pull' }
}
