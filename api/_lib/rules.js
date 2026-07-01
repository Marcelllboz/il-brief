export function ruleParse(text) {
  const t = text.trim();
  const lower = t.toLowerCase();

  if (lower === 'list' || lower === 'today' || lower.startsWith("what's on") || lower.startsWith('whats on')) {
    return { action: 'list', text: '' };
  }
  const rem = parseReminder(t);
  if (rem) return rem;
  if (lower.startsWith('note ') || lower.startsWith('note:')) {
    return { action: 'add_note', text: t.replace(/^note:?\s*/i, '') };
  }
  if (/^(done|complete|completed)\b/i.test(lower)) {
    return { action: 'complete', text: '', match: t.replace(/^(done:?|completed?|complete)\s*/i, '').trim() };
  }
  if (lower.startsWith('add ')) {
    return { action: 'add_task', text: t.slice(4).trim() };
  }
  return { action: 'add_task', text: t };
}

function parseReminder(t) {
  const m = t.match(/^remind me (?:to )?(.*?)\s+(?:at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?|in\s+(\d+)\s*(m|min|mins|h|hr|hrs|hour|hours))\s*$/i);
  if (!m) return null;
  const what = m[1].trim();
  let dueAt;
  if (m[2]) {
    let hour = parseInt(m[2], 10);
    const min = m[3] ? parseInt(m[3], 10) : 0;
    const ap = (m[4] || '').toLowerCase();
    if (ap === 'pm' && hour < 12) hour += 12;
    if (ap === 'am' && hour === 12) hour = 0;
    dueAt = adelaideTodayAt(hour, min);
  } else {
    const n = parseInt(m[5], 10);
    const unit = m[6].toLowerCase();
    dueAt = new Date(Date.now() + (unit.startsWith('h') ? n * 3600000 : n * 60000)).toISOString();
  }
  return { action: 'add_reminder', text: what, dueAt };
}

function adelaideOffset(d) {
  const tzName = new Intl.DateTimeFormat('en-US', { timeZone: 'Australia/Adelaide', timeZoneName: 'longOffset' })
    .formatToParts(d).find((p) => p.type === 'timeZoneName')?.value || 'GMT+09:30';
  const m = tzName.match(/GMT([+-])(\d{1,2}):?(\d{2})?/);
  if (!m) return '+09:30';
  return `${m[1]}${m[2].padStart(2, '0')}:${m[3] || '00'}`;
}

function adelaideTodayAt(hour, min) {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Australia/Adelaide', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const get = (type) => parts.find((p) => p.type === type).value;
  const dateStr = `${get('year')}-${get('month')}-${get('day')}`;
  const hhmm = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  let due = new Date(`${dateStr}T${hhmm}:00${adelaideOffset(now)}`);
  if (due.getTime() <= Date.now()) due = new Date(due.getTime() + 86400000); // already passed → tomorrow
  return due.toISOString();
}
