import { connect } from 'cloudflare:sockets'
import { Protocol } from '../constants/protocol'
import type { ITransport } from '../core/transport'
import type { Header } from '../protocols/index'

export async function processDNS(transport: ITransport, header: Header) {
  const socket = connect({
    hostname: '1.1.1.1',
    port: 53,
  })

  const writer = socket.writable.getWriter()
  await writer.write(header.rawData)

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
    await new Blob([Protocol.RESPONSE_DATA(header.version), value]).arrayBuffer(),
  )

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
