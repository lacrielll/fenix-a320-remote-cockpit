using System;

namespace A320Boards.Bridge.Protocol
{
    internal sealed class FcuState
    {
        public bool Powered { get; set; }
        public double Speed { get; set; }
        public double Heading { get; set; }
        public double Altitude { get; set; }
        public double VerticalSpeed { get; set; }
        public bool SpeedManaged { get; set; }
        public bool HeadingManaged { get; set; }
        public bool AltitudeManaged { get; set; }
        public bool VerticalSpeedManaged { get; set; }
        public bool SpeedDashed { get; set; }
        public bool HeadingDashed { get; set; }
        public bool VerticalSpeedDashed { get; set; }
        public bool Mach { get; set; }
        public bool TrackMode { get; set; }
        public bool FpaMode { get; set; }
        public bool MetricAltitude { get; set; }
        public int AltitudeStep { get; set; }
        public FcuButtons Buttons { get; set; } = new FcuButtons();

        public static FcuState FromRaw(Sim.FcuRawState raw)
        {
            var trackFpa = IsOn(raw.TrackFpaModeB) || IsOn(raw.TrackFpaModeI);
            var machMode = IsOn(raw.MachModeB) || IsOn(raw.MachModeI);
            return new FcuState
            {
                Powered = IsOn(raw.Powered),
                // Fenix exposes Mach as integer hundredths (15 means Mach 0.15),
                // while the existing FCU component expects the decimal value.
                Speed = machMode ? raw.Speed / 100.0 : raw.Speed,
                Heading = raw.Heading,
                Altitude = raw.Altitude,
                VerticalSpeed = raw.VerticalSpeed,
                SpeedManaged = IsOn(raw.SpeedManaged),
                HeadingManaged = IsOn(raw.HeadingManaged),
                AltitudeManaged = IsOn(raw.AltitudeManaged),
                VerticalSpeedManaged = false,
                SpeedDashed = IsOn(raw.SpeedDashed),
                HeadingDashed = IsOn(raw.HeadingDashed),
                VerticalSpeedDashed = IsOn(raw.VerticalSpeedDashed),
                Mach = machMode,
                TrackMode = trackFpa,
                FpaMode = trackFpa,
                // S_FCU_METRIC_ALT is a monotonically changing press/release counter,
                // not a latched indicator. Fenix exposes no reliable FCU metric lamp
                // output, so do not manufacture display state from the input counter.
                MetricAltitude = false,
                AltitudeStep = IsOn(raw.AltitudeScale) ? 1000 : 100,
                Buttons = new FcuButtons
                {
                    Loc = IsOn(raw.Loc),
                    Exped = IsOn(raw.Exped),
                    Ap1 = IsOn(raw.Ap1),
                    Ap2 = IsOn(raw.Ap2),
                    Athr = IsOn(raw.AutoThrust),
                    Appr = IsOn(raw.Appr)
                }
            };
        }

        private static bool IsOn(double value)
        {
            return Math.Abs(value) >= 0.5;
        }
    }

    internal sealed class FcuButtons
    {
        public bool Loc { get; set; }
        public bool Exped { get; set; }
        public bool Ap1 { get; set; }
        public bool Ap2 { get; set; }
        public bool Athr { get; set; }
        public bool Appr { get; set; }
    }

    internal sealed class EfisState
    {
        public double Baro { get; set; }
        public bool BaroStd { get; set; }
        public bool BaroInHg { get; set; }
        public bool Fd { get; set; }
        public bool Ls { get; set; }
        public int Mode { get; set; }
        public int Range { get; set; }
        public int Nav1 { get; set; }
        public int Nav2 { get; set; }
        public EfisFilters Filters { get; set; } = new EfisFilters();

        public static EfisState FromRaw(Sim.FcuRawState raw, bool firstOfficer = false)
        {
            var baroMode = firstOfficer ? raw.Efis2BaroMode : raw.Efis1BaroMode;
            var qnh = firstOfficer ? raw.Efis2Qnh : raw.Efis1Qnh;
            var baroInch = firstOfficer ? raw.Efis2BaroInch : raw.Efis1BaroInch;
            var baroHpa = firstOfficer ? raw.Efis2BaroHpa : raw.Efis1BaroHpa;
            var inHg = baroMode < 0.5;
            return new EfisState
            {
                Baro = inHg ? baroInch : baroHpa,
                BaroStd = qnh < 0.5,
                BaroInHg = inHg,
                Fd = IsOn(firstOfficer ? raw.Efis2Fd : raw.Efis1Fd),
                Ls = IsOn(firstOfficer ? raw.Efis2Ls : raw.Efis1Ls),
                Mode = ClampPosition(firstOfficer ? raw.Efis2NdMode : raw.Efis1NdMode, 0, 4),
                Range = ClampPosition(firstOfficer ? raw.Efis2NdZoom : raw.Efis1NdZoom, 0, 5),
                Nav1 = ClampPosition(firstOfficer ? raw.Efis2Nav1 : raw.Efis1Nav1, 0, 2),
                Nav2 = ClampPosition(firstOfficer ? raw.Efis2Nav2 : raw.Efis1Nav2, 0, 2),
                Filters = new EfisFilters
                {
                    Cstr = IsOn(firstOfficer ? raw.Efis2Cstr : raw.Efis1Cstr),
                    Wpt = IsOn(firstOfficer ? raw.Efis2Wpt : raw.Efis1Wpt),
                    Vord = IsOn(firstOfficer ? raw.Efis2Vord : raw.Efis1Vord),
                    Ndb = IsOn(firstOfficer ? raw.Efis2Ndb : raw.Efis1Ndb),
                    Arpt = IsOn(firstOfficer ? raw.Efis2Arpt : raw.Efis1Arpt)
                }
            };
        }

        private static int ClampPosition(double value, int minimum, int maximum)
        {
            return Math.Clamp((int)Math.Round(value), minimum, maximum);
        }

        private static bool IsOn(double value)
        {
            return Math.Abs(value) >= 0.5;
        }
    }

    internal sealed class EfisFilters
    {
        public bool Cstr { get; set; }
        public bool Wpt { get; set; }
        public bool Vord { get; set; }
        public bool Ndb { get; set; }
        public bool Arpt { get; set; }
    }

    internal sealed class KorryState
    {
        public bool Pushed { get; set; }
        public bool UpperLight { get; set; }
        public bool LowerLight { get; set; }

        public static KorryState FromIndicators(double lower, double upper)
        {
            var lowerLight = Math.Abs(lower) >= 0.5;
            return new KorryState
            {
                // Fenix S_* pushbutton inputs are momentary and return to zero.
                // On ADIRS Korries the latched mechanical state is represented by
                // the inverse of the lower OFF indication once the panel is powered.
                Pushed = !lowerLight,
                UpperLight = Math.Abs(upper) >= 0.5,
                LowerLight = lowerLight
            };
        }

        public static KorryState FromSwitchAndIndicators(double pushed, double lower, double upper)
        {
            return new KorryState
            {
                Pushed = Math.Abs(pushed) >= 0.5,
                UpperLight = Math.Abs(upper) >= 0.5,
                LowerLight = Math.Abs(lower) >= 0.5
            };
        }
    }

    internal sealed class AdirsState
    {
        public bool OnBat { get; set; }
        public KorryState[] Ir { get; set; } = Array.Empty<KorryState>();
        public KorryState[] Adr { get; set; } = Array.Empty<KorryState>();
        public int[] Selectors { get; set; } = Array.Empty<int>();
    }

    internal sealed class OverheadState
    {
        public KorryState CockpitDoorVideo { get; set; } = new KorryState();
        public AdirsState Adirs { get; set; } = new AdirsState();
        public FlightControlsState FlightControls { get; set; } = new FlightControlsState();

        public static OverheadState FromRaw(Sim.FcuRawState raw)
        {
            var videoIndicator = Math.Abs(raw.CockpitDoorVideoIndicator) >= 0.5;
            return new OverheadState
            {
                CockpitDoorVideo = new KorryState
                {
                    Pushed = Math.Abs(raw.CockpitDoorVideoSwitch) >= 0.5,
                    UpperLight = false,
                    LowerLight = videoIndicator
                },
                Adirs = new AdirsState
                {
                    OnBat = Math.Abs(raw.AdirsOnBat) >= 0.5,
                    Ir = new[]
                    {
                        KorryState.FromIndicators(raw.AdirsIr1Lower, raw.AdirsIr1Upper),
                        KorryState.FromIndicators(raw.AdirsIr2Lower, raw.AdirsIr2Upper),
                        KorryState.FromIndicators(raw.AdirsIr3Lower, raw.AdirsIr3Upper)
                    },
                    Adr = new[]
                    {
                        KorryState.FromIndicators(raw.AdirsAdr1Lower, raw.AdirsAdr1Upper),
                        KorryState.FromIndicators(raw.AdirsAdr2Lower, raw.AdirsAdr2Upper),
                        KorryState.FromIndicators(raw.AdirsAdr3Lower, raw.AdirsAdr3Upper)
                    },
                    Selectors = new[]
                    {
                        ClampSelector(raw.AdirsIr1Mode),
                        ClampSelector(raw.AdirsIr2Mode),
                        ClampSelector(raw.AdirsIr3Mode)
                    }
                },
                FlightControls = new FlightControlsState
                {
                    Elac1 = KorryState.FromSwitchAndIndicators(raw.FlightControlsElac1Switch, raw.FlightControlsElac1Lower, raw.FlightControlsElac1Upper),
                    Sec1 = KorryState.FromSwitchAndIndicators(raw.FlightControlsSec1Switch, raw.FlightControlsSec1Lower, raw.FlightControlsSec1Upper),
                    Fac1 = KorryState.FromSwitchAndIndicators(raw.FlightControlsFac1Switch, raw.FlightControlsFac1Lower, raw.FlightControlsFac1Upper)
                }
            };
        }

        private static int ClampSelector(double value)
        {
            return Math.Clamp((int)Math.Round(value), 0, 2);
        }
    }

    internal sealed class FlightControlsState
    {
        public KorryState Elac1 { get; set; } = new KorryState();
        public KorryState Sec1 { get; set; } = new KorryState();
        public KorryState Fac1 { get; set; } = new KorryState();
    }

    internal sealed class BridgeState
    {
        public FcuState Fcu { get; set; } = new FcuState();
        public EfisState Efis { get; set; } = new EfisState();
        public EfisState EfisFirstOfficer { get; set; } = new EfisState();
        public OverheadState Overhead { get; set; } = new OverheadState();
        public bool SimulatorConnected { get; set; }
        public bool MobiFlightVerified { get; set; }
    }
}
