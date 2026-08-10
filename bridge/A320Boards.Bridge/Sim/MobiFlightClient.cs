using System;
using System.Runtime.InteropServices;
using Microsoft.FlightSimulator.SimConnect;

namespace A320Boards.Bridge.Sim
{
    internal sealed class MobiFlightClient
    {
        private const int MaxCommandSize = 1024;
        private const int MaxResponseSize = 1024;

        private readonly SimConnect _simConnect;

        private enum ClientDataAreaId
        {
            Command = 1000,
            Response = 1001
        }

        private enum ClientDataDefinitionId
        {
            Command = 2000,
            Response = 2001
        }

        private enum ClientDataRequestId
        {
            Response = 3000
        }

        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi, Pack = 1)]
        private struct CommandData
        {
            [MarshalAs(UnmanagedType.ByValTStr, SizeConst = MaxCommandSize)]
            public string Command;
        }

        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi, Pack = 1)]
        private struct ResponseData
        {
            [MarshalAs(UnmanagedType.ByValTStr, SizeConst = MaxResponseSize)]
            public string Response;
        }

        public bool HasResponded { get; private set; }

        public MobiFlightClient(SimConnect simConnect)
        {
            _simConnect = simConnect;
        }

        public void Initialize()
        {
            _simConnect.MapClientDataNameToID("MobiFlight.Command", ClientDataAreaId.Command);
            _simConnect.MapClientDataNameToID("MobiFlight.Response", ClientDataAreaId.Response);

            _simConnect.AddToClientDataDefinition(
                ClientDataDefinitionId.Command,
                0,
                MaxCommandSize,
                0,
                0);
            _simConnect.AddToClientDataDefinition(
                ClientDataDefinitionId.Response,
                0,
                MaxResponseSize,
                0,
                0);
            _simConnect.RegisterStruct<SIMCONNECT_RECV_CLIENT_DATA, ResponseData>(
                ClientDataDefinitionId.Response);

            _simConnect.RequestClientData(
                ClientDataAreaId.Response,
                ClientDataRequestId.Response,
                ClientDataDefinitionId.Response,
                SIMCONNECT_CLIENT_DATA_PERIOD.ON_SET,
                SIMCONNECT_CLIENT_DATA_REQUEST_FLAG.CHANGED,
                0,
                0,
                0);

            SendCommand("MF.Ping");
            Console.WriteLine("MobiFlight client-data channel initialized; ping sent.");
        }

        public void ExecuteCalculatorCode(string rpnCode)
        {
            SendCommand("MF.SimVars.Set." + rpnCode);
        }

        public void ProcessClientData(SIMCONNECT_RECV_CLIENT_DATA data)
        {
            if ((ClientDataRequestId)data.dwRequestID != ClientDataRequestId.Response || data.dwData.Length == 0)
            {
                return;
            }

            if (!(data.dwData[0] is ResponseData response))
            {
                return;
            }
            var text = (response.Response ?? string.Empty).TrimEnd('\0').Trim();
            if (text.Length == 0)
            {
                return;
            }

            HasResponded = true;
            Console.WriteLine("MobiFlight response: " + text);
        }

        private void SendCommand(string command)
        {
            var data = new CommandData { Command = command };
            _simConnect.SetClientData(
                ClientDataAreaId.Command,
                ClientDataDefinitionId.Command,
                SIMCONNECT_CLIENT_DATA_SET_FLAG.DEFAULT,
                0,
                data);
        }
    }
}
