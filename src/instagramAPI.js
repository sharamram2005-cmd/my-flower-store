import axios from 'axios';

export async function sendMessage(recipientId, messageText) {
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
    await axios.post(
        'https://graph.facebook.com/v18.0/me/messages',
            { recipient: { id: recipientId }, message: { text: messageText }, messaging_type: 'RESPONSE' },
                { params: { access_token: accessToken } }
                  );
                  }
