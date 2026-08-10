using System.Runtime.InteropServices;

namespace A320Boards.Bridge.Sim
{
    // Field order must exactly match SimConnectFcuReader.RegisterFcuDefinition().
    [StructLayout(LayoutKind.Sequential, Pack = 1)]
    internal struct FcuRawState
    {
        public double Speed;
        public double Heading;
        public double Altitude;
        public double VerticalSpeed;

        public double Powered;
        public double SpeedDashed;
        public double HeadingDashed;
        public double VerticalSpeedDashed;

        public double SpeedManaged;
        public double HeadingManaged;
        public double AltitudeManaged;

        public double MachModeI;
        public double MachModeB;
        public double TrackFpaModeI;
        public double TrackFpaModeB;

        public double Ap1;
        public double Ap2;
        public double AutoThrust;
        public double Loc;
        public double Exped;
        public double Appr;

        public double AltitudeScale;
        public double MetricAltitudeS;
        public double MetricAltitudeI;
        public double MetricAltitudeB;

        public double SpdMachButtonCounter;
        public double TrackFpaButtonCounter;
        public double Ap1ButtonCounter;
        public double Ap2ButtonCounter;
        public double AutoThrustButtonCounter;
        public double LocButtonCounter;
        public double ExpedButtonCounter;
        public double ApprButtonCounter;

        public double SpeedRotateCounter;
        public double HeadingRotateCounter;
        public double AltitudeRotateCounter;
        public double VerticalSpeedRotateCounter;
        public double SpeedAxialCounter;
        public double HeadingAxialCounter;
        public double AltitudeAxialCounter;
        public double VerticalSpeedAxialCounter;

        public double Efis1BaroMode;
        public double Efis1Qnh;
        public double Efis1BaroHpa;
        public double Efis1BaroInch;
        public double Efis1NdMode;
        public double Efis1NdZoom;
        public double Efis1Nav1;
        public double Efis1Nav2;
        public double Efis1Cstr;
        public double Efis1Wpt;
        public double Efis1Vord;
        public double Efis1Ndb;
        public double Efis1Arpt;
        public double Efis1Fd;
        public double Efis1Ls;
        public double Efis1BaroCounter;

        public double Efis2BaroMode;
        public double Efis2Qnh;
        public double Efis2BaroHpa;
        public double Efis2BaroInch;
        public double Efis2NdMode;
        public double Efis2NdZoom;
        public double Efis2Nav1;
        public double Efis2Nav2;
        public double Efis2Cstr;
        public double Efis2Wpt;
        public double Efis2Vord;
        public double Efis2Ndb;
        public double Efis2Arpt;
        public double Efis2Fd;
        public double Efis2Ls;
        public double Efis2BaroCounter;

        public double CockpitDoorVideoSwitch;
        public double CockpitDoorVideoIndicator;

        public double AdirsIr1Mode;
        public double AdirsIr2Mode;
        public double AdirsIr3Mode;
        public double AdirsIr1Lower;
        public double AdirsIr1Upper;
        public double AdirsIr2Lower;
        public double AdirsIr2Upper;
        public double AdirsIr3Lower;
        public double AdirsIr3Upper;
        public double AdirsAdr1Lower;
        public double AdirsAdr1Upper;
        public double AdirsAdr2Lower;
        public double AdirsAdr2Upper;
        public double AdirsAdr3Lower;
        public double AdirsAdr3Upper;
        public double AdirsOnBat;

        public double FlightControlsElac1Switch;
        public double FlightControlsElac1Lower;
        public double FlightControlsElac1Upper;
        public double FlightControlsSec1Switch;
        public double FlightControlsSec1Lower;
        public double FlightControlsSec1Upper;
        public double FlightControlsFac1Switch;
        public double FlightControlsFac1Lower;
        public double FlightControlsFac1Upper;
    }
}
