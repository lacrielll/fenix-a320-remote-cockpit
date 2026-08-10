using System;
using System.Diagnostics;
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
            var port = 8380;
            var readOnly = Array.Exists(args, argument => argument == "--read-only");
            var probeIndex = Array.IndexOf(args, "--probe-seconds");
            var portIndex = Array.IndexOf(args, "--port");
            var noBrowser = Array.Exists(args, argument => argument == "--no-browser");
            if (probeIndex >= 0 && probeIndex + 1 < args.Length)
            {
                int.TryParse(args[probeIndex + 1], out probeSeconds);
            }
            if (portIndex >= 0 && portIndex + 1 < args.Length &&
                (!int.TryParse(args[portIndex + 1], out port) || port < 1 || port > 65535))
            {
                throw new ArgumentException("--port must be between 1 and 65535.");
            }

            var webRoot = Path.Combine(AppContext.BaseDirectory, "web");
            using (var server = new WebSocketBridgeServer(port, webRoot))
            {
                server.Start();
                if (Directory.Exists(webRoot))
                {
                    var localUrl = "http://localhost:" + port + "/";
                    Console.WriteLine("Remote cockpit: " + localUrl);
                    if (!noBrowser)
                    {
                        try
                        {
                            Process.Start(new ProcessStartInfo(localUrl) { UseShellExecute = true });
                        }
                        catch (Exception exception)
                        {
                            Console.Error.WriteLine("Could not open the browser: " + exception.Message);
                        }
                    }
                }
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
