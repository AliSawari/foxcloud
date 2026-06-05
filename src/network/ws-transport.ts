import type { ITransport } from '../core/transport'

/**
 * Wraps a native WebSocket in the ITransport interface.
 * Drop-in replacement for the raw `ws` references that used to be
 * scattered through tcp.ts and dns.ts.
 */
export class WebSocketTransport implements ITransport {
  private ws: WebSocket

  constructor(ws: WebSocket) {
    this.ws = ws
  }

  send(data: ArrayBuffer | Uint8Array): void {
    this.ws.send(data)
  }

  onMessage(handler: (data: ArrayBuffer) => void | Promise<void>): void {
    this.ws.addEventListener('message', async (event: MessageEvent) => {
      // Cloudflare Workers can deliver messages as Blob — normalize to ArrayBuffer
      if (event.data instanceof ArrayBuffer) {
        handler(event.data)
      } else if (event.data instanceof Blob) {
        handler(await event.data.arrayBuffer())
      }
      // ignore string frames
    })
  }

  onClose(handler: () => void | Promise<void>): void {
    this.ws.addEventListener('close', () => handler())
  }

  onError(handler: (err: unknown) => void | Promise<void>): void {
    this.ws.addEventListener('error', (event: Event) => {
      handler((event as ErrorEvent).error ?? event)
    })
  }

  close(): void {
    try {
      this.ws.close()
    } catch {
      // already closed
    }
  }
}