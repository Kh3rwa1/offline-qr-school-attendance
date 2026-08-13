# RFID Runbook

## Reader Offline Troubleshooting
1. **Check Power & Network:** Ensure the RFID reader is powered on and connected to the local network.
2. **Ping Reader:** Attempt to ping the reader's IP address from the network gateway.
3. **Check Logs:** Review the local gateway logs to see if the reader is attempting to connect but failing authentication.
4. **Restart Reader:** Power cycle the reader. If it remains offline, re-provision the reader using the Reader Management dashboard.

## Queue Backlog Resolution
- **Symptom:** `rfid_offline_queue_depth` is high (>1000).
- **Action:** Check if the site's internet connection is active. The system is designed to queue locally during outages. If the connection is restored but the queue is not draining, force a manual sync from the RfidDashboard. Check PostgreSQL availability.

## Clock Drift Correction
- **Symptom:** `RfidClockDrift` alert fires (drift > 60s).
- **Action:** Readers use NTP to sync time. Check if the reader can reach the NTP server (port 123). Large drift can cause cryptographic tokens to be rejected.

## Replay Attack Investigation
- **Symptom:** `RfidReplayAttempts` alert fires.
- **Action:** This indicates someone is trying to reuse intercepted SECURE mode payloads.
- Identify the reader in the logs.
- This is a serious security event. Confiscate any cloning devices and cross-reference CCTV footage for the exact timestamp.

## Unknown Card Investigation
- **Symptom:** `RfidExcessiveUnknownCards` alert fires.
- **Action:** This can happen if an entire class taps unregistered cards, or during a brute-force UID scanning attempt.
- Check if a new batch of cards was issued but not yet enrolled. Use the Bulk Enrollment tool if needed.

## Mass Card Revocation Procedure
1. Navigate to the Bulk Enrollment page.
2. Prepare a CSV mapping `studentId` -> `REVOKED`.
3. Submit the job. This instantly invalidates the specified cards across all connected readers.
4. Offline readers will sync this revocation list as soon as they reconnect.

## Emergency Key Rotation
If the global `RFID_SECRET_KEY` is compromised:
1. Generate a new high-entropy key.
2. Update the environment variable `RFID_SECRET_KEY` on the server and restart.
3. **WARNING:** This will invalidate ALL currently issued SECURE mode cards. All students will need to be re-enrolled using the CardEnrollmentWizard or BulkEnrollment.

## Database Connection Issues
- **Symptom:** `RfidPostgresUnavailable` alert fires.
- **Action:** Check PostgreSQL process. Scans will be queued locally on the React client or Edge nodes until DB is restored. No data is lost, but centralized reporting is delayed.

## Redis Failure Impact and Recovery
- **Symptom:** `RfidRedisUnavailable` alert fires.
- **Action:** Redis is used for rate limiting and fast token caching. If Redis fails, the system falls back to PostgreSQL for validation, which increases latency. Restart the Redis cluster immediately to restore low latency processing.
