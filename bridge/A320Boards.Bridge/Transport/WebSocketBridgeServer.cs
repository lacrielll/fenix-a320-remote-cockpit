using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Sockets;
using System.Net.WebSockets;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using A320Boards.Bridge.Protocol;

namespace A320Boards.Bridge.Transport
{
    internal sealed class WebSocketBridgeServer : IDisposable
    {
        private const string WebSocketMagic = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
        private readonly TcpListener _listener;
        private readonly CancellationTokenSource _shutdown = new CancellationTokenSource();
        private readonly ConcurrentDictionary<string, ClientConnection> _clients = new ConcurrentDictionary<string, ClientConnection>();
        private readonly JsonSerializerOptions _jsonOptions = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        };

        private Task? _acceptLoop;
        private long _revision;
        private string? _latestSnapshot;

        public event Action<BridgeCommand>? CommandReceived;

        public WebSocketBridgeServer(int port)
        {
            _listener = new TcpListener(IPAddress.Any, port);
        }

        public void Start()
        {
            _listener.Start();
            _acceptLoop = AcceptLoopAsync(_shutdown.Token);
            Console.WriteLine("WebSocket bridge listening on ws://0.0.0.0:8380/ws");
        }

        public void Publish(BridgeState state)
        {
            var envelope = new
            {
                type = "snapshot",
                protocolVersion = 1,
                revision = Interlocked.Increment(ref _revision),
                status = new
                {
                    simulatorConnected = state.SimulatorConnected,
                    mobiFlightVerified = state.MobiFlightVerified
                },
                state = new
                {
                    fcu = state.Fcu,
                    efis = state.Efis,
                    efisFirstOfficer = state.EfisFirstOfficer,
                    overhead = state.Overhead
                }
            };

            var json = JsonSerializer.Serialize(envelope, _jsonOptions);
            _latestSnapshot = json;
            Broadcast(json);
        }

        public void SendCommandResult(CommandResult result)
        {
            var payload = JsonSerializer.Serialize(new
            {
                type = "commandResult",
                protocolVersion = 1,
                commandId = result.CommandId,
                success = result.Success,
                message = result.Message
            }, _jsonOptions);

            if (_clients.TryGetValue(result.ClientId, out var client))
            {
                _ = client.SendTextAsync(payload, _shutdown.Token);
            }
        }

        public void Dispose()
        {
            _shutdown.Cancel();
            _listener.Stop();

            foreach (var client in _clients.Values)
            {
                client.Dispose();
            }

            _clients.Clear();
            _shutdown.Dispose();
        }

        private async Task AcceptLoopAsync(CancellationToken cancellationToken)
        {
            while (!cancellationToken.IsCancellationRequested)
            {
                try
                {
                    var tcpClient = await _listener.AcceptTcpClientAsync(cancellationToken).ConfigureAwait(false);
                    _ = HandleClientAsync(tcpClient, cancellationToken);
                }
                catch (OperationCanceledException)
                {
                    break;
                }
                catch (ObjectDisposedException)
                {
                    break;
                }
                catch (Exception exception)
                {
                    Console.Error.WriteLine("WebSocket accept error: " + exception.Message);
                }
            }
        }

        private async Task HandleClientAsync(TcpClient tcpClient, CancellationToken cancellationToken)
        {
            using (tcpClient)
            {
                tcpClient.NoDelay = true;
                var stream = tcpClient.GetStream();
                var request = await ReadHttpHeadersAsync(stream, cancellationToken).ConfigureAwait(false);
                if (request == null)
                {
                    return;
                }

                if (!request.Value.Path.Equals("/ws", StringComparison.OrdinalIgnoreCase))
                {
                    await SendHealthResponseAsync(stream, cancellationToken).ConfigureAwait(false);
                    return;
                }

                if (!request.Value.Headers.TryGetValue("sec-websocket-key", out var key))
                {
                    return;
                }

                var accept = Convert.ToBase64String(SHA1.HashData(Encoding.ASCII.GetBytes(key + WebSocketMagic)));
                var response =
                    "HTTP/1.1 101 Switching Protocols\r\n" +
                    "Upgrade: websocket\r\n" +
                    "Connection: Upgrade\r\n" +
                    "Sec-WebSocket-Accept: " + accept + "\r\n\r\n";
                var responseBytes = Encoding.ASCII.GetBytes(response);
                await stream.WriteAsync(responseBytes, cancellationToken).ConfigureAwait(false);

                using (var socket = WebSocket.CreateFromStream(stream, true, null, TimeSpan.FromSeconds(30)))
                {
                    var clientId = Guid.NewGuid().ToString("N");
                    var connection = new ClientConnection(clientId, socket);
                    _clients[clientId] = connection;
                    Console.WriteLine("Browser connected: " + clientId);

                    if (_latestSnapshot != null)
                    {
                        await connection.SendTextAsync(_latestSnapshot, cancellationToken).ConfigureAwait(false);
                    }

                    try
                    {
                        await ReceiveLoopAsync(connection, cancellationToken).ConfigureAwait(false);
                    }
                    finally
                    {
                        _clients.TryRemove(clientId, out _);
                        Console.WriteLine("Browser disconnected: " + clientId);
                    }
                }
            }
        }

        private async Task ReceiveLoopAsync(ClientConnection connection, CancellationToken cancellationToken)
        {
            var buffer = new byte[4096];
            using (var message = new MemoryStream())
            {
                while (connection.Socket.State == WebSocketState.Open && !cancellationToken.IsCancellationRequested)
                {
                    var result = await connection.Socket.ReceiveAsync(buffer, cancellationToken).ConfigureAwait(false);
                    if (result.MessageType == WebSocketMessageType.Close)
                    {
                        await connection.Socket.CloseOutputAsync(WebSocketCloseStatus.NormalClosure, "bye", cancellationToken).ConfigureAwait(false);
                        return;
                    }

                    if (result.MessageType != WebSocketMessageType.Text)
                    {
                        continue;
                    }

                    message.Write(buffer, 0, result.Count);
                    if (!result.EndOfMessage)
                    {
                        continue;
                    }

                    var json = Encoding.UTF8.GetString(message.GetBuffer(), 0, (int)message.Length);
                    message.SetLength(0);
                    ProcessMessage(connection, json);
                }
            }
        }

        private void ProcessMessage(ClientConnection connection, string json)
        {
            try
            {
                using (var document = JsonDocument.Parse(json))
                {
                    var root = document.RootElement;
                    if (!root.TryGetProperty("type", out var envelopeType) || envelopeType.GetString() != "command")
                    {
                        SendProtocolError(connection, string.Empty, "Expected a command envelope.");
                        return;
                    }

                    var commandId = root.TryGetProperty("commandId", out var id) ? id.GetString() ?? string.Empty : string.Empty;
                    if (commandId.Length == 0 || !root.TryGetProperty("command", out var commandElement))
                    {
                        SendProtocolError(connection, commandId, "commandId and command are required.");
                        return;
                    }

                    if (!connection.TryAcceptCommand(commandId))
                    {
                        SendProtocolError(connection, commandId, "Duplicate commandId.");
                        return;
                    }

                    var command = new BridgeCommand
                    {
                        ClientId = connection.Id,
                        CommandId = commandId,
                        Type = commandElement.TryGetProperty("type", out var type) ? type.GetString() ?? string.Empty : string.Empty,
                        Control = commandElement.TryGetProperty("control", out var control) ? control.GetString() ?? string.Empty : string.Empty,
                        Side = commandElement.TryGetProperty("side", out var side) ? side.GetString() ?? string.Empty : string.Empty,
                        Direction = commandElement.TryGetProperty("direction", out var direction) ? direction.GetInt32() : 0,
                        Value = commandElement.TryGetProperty("value", out var value) ? value.GetDouble() : 0
                    };

                    Console.WriteLine(
                        "Browser command " + command.CommandId +
                        " | " + command.Type +
                        " " + command.Control +
                        (command.Direction == 0 ? string.Empty : " direction=" + command.Direction));
                    CommandReceived?.Invoke(command);
                    var accepted = JsonSerializer.Serialize(new
                    {
                        type = "commandAck",
                        protocolVersion = 1,
                        commandId,
                        accepted = true
                    }, _jsonOptions);
                    _ = connection.SendTextAsync(accepted, _shutdown.Token);
                }
            }
            catch (Exception exception)
            {
                SendProtocolError(connection, string.Empty, exception.Message);
            }
        }

        private void SendProtocolError(ClientConnection connection, string commandId, string message)
        {
            var payload = JsonSerializer.Serialize(new
            {
                type = "commandResult",
                protocolVersion = 1,
                commandId,
                success = false,
                message
            }, _jsonOptions);
            _ = connection.SendTextAsync(payload, _shutdown.Token);
        }

        private void Broadcast(string json)
        {
            foreach (var client in _clients.Values)
            {
                _ = client.SendTextAsync(json, _shutdown.Token);
            }
        }

        private static async Task<HttpRequest?> ReadHttpHeadersAsync(NetworkStream stream, CancellationToken cancellationToken)
        {
            var buffer = new byte[16384];
            var length = 0;
            while (length < buffer.Length)
            {
                var count = await stream.ReadAsync(buffer.AsMemory(length, buffer.Length - length), cancellationToken).ConfigureAwait(false);
                if (count == 0)
                {
                    return null;
                }

                length += count;
                var text = Encoding.ASCII.GetString(buffer, 0, length);
                var end = text.IndexOf("\r\n\r\n", StringComparison.Ordinal);
                if (end < 0)
                {
                    continue;
                }

                var lines = text.Substring(0, end).Split(new[] { "\r\n" }, StringSplitOptions.None);
                var requestLine = lines[0].Split(' ');
                if (requestLine.Length < 2)
                {
                    return null;
                }

                var headers = lines.Skip(1)
                    .Select(line => line.Split(new[] { ':' }, 2))
                    .Where(parts => parts.Length == 2)
                    .ToDictionary(parts => parts[0].Trim().ToLowerInvariant(), parts => parts[1].Trim());
                return new HttpRequest(requestLine[1], headers);
            }

            return null;
        }

        private static async Task SendHealthResponseAsync(NetworkStream stream, CancellationToken cancellationToken)
        {
            const string body = "{\"service\":\"a320-boards-bridge\",\"ok\":true}";
            var response =
                "HTTP/1.1 200 OK\r\n" +
                "Content-Type: application/json\r\n" +
                "Access-Control-Allow-Origin: *\r\n" +
                "Content-Length: " + Encoding.UTF8.GetByteCount(body) + "\r\n" +
                "Connection: close\r\n\r\n" + body;
            await stream.WriteAsync(Encoding.UTF8.GetBytes(response), cancellationToken).ConfigureAwait(false);
        }

        private readonly struct HttpRequest
        {
            public HttpRequest(string path, System.Collections.Generic.Dictionary<string, string> headers)
            {
                Path = path;
                Headers = headers;
            }

            public string Path { get; }
            public System.Collections.Generic.Dictionary<string, string> Headers { get; }
        }

        private sealed class ClientConnection : IDisposable
        {
            private readonly SemaphoreSlim _sendLock = new SemaphoreSlim(1, 1);
            private readonly object _commandLock = new object();
            private readonly HashSet<string> _seenCommands = new HashSet<string>(StringComparer.Ordinal);
            private readonly Queue<string> _commandOrder = new Queue<string>();

            public ClientConnection(string id, WebSocket socket)
            {
                Id = id;
                Socket = socket;
            }

            public string Id { get; }
            public WebSocket Socket { get; }

            public bool TryAcceptCommand(string commandId)
            {
                lock (_commandLock)
                {
                    if (!_seenCommands.Add(commandId))
                    {
                        return false;
                    }

                    _commandOrder.Enqueue(commandId);
                    while (_commandOrder.Count > 2048)
                    {
                        _seenCommands.Remove(_commandOrder.Dequeue());
                    }

                    return true;
                }
            }

            public async Task SendTextAsync(string text, CancellationToken cancellationToken)
            {
                if (Socket.State != WebSocketState.Open)
                {
                    return;
                }

                var payload = Encoding.UTF8.GetBytes(text);
                await _sendLock.WaitAsync(cancellationToken).ConfigureAwait(false);
                try
                {
                    if (Socket.State == WebSocketState.Open)
                    {
                        await Socket.SendAsync(payload, WebSocketMessageType.Text, true, cancellationToken).ConfigureAwait(false);
                    }
                }
                catch
                {
                    // Receive loop owns connection teardown.
                }
                finally
                {
                    _sendLock.Release();
                }
            }

            public void Dispose()
            {
                Socket.Dispose();
                _sendLock.Dispose();
            }
        }
    }
}
