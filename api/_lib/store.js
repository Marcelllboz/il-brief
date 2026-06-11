import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv(); // reads UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

async function readList(key) {
  const v = await redis.get(key);
  return Array.isArray(v) ? v : [];
}
async function writeList(key, list) {
  await redis.set(key, list);
}

export async function getTasks() { return readList('tasks'); }
export async function getNotes() { return readList('notes'); }
export async function getReminders() { return readList('reminders'); }

export async function addTask(text, source = 'telegram') {
  const tasks = await readList('tasks');
  const task = { id: newId(), text, done: false, createdAt: new Date().toISOString(), source };
  tasks.push(task);
  await writeList('tasks', tasks);
  return task;
}

export async function addNote(text, source = 'telegram') {
  const notes = await readList('notes');
  const note = { id: newId(), text, createdAt: new Date().toISOString(), source };
  notes.push(note);
  await writeList('notes', notes);
  return note;
}

export async function completeTaskByText(match) {
  const tasks = await readList('tasks');
  const m = match.toLowerCase();
  const t = tasks.find((x) => !x.done && x.text.toLowerCase().includes(m));
  if (!t) return null;
  t.done = true;
  await writeList('tasks', tasks);
  return t;
}

export async function addReminder(text, dueAt, source = 'telegram') {
  const reminders = await readList('reminders');
  const r = { id: newId(), text, dueAt, sent: false, createdAt: new Date().toISOString(), source };
  reminders.push(r);
  await writeList('reminders', reminders);
  return r;
}

export async function dueReminders(nowISO) {
  const reminders = await readList('reminders');
  return reminders.filter((r) => !r.sent && r.dueAt <= nowISO);
}

export async function markReminderSent(id) {
  const reminders = await readList('reminders');
  const r = reminders.find((x) => x.id === id);
  if (r) { r.sent = true; await writeList('reminders', reminders); }
}
