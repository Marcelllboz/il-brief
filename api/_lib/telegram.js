const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.MARCELLO_CHAT_ID;

export async function sendMessage(text, chatId = CHAT_ID) {
  const r = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  return r.ok;
}

export function isAuthorisedChat(chatId) {
  return String(chatId) === String(CHAT_ID);
}
