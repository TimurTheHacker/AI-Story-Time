/* ── State ── */
let selectedGenre  = null;
let selectedLength = null;
let selectedMode   = 'prompt';
let isGenerating   = false;
let lastParams     = null;

/* ── DOM ── */
const genreBtns         = document.querySelectorAll('.genre-btn');
const lengthBtns        = document.querySelectorAll('.length-btn');
const modeBtns          = document.querySelectorAll('.mode-btn');
const promptInput       = document.getElementById('prompt-input');
const charCount         = document.getElementById('char-count');
const premisePrompt     = document.getElementById('premise-prompt');
const premiseStructured = document.getElementById('premise-structured');
const generateBtn       = document.getElementById('generate-btn');
const generateLabel     = document.getElementById('generate-label');
const storyActions      = document.getElementById('story-actions');
const copyBtn           = document.getElementById('copy-btn');
const copyLabel         = document.getElementById('copy-label');
const regenBtn          = document.getElementById('regen-btn');
const validationMsg     = document.getElementById('validation-msg');

const stateEmpty   = document.getElementById('state-empty');
const stateLoading = document.getElementById('state-loading');
const stateError   = document.getElementById('state-error');
const errorMsg     = document.getElementById('error-msg');
const storyText    = document.getElementById('story-text');
const storyBody    = document.getElementById('story-body');

/* ── Genre selection ── */
genreBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    genreBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedGenre = btn.dataset.genre;
    clearValidation();
  });
});

/* ── Length selection ── */
lengthBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    lengthBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedLength = btn.dataset.length;
    clearValidation();
  });
});

/* ── Mode toggle ── */
modeBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    modeBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedMode = btn.dataset.mode;
    premisePrompt.hidden     = selectedMode !== 'prompt';
    premiseStructured.hidden = selectedMode !== 'structured';
    clearValidation();
  });
});

/* ── Char counter (prompt) ── */
promptInput.addEventListener('input', () => {
  charCount.textContent = promptInput.value.length;
  clearValidation();
});

/* ── Char counters (structured fields) ── */
[
  ['struct-exposition', 'struct-exposition-count'],
  ['struct-inciting',   'struct-inciting-count'],
  ['struct-rising',     'struct-rising-count'],
  ['struct-climax',     'struct-climax-count'],
  ['struct-falling',    'struct-falling-count'],
].forEach(([id, countId]) => {
  document.getElementById(id).addEventListener('input', function () {
    document.getElementById(countId).textContent = this.value.length;
    clearValidation();
  });
});

/* ── Char counter (character descriptions) ── */
const charDescTextarea = document.getElementById('char-descriptions');
const charDescCountEl  = document.getElementById('char-desc-count');
charDescTextarea.addEventListener('input', () => {
  charDescCountEl.textContent = charDescTextarea.value.length;
});

/* ── Build params from current form state ── */
function buildParams() {
  return {
    genre:  selectedGenre,
    length: selectedLength,
    mode:   selectedMode,
    prompt: promptInput.value.trim(),
    structure: {
      exposition:       document.getElementById('struct-exposition').value.trim(),
      incitingIncident: document.getElementById('struct-inciting').value.trim(),
      risingAction:     document.getElementById('struct-rising').value.trim(),
      climax:           document.getElementById('struct-climax').value.trim(),
      fallingAction:    document.getElementById('struct-falling').value.trim(),
    },
    characters: {
      protagonist:  document.getElementById('char-protagonist').value.trim(),
      antagonist:   document.getElementById('char-antagonist').value.trim(),
      supporting:   document.getElementById('char-supporting').value.trim(),
      descriptions: document.getElementById('char-descriptions').value.trim(),
    },
  };
}

/* ── Generate ── */
generateBtn.addEventListener('click', () => generate(buildParams()));

/* ── Regenerate ── */
regenBtn.addEventListener('click', () => {
  if (lastParams) generate(lastParams);
});

/* ── Copy ── */
copyBtn.addEventListener('click', async () => {
  const text = storyText.innerText;
  try {
    await navigator.clipboard.writeText(text);
    copyLabel.textContent = 'Copied!';
    setTimeout(() => { copyLabel.textContent = 'Copy'; }, 2000);
  } catch {
    copyLabel.textContent = 'Failed';
    setTimeout(() => { copyLabel.textContent = 'Copy'; }, 2000);
  }
});

/* ── Core generate function ── */
async function generate({ genre, length, mode, prompt, structure, characters }) {
  if (isGenerating) return;

  if (!genre)  { showValidation('Please select a genre.'); return; }
  if (!length) { showValidation('Please select a story length.'); return; }

  if (mode === 'prompt') {
    if (!prompt) { showValidation('Please enter a story premise.'); return; }
  } else {
    const hasAny = Object.values(structure).some(v => v);
    if (!hasAny) { showValidation('Please fill in at least one story structure field.'); return; }
  }

  clearValidation();
  isGenerating = true;
  lastParams = { genre, length, mode, prompt, structure, characters };

  setGeneratingUI(true);
  showPanel('loading');

  let fullText = '';

  try {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ genre, length, mode, prompt, structure, characters }),
    });

    if (!response.ok) {
      let message = 'Failed to generate story. Please try again.';
      try {
        const data = await response.json();
        if (data.error) message = data.error;
      } catch { /* ignore */ }
      throw new Error(message);
    }

    showPanel('story');
    storyText.classList.add('streaming');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      fullText += chunk;
      renderStory(fullText);
    }

  } catch (err) {
    showPanel('error');
    errorMsg.textContent = err.message || 'Something went wrong. Please try again.';
  } finally {
    storyText.classList.remove('streaming');
    isGenerating = false;
    setGeneratingUI(false);
  }
}

/* Converts raw text (with \n\n paragraph breaks) to <p> elements */
function renderStory(text) {
  const paragraphs = text.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
  storyText.innerHTML = paragraphs
    .map(p => `<p>${escapeHtml(p)}</p>`)
    .join('');
  storyBody.scrollTop = storyBody.scrollHeight;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\n/g, '<br>');
}

/* ── UI helpers ── */
function showPanel(state) {
  stateEmpty.hidden   = state !== 'empty';
  stateLoading.hidden = state !== 'loading';
  stateError.hidden   = state !== 'error';
  storyText.hidden    = state !== 'story';
  storyActions.hidden = state !== 'story';
}

function setGeneratingUI(on) {
  generateBtn.disabled = on;
  generateLabel.textContent = on ? 'Generating…' : 'Generate Story';
}

function showValidation(msg) {
  validationMsg.textContent = msg;
  validationMsg.hidden = false;
}

function clearValidation() {
  validationMsg.hidden = true;
  validationMsg.textContent = '';
}

/* ── Initial state ── */
showPanel('empty');
