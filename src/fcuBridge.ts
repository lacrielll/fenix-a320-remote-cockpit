import { useCallback, useEffect, useRef, useState } from 'react'
import type { CockpitCommand, EfisState, FcuState, OverheadState } from './types'

type SnapshotMessage = {
  type: 'snapshot'
  protocolVersion: 1
  revision: number
  status: {
    simulatorConnected: boolean
    mobiFlightVerified: boolean
  }
  state: {
    fcu: FcuState
    efis: EfisState
    efisFirstOfficer: EfisState
    overhead?: OverheadState
  }
}

type CommandResultMessage = {
  type: 'commandResult'
  commandId: string
  success: boolean
  message: string
}

type BridgeMessage = SnapshotMessage | CommandResultMessage | {
  type: 'commandAck'
  commandId: string
  accepted: boolean
}

const reconnectDelayMs = 1000

function createCommandId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }

  // randomUUID is unavailable in many browsers on a plain-http LAN origin.
  // The bridge only needs a collision-resistant per-client deduplication key.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
}

function bridgeUrl() {
  const configured = import.meta.env.VITE_FCU_BRIDGE_URL as string | undefined
  if (configured) return configured
  if (!import.meta.env.DEV) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${protocol}//${window.location.host}/ws`
  }
  return `ws://${window.location.hostname || '127.0.0.1'}:8380/ws`
}

export function useFcuBridge(initialFcu: FcuState, initialEfis: EfisState, initialOverhead: OverheadState) {
  const [fcu, setFcu] = useState(initialFcu)
  const [efis, setEfis] = useState(initialEfis)
  const [efisFirstOfficer, setEfisFirstOfficer] = useState(initialEfis)
  const [overhead, setOverhead] = useState(initialOverhead)
  const [connected, setConnected] = useState(false)
  const [ready, setReady] = useState(false)
  const [lastCommand, setLastCommand] = useState('Waiting for Fenix bridge')
  const socketRef = useRef<WebSocket | null>(null)
  const revisionRef = useRef(-1)
  const reconnectTimerRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    let disposed = false

    const connect = () => {
      if (disposed) return
      const socket = new WebSocket(bridgeUrl())
      socketRef.current = socket

      socket.onopen = () => {
        revisionRef.current = -1
        setConnected(false)
        setReady(false)
        setLastCommand('BRIDGE CONNECTED · WAITING FOR SIM')
      }

      socket.onmessage = event => {
        const message = JSON.parse(event.data) as BridgeMessage
        if (message.type === 'snapshot') {
          if (message.revision <= revisionRef.current) return
          revisionRef.current = message.revision
          setFcu(message.state.fcu)
          setEfis(message.state.efis)
          setEfisFirstOfficer(message.state.efisFirstOfficer)
          if (message.state.overhead) setOverhead(message.state.overhead)
          setConnected(message.status.simulatorConnected)
          setReady(message.status.simulatorConnected && message.status.mobiFlightVerified)
          return
        }

        if (message.type === 'commandResult') {
          setLastCommand(message.success ? `CONFIRMED · ${message.commandId.slice(0, 8)}` : `REJECTED · ${message.message}`)
        }
      }

      socket.onerror = () => socket.close()
      socket.onclose = () => {
        if (socketRef.current === socket) socketRef.current = null
        setConnected(false)
        setReady(false)
        if (!disposed) reconnectTimerRef.current = window.setTimeout(connect, reconnectDelayMs)
      }
    }

    connect()
    return () => {
      disposed = true
      if (reconnectTimerRef.current !== undefined) window.clearTimeout(reconnectTimerRef.current)
      socketRef.current?.close()
      socketRef.current = null
    }
  }, [])

  const send = useCallback((command: CockpitCommand) => {
    const socket = socketRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setLastCommand('BRIDGE DISCONNECTED')
      return
    }

    const commandId = createCommandId()
    socket.send(JSON.stringify({
      type: 'command',
      protocolVersion: 1,
      commandId,
      command,
    }))
    setLastCommand(`SENT · ${command.type} · ${command.control}`)
  }, [])

  return { fcu, efis, efisFirstOfficer, overhead, connected, ready, lastCommand, send }
}
