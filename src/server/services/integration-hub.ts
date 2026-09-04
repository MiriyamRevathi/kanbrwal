import type { Activity, Task, Project } from '../types.js';

export type WebhookEvent = 'task.created' | 'task.moved' | 'project.risk_alert' | 'audit.security';

export type WebhookSubscription = {
  id: string;
  name: string;
  targetUrl: string;
  secretToken: string;
  events: WebhookEvent[];
  active: boolean;
  createdAt: string;
};

export type WebhookDeliveryLog = {
  id: string;
  subscriptionId: string;
  event: WebhookEvent;
  payload: Record<string, unknown>;
  statusCode: number;
  responseBody?: string;
  deliveredAt: string;
};

export class IntegrationHubService {
  private subscriptions: Map<string, WebhookSubscription> = new Map();
  private deliveryLogs: WebhookDeliveryLog[] = [];

  constructor() {
    this.initializeDefaultWebhooks();
  }

  private initializeDefaultWebhooks(): void {
    const defaultSub: WebhookSubscription = {
      id: 'sub_slack_alerts',
      name: 'Slack Enterprise Engineering Alerts',
      targetUrl: 'https://api.enterprise-example.com/webhooks/slack-alerts',
      secretToken: 'sec_token_enterprise_key_99812',
      events: ['task.created', 'task.moved', 'project.risk_alert'],
      active: true,
      createdAt: new Date().toISOString(),
    };

    this.subscriptions.set(defaultSub.id, defaultSub);
  }

  public registerWebhook(name: string, targetUrl: string, events: WebhookEvent[]): WebhookSubscription {
    const sub: WebhookSubscription = {
      id: `sub_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name,
      targetUrl,
      secretToken: `sec_token_${Math.random().toString(36).slice(2, 12)}`,
      events,
      active: true,
      createdAt: new Date().toISOString(),
    };

    this.subscriptions.set(sub.id, sub);
    return sub;
  }

  public dispatchEvent(event: WebhookEvent, payload: Record<string, unknown>): WebhookDeliveryLog[] {
    const logs: WebhookDeliveryLog[] = [];

    for (const sub of this.subscriptions.values()) {
      if (!sub.active || !sub.events.includes(event)) continue;

      const log: WebhookDeliveryLog = {
        id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        subscriptionId: sub.id,
        event,
        payload,
        statusCode: 200,
        responseBody: '{"status":"queued_simulated_success"}',
        deliveredAt: new Date().toISOString(),
      };

      this.deliveryLogs.push(log);
      logs.push(log);
    }

    return logs;
  }

  public getDeliveryLogs(subscriptionId?: string): WebhookDeliveryLog[] {
    if (subscriptionId) {
      return this.deliveryLogs.filter((l) => l.subscriptionId === subscriptionId);
    }
    return this.deliveryLogs;
  }

  public getSubscriptions(): WebhookSubscription[] {
    return Array.from(this.subscriptions.values());
  }
}

export const globalIntegrationHub = new IntegrationHubService();
