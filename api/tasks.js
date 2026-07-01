import { getTasks, getNotes } from './_lib/store.js';

export default async function handler(req, res) {
  res.setHeader('cache-control', 'no-store');
  try {
    const [tasks, notes] = await Promise.all([getTasks(), getNotes()]);
    res.status(200).json({ tasks, notes });
  } catch (e) {
    res.status(500).json({
      error: 'store unavailable',
      detail: String(e && e.message || e),
      env: {
        UPSTASH_REDIS_REST_URL: !!process.env.UPSTASH_REDIS_REST_URL,
        UPSTASH_REDIS_REST_TOKEN: !!process.env.UPSTASH_REDIS_REST_TOKEN,
        KV_REST_API_URL: !!process.env.KV_REST_API_URL,
        KV_REST_API_TOKEN: !!process.env.KV_REST_API_TOKEN,
        REDIS_URL: !!process.env.REDIS_URL,
      },
    });
  }
}
