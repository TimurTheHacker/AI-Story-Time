const AnthropicModule = require('@anthropic-ai/sdk');
const Anthropic = AnthropicModule.default || AnthropicModule;

module.exports.config = {
  api: { responseLimit: false },
};

const VALID_GENRES = ['Comedy', 'Mystery', 'Adventure', 'Horror', 'Romance', 'Sci-Fi', 'Fantasy', 'Thriller'];
const WORD_COUNTS = { short: 200, medium: 600, long: 2000 };

module.exports.default = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body ?? {};

  const { genre, length, prompt } = body;

  if (!genre || !length || !prompt) {
    res.status(400).json({ error: 'Missing required fields: genre, length, prompt' });
    return;
  }
  if (!VALID_GENRES.includes(genre)) {
    res.status(400).json({ error: 'Invalid genre' });
    return;
  }
  if (!WORD_COUNTS[length]) {
    res.status(400).json({ error: 'Invalid length. Must be short, medium, or long.' });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Server configuration error: API key missing' });
    return;
  }

  const wordCount = WORD_COUNTS[length];
  const client = new Anthropic({ apiKey });

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('X-Accel-Buffering', 'no');

  try {
    const stream = client.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      system:
        'You are a master storyteller. Write vivid, immersive stories in any genre. ' +
        'When given a premise, write the story immediately — no title, no preamble, ' +
        'no "Here is your story" introduction. Begin with the first sentence of the narrative. ' +
        'Write in well-formed paragraphs separated by blank lines.',
      messages: [
        {
          role: 'user',
          content: `Write a ${genre} story of approximately ${wordCount} words.\n\nPremise: ${prompt}`,
        },
      ],
    });

    stream.on('text', (text) => {
      res.write(text);
    });

    await stream.finalMessage();
    res.end();
  } catch (err) {
    console.error('Anthropic API error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate story. Please try again.' });
    } else {
      res.end();
    }
  }
};
