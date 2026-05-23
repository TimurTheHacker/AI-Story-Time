const AnthropicModule = require('@anthropic-ai/sdk');
const Anthropic = AnthropicModule.default || AnthropicModule;

module.exports.config = {
  api: { responseLimit: false },
};

const VALID_GENRES = ['Comedy', 'Mystery', 'Adventure', 'Horror', 'Romance', 'Sci-Fi', 'Fantasy', 'Thriller'];
const WORD_COUNTS = { short: 200, medium: 600, long: 2000 };

function buildUserMessage({ mode, prompt, structure, characters, genre, wordCount }) {
  let premisePart;

  if (mode === 'structured') {
    const parts = [];
    if (structure.exposition)       parts.push(`Exposition/Introduction: ${structure.exposition}`);
    if (structure.incitingIncident) parts.push(`Inciting Incident: ${structure.incitingIncident}`);
    if (structure.risingAction)     parts.push(`Rising Action: ${structure.risingAction}`);
    if (structure.climax)           parts.push(`Climax: ${structure.climax}`);
    if (structure.fallingAction)    parts.push(`Falling Action/Ending: ${structure.fallingAction}`);
    premisePart = `Story Structure:\n${parts.join('\n')}`;
  } else {
    premisePart = `Premise: ${prompt}`;
  }

  let characterPart = '';
  if (characters) {
    const parts = [];
    if (characters.protagonist)  parts.push(`Protagonist: ${characters.protagonist}`);
    if (characters.antagonist)   parts.push(`Antagonist: ${characters.antagonist}`);
    if (characters.supporting)   parts.push(`Supporting Characters: ${characters.supporting}`);
    if (characters.descriptions) parts.push(`Character Descriptions: ${characters.descriptions}`);
    if (parts.length > 0) {
      characterPart = `\n\nCharacters:\n${parts.join('\n')}`;
    }
  }

  const wordTarget = wordCount === 2000
    ? 'approximately 2000 words — finish the story naturally even if it runs up to 150 words longer; never stop mid-scene'
    : `approximately ${wordCount} words`;

  return `Write a ${genre} story of ${wordTarget}.\n\n${premisePart}${characterPart}`;
}

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

  const { genre, length, mode = 'prompt', prompt, structure = {}, characters = {} } = body;

  if (!genre || !length) {
    res.status(400).json({ error: 'Missing required fields: genre, length' });
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

  if (mode === 'prompt') {
    if (!prompt) {
      res.status(400).json({ error: 'Missing required field: prompt' });
      return;
    }
  } else {
    const hasAny = Object.values(structure).some(v => v && v.trim());
    if (!hasAny) {
      res.status(400).json({ error: 'At least one story structure field is required' });
      return;
    }
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
        'You are a master storyteller. Write engaging stories in any genre. ' +
        'Always begin your response with a short, compelling title on its own line, ' +
        'then a blank line, then the story. No preamble, no "Here is your story" introduction — ' +
        'just the title, blank line, and immediately the first sentence of the narrative. ' +
        'Write in well-formed paragraphs separated by blank lines. ' +
        'Match your prose style to the genre: for Horror, Thriller, and Fantasy use rich, ' +
        'atmospheric language; for Comedy, Romance, and Adventure write in a natural, ' +
        'conversational tone with plain everyday vocabulary — avoid flowery or overly ' +
        'literary phrasing; for Mystery and Sci-Fi use clear, precise language that keeps ' +
        'the focus on plot and ideas rather than description.',
      messages: [
        {
          role: 'user',
          content: buildUserMessage({ mode, prompt, structure, characters, genre, wordCount }),
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
