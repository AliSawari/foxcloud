# 🦊 FoxCloud — VLESS Proxy on Cloudflare Workers

[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange?logo=cloudflare)](https://workers.cloudflare.com/)
[![License](https://img.shields.io/github/license/code3-dev/foxcloud)](LICENSE)

A lightweight VLESS proxy running on Cloudflare Workers, using WebSocket transport over Cloudflare's global edge network.

---

## Credits

- **Original project:** [FoxCloud](https://github.com/code3-dev/foxcloud) by **Hossein Pira** & **IRCF**
- **This fork:** maintained by **AliSawari** — refactored transport layer, fixed Blob/ArrayBuffer handling for newer Cloudflare Workers runtime

---

## How it works

```
V2ray Client  ──(VLESS over WebSocket/TLS)──►  Cloudflare Worker  ──►  Destination
```

The Worker accepts VLESS connections over WebSocket, parses the protocol header, and proxies TCP traffic (and DNS over UDP) to the target host using Cloudflare's `connect()` socket API.

---

## Quick Start

### Option 1 — Build from source

```bash
git clone <your-fork-url>
cd foxcloud
npm install
npm run build
wrangler deploy
```

### Option 2 — Deploy pre-built

Download `worker.js` from Releases and deploy directly:

```bash
wrangler deploy worker.js --name your-worker-name
```

---

## Environment Variables

Set these in your Cloudflare Worker settings or `wrangler.toml`:

| Variable | Description | Example |
|---|---|---|
| `UUID` | Comma-separated list of allowed UUIDs | `08dad8a6-8a6c-4424-9d63-62f3a9bf7f4f` |
| `PROXY_IP` | Fallback relay IPs if direct connect fails | `172.66.45.9:443,104.18.128.25:443` |

Generate a UUID:
```bash
node -e "console.log(crypto.randomUUID())"
```

**PROXY_IP** is a fallback exit relay — when the Worker can't reach a destination directly, it retries through these IPs. If you have a VPS with clean routing, put its IP here. Otherwise use public Cloudflare IPs.

---

## Getting your config

After deploying, visit:
```
https://your-worker.workers.dev/<your-uuid>
```

This returns a base64-encoded subscription. Import it as a **Subscription URL** in your V2ray client — don't paste the raw output.

---

## Client Setup (V2rayN / V2rayNG)

| Field | Value |
|---|---|
| Protocol | VLESS |
| Address | Your worker domain (or a clean CF IP — see below) |
| Port | `443` |
| UUID | Your configured UUID |
| Transport | WebSocket |
| Path | `/` |
| TLS | Enabled |
| SNI | Your worker domain |
| Fingerprint | `chrome` |

**Disable Mux** in your client config — the worker does not support multiplexing.

---

## Bypassing ISP blocks (Iran / restricted networks)

`workers.dev` is blocked on many ISPs. Two approaches:

**1. CF IP scanning (quick)**
Use a tool like [CloudflareScanner](https://github.com/XIU2/CloudflareScanner) to find a low-latency Cloudflare IP that isn't blocked on your ISP. Put that IP in the **Address** field of your config, keep the worker domain in **SNI** and **Host**. Cloudflare routes by Host header, so your worker still receives the traffic.

**2. Custom domain (recommended)**
Attach your own domain to the worker in the Cloudflare dashboard (Workers → your worker → Domains & Routes). A domain on a less-blocked TLD (`.xyz`, `.top`, etc.) is more resilient than `workers.dev` and you can change it anytime.

---

## Local development

```bash
npm run dev
# Worker runs at http://localhost:8787
```

Note: `cloudflare:sockets` (used for outbound TCP) only works fully with `--remote`:
```bash
wrangler dev --remote
```

---

## What's changed in this fork

- Transport layer abstracted to `ITransport` interface — `tcp.ts` and `dns.ts` are no longer coupled to `WebSocket`
- Fixed `Blob` vs `ArrayBuffer` normalization in WebSocket message handling (caused `DataView` constructor errors on newer CF runtime)
- Removed XHTTP/SplitHTTP code — not viable on CF Workers due to stateless isolate constraints and lack of long-lived streaming support

---

## License

MIT — see [LICENSE](LICENSE)