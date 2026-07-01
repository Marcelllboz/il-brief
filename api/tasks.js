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
      envKeys: Object.keys(process.env).filter(k =>
        /REDIS|UPSTASH|KV_|TELEGRAM|ANTHROPIC|MARCELLO|CRON/i.test(k)),
    });
  }
}
