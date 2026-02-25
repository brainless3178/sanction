import { DatabaseClient, Webhook, createChildLogger } from '@sss/shared';

const log = createChildLogger({ module: 'webhook-registry' });

// CRUD for webhook subscriptions (URL + event type filter + HMAC secret).
export class WebhookRegistry {
    constructor(private readonly db: DatabaseClient) { }

    async register(url: string, eventTypes: string[], secret: string): Promise<Webhook> {
        log.info({ url, eventTypes }, 'Registering new webhook');
        return this.db.createWebhook(url, eventTypes, secret);
    }

    async getActiveForEvent(eventType: string): Promise<Webhook[]> {
        return this.db.getActiveWebhooksForEvent(eventType);
    }
}
