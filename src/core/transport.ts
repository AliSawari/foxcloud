/**
 * Transport abstraction layer
 *
 * Both WebSocket and XHTTP sessions implement this interface so that
 * tcp.ts and dns.ts are completely transport-agnostic.
 */
export interface ITransport {
  /** Send binary data to the client (downstream) */
  send(data: ArrayBuffer | Uint8Array): void

  /** Register a handler for data arriving from the client (upstream) */
  onMessage(handler: (data: ArrayBuffer) => void | Promise<void>): void

  /** Register a handler for when the client closes the connection */
  onClose(handler: () => void | Promise<void>): void

  /** Register a handler for transport errors */
  onError(handler: (err: unknown) => void | Promise<void>): void

  /** Close / tear down this transport */
  close(): void
}
