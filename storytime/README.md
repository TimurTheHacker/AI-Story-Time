# Storytime — AI Story Generator

A streaming story generator built with vanilla HTML/CSS/JS and the Anthropic API. Deploy-ready for Vercel.

## Features

- 8 genres with distinct accent colors (Comedy, Mystery, Adventure, Horror, Romance, Sci-Fi, Fantasy, Thriller)
- 3 length options: Short (~200 words), Medium (~600 words), Long (~2000 words)
- Real-time word-by-word streaming via the Anthropic API
- Copy and Regenerate actions
- Dark theme, responsive layout
- API key stays server-side only (Vercel serverless function)

## Setup & Deploy

### 1. Clone the repo

```bash
git clone <your-repo-url>
cd storytime
```

### 2. Add your Anthropic API key to Vercel

In the [Vercel dashboard](https://vercel.com), go to your project → **Settings → Environment Variables** and add:

```
ANTHROPIC_API_KEY = sk-ant-...
```

### 3. Push to GitHub and connect to Vercel

```bash
git add .
git commit -m "Initial commit"
git push origin main
```

Then in Vercel: **Add New Project → Import Git Repository → select your repo → Deploy**.

Vercel auto-installs dependencies from `package.json` and picks up `api/generate.js` as a serverless function. No additional configuration needed beyond the environment variable above.

## Local Development

```bash
npm install
npx vercel dev
```

Open `http://localhost:3000`. The `vercel dev` command emulates the serverless function locally and reads from a `.env` file:

```bash
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY
```

## Project Structure

```
storytime/
├── index.html          # Main UI
├── style.css           # All styles (dark theme)
├── script.js           # Frontend logic + streaming
├── api/
│   └── generate.js     # Vercel serverless function (Anthropic API proxy)
├── vercel.json         # Vercel config (60s function timeout)
├── package.json        # @anthropic-ai/sdk dependency
├── .env.example        # Environment variable template
└── .gitignore
```
