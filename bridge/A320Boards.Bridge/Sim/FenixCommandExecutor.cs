using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Threading;
using A320Boards.Bridge.Protocol;

namespace A320Boards.Bridge.Sim
{
    internal sealed class FenixCommandExecutor
    {
        private const int MaxQueuedCommands = 32;
        private readonly MobiFlightClient _mobiFlight;
        private readonly ConcurrentQueue<BridgeCommand> _commands = new ConcurrentQueue<BridgeCommand>();
        private readonly List<ScheduledCounterRelease> _scheduledReleases = new List<ScheduledCounterRelease>();
        private readonly List<ScheduledAbsoluteWrite> _scheduledWrites = new List<ScheduledAbsoluteWrite>();
        private readonly List<PendingConfirmation> _pendingConfirmations = new List<PendingConfirmation>();
        private int _queuedCommandCount;
        private long _sequence;

        public event Action<CommandResult>? CommandCompleted;

        public FenixCommandExecutor(MobiFlightClient mobiFlight)
        {
            _mobiFlight = mobiFlight;
        }

        public void Enqueue(BridgeCommand command)
        {
            if (Interlocked.Increment(ref _queuedCommandCount) > MaxQueuedCommands)
            {
                Interlocked.Decrement(ref _queuedCommandCount);
                Complete(command, false, "FCU command queue is full; input was throttled.");
                return;
            }

            _commands.Enqueue(command);
        }

        public void Tick(FcuRawState? latestState)
        {
            var now = DateTime.UtcNow;
            if (!latestState.HasValue || !IsOn(latestState.Value.Powered))
            {
                CancelUnsafeInFlightCommands();
                return;
            }

            ProcessConfirmations(latestState, now);

            for (var index = _scheduledReleases.Count - 1; index >= 0; index--)
            {
                if (_scheduledReleases[index].DueAt > now)
                {
                    continue;
                }

                ReleaseCounter(_scheduledReleases[index].Variable);
                _scheduledReleases.RemoveAt(index);
            }

            for (var index = 0; index < _scheduledWrites.Count;)
            {
                if (_scheduledWrites[index].DueAt > now)
                {
                    index++;
                    continue;
                }

                WriteAbsolute(_scheduledWrites[index].Variable, _scheduledWrites[index].Value);
                _scheduledWrites.RemoveAt(index);
            }

            // Keep physical actions serialized. A second click must not start while
            // the first control is still between its press and release edges.
            if (_pendingConfirmations.Count == 0 &&
                _scheduledReleases.Count == 0 &&
                _scheduledWrites.Count == 0 &&
                _commands.TryDequeue(out var command))
            {
                Interlocked.Decrement(ref _queuedCommandCount);
                Execute(command, latestState);
            }
        }

        private void Execute(BridgeCommand command, FcuRawState? latestState)
        {
            try
            {
                if (!latestState.HasValue)
                {
                    throw new InvalidOperationException("No Fenix state available.");
                }
                if (!IsOn(latestState.Value.Powered))
                {
                    throw new InvalidOperationException("Fenix FCU is not powered; command was not sent.");
                }

                Func<FcuRawState, bool> confirmed;
                switch (command.Type)
                {
                    case "fcu.rotate":
                        confirmed = Rotate(command.Control, command.Direction, latestState.Value);
                        break;
                    case "fcu.push":
                        confirmed = Axial(command.Control, push: true, latestState.Value);
                        break;
                    case "fcu.pull":
                        confirmed = Axial(command.Control, push: false, latestState.Value);
                        break;
                    case "fcu.button":
                        ClickCounter(MapButton(command.Control));
                        confirmed = ButtonConfirmation(command.Control, latestState.Value);
                        break;
                    case "fcu.toggle":
                        confirmed = Toggle(command.Control, latestState.Value);
                        break;
                    case "efis.rotate":
                        confirmed = EfisRotate(command, latestState.Value);
                        break;
                    case "efis.button":
                        confirmed = EfisButton(command, latestState.Value);
                        break;
                    case "efis.push":
                        confirmed = EfisAxial(command, push: true, latestState.Value);
                        break;
                    case "efis.pull":
                        confirmed = EfisAxial(command, push: false, latestState.Value);
                        break;
                    case "efis.toggle":
                        confirmed = EfisToggle(command, latestState.Value);
                        break;
                    case "overhead.button":
                        confirmed = OverheadButton(command.Control, latestState.Value);
                        break;
                    case "overhead.rotate":
                        confirmed = OverheadRotate(command, latestState.Value);
                        break;
                    case "overhead.set":
                        confirmed = OverheadSet(command, latestState.Value);
                        break;
                    case "overhead.zone2.button":
                        confirmed = ZoneTwoButton(command.Control, latestState.Value);
                        break;
                    case "overhead.zone2.cover":
                        confirmed = ZoneTwoCover(command.Control, command.Open, latestState.Value);
                        break;
                    case "overhead.zone2.set":
                        confirmed = ZoneTwoSet(command.Control, command.Value, latestState.Value);
                        break;
                    default:
                        throw new InvalidOperationException("Unsupported command type: " + command.Type);
                }

                _pendingConfirmations.Add(new PendingConfirmation(
                    command,
                    DateTime.UtcNow.AddMilliseconds(1500),
                    confirmed));
            }
            catch (Exception exception)
            {
                Complete(command, false, exception.Message);
            }
        }

        private Func<FcuRawState, bool> Rotate(string control, int direction, FcuRawState baseline)
        {
            if (direction != 1 && direction != -1)
            {
                throw new InvalidOperationException("Rotation direction must be 1 or -1.");
            }

            var variable = control switch
            {
                "speed" => "E_FCU_SPEED",
                "heading" => "E_FCU_HEADING",
                "altitude" => "E_FCU_ALTITUDE",
                "verticalSpeed" => "E_FCU_VS",
                _ => throw new InvalidOperationException("Unknown FCU knob: " + control)
            };

            AdjustCounter(variable, direction);
            return control switch
            {
                "speed" => state => state.SpeedRotateCounter != baseline.SpeedRotateCounter,
                "heading" => state => state.HeadingRotateCounter != baseline.HeadingRotateCounter,
                "altitude" => state => state.AltitudeRotateCounter != baseline.AltitudeRotateCounter,
                "verticalSpeed" => state => state.VerticalSpeedRotateCounter != baseline.VerticalSpeedRotateCounter,
                _ => _ => false
            };
        }

        private Func<FcuRawState, bool> Axial(string control, bool push, FcuRawState baseline)
        {
            var variable = control switch
            {
                "speed" => "S_FCU_SPEED",
                "heading" => "S_FCU_HEADING",
                "altitude" => "S_FCU_ALTITUDE",
                "verticalSpeed" => "S_FCU_VERTICAL_SPEED",
                _ => throw new InvalidOperationException("Unknown FCU knob: " + control)
            };

            // Semantic actions remain distinct in the protocol. Only this Fenix adapter
            // translates the axial direction to the counter edge expected by S_FCU_*.
            AdjustCounter(variable, push ? -1 : 1);
            return control switch
            {
                "speed" => state => state.SpeedAxialCounter != baseline.SpeedAxialCounter,
                "heading" => state => state.HeadingAxialCounter != baseline.HeadingAxialCounter,
                "altitude" => state => state.AltitudeAxialCounter != baseline.AltitudeAxialCounter,
                "verticalSpeed" => state => state.VerticalSpeedAxialCounter != baseline.VerticalSpeedAxialCounter,
                _ => _ => false
            };
        }

        private Func<FcuRawState, bool> Toggle(string control, FcuRawState baseline)
        {
            switch (control)
            {
                case "mach":
                    ClickCounter("S_FCU_SPD_MACH");
                    return state => CounterClickCompleted(state.SpdMachButtonCounter, baseline.SpdMachButtonCounter);
                case "headingTrack":
                case "verticalFpa":
                    ClickCounter("S_FCU_HDGVS_TRKFPA");
                    return state => CounterClickCompleted(state.TrackFpaButtonCounter, baseline.TrackFpaButtonCounter);
                case "metricAltitude":
                    ClickCounter("S_FCU_METRIC_ALT");
                    return state => CounterClickCompleted(state.MetricAltitudeS, baseline.MetricAltitudeS);
                case "altitudeStep":
                    WriteAbsolute("S_FCU_ALTITUDE_SCALE", baseline.AltitudeScale >= 0.5 ? 0 : 1);
                    return state => state.AltitudeScale != baseline.AltitudeScale;
                default:
                    throw new InvalidOperationException("Unknown FCU toggle: " + control);
            }
        }

        private Func<FcuRawState, bool> EfisRotate(BridgeCommand command, FcuRawState baseline)
        {
            var firstOfficer = IsFirstOfficer(command.Side);
            var prefix = firstOfficer ? "S_FCU_EFIS2_" : "S_FCU_EFIS1_";
            if (command.Direction != 1 && command.Direction != -1)
            {
                throw new InvalidOperationException("Rotation direction must be 1 or -1.");
            }

            switch (command.Control)
            {
                case "baro":
                    AdjustCounter("E_FCU_EFIS1_BARO", command.Direction);
                    AdjustCounter("E_FCU_EFIS2_BARO", command.Direction);
                    return firstOfficer
                        ? state => state.Efis2BaroCounter != baseline.Efis2BaroCounter || state.Efis2BaroHpa != baseline.Efis2BaroHpa || state.Efis2BaroInch != baseline.Efis2BaroInch
                        : state => state.Efis1BaroCounter != baseline.Efis1BaroCounter || state.Efis1BaroHpa != baseline.Efis1BaroHpa || state.Efis1BaroInch != baseline.Efis1BaroInch;
                case "mode":
                    var mode = Math.Clamp((int)Math.Round(firstOfficer ? baseline.Efis2NdMode : baseline.Efis1NdMode) + command.Direction, 0, 4);
                    WriteAbsolute(prefix + "ND_MODE", mode);
                    return firstOfficer ? state => (int)Math.Round(state.Efis2NdMode) == mode : state => (int)Math.Round(state.Efis1NdMode) == mode;
                case "range":
                    var range = Math.Clamp((int)Math.Round(firstOfficer ? baseline.Efis2NdZoom : baseline.Efis1NdZoom) + command.Direction, 0, 5);
                    WriteAbsolute(prefix + "ND_ZOOM", range);
                    return firstOfficer ? state => (int)Math.Round(state.Efis2NdZoom) == range : state => (int)Math.Round(state.Efis1NdZoom) == range;
                case "nav1":
                    var nav1 = Math.Clamp((int)Math.Round(firstOfficer ? baseline.Efis2Nav1 : baseline.Efis1Nav1) + command.Direction, 0, 2);
                    WriteAbsolute(prefix + "NAV1", nav1);
                    return firstOfficer ? state => (int)Math.Round(state.Efis2Nav1) == nav1 : state => (int)Math.Round(state.Efis1Nav1) == nav1;
                case "nav2":
                    var nav2 = Math.Clamp((int)Math.Round(firstOfficer ? baseline.Efis2Nav2 : baseline.Efis1Nav2) + command.Direction, 0, 2);
                    WriteAbsolute(prefix + "NAV2", nav2);
                    return firstOfficer ? state => (int)Math.Round(state.Efis2Nav2) == nav2 : state => (int)Math.Round(state.Efis1Nav2) == nav2;
                default:
                    throw new InvalidOperationException("Unknown EFIS rotary control: " + command.Control);
            }
        }

        private Func<FcuRawState, bool> EfisButton(BridgeCommand command, FcuRawState baseline)
        {
            var firstOfficer = IsFirstOfficer(command.Side);
            var prefix = firstOfficer ? "S_FCU_EFIS2_" : "S_FCU_EFIS1_";
            if (command.Control == "baroStd")
            {
                var selectStd = (firstOfficer ? baseline.Efis2Qnh : baseline.Efis1Qnh) >= 0.5;
                WriteSynchronizedBaro("BARO_STD", selectStd ? 1 : 0);
                return firstOfficer ? state => (state.Efis2Qnh < 0.5) == selectStd : state => (state.Efis1Qnh < 0.5) == selectStd;
            }

            var variable = command.Control switch
            {
                "fd" => prefix + "FD",
                "ls" => prefix + "LS",
                "cstr" => prefix + "CSTR",
                "wpt" => prefix + "WPT",
                "vord" => prefix + "VORD",
                "ndb" => prefix + "NDB",
                "arpt" => prefix + "ARPT",
                _ => throw new InvalidOperationException("Unknown EFIS button: " + command.Control)
            };

            PulseMomentary(variable);
            if (firstOfficer)
            {
                return command.Control switch
                {
                    "fd" => state => IsOn(state.Efis2Fd) != IsOn(baseline.Efis2Fd),
                    "ls" => state => IsOn(state.Efis2Ls) != IsOn(baseline.Efis2Ls),
                    "cstr" => state => IsOn(state.Efis2Cstr) != IsOn(baseline.Efis2Cstr),
                    "wpt" => state => IsOn(state.Efis2Wpt) != IsOn(baseline.Efis2Wpt),
                    "vord" => state => IsOn(state.Efis2Vord) != IsOn(baseline.Efis2Vord),
                    "ndb" => state => IsOn(state.Efis2Ndb) != IsOn(baseline.Efis2Ndb),
                    "arpt" => state => IsOn(state.Efis2Arpt) != IsOn(baseline.Efis2Arpt),
                    _ => _ => false
                };
            }

            return command.Control switch
            {
                "fd" => state => IsOn(state.Efis1Fd) != IsOn(baseline.Efis1Fd),
                "ls" => state => IsOn(state.Efis1Ls) != IsOn(baseline.Efis1Ls),
                "cstr" => state => IsOn(state.Efis1Cstr) != IsOn(baseline.Efis1Cstr),
                "wpt" => state => IsOn(state.Efis1Wpt) != IsOn(baseline.Efis1Wpt),
                "vord" => state => IsOn(state.Efis1Vord) != IsOn(baseline.Efis1Vord),
                "ndb" => state => IsOn(state.Efis1Ndb) != IsOn(baseline.Efis1Ndb),
                "arpt" => state => IsOn(state.Efis1Arpt) != IsOn(baseline.Efis1Arpt),
                _ => _ => false
            };
        }

        private Func<FcuRawState, bool> EfisAxial(BridgeCommand command, bool push, FcuRawState baseline)
        {
            var firstOfficer = IsFirstOfficer(command.Side);
            if (command.Control != "baro")
            {
                throw new InvalidOperationException("Unknown EFIS axial control: " + command.Control);
            }

            // Airbus BARO: push returns to QNH, pull selects STD.
            WriteSynchronizedBaro("BARO_STD", push ? 0 : 1);
            return firstOfficer
                ? state => push ? state.Efis2Qnh >= 0.5 : state.Efis2Qnh < 0.5
                : state => push ? state.Efis1Qnh >= 0.5 : state.Efis1Qnh < 0.5;
        }

        private Func<FcuRawState, bool> EfisToggle(BridgeCommand command, FcuRawState baseline)
        {
            var firstOfficer = IsFirstOfficer(command.Side);
            if (command.Control != "baroMode")
            {
                throw new InvalidOperationException("Unknown EFIS toggle: " + command.Control);
            }

            var mode = (firstOfficer ? baseline.Efis2BaroMode : baseline.Efis1BaroMode) < 0.5 ? 1 : 0;
            WriteSynchronizedBaro("BARO_MODE", mode);
            return firstOfficer ? state => (int)Math.Round(state.Efis2BaroMode) == mode : state => (int)Math.Round(state.Efis1BaroMode) == mode;
        }

        private static bool IsFirstOfficer(string side)
        {
            if (side.Length == 0 || side == "captain")
            {
                return false;
            }
            if (side == "firstOfficer") return true;
            throw new InvalidOperationException("Unknown EFIS side: " + side);
        }

        private Func<FcuRawState, bool> OverheadButton(string control, FcuRawState baseline)
        {
            if (control == "cockpitDoorVideo")
            {
                var target = IsOn(baseline.CockpitDoorVideoSwitch) ? 0 : 1;
                WriteAbsolute("S_OH_COCKPIT_DOOR_VIDEO", target);
                return state => IsOn(state.CockpitDoorVideoSwitch) == (target == 1);
            }

            if (control == "elac1" || control == "sec1" || control == "fac1")
            {
                var flightControlsVariable = control switch
                {
                    "elac1" => "S_OH_FLT_CTL_ELAC_1",
                    "sec1" => "S_OH_FLT_CTL_SEC_1",
                    "fac1" => "S_OH_FLT_CTL_FAC_1",
                    _ => throw new InvalidOperationException("Unknown flight-control computer: " + control)
                };
                var baselineSwitch = FlightControlsSwitch(control, baseline);
                var target = IsOn(baselineSwitch) ? 0 : 1;
                WriteAbsolute(flightControlsVariable, target);
                return state => IsOn(FlightControlsSwitch(control, state)) == (target == 1);
            }

            var variable = control switch
            {
                "ir1" => "S_OH_NAV_IR1_SWITCH",
                "ir2" => "S_OH_NAV_IR2_SWITCH",
                "ir3" => "S_OH_NAV_IR3_SWITCH",
                "adr1" => "S_OH_NAV_ADR1",
                "adr2" => "S_OH_NAV_ADR2",
                "adr3" => "S_OH_NAV_ADR3",
                _ => throw new InvalidOperationException("Unknown overhead button: " + control)
            };
            var baselineLower = OverheadLowerIndicator(control, baseline);
            var baselineUpper = OverheadUpperIndicator(control, baseline);
            PulseFenixMomentary(variable);
            return state => OverheadLowerIndicator(control, state) != baselineLower ||
                            OverheadUpperIndicator(control, state) != baselineUpper;
        }

        private Func<FcuRawState, bool> ZoneTwoButton(string control, FcuRawState baseline)
        {
            var variable = control switch
            {
                "evacCommand" => "S_OH_EVAC_COMMAND",
                "evacHorn" => "S_OH_EVAC_HORN_SHUTOFF",
                "emergencyGeneratorTest" => "S_OH_ELEC_EMER_GEN_TEST",
                "gen1Line" => "S_OH_ELEC_GEN1_LINE",
                "ratManualOn" => "S_OH_ELEC_EMER_GEN_MAN_ON",
                "gpwsTerr" => "S_OH_GPWS_TERR",
                "gpwsSys" => "S_OH_GPWS_SYS",
                "gpwsGsMode" => "S_OH_GPWS_GS_MODE",
                "gpwsFlapMode" => "S_OH_GPWS_FLAP_MODE",
                "gpwsLdgFlap3" => "S_OH_GPWS_LDG_FLAP3",
                "recorderGroundControl" => "S_OH_RCRD_GND_CTL",
                "cvrErase" => "S_OH_RCRD_ERASE",
                "cvrTest" => "S_OH_RCRD_TEST",
                "oxygenHighAlt" => "S_OH_OXYGEN_HIGH_ALT",
                "oxygenMaskManualOn" => "S_OH_OXYGEN_MASK_MAN_ON",
                "oxygenCrewSupply" => "S_OH_OXYGEN_CREW_OXYGEN",
                "callsMech" => "S_OH_CALLS_MECH",
                "callsAll" => "S_OH_CALLS_ALL",
                "callsFwd" => "S_OH_CALLS_FWD",
                "callsAft" => "S_OH_CALLS_AFT",
                "callsEmergency" => "S_OH_CALLS_EMER",
                "rainRepellent" => "S_MISC_WIPER_REPELLENT_CAPT",
                _ => throw new InvalidOperationException("Unknown overhead zone 2 button: " + control)
            };
            var before = ZoneTwoObservable(control, baseline);
            var latching = control == "evacCommand" || control == "gen1Line" ||
                           control == "gpwsTerr" || control == "gpwsSys" ||
                           control == "gpwsGsMode" || control == "gpwsFlapMode" ||
                           control == "gpwsLdgFlap3" || control == "oxygenHighAlt" ||
                           control == "oxygenCrewSupply" || control == "callsEmergency";

            if (latching)
            {
                var target = IsOn(before) ? 0 : 1;
                WriteAbsolute(variable, target);
                return state => IsOn(ZoneTwoObservable(control, state)) == (target == 1);
            }

            // Fenix's own momentary-button template increments the S-variable
            // once on LeftSingle and once again on LeftRelease. Reproduce both
            // edges on separate simulator frames; writing 0/1/0 does not click it.
            ClickCounter(variable);
            return control == "recorderGroundControl"
                ? state => ZoneTwoObservable(control, state) != before
                : _ => true;
        }

        private Func<FcuRawState, bool> ZoneTwoCover(string control, bool open, FcuRawState baseline)
        {
            var variable = control switch
            {
                "emergencyGeneratorTest" => "S_OH_ELEC_EMER_GEN_TEST_Cover",
                "ratManualOn" => "S_OH_ELEC_EMER_GEN_MAN_ON_Cover",
                "evacCommand" => "S_OH_EVAC_COMMAND_Cover",
                "oxygenHighAlt" => "S_OH_OXYGEN_HIGH_ALT_Cover",
                "oxygenMaskManualOn" => "S_OH_OXYGEN_MASK_MAN_ON_Cover",
                "callsEmergency" => "S_OH_CALLS_EMER_Cover",
                _ => throw new InvalidOperationException("This zone 2 cover is not exposed by Fenix: " + control)
            };
            WriteAbsolute(variable, open ? 1 : 0);
            return state => IsOn(ZoneTwoCoverValue(control, state)) == open;
        }

        private Func<FcuRawState, bool> ZoneTwoSet(string control, double rawValue, FcuRawState baseline)
        {
            var value = (int)Math.Round(rawValue);
            if (control == "evacCaptPurser")
            {
                value = Math.Clamp(value, 0, 1);
                var captAndPurser = value == 1;
                var fenixValue = captAndPurser ? 0 : 1;
                WriteAbsolute("S_OH_EVAC_CAPT_PURSER", fenixValue);
                return state => !IsOn(state.ZoneTwoEvacCaptPurser) == captAndPurser;
            }
            if (control == "wiperCaptain")
            {
                value = Math.Clamp(value, 0, 2);
                WriteAbsolute("S_MISC_WIPER_CAPT", value);
                return state => (int)Math.Round(state.ZoneTwoWiperCaptain) == value;
            }
            throw new InvalidOperationException("Unknown overhead zone 2 selector: " + control);
        }

        private static double ZoneTwoObservable(string control, FcuRawState state)
        {
            return control switch
            {
                "evacCommand" => state.ZoneTwoEvacCommand,
                "gen1Line" => state.ZoneTwoGen1Line,
                "gpwsTerr" => state.ZoneTwoGpwsTerr,
                "gpwsSys" => state.ZoneTwoGpwsSys,
                "gpwsGsMode" => state.ZoneTwoGpwsGsMode,
                "gpwsFlapMode" => state.ZoneTwoGpwsFlapMode,
                "gpwsLdgFlap3" => state.ZoneTwoGpwsLdgFlap3,
                "recorderGroundControl" => state.ZoneTwoRecorderGroundControl,
                "oxygenHighAlt" => state.ZoneTwoOxygenHighAlt,
                "oxygenCrewSupply" => state.ZoneTwoOxygenCrew,
                "callsEmergency" => state.ZoneTwoCallsEmergency,
                "rainRepellent" => 0,
                _ => 0
            };
        }

        private static double ZoneTwoCoverValue(string control, FcuRawState state)
        {
            return control switch
            {
                "emergencyGeneratorTest" => state.ZoneTwoEmergencyGeneratorTestCover,
                "ratManualOn" => state.ZoneTwoRatManualOnCover,
                "evacCommand" => state.ZoneTwoEvacCommandCover,
                "oxygenHighAlt" => state.ZoneTwoOxygenHighAltCover,
                "oxygenMaskManualOn" => state.ZoneTwoOxygenMaskManualOnCover,
                "callsEmergency" => state.ZoneTwoCallsEmergencyCover,
                _ => 0
            };
        }

        private static double FlightControlsSwitch(string control, FcuRawState state)
        {
            return control switch
            {
                "elac1" => state.FlightControlsElac1Switch,
                "sec1" => state.FlightControlsSec1Switch,
                "fac1" => state.FlightControlsFac1Switch,
                _ => throw new InvalidOperationException("Unknown flight-control computer: " + control)
            };
        }

        private Func<FcuRawState, bool> OverheadRotate(BridgeCommand command, FcuRawState baseline)
        {
            if (command.Direction != 1 && command.Direction != -1)
            {
                throw new InvalidOperationException("Rotation direction must be 1 or -1.");
            }

            var current = OverheadSelectorValue(command.Control, baseline);
            var target = Math.Clamp((int)Math.Round(current) + command.Direction, 0, 2);
            WriteAbsolute(OverheadSelectorVariable(command.Control), target);
            return state => (int)Math.Round(OverheadSelectorValue(command.Control, state)) == target;
        }

        private Func<FcuRawState, bool> OverheadSet(BridgeCommand command, FcuRawState baseline)
        {
            var target = (int)Math.Round(command.Value);
            if (target < 0 || target > 2 || Math.Abs(command.Value - target) > 0.001)
            {
                throw new InvalidOperationException("ADIRS selector value must be 0, 1, or 2.");
            }

            WriteAbsolute(OverheadSelectorVariable(command.Control), target);
            return state => (int)Math.Round(OverheadSelectorValue(command.Control, state)) == target;
        }

        private static string OverheadSelectorVariable(string control)
        {
            return control switch
            {
                "ir1Mode" => "S_OH_NAV_IR1_MODE",
                "ir2Mode" => "S_OH_NAV_IR2_MODE",
                "ir3Mode" => "S_OH_NAV_IR3_MODE",
                _ => throw new InvalidOperationException("Unknown ADIRS selector: " + control)
            };
        }

        private static double OverheadSelectorValue(string control, FcuRawState state)
        {
            return control switch
            {
                "ir1Mode" => state.AdirsIr1Mode,
                "ir2Mode" => state.AdirsIr2Mode,
                "ir3Mode" => state.AdirsIr3Mode,
                _ => throw new InvalidOperationException("Unknown ADIRS selector: " + control)
            };
        }

        private static bool OverheadLowerIndicator(string control, FcuRawState state)
        {
            return IsOn(control switch
            {
                "ir1" => state.AdirsIr1Lower,
                "ir2" => state.AdirsIr2Lower,
                "ir3" => state.AdirsIr3Lower,
                "adr1" => state.AdirsAdr1Lower,
                "adr2" => state.AdirsAdr2Lower,
                "adr3" => state.AdirsAdr3Lower,
                _ => throw new InvalidOperationException("Unknown overhead Korry: " + control)
            });
        }

        private static bool OverheadUpperIndicator(string control, FcuRawState state)
        {
            return IsOn(control switch
            {
                "ir1" => state.AdirsIr1Upper,
                "ir2" => state.AdirsIr2Upper,
                "ir3" => state.AdirsIr3Upper,
                "adr1" => state.AdirsAdr1Upper,
                "adr2" => state.AdirsAdr2Upper,
                "adr3" => state.AdirsAdr3Upper,
                _ => throw new InvalidOperationException("Unknown overhead Korry: " + control)
            });
        }

        private static bool IsOn(double value)
        {
            return Math.Abs(value) >= 0.5;
        }

        private void WriteSynchronizedBaro(string suffix, double value)
        {
            WriteAbsolute("S_FCU_EFIS1_" + suffix, value);
            WriteAbsolute("S_FCU_EFIS2_" + suffix, value);
        }

        private void PulseMomentary(string variable)
        {
            WriteAbsolute(variable, 0);
            var now = DateTime.UtcNow;
            _scheduledWrites.Add(new ScheduledAbsoluteWrite(now.AddMilliseconds(100), variable, 1));
            _scheduledWrites.Add(new ScheduledAbsoluteWrite(now.AddMilliseconds(300), variable, 0));
        }

        private void PulseFenixMomentary(string variable)
        {
            // Fenix S_* Korry inputs are rising-edge actions, not latched state.
            // Establish a clean release, press on a later frame, then release again.
            WriteAbsolute(variable, 0);
            var now = DateTime.UtcNow;
            _scheduledWrites.Add(new ScheduledAbsoluteWrite(now.AddMilliseconds(200), variable, 1));
            _scheduledWrites.Add(new ScheduledAbsoluteWrite(now.AddMilliseconds(400), variable, 0));
        }

        private static Func<FcuRawState, bool> ButtonConfirmation(string control, FcuRawState baseline)
        {
            return control switch
            {
                "loc" => state => CounterClickCompleted(state.LocButtonCounter, baseline.LocButtonCounter),
                "exped" => state => CounterClickCompleted(state.ExpedButtonCounter, baseline.ExpedButtonCounter),
                "ap1" => state => CounterClickCompleted(state.Ap1ButtonCounter, baseline.Ap1ButtonCounter),
                "ap2" => state => CounterClickCompleted(state.Ap2ButtonCounter, baseline.Ap2ButtonCounter),
                "athr" => state => CounterClickCompleted(state.AutoThrustButtonCounter, baseline.AutoThrustButtonCounter),
                "appr" => state => CounterClickCompleted(state.ApprButtonCounter, baseline.ApprButtonCounter),
                _ => _ => false
            };
        }

        private static bool CounterClickCompleted(double current, double baseline)
        {
            return Math.Abs(current - baseline) >= 2;
        }

        private static string MapButton(string control)
        {
            return control switch
            {
                "loc" => "S_FCU_LOC",
                "exped" => "S_FCU_EXPED",
                "ap1" => "S_FCU_AP1",
                "ap2" => "S_FCU_AP2",
                "athr" => "S_FCU_ATHR",
                "appr" => "S_FCU_APPR",
                _ => throw new InvalidOperationException("Unknown FCU button: " + control)
            };
        }

        private void AdjustCounter(string variable, int delta)
        {
            var sequence = ++_sequence;
            var sign = delta > 0 ? "+" : "-";
            _mobiFlight.ExecuteCalculatorCode(
                "(L:" + variable + ") " + Math.Abs(delta) + " " + sign + " " + sequence + " 0 * + (>L:" + variable + ")");
        }

        private void ClickCounter(string variable)
        {
            // Current Fenix HubHop presets increment once on press and once on
            // release. Keeping the edges on separate simulator frames matters:
            // an atomic +2 changes the counter but does not actuate the control.
            AdjustCounter(variable, 1);
            _scheduledReleases.Add(new ScheduledCounterRelease(
                DateTime.UtcNow.AddMilliseconds(100),
                variable));
        }

        private void ReleaseCounter(string variable)
        {
            var sequence = ++_sequence;
            _mobiFlight.ExecuteCalculatorCode(
                "(L:" + variable + ") s0 2 % 0 != if{ l0 ++ " + sequence + " 0 * + (>L:" + variable + ") }");
        }

        private void WriteAbsolute(string variable, double value)
        {
            var sequence = ++_sequence;
            _mobiFlight.ExecuteCalculatorCode(
                value.ToString(System.Globalization.CultureInfo.InvariantCulture) +
                " " + sequence + " 0 * + (>L:" + variable + ")");
        }

        private void Complete(BridgeCommand command, bool success, string message)
        {
            CommandCompleted?.Invoke(new CommandResult
            {
                ClientId = command.ClientId,
                CommandId = command.CommandId,
                Success = success,
                Message = message
            });
        }

        private void ProcessConfirmations(FcuRawState? latestState, DateTime now)
        {
            for (var index = _pendingConfirmations.Count - 1; index >= 0; index--)
            {
                var pending = _pendingConfirmations[index];
                if (latestState.HasValue && pending.IsConfirmed(latestState.Value))
                {
                    Complete(pending.Command, true, "confirmed by Fenix readback");
                    _pendingConfirmations.RemoveAt(index);
                    continue;
                }

                if (now >= pending.ExpiresAt)
                {
                    Complete(pending.Command, false, "No matching Fenix readback within 1500 ms.");
                    _pendingConfirmations.RemoveAt(index);
                }
            }
        }

        private void CancelUnsafeInFlightCommands()
        {
            foreach (var pending in _pendingConfirmations)
            {
                Complete(pending.Command, false, "Fenix FCU lost power before command completion.");
            }
            _pendingConfirmations.Clear();
            _scheduledReleases.Clear();
            _scheduledWrites.Clear();

            while (_commands.TryDequeue(out var command))
            {
                Interlocked.Decrement(ref _queuedCommandCount);
                Complete(command, false, "Fenix FCU is not powered; queued command was cancelled.");
            }
        }

        private sealed class ScheduledCounterRelease
        {
            public ScheduledCounterRelease(DateTime dueAt, string variable)
            {
                DueAt = dueAt;
                Variable = variable;
            }

            public DateTime DueAt { get; }
            public string Variable { get; }
        }

        private sealed class ScheduledAbsoluteWrite
        {
            public ScheduledAbsoluteWrite(DateTime dueAt, string variable, double value)
            {
                DueAt = dueAt;
                Variable = variable;
                Value = value;
            }

            public DateTime DueAt { get; }
            public string Variable { get; }
            public double Value { get; }
        }

        private sealed class PendingConfirmation
        {
            public PendingConfirmation(BridgeCommand command, DateTime expiresAt, Func<FcuRawState, bool> isConfirmed)
            {
                Command = command;
                ExpiresAt = expiresAt;
                IsConfirmed = isConfirmed;
            }

            public BridgeCommand Command { get; }
            public DateTime ExpiresAt { get; }
            public Func<FcuRawState, bool> IsConfirmed { get; }
        }
    }
}
