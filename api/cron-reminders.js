import { dueReminders, markReminderSent } from './_lib/store.js';
import { sendMessage } from './_lib/telegram.js';

export default async function handler(req, res) {
  const secret = req.query.secret || req.headers['x-cron-secret'];
  if (secret !== process.env.CRON_SECRET) return res.status(401).end();

  const now = new Date().toISOString();
  const due = await dueReminders(now);
  for (const r of due) {
    const ok = await sendMessage(`Reminder: ${r.text}`);
    if (ok) await markReminderSent(r.id);
  }
  res.status(200).json({ sent: due.length });
}
