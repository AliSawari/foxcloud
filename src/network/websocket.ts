import { processHeader } from '../protocols/index'
import { processTCP } from './tcp'
import { processDNS } from './dns'
import { WebSocketTransport } from './ws-transport'

import type { Env } from '../core/types'

/**
 * Decodes early data from base64url encoding
 */
function decodeEarlyData(earlyData: string): ArrayBuffer {
  earlyData = earlyData.replace(/-/g, '+').replace(/_/g, '/')
  const binaryStr = atob(earlyData)
  const buffer = new ArrayBuffer(binaryStr.length)
  const view = new Uint8Array(buffer)
  for (let i = 0; i < binaryStr.length; i++) {
    view[i] = binaryStr.charCodeAt(i)
  }
  return buffer
}

/**
 * Waits for the first message from the WebSocket (or uses early data if present)
 */
function getHeader(
  ws: WebSocket,
  earlyData: string | null,
): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    if (earlyData) {
      try {
        resolve(decodeEarlyData(earlyData))
        return
      } catch (err) {
        reject(err)
        return
      }
    }

    const handleMsg = async (event: MessageEvent) => {
      ws.removeEventListener('message', handleMsg)
      ws.removeEventListener('error', handleErr)
      if (typeof event.data === 'string') {
        reject('invalid data: string received, expected binary')
        return
      }
      // Cloudflare Workers can deliver messages as Blob — normalize to ArrayBuffer
      if (event.data instanceof ArrayBuffer) {
        resolve(event.data)
      } else if (event.data instanceof Blob) {
        resolve(await event.data.arrayBuffer())
      } else {
        reject('invalid data: unknown type')
      }
    }

    const handleErr = (event: Event) => {
     
      reject((event as ErrorEvent).error ?? 'WebSocket error')
      ws.removeEventListener('message', handleMsg)
      ws.removeEventListener('error', handleErr)
    }

    ws.addEventListener('message', handleMsg)
    ws.addEventListener('error', handleErr)

    setTimeout(() => {
      reject('timeout')
      ws.removeEventListener('message', handleMsg)
      ws.removeEventListener('error', handleErr)
    }, 10000)
  })
}

/**
 * Processes incoming WebSocket connections (legacy transport, kept for
 * backwards compatibility with existing deployed configs)
 */
export function processWebSocket(request: Request, env: Env): Response {
  const uuids = env.UUID.split(',').filter((v) => v !== '')
  const proxyIPs = env.PROXY_IP.split(',').filter((v) => v !== '')

  const [client, server] = Object.values(new WebSocketPair())
  if (!server) throw 'WebSocket server not defined'
  if (!client) throw 'WebSocket client not defined'

  server.accept()

  const transport = new WebSocketTransport(server)

  getHeader(server, request.headers.get('Sec-WebSocket-Protocol'))
    .then((v) => processHeader(v, uuids))
    .then(async (header) => {
      if (header.isUDP) {
        if (header.port === 53) {
          await processDNS(transport, header)
        } else {
          throw new Error('UDP transport is unsupported')
        }
      } else {
        await processTCP(transport, header, proxyIPs)
      }
    })
    .catch((err) => {
      console.error('WebSocket session error:', err)
      transport.close()
    })

  return new Response(null, {
    status: 101,
    webSocket: client,
  })
}