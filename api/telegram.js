import { isAuthorisedChat, sendMessage } from './_lib/telegram.js';
import { parseIntent } from './_lib/intent.js';
import { addTask, addNote, completeTaskByText, getTasks, addReminder, getReminders } from './_lib/store.js';

const MAX_LEN = 500;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (req.headers['x-telegram-bot-api-secret-token'] !== process.env.TELEGRAM_SECRET_TOKEN) {
    return res.status(401).end();
  }

  const msg = req.body?.message;
  if (!msg || !msg.text) return res.status(200).json({ ok: true });
  if (!isAuthorisedChat(msg.chat.id)) return res.status(200).json({ ok: true });

  const text = msg.text.slice(0, MAX_LEN);
  try {
    const intent = await parseIntent(text);
    const reply = await runIntent(intent);
    await sendMessage(reply, msg.chat.id);
  } catch (e) {
    await sendMessage("Couldn't process that — try again.", msg.chat.id);
  }
  return res.status(200).json({ ok: true });
}

async function runIntent(intent) {
  switch (intent.action) {
    case 'add_task': {
      const t = await addTask(intent.text);
      return `Added: ${t.text}`;
    }
    case 'add_note': {
      const n = await addNote(intent.text);
      return `Noted: ${n.text}`;
    }
    case 'add_reminder': {
      const r = await addReminder(intent.text, intent.dueAt);
      const when = new Date(r.dueAt).toLocaleString('en-AU', { timeZone: 'Australia/Adelaide', weekday: 'short', hour: 'numeric', minute: '2-digit' });
      return `Reminder set for ${when}: ${r.text}`;
    }
    case 'complete': {
      const t = await completeTaskByText(intent.match);
      return t ? `Done: ${t.text}` : `Couldn't find an open task matching "${intent.match}".`;
    }
    case 'list': {
      const tasks = (await getTasks()).filter((t) => !t.done);
      const reminders = (await getReminders()).filter((r) => !r.sent);
      const taskLines = tasks.length ? 'Today:\n' + tasks.map((t) => `• ${t.text}`).join('\n') : 'No open tasks.';
      const remLines = reminders.length
        ? '\n\nReminders:\n' + reminders.map((r) => `• ${r.text} (${new Date(r.dueAt).toLocaleString('en-AU', { timeZone: 'Australia/Adelaide', hour: 'numeric', minute: '2-digit' })})`).join('\n')
        : '';
      return taskLines + remLines;
    }
    default:
      return "Didn't catch that — try 'add <task>', 'note <thing>', 'done <task>', or 'list'.";
  }
}
