/* ── State ── */
let selectedGenre = null;
let selectedLength = null;
let isGenerating = false;
let lastParams = null; // for Regenerate

/* ── DOM ── */
const genreBtns    = document.querySelectorAll('.genre-btn');
const lengthBtns   = document.querySelectorAll('.length-btn');
const promptInput  = document.getElementById('prompt-input');
const charCount    = document.getElementById('char-count');
const generateBtn  = document.getElementById('generate-btn');
const generateLabel = document.getElementById('generate-label');
const storyActions = document.getElementById('story-actions');
const copyBtn      = document.getElementById('copy-btn');
const copyLabel    = document.getElementById('copy-label');
const regenBtn     = document.getElementById('regen-btn');
const validationMsg = document.getElementById('validation-msg');

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

/* ── Character counter ── */
promptInput.addEventListener('input', () => {
  charCount.textContent = promptInput.value.length;
  clearValidation();
});

/* ── Generate ── */
generateBtn.addEventListener('click', () => {
  const prompt = promptInput.value.trim();
  const params = { genre: selectedGenre, length: selectedLength, prompt };
  generate(params);
});

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
async function generate({ genre, length, prompt }) {
  if (isGenerating) return;

  // Validate
  if (!genre) { showValidation('Please select a genre.'); return; }
  if (!length) { showValidation('Please select a story length.'); return; }
  if (!prompt) { showValidation('Please enter a story premise.'); return; }

  clearValidation();
  isGenerating = true;
  lastParams = { genre, length, prompt };

  setGeneratingUI(true);
  showPanel('loading');

  let fullText = '';

  try {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ genre, length, prompt }),
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
  // Auto-scroll to the bottom as text streams in
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
