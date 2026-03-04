/**
 * Register Webflow webhooks for CMS sync.
 *
 * Usage:
 *   npx tsx scripts/register-webhooks.ts
 *
 * Requires WEBFLOW_SITE_API_TOKEN and WEBFLOW_SITE_ID in .env
 */

import 'dotenv/config';

const SITE_ID = process.env.WEBFLOW_SITE_ID;
const TOKEN = process.env.WEBFLOW_SITE_API_TOKEN;
const WEBHOOK_URL = 'https://thisisagoodplace.com/api/webhooks/cms-sync';

const TRIGGER_TYPES = [
  'collection_item_created',
  'collection_item_changed',
  'collection_item_deleted',
  'collection_item_unpublished',
];

async function listExistingWebhooks() {
  const res = await fetch(`https://api.webflow.com/v2/sites/${SITE_ID}/webhooks`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!res.ok) {
    throw new Error(`Failed to list webhooks: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as { webhooks: Array<{ id: string; triggerType: string; url: string }> };
}

async function createWebhook(triggerType: string) {
  const res = await fetch(`https://api.webflow.com/v2/sites/${SITE_ID}/webhooks`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      triggerType,
      url: WEBHOOK_URL,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to create webhook for ${triggerType}: ${res.status} ${body}`);
  }

  return await res.json();
}

async function main() {
  if (!SITE_ID || !TOKEN) {
    console.error('Missing WEBFLOW_SITE_ID or WEBFLOW_SITE_API_TOKEN in .env');
    process.exit(1);
  }

  console.log('Checking existing webhooks...');
  const { webhooks: existing } = await listExistingWebhooks();

  console.log(`Found ${existing.length} existing webhook(s):`);
  for (const wh of existing) {
    console.log(`  - ${wh.triggerType} → ${wh.url} (${wh.id})`);
  }

  for (const triggerType of TRIGGER_TYPES) {
    const alreadyExists = existing.find(
      (wh) => wh.triggerType === triggerType && wh.url === WEBHOOK_URL
    );

    if (alreadyExists) {
      console.log(`✓ ${triggerType} already registered, skipping`);
      continue;
    }

    console.log(`Creating webhook: ${triggerType} → ${WEBHOOK_URL}`);
    const result = await createWebhook(triggerType);
    console.log(`  Created: ${result.id}`);
  }

  console.log('\nDone! All webhooks registered.');
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
