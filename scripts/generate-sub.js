function generateSubscription(uuid, url) {
  return `vless://${uuid}@${url.hostname}:443?encryption=none&security=tls&sni=${url.hostname}&fp=chrome&type=ws&host=${url.hostname}&path=ws&ed=4096#${url.hostname}`
}