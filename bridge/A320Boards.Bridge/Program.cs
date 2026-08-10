using System;
using System.IO;
using System.Threading;
using A320Boards.Bridge.Sim;
using A320Boards.Bridge.Transport;

namespace A320Boards.Bridge
{
    internal static class Program
    {
        private static void Main(string[] args)
        {
            Console.SetOut(new StreamWriter(Console.OpenStandardOutput()) { AutoFlush = true });
            Console.SetError(new StreamWriter(Console.OpenStandardError()) { AutoFlush = true });
            Console.OutputEncoding = System.Text.Encoding.UTF8;
            Console.WriteLine("Fenix A320 Remote Cockpit Bridge");
            Console.WriteLine("Waiting for Microsoft Flight Simulator...");

            var probeSeconds = 0;
            var readOnly = Array.Exists(args, argument => argument == "--read-only");
            var probeIndex = Array.IndexOf(args, "--probe-seconds");
            if (probeIndex >= 0 && probeIndex + 1 < args.Length)
            {
                int.TryParse(args[probeIndex + 1], out probeSeconds);
            }

            using (var server = new WebSocketBridgeServer(8380))
            {
                server.Start();
                var reconnect = true;
                while (reconnect)
                {
                    using (var reader = new SimConnectFcuReader(allowWrites: !readOnly))
                    {
                        server.CommandReceived += reader.EnqueueCommand;
                        reader.StateChanged += server.Publish;
                        reader.CommandCompleted += server.SendCommandResult;
                        reconnect = reader.Run(probeSeconds);
                        server.CommandReceived -= reader.EnqueueCommand;
                        reader.StateChanged -= server.Publish;
                        reader.CommandCompleted -= server.SendCommandResult;
                    }

                    if (reconnect)
                    {
                        Console.WriteLine("Reconnecting to MSFS in 2 seconds...");
                        Thread.Sleep(2000);
                    }
                }
            }
        }
    }
}
