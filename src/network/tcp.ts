/* eslint-disable @typescript-eslint/no-explicit-any */
import { connect } from 'cloudflare:sockets'
import { Protocol } from '../constants/protocol'
import type { ITransport } from '../core/transport'
import type { Header } from '../protocols/index'

async function retry(
  version: number,
  rawData: ArrayBuffer,
  transport: ITransport,
  proxyIPs: string[],
): Promise<Socket | undefined> {
  for (const proxyIP of proxyIPs) {
    try {
      const socket = await dial(proxyIP, version, rawData, transport)
      return socket
    } catch (err) {
      console.error(err)
      continue
    }
  }
}

async function dial(
  remote: SocketAddress | string,
  version: number,
  rawData: ArrayBuffer,
  transport: ITransport,
): Promise<Socket> {
  const socket = connect(remote)
  const writer = socket.writable.getWriter()
  await writer.write(rawData)

  transport.onMessage(async (data) => {
    await writer.write(data)
  })
  transport.onClose(async () => {
    await socket.close()
  })
  transport.onError(async () => {
    await socket.close()
  })

  const reader = socket.readable.getReader()
  const { done, value } = await reader.read()
  if (done) {
    throw new Error('connection was done')
  }
  reader.releaseLock()

  transport.send(
    await new Blob([Protocol.RESPONSE_DATA(version), value]).arrayBuffer(),
  )

  return socket
}

export async function processTCP(
  transport: ITransport,
  header: Header,
  proxyIPs: string[],
) {
  let socket: Socket | undefined

  // Resolve domain names before connecting
  let address = header.address
  if (isNaN(Number(address.split('.')[0]))) {
    try {
      address = await resolveDomain(address)
    } catch (resolveErr) {
      console.error(`Failed to resolve domain ${header.address}:`, resolveErr)
    }
  }

  try {
    socket = await dial(
      { hostname: address, port: header.port },
      header.version,
      header.rawData,
      transport,
    )
  } catch (e) {
    console.log(e)
    socket = await retry(header.version, header.rawData, transport, proxyIPs)
  }

  if (socket === undefined) {
    throw new Error(
      `cannot connect to hostname: ${header.address}, port: ${header.port}`,
    )
  }

  await socket.readable.pipeTo(
    new WritableStream({
      write(chunk) {
        transport.send(chunk)
      },
      abort() {
        transport.close()
      },
      close() {
        transport.close()
      },
    }),
  )
}

async function resolveDomain(domain: string): Promise<string> {
  try {
    const response = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${domain}&type=A`,
      { headers: { Accept: 'application/dns-json' } },
    )
    if (response.ok) {
      const data: any = await response.json()
      if (data.Answer?.length > 0) {
        const aRecord = data.Answer.find((r: any) => r.type === 1)
        if (aRecord) return aRecord.data
      }
    }
  } catch (err) {
    console.error('DNS resolution error:', err)
  }
  return domain
}
