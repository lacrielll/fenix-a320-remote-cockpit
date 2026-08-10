using System;
using System.Globalization;
using System.Runtime.InteropServices;
using System.Threading;
using A320Boards.Bridge.Protocol;
using Microsoft.FlightSimulator.SimConnect;

namespace A320Boards.Bridge.Sim
{
    internal sealed class SimConnectFcuReader : IDisposable
    {
        private const uint SimConnectUnused = 0xFFFFFFFF;

        private SimConnect? _simConnect;
        private MobiFlightClient? _mobiFlight;
        private FenixCommandExecutor? _commandExecutor;
        private FcuRawState? _lastState;
        private volatile bool _running;
        private bool _cancelRequested;
        private DateTime _connectedAt;
        private DateTime _probeSentAt;
        private bool _probeSent;
        private bool _probeDefinitionRegistered;
        private bool _probeVerified;
        private const int ProbeNonce = 7319;
        private readonly bool _allowWrites;

        public event Action<BridgeState>? StateChanged;
        public event Action<CommandResult>? CommandCompleted;

        public SimConnectFcuReader(bool allowWrites = true)
        {
            _allowWrites = allowWrites;
        }

        private enum DefinitionId
        {
            FcuState = 1,
            BridgeProbe = 2
        }

        private enum RequestId
        {
            FcuState = 1,
            BridgeProbe = 2
        }

        [System.Runtime.InteropServices.StructLayout(System.Runtime.InteropServices.LayoutKind.Sequential, Pack = 1)]
        private struct ProbeState
        {
            public double Value;
        }

        public bool Run(int probeSeconds)
        {
            Connect();
            if (_simConnect == null)
            {
                return probeSeconds == 0;
            }

            _running = true;
            var startedAt = DateTime.UtcNow;
            Console.CancelKeyPress += OnCancelKeyPress;

            while (_running)
            {
                try
                {
                    _simConnect.ReceiveMessage();
                }
                catch (Exception exception) when (IsNoMessageAvailable(exception))
                {
                    // Polling is intentionally non-blocking; an empty queue is normal.
                }
                catch (COMException exception) when (IsSimConnectDisconnected(exception))
                {
                    Console.WriteLine("MSFS closed the SimConnect transport; reconnecting safely.");
                    _running = false;
                }

                TickMobiFlightProbe();
                _commandExecutor?.Tick(_lastState);

                if (probeSeconds > 0 && (DateTime.UtcNow - startedAt).TotalSeconds >= probeSeconds)
                {
                    Console.WriteLine("Probe interval complete.");
                    break;
                }

                Thread.Sleep(10);
            }

            Console.CancelKeyPress -= OnCancelKeyPress;
            return !_cancelRequested && probeSeconds == 0;
        }

        private void Connect()
        {
            try
            {
                _simConnect = new SimConnect(
                    "Fenix A320 Remote Cockpit Bridge",
                    IntPtr.Zero,
                    0,
                    null,
                    0);

                _simConnect.OnRecvOpen += OnOpen;
                _simConnect.OnRecvQuit += OnQuit;
                _simConnect.OnRecvException += OnException;
                _simConnect.OnRecvSimobjectData += OnSimObjectData;
                _simConnect.OnRecvClientData += OnClientData;
            }
            catch (Exception exception)
            {
                Console.Error.WriteLine("Could not connect to MSFS: " + exception.Message);
            }
        }

        public void Dispose()
        {
            _running = false;
            _mobiFlight = null;
            if (_simConnect != null)
            {
                _simConnect.Dispose();
                _simConnect = null;
            }
        }

        public void EnqueueCommand(BridgeCommand command)
        {
            if (!_allowWrites)
            {
                CommandCompleted?.Invoke(new CommandResult
                {
                    ClientId = command.ClientId,
                    CommandId = command.CommandId,
                    Success = false,
                    Message = "Bridge is running in read-only safety mode."
                });
                return;
            }

            if (!IsFcuPoweredAndInitialized())
            {
                CommandCompleted?.Invoke(new CommandResult
                {
                    ClientId = command.ClientId,
                    CommandId = command.CommandId,
                    Success = false,
                    Message = "Fenix FCU is not initialized and powered; command was not sent."
                });
                return;
            }

            var executor = _commandExecutor;
            if (executor == null || !_probeVerified)
            {
                CommandCompleted?.Invoke(new CommandResult
                {
                    ClientId = command.ClientId,
                    CommandId = command.CommandId,
                    Success = false,
                    Message = "Fenix/MobiFlight is not ready."
                });
                return;
            }

            executor.Enqueue(command);
        }

        private void OnCancelKeyPress(object? sender, ConsoleCancelEventArgs eventArgs)
        {
            eventArgs.Cancel = true;
            _cancelRequested = true;
            _running = false;
        }

        private static bool IsNoMessageAvailable(Exception exception)
        {
            // The managed SimConnect wrapper reports an empty dispatch queue as E_FAIL.
            return exception.HResult == unchecked((int)0x80004005);
        }

        private static bool IsSimConnectDisconnected(COMException exception)
        {
            // 0xC000014B is returned by the native SimConnect dispatch when the
            // simulator process disappears. It is a disconnect, not a bridge crash.
            return exception.HResult == unchecked((int)0xC000014B);
        }

        private void OnOpen(SimConnect sender, SIMCONNECT_RECV_OPEN data)
        {
            Console.WriteLine("Connected to MSFS: " + data.szApplicationName);
            RegisterFcuDefinition(sender);

            sender.RegisterDataDefineStruct<FcuRawState>(DefinitionId.FcuState);
            sender.RequestDataOnSimObject(
                RequestId.FcuState,
                DefinitionId.FcuState,
                SimConnect.SIMCONNECT_OBJECT_ID_USER,
                SIMCONNECT_PERIOD.SIM_FRAME,
                SIMCONNECT_DATA_REQUEST_FLAG.CHANGED,
                0,
                2,
                0);

            Console.WriteLine("Subscribed to Fenix FCU LVars.");

            if (!_allowWrites)
            {
                Console.WriteLine("Read-only safety mode: MobiFlight writes and browser commands are disabled.");
            }
        }

        private void InitializeMobiFlightIfReady(SimConnect sender)
        {
            if (!_allowWrites || _mobiFlight != null || !IsFcuPoweredAndInitialized())
            {
                return;
            }

            _mobiFlight = new MobiFlightClient(sender);
            _mobiFlight.Initialize();
            _commandExecutor = new FenixCommandExecutor(_mobiFlight);
            _commandExecutor.CommandCompleted += result => CommandCompleted?.Invoke(result);
            _connectedAt = DateTime.UtcNow;
            Console.WriteLine("Powered Fenix FCU detected; MobiFlight write path enabled.");
        }

        private void TickMobiFlightProbe()
        {
            // Do not execute any calculator write while the Fenix FCU LVars are
            // absent/uninitialized. MSFS may expose them as an all-zero block in
            // the menus or before the aircraft systems have started.
            if (_mobiFlight == null || !IsFcuPoweredAndInitialized())
            {
                return;
            }

            var now = DateTime.UtcNow;
            if (!_probeSent && (now - _connectedAt).TotalMilliseconds >= 500)
            {
                _mobiFlight.ExecuteCalculatorCode(ProbeNonce + " (>L:A320BOARDS_BRIDGE_PROBE)");
                _probeSent = true;
                _probeSentAt = now;
                Console.WriteLine("MobiFlight end-to-end nonce written to isolated probe LVar.");
                return;
            }

            if (_probeSent && !_probeDefinitionRegistered && (now - _probeSentAt).TotalMilliseconds >= 500)
            {
                _simConnect!.AddToDataDefinition(
                    DefinitionId.BridgeProbe,
                    "L:A320BOARDS_BRIDGE_PROBE",
                    "number",
                    SIMCONNECT_DATATYPE.FLOAT64,
                    0.0f,
                    SimConnectUnused);
                _simConnect.RegisterDataDefineStruct<ProbeState>(DefinitionId.BridgeProbe);
                _probeDefinitionRegistered = true;
            }

            if (_probeDefinitionRegistered && !_probeVerified && (now - _probeSentAt).TotalMilliseconds >= 600)
            {
                _simConnect!.RequestDataOnSimObject(
                    RequestId.BridgeProbe,
                    DefinitionId.BridgeProbe,
                    SimConnect.SIMCONNECT_OBJECT_ID_USER,
                    SIMCONNECT_PERIOD.ONCE,
                    SIMCONNECT_DATA_REQUEST_FLAG.DEFAULT,
                    0,
                    0,
                    0);
                _probeSentAt = now;
            }
        }

        private static void RegisterFcuDefinition(SimConnect sender)
        {
            AddLVar(sender, "N_FCU_SPEED");
            AddLVar(sender, "N_FCU_HEADING");
            AddLVar(sender, "N_FCU_ALTITUDE");
            AddLVar(sender, "N_FCU_VS");

            AddLVar(sender, "B_FCU_POWER");
            AddLVar(sender, "B_FCU_SPEED_DASHED");
            AddLVar(sender, "B_FCU_HEADING_DASHED");
            AddLVar(sender, "B_FCU_VERTICALSPEED_DASHED");

            AddLVar(sender, "I_FCU_SPEED_MANAGED");
            AddLVar(sender, "I_FCU_HEADING_MANAGED");
            AddLVar(sender, "I_FCU_ALTITUDE_MANAGED");

            AddLVar(sender, "I_FCU_MACH_MODE");
            AddLVar(sender, "B_FCU_SPEED_MACH");
            AddLVar(sender, "I_FCU_TRACK_FPA_MODE");
            AddLVar(sender, "B_FCU_TRACK_FPA_MODE");

            AddLVar(sender, "I_FCU_AP1");
            AddLVar(sender, "I_FCU_AP2");
            AddLVar(sender, "I_FCU_ATHR");
            AddLVar(sender, "I_FCU_LOC");
            AddLVar(sender, "I_FCU_EXPED");
            AddLVar(sender, "I_FCU_APPR");

            AddLVar(sender, "S_FCU_ALTITUDE_SCALE");
            AddLVar(sender, "S_FCU_METRIC_ALT");
            AddLVar(sender, "I_FCU_METRIC_ALT");
            AddLVar(sender, "B_FCU_METRIC_ALT");

            AddLVar(sender, "S_FCU_SPD_MACH");
            AddLVar(sender, "S_FCU_HDGVS_TRKFPA");
            AddLVar(sender, "S_FCU_AP1");
            AddLVar(sender, "S_FCU_AP2");
            AddLVar(sender, "S_FCU_ATHR");
            AddLVar(sender, "S_FCU_LOC");
            AddLVar(sender, "S_FCU_EXPED");
            AddLVar(sender, "S_FCU_APPR");

            AddLVar(sender, "E_FCU_SPEED");
            AddLVar(sender, "E_FCU_HEADING");
            AddLVar(sender, "E_FCU_ALTITUDE");
            AddLVar(sender, "E_FCU_VS");
            AddLVar(sender, "S_FCU_SPEED");
            AddLVar(sender, "S_FCU_HEADING");
            AddLVar(sender, "S_FCU_ALTITUDE");
            AddLVar(sender, "S_FCU_VERTICAL_SPEED");

            AddLVar(sender, "S_FCU_EFIS1_BARO_MODE");
            AddLVar(sender, "I_FCU_EFIS1_QNH");
            AddLVar(sender, "N_FCU_EFIS1_BARO_HPA");
            AddLVar(sender, "N_FCU_EFIS1_BARO_INCH");
            AddLVar(sender, "S_FCU_EFIS1_ND_MODE");
            AddLVar(sender, "S_FCU_EFIS1_ND_ZOOM");
            AddLVar(sender, "S_FCU_EFIS1_NAV1");
            AddLVar(sender, "S_FCU_EFIS1_NAV2");
            AddLVar(sender, "I_FCU_EFIS1_CSTR");
            AddLVar(sender, "I_FCU_EFIS1_WPT");
            AddLVar(sender, "I_FCU_EFIS1_VORD");
            AddLVar(sender, "I_FCU_EFIS1_NDB");
            AddLVar(sender, "I_FCU_EFIS1_ARPT");
            AddLVar(sender, "I_FCU_EFIS1_FD");
            AddLVar(sender, "I_FCU_EFIS1_LS");
            AddLVar(sender, "E_FCU_EFIS1_BARO");

            AddLVar(sender, "S_FCU_EFIS2_BARO_MODE");
            AddLVar(sender, "I_FCU_EFIS2_QNH");
            AddLVar(sender, "N_FCU_EFIS2_BARO_HPA");
            AddLVar(sender, "N_FCU_EFIS2_BARO_INCH");
            AddLVar(sender, "S_FCU_EFIS2_ND_MODE");
            AddLVar(sender, "S_FCU_EFIS2_ND_ZOOM");
            AddLVar(sender, "S_FCU_EFIS2_NAV1");
            AddLVar(sender, "S_FCU_EFIS2_NAV2");
            AddLVar(sender, "I_FCU_EFIS2_CSTR");
            AddLVar(sender, "I_FCU_EFIS2_WPT");
            AddLVar(sender, "I_FCU_EFIS2_VORD");
            AddLVar(sender, "I_FCU_EFIS2_NDB");
            AddLVar(sender, "I_FCU_EFIS2_ARPT");
            AddLVar(sender, "I_FCU_EFIS2_FD");
            AddLVar(sender, "I_FCU_EFIS2_LS");
            AddLVar(sender, "E_FCU_EFIS2_BARO");

            AddLVar(sender, "S_OH_COCKPIT_DOOR_VIDEO");
            AddLVar(sender, "I_OH_DOOR_VIDEO");

            AddLVar(sender, "S_OH_NAV_IR1_MODE");
            AddLVar(sender, "S_OH_NAV_IR2_MODE");
            AddLVar(sender, "S_OH_NAV_IR3_MODE");
            AddLVar(sender, "I_OH_NAV_IR1_SWITCH_L");
            AddLVar(sender, "I_OH_NAV_IR1_SWITCH_U");
            AddLVar(sender, "I_OH_NAV_IR2_SWITCH_L");
            AddLVar(sender, "I_OH_NAV_IR2_SWITCH_U");
            AddLVar(sender, "I_OH_NAV_IR3_SWITCH_L");
            AddLVar(sender, "I_OH_NAV_IR3_SWITCH_U");
            AddLVar(sender, "I_OH_NAV_ADR1_L");
            AddLVar(sender, "I_OH_NAV_ADR1_U");
            AddLVar(sender, "I_OH_NAV_ADR2_L");
            AddLVar(sender, "I_OH_NAV_ADR2_U");
            AddLVar(sender, "I_OH_NAV_ADR3_L");
            AddLVar(sender, "I_OH_NAV_ADR3_U");
            AddLVar(sender, "I_OH_NAV_ADIRS_ON_BAT");

            AddLVar(sender, "S_OH_FLT_CTL_ELAC_1");
            AddLVar(sender, "I_OH_FLT_CTL_ELAC_1_L");
            AddLVar(sender, "I_OH_FLT_CTL_ELAC_1_U");
            AddLVar(sender, "S_OH_FLT_CTL_SEC_1");
            AddLVar(sender, "I_OH_FLT_CTL_SEC_1_L");
            AddLVar(sender, "I_OH_FLT_CTL_SEC_1_U");
            AddLVar(sender, "S_OH_FLT_CTL_FAC_1");
            AddLVar(sender, "I_OH_FLT_CTL_FAC_1_L");
            AddLVar(sender, "I_OH_FLT_CTL_FAC_1_U");
        }

        private static void AddLVar(SimConnect sender, string name)
        {
            sender.AddToDataDefinition(
                DefinitionId.FcuState,
                "L:" + name,
                "number",
                SIMCONNECT_DATATYPE.FLOAT64,
                0.0f,
                SimConnectUnused);
        }

        private void OnSimObjectData(SimConnect sender, SIMCONNECT_RECV_SIMOBJECT_DATA data)
        {
            if ((RequestId)data.dwRequestID != RequestId.FcuState || data.dwData.Length == 0)
            {
                if ((RequestId)data.dwRequestID == RequestId.BridgeProbe && data.dwData.Length > 0)
                {
                    var probe = (ProbeState)data.dwData[0];
                    if ((int)Math.Round(probe.Value) == ProbeNonce && !_probeVerified)
                    {
                        _probeVerified = true;
                        Console.WriteLine("MobiFlight end-to-end probe verified: calculator write + independent SimConnect readback OK.");
                        PublishState(true);
                    }
                    else if (!_probeVerified)
                    {
                        Console.WriteLine("MobiFlight probe readback mismatch: " + probe.Value);
                    }
                }

                return;
            }

            var state = (FcuRawState)data.dwData[0];
            if (_lastState.HasValue && StatesEqual(_lastState.Value, state))
            {
                return;
            }

            _lastState = state;
            InitializeMobiFlightIfReady(sender);
            PrintState(state);
            PublishState(true);
        }

        private void PublishState(bool simulatorConnected)
        {
            if (!_lastState.HasValue)
            {
                return;
            }

            StateChanged?.Invoke(new BridgeState
            {
                SimulatorConnected = simulatorConnected,
                MobiFlightVerified = simulatorConnected && _probeVerified && IsFcuPoweredAndInitialized(),
                Fcu = FcuState.FromRaw(_lastState.Value),
                Efis = EfisState.FromRaw(_lastState.Value),
                EfisFirstOfficer = EfisState.FromRaw(_lastState.Value, firstOfficer: true),
                Overhead = OverheadState.FromRaw(_lastState.Value)
            });
        }

        private bool IsFcuPoweredAndInitialized()
        {
            return _lastState.HasValue && Math.Abs(_lastState.Value.Powered) >= 0.5;
        }

        private void OnClientData(SimConnect sender, SIMCONNECT_RECV_CLIENT_DATA data)
        {
            _mobiFlight?.ProcessClientData(data);
        }

        private static bool StatesEqual(FcuRawState left, FcuRawState right)
        {
            return left.Speed == right.Speed &&
                   left.Heading == right.Heading &&
                   left.Altitude == right.Altitude &&
                   left.VerticalSpeed == right.VerticalSpeed &&
                   left.Powered == right.Powered &&
                   left.SpeedDashed == right.SpeedDashed &&
                   left.HeadingDashed == right.HeadingDashed &&
                   left.VerticalSpeedDashed == right.VerticalSpeedDashed &&
                   left.SpeedManaged == right.SpeedManaged &&
                   left.HeadingManaged == right.HeadingManaged &&
                   left.AltitudeManaged == right.AltitudeManaged &&
                   left.MachModeI == right.MachModeI &&
                   left.MachModeB == right.MachModeB &&
                   left.TrackFpaModeI == right.TrackFpaModeI &&
                   left.TrackFpaModeB == right.TrackFpaModeB &&
                   left.Ap1 == right.Ap1 &&
                   left.Ap2 == right.Ap2 &&
                   left.AutoThrust == right.AutoThrust &&
                   left.Loc == right.Loc &&
                   left.Exped == right.Exped &&
                   left.Appr == right.Appr &&
                   left.AltitudeScale == right.AltitudeScale &&
                   left.MetricAltitudeS == right.MetricAltitudeS &&
                   left.MetricAltitudeI == right.MetricAltitudeI &&
                   left.MetricAltitudeB == right.MetricAltitudeB &&
                   left.SpdMachButtonCounter == right.SpdMachButtonCounter &&
                   left.TrackFpaButtonCounter == right.TrackFpaButtonCounter &&
                   left.Ap1ButtonCounter == right.Ap1ButtonCounter &&
                   left.Ap2ButtonCounter == right.Ap2ButtonCounter &&
                   left.AutoThrustButtonCounter == right.AutoThrustButtonCounter &&
                   left.LocButtonCounter == right.LocButtonCounter &&
                   left.ExpedButtonCounter == right.ExpedButtonCounter &&
                   left.ApprButtonCounter == right.ApprButtonCounter &&
                   left.SpeedRotateCounter == right.SpeedRotateCounter &&
                   left.HeadingRotateCounter == right.HeadingRotateCounter &&
                   left.AltitudeRotateCounter == right.AltitudeRotateCounter &&
                   left.VerticalSpeedRotateCounter == right.VerticalSpeedRotateCounter &&
                   left.SpeedAxialCounter == right.SpeedAxialCounter &&
                   left.HeadingAxialCounter == right.HeadingAxialCounter &&
                   left.AltitudeAxialCounter == right.AltitudeAxialCounter &&
                   left.VerticalSpeedAxialCounter == right.VerticalSpeedAxialCounter &&
                   left.Efis1BaroMode == right.Efis1BaroMode &&
                   left.Efis1Qnh == right.Efis1Qnh &&
                   left.Efis1BaroHpa == right.Efis1BaroHpa &&
                   left.Efis1BaroInch == right.Efis1BaroInch &&
                   left.Efis1NdMode == right.Efis1NdMode &&
                   left.Efis1NdZoom == right.Efis1NdZoom &&
                   left.Efis1Nav1 == right.Efis1Nav1 &&
                   left.Efis1Nav2 == right.Efis1Nav2 &&
                   left.Efis1Cstr == right.Efis1Cstr &&
                   left.Efis1Wpt == right.Efis1Wpt &&
                   left.Efis1Vord == right.Efis1Vord &&
                   left.Efis1Ndb == right.Efis1Ndb &&
                   left.Efis1Arpt == right.Efis1Arpt &&
                   left.Efis1Fd == right.Efis1Fd &&
                   left.Efis1Ls == right.Efis1Ls &&
                   left.Efis1BaroCounter == right.Efis1BaroCounter &&
                   left.Efis2BaroMode == right.Efis2BaroMode &&
                   left.Efis2Qnh == right.Efis2Qnh &&
                   left.Efis2BaroHpa == right.Efis2BaroHpa &&
                   left.Efis2BaroInch == right.Efis2BaroInch &&
                   left.Efis2NdMode == right.Efis2NdMode &&
                   left.Efis2NdZoom == right.Efis2NdZoom &&
                   left.Efis2Nav1 == right.Efis2Nav1 &&
                   left.Efis2Nav2 == right.Efis2Nav2 &&
                   left.Efis2Cstr == right.Efis2Cstr &&
                   left.Efis2Wpt == right.Efis2Wpt &&
                   left.Efis2Vord == right.Efis2Vord &&
                   left.Efis2Ndb == right.Efis2Ndb &&
                   left.Efis2Arpt == right.Efis2Arpt &&
                   left.Efis2Fd == right.Efis2Fd &&
                   left.Efis2Ls == right.Efis2Ls &&
                   left.Efis2BaroCounter == right.Efis2BaroCounter &&
                   left.CockpitDoorVideoSwitch == right.CockpitDoorVideoSwitch &&
                   left.CockpitDoorVideoIndicator == right.CockpitDoorVideoIndicator &&
                   left.AdirsIr1Mode == right.AdirsIr1Mode &&
                   left.AdirsIr2Mode == right.AdirsIr2Mode &&
                   left.AdirsIr3Mode == right.AdirsIr3Mode &&
                   left.AdirsIr1Lower == right.AdirsIr1Lower &&
                   left.AdirsIr1Upper == right.AdirsIr1Upper &&
                   left.AdirsIr2Lower == right.AdirsIr2Lower &&
                   left.AdirsIr2Upper == right.AdirsIr2Upper &&
                   left.AdirsIr3Lower == right.AdirsIr3Lower &&
                   left.AdirsIr3Upper == right.AdirsIr3Upper &&
                   left.AdirsAdr1Lower == right.AdirsAdr1Lower &&
                   left.AdirsAdr1Upper == right.AdirsAdr1Upper &&
                   left.AdirsAdr2Lower == right.AdirsAdr2Lower &&
                   left.AdirsAdr2Upper == right.AdirsAdr2Upper &&
                   left.AdirsAdr3Lower == right.AdirsAdr3Lower &&
                   left.AdirsAdr3Upper == right.AdirsAdr3Upper &&
                   left.AdirsOnBat == right.AdirsOnBat &&
                   left.FlightControlsElac1Switch == right.FlightControlsElac1Switch &&
                   left.FlightControlsElac1Lower == right.FlightControlsElac1Lower &&
                   left.FlightControlsElac1Upper == right.FlightControlsElac1Upper &&
                   left.FlightControlsSec1Switch == right.FlightControlsSec1Switch &&
                   left.FlightControlsSec1Lower == right.FlightControlsSec1Lower &&
                   left.FlightControlsSec1Upper == right.FlightControlsSec1Upper &&
                   left.FlightControlsFac1Switch == right.FlightControlsFac1Switch &&
                   left.FlightControlsFac1Lower == right.FlightControlsFac1Lower &&
                   left.FlightControlsFac1Upper == right.FlightControlsFac1Upper;
        }

        private static void PrintState(FcuRawState state)
        {
            Console.WriteLine(
                "FCU " + DateTime.Now.ToString("HH:mm:ss.fff", CultureInfo.InvariantCulture) +
                " | SPD=" + state.Speed.ToString("0.###", CultureInfo.InvariantCulture) +
                " HDG=" + state.Heading.ToString("0.###", CultureInfo.InvariantCulture) +
                " ALT=" + state.Altitude.ToString("0", CultureInfo.InvariantCulture) +
                " VS=" + state.VerticalSpeed.ToString("0.###", CultureInfo.InvariantCulture) +
                " | power=" + state.Powered +
                " dashed=" + state.SpeedDashed + "/" + state.HeadingDashed + "/" + state.VerticalSpeedDashed +
                " managed=" + state.SpeedManaged + "/" + state.HeadingManaged + "/" + state.AltitudeManaged +
                " | mach(I/B)=" + state.MachModeI + "/" + state.MachModeB +
                " trkFpa(I/B)=" + state.TrackFpaModeI + "/" + state.TrackFpaModeB +
                " | AP1=" + state.Ap1 + " AP2=" + state.Ap2 + " ATHR=" + state.AutoThrust +
                " LOC=" + state.Loc + " EXPED=" + state.Exped + " APPR=" + state.Appr +
                " | altScale=" + state.AltitudeScale +
                " metric(S/I/B)=" + state.MetricAltitudeS + "/" + state.MetricAltitudeI + "/" + state.MetricAltitudeB +
                " buttonCounters=" + state.SpdMachButtonCounter + "/" + state.TrackFpaButtonCounter + "/" + state.MetricAltitudeS +
                "/" + state.Ap1ButtonCounter + "/" + state.Ap2ButtonCounter + "/" + state.AutoThrustButtonCounter +
                "/" + state.LocButtonCounter + "/" + state.ExpedButtonCounter + "/" + state.ApprButtonCounter +
                " | rotateCounters=" + state.SpeedRotateCounter + "/" + state.HeadingRotateCounter + "/" + state.AltitudeRotateCounter + "/" + state.VerticalSpeedRotateCounter +
                " axialCounters=" + state.SpeedAxialCounter + "/" + state.HeadingAxialCounter + "/" + state.AltitudeAxialCounter + "/" + state.VerticalSpeedAxialCounter +
                " | EFIS1 baro=" + state.Efis1BaroHpa.ToString("0", CultureInfo.InvariantCulture) + "/" + state.Efis1BaroInch.ToString("0.00", CultureInfo.InvariantCulture) +
                " mode=" + state.Efis1BaroMode + " qnh=" + state.Efis1Qnh + " counter=" + state.Efis1BaroCounter +
                " nd=" + state.Efis1NdMode + "/" + state.Efis1NdZoom + " nav=" + state.Efis1Nav1 + "/" + state.Efis1Nav2 +
                " filters=" + state.Efis1Cstr + "/" + state.Efis1Wpt + "/" + state.Efis1Vord + "/" + state.Efis1Ndb + "/" + state.Efis1Arpt +
                " fd/ls=" + state.Efis1Fd + "/" + state.Efis1Ls);
        }

        private void OnQuit(SimConnect sender, SIMCONNECT_RECV data)
        {
            Console.WriteLine("MSFS closed the SimConnect session.");
            PublishState(false);
            _commandExecutor = null;
            _mobiFlight = null;
            _running = false;
        }

        private static void OnException(SimConnect sender, SIMCONNECT_RECV_EXCEPTION data)
        {
            Console.Error.WriteLine(
                "SimConnect exception: " + ((SIMCONNECT_EXCEPTION)data.dwException) +
                " sendId=" + data.dwSendID +
                " index=" + data.dwIndex);
        }
    }
}
