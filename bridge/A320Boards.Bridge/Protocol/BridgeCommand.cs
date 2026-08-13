namespace A320Boards.Bridge.Protocol
{
    internal sealed class BridgeCommand
    {
        public string ClientId { get; set; } = string.Empty;
        public string CommandId { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty;
        public string Control { get; set; } = string.Empty;
        public string Side { get; set; } = string.Empty;
        public int Direction { get; set; }
        public double Value { get; set; }
        public bool Open { get; set; }
    }

    internal sealed class CommandResult
    {
        public string ClientId { get; set; } = string.Empty;
        public string CommandId { get; set; } = string.Empty;
        public bool Success { get; set; }
        public string Message { get; set; } = string.Empty;
    }
}
