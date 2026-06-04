import 'dotenv/config';
import { startServer, onMessage } from './server.js';
import { getChatResponse } from './claudeHandler.js';
import { sendMessage } from './instagramAPI.js';

const KEYWORDS = ['היי', 'מה קורה'];

async function handleMessage({ senderId, text }) {
  const lower = text.toLowerCase();
    if (!KEYWORDS.some((k) => lower.includes(k))) return;
      console.log(`[Bot] 🌸 מילת מפתח זוהתה — מעיר את Claude...`);
        try {
            const reply = await getChatResponse(senderId, text);
                await sendMessage(senderId, reply);
                  } catch (e) {
                      console.error('[Bot] שגיאה:', e.message);
                        }
                        }

                        onMessage(handleMessage);
                        await startServer();
                        console.log('[Bot] הבוט רץ ומחכה להודעות...');
