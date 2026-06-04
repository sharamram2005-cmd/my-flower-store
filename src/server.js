import express from 'express';
import bodyParser from 'body-parser';

const app = express();
app.use(bodyParser.json());

app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
          return res.status(200).send(challenge);
    }
    return res.sendStatus(403);
});

app.post('/webhook', (req, res) => {
    res.sendStatus(200);
    const body = req.body;
    if (body.object !== 'instagram') return;
    for (const entry of body.entry ?? []) {
          for (const event of entry.messaging ?? []) {
                  const senderId = event.sender?.id;
                  const message = event.message;
                  if (!senderId || !message || message.is_echo) continue;
                  const text = message.text ?? '';
                  if (app.locals.onMessage) app.locals.onMessage({ senderId, text });
          }
    }
});

export function onMessage(handler) { app.locals.onMessage = handler; }

export function startServer() {
    const port = process.env.PORT ?? 3000;
    return new Promise((resolve) => {
          app.listen(port, () => { console.log(`[Server] פורט ${port}`); resolve(); });
    });
}

export default app;
