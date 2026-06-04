import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `אתה עוזר אדיב וחם של חנות הפרחים "גן עדן פרחים".
החנות מוכרת פרחים טריים, זרי פרחים, סידורים לכל אירוע ועציצים.
אנחנו מתמחים בזרי חתונה, אירועים עסקיים ומתנות אישיות.
דבר תמיד בעברית, בצורה חברותית ומזמינה.
אם הלקוח רוצה להזמין — הפנה אותו לדבר איתנו ישירות לתיאום.`;

export async function getChatResponse(senderId, userMessage) {
  const response = await client.messages.create({
                                                    model: 'claude-sonnet-4-6',
                                                    max_tokens: 1024,
                                                    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [{
      role: 'user',
      content: `היי יש הודעה מלקוח תטפל בזה בבקשה 🌸\n\nהלקוח כתב: "${userMessage}"`,
    }],
  });
  const block = response.content.find((b) => b.type === 'text');
  if (!block) throw new Error('No response');
  return block.text;
}
