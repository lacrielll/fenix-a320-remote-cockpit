using System;
using System.IO;
using System.Linq;
using System.Net.NetworkInformation;
using System.Net.Sockets;
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
            using var instanceMutex = new Mutex(true, "FenixA320RemoteCockpitBridge", out var isFirstInstance);
            if (!isFirstInstance)
            {
                Console.WriteLine("Fenix A320 Remote Cockpit is already running.");
                Console.WriteLine("Open http://localhost:8380/ in a browser.");
                return;
            }

            Console.WriteLine("Fenix A320 Remote Cockpit Bridge");
            Console.WriteLine("Waiting for Microsoft Flight Simulator...");

            var probeSeconds = 0;
            var port = 8380;
            var readOnly = Array.Exists(args, argument => argument == "--read-only");
            var probeIndex = Array.IndexOf(args, "--probe-seconds");
            var portIndex = Array.IndexOf(args, "--port");
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
                    PrintConnectionInformation(port, localUrl);
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

        private static void PrintConnectionInformation(int port, string localUrl)
        {
            Console.WriteLine();
            Console.WriteLine("OPEN ON THIS PC:");
            Console.WriteLine("  " + localUrl);
            Console.WriteLine();
            Console.WriteLine("OPEN ON ANOTHER DEVICE ON THE SAME NETWORK:");

            var addresses = NetworkInterface.GetAllNetworkInterfaces()
                .Where(adapter => adapter.OperationalStatus == OperationalStatus.Up &&
                                  adapter.NetworkInterfaceType != NetworkInterfaceType.Loopback)
                .SelectMany(adapter => adapter.GetIPProperties().UnicastAddresses
                    .Where(address => address.Address.AddressFamily == AddressFamily.InterNetwork &&
                                      !System.Net.IPAddress.IsLoopback(address.Address))
                    .Select(address => new { adapter.Name, Address = address.Address.ToString() }))
                .Distinct()
                .OrderBy(item => item.Name)
                .ThenBy(item => item.Address)
                .ToArray();

            if (addresses.Length == 0)
            {
                Console.WriteLine("  No LAN IPv4 address was found.");
            }
            else
            {
                foreach (var item in addresses)
                {
                    Console.WriteLine("  http://" + item.Address + ":" + port + "/  [" + item.Name + "]");
                }
            }

            Console.WriteLine();
            Console.WriteLine("Keep this window open while using the remote cockpit.");
            Console.WriteLine("The other device must be on the same LAN/VPN. Windows Firewall access is enabled for private networks.");
            Console.WriteLine(new string('-', 78));
        }

    }
}
