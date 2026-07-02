import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN,
});

// Temporary one-off admin reset, guarded by CRON_SECRET. Removed after use.
export default async function handler(req, res) {
  if ((req.query.secret || '') !== process.env.CRON_SECRET) return res.status(401).end();
  await redis.set('tasks', []);
  await redis.set('notes', []);
  await redis.set('reminders', []);
  res.status(200).json({ ok: true, cleared: ['tasks', 'notes', 'reminders'] });
}
