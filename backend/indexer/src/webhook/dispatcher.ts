import * as crypto from 'crypto';
import { DatabaseClient, EventRecord, Webhook, createChildLogger } from '@sss/shared';

const log = createChildLogger({ module: 'webhook-dispatcher' });

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 2000;

// Finds active webhook subscriptions for the event, then POSTs with HMAC signature.
export async function dispatchWebhooks(
    db: DatabaseClient,
    event: EventRecord,
): Promise<void> {
    const webhooks = await db.getActiveWebhooksForEvent(event.event_type);

    if (webhooks.length === 0) {
        log.debug({ eventType: event.event_type }, 'No active webhooks for event type');
        return;
    }

    log.info(
        { eventType: event.event_type, webhookCount: webhooks.length },
        'Dispatching webhooks'
    );

    for (const webhook of webhooks) {
        try {
            const delivery = await db.createWebhookDelivery(webhook.id, event.id);
            await sendWebhook(db, webhook, event, delivery.id);
        } catch (err) {
            log.error({ err, webhookId: webhook.id }, 'Failed to dispatch webhook');
        }
    }
}

// Sends one webhook with retry + exponential backoff.
async function sendWebhook(
    db: DatabaseClient,
    webhook: Webhook,
    event: EventRecord,
    deliveryId: string,
): Promise<void> {
    const payload = JSON.stringify({
        id: event.id,
        event_type: event.event_type,
        mint_address: event.mint_address,
        data: event.payload,
        tx_signature: event.tx_signature,
        slot: event.slot,
        timestamp: event.created_at,
    });

    const signature = crypto
        .createHmac('sha256', webhook.secret)
        .update(payload)
        .digest('hex');

    for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
        try {
            const response = await fetch(webhook.url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-SSS-Signature': signature,
                    'X-SSS-Event': event.event_type,
                },
                body: payload,
                signal: AbortSignal.timeout(10000), // 10s timeout
            });

            if (response.ok) {
                await db.updateWebhookDelivery(deliveryId, 'delivered', response.status);
                log.info(
                    { webhookId: webhook.id, status: response.status, attempt },
                    'Webhook delivered successfully'
                );
                return;
            }

            log.warn(
                { webhookId: webhook.id, status: response.status, attempt },
                'Webhook delivery received non-OK response'
            );
            await db.updateWebhookDelivery(deliveryId, 'pending', response.status);
        } catch (err) {
            log.error(
                { err, webhookId: webhook.id, attempt },
                'Webhook delivery request failed'
            );
        }

        // Wait before retrying
        if (attempt < MAX_RETRY_ATTEMPTS) {
            await sleep(RETRY_DELAY_MS * attempt);
        }
    }

    // All retries exhausted
    await db.updateWebhookDelivery(deliveryId, 'failed');
    log.error(
        { webhookId: webhook.id, deliveryId },
        `Webhook delivery failed after ${MAX_RETRY_ATTEMPTS} attempts`
    );
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
