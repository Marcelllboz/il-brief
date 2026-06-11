import Anthropic from '@anthropic-ai/sdk';
import { ruleParse } from './rules.js';

const client = new Anthropic(); // reads ANTHROPIC_API_KEY

const SYSTEM = `You convert a real estate agent's short text message into ONE structured action for his personal task app.
Actions:
- add_task: a to-do item.
- add_note: a thought/fact to remember (no action needed).
- add_reminder: something he must be reminded of at a specific time. Resolve the time to a future ISO 8601 timestamp in the Australia/Adelaide timezone using the current time provided.
- list: he wants to see today's tasks/reminders.
- complete: mark a task done; put the identifying words in "match".
- unknown: the message doesn't fit any action.
Keep "text" to the core content only — strip filler like "remind me to" or "add".`;

const schema = {
  type: 'object',
  properties: {
    action: { type: 'string', enum: ['add_task', 'add_note', 'add_reminder', 'list', 'complete', 'unknown'] },
    text: { type: 'string' },
    dueAt: { type: 'string' },
    match: { type: 'string' },
  },
  required: ['action', 'text'],
  additionalProperties: false,
};

export async function parseIntent(text) {
  try {
    const now = new Date().toLocaleString('en-AU', { timeZone: 'Australia/Adelaide' });
    const resp = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 150,
      system: SYSTEM,
      output_config: { format: { type: 'json_schema', schema } },
      messages: [{ role: 'user', content: `Current Adelaide time: ${now}\nMessage: ${text}` }],
    });
    const block = resp.content.find((b) => b.type === 'text');
    const parsed = JSON.parse(block.text);
    if (parsed.action === 'unknown') return ruleParse(text); // give the deterministic parser a shot
    return parsed;
  } catch (e) {
    return ruleParse(text); // API error / bad JSON → deterministic fallback, never drop the message
  }
}
