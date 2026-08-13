# RFID Reader Gateway

## Architecture
The Reader Gateway is an on-premise service running near physical readers. It handles the low-level hardware communication, buffers offline events, and provides a secure mTLS tunnel to the central server.

## Installation
- Deployable as a Docker container or systemd service.
- Requires local network access to IP readers or USB access for PC/SC readers.

## Configuration & mTLS
- Gateway requires a signed client certificate from the organizational CA.
- Configuration includes server endpoint, reader adapter bindings, and offline queue limits.

## Reader Pairing Workflow
1. Gateway powered on.
2. Gateway authenticates to server via mTLS.
3. Server provisions reader configuration (keys, modes) to the Gateway.
4. Gateway initializes local readers.

## Offline Operation
- **Encrypted Queue:** Scans are stored in an encrypted local queue when the server is unreachable.
- **Bounded Storage:** Queue has strict limits; older events are prioritized, storage-full policy dictates behavior (e.g., reject new scans or drop oldest).
- **Auto-Sync:** Upon connection restore, queue is drained to the server.

## Health Monitoring
- Heartbeat endpoint (`/health`)
- Exposes Prometheus metrics (queue depth, reader status, error rates).

## Security
- No database credentials reside on the Gateway.
- Local storage is encrypted.
- Events are signed locally to prevent tampering.
