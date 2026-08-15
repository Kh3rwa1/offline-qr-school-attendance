export interface SystemAlert {
  id: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  title: string;
  description: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export class AlertingService {
  private webhookUrl: string | null;

  constructor(webhookUrl?: string | null) {
    this.webhookUrl = webhookUrl || process.env.ALERT_WEBHOOK_URL || null;
  }

  async dispatchAlert(alert: SystemAlert): Promise<{ sent: boolean; reason?: string }> {
    if (!this.webhookUrl) {
      // In production without webhook, log to standard operational error log
      console.warn(`[AlertingService] [${alert.severity}] ${alert.title}: ${alert.description}`);
      return { sent: false, reason: 'NO_WEBHOOK_CONFIGURED' };
    }

    const payload = {
      app: 'AttendEase OS',
      alertId: alert.id,
      severity: alert.severity,
      title: alert.title,
      summary: alert.description,
      timestamp: alert.timestamp || new Date().toISOString(),
      metadata: alert.metadata || {},
    };

    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'AttendEase-Appliance-Alerting/1.0',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        console.error(`[AlertingService] Webhook rejected alert: HTTP ${response.status}`);
        return { sent: false, reason: `HTTP_${response.status}` };
      }

      return { sent: true };
    } catch (err: any) {
      console.error(`[AlertingService] Failed to deliver alert to webhook: ${err.message}`);
      return { sent: false, reason: err.message };
    }
  }
}

export const alertingService = new AlertingService();
