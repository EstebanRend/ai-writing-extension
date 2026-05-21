# AI Writing Assistant (Chrome Extension + Node Backend)

Lightweight Chrome extension that adds an **Improve writing** button when text is selected, sends selected text to a local backend, and replaces the selected text with the AI rewrite.

Designed for everyday software communication (Slack messages, status updates, help requests, review requests).

## Project Structure

- `extension/` - Chrome extension (Manifest V3)
  - `config.js` - shared IDs, message types, fallback actions
  - `runtime.js` - extension messaging helpers
  - `selection.js` - read/replace selected text, anchor positioning
  - `request.js` - load actions, run/stop improve requests
  - `tooltip.js` - floating UI (split button, menu, loading/stop)
  - `content.js` - document event wiring (entry point)
  - `background.js` - service worker, backend `fetch` + abort
  - `manifest.json` - extension permissions and script wiring
- `backend/` - local API service
  - `server.js` - API endpoints and OpenAI call
  - `config/actions.js` - centralized action prompts and per-action token limits
  - `.env` - local secrets/config

## Requirements

- Node.js 18+
- Google Chrome
- OpenAI API key

## 1) Backend Setup

```bash
cd backend
npm install
```

Create `backend/.env` (or copy from `.env.example`):

```env
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4.1-mini
PORT=3000
MAX_SELECTION_CHARS=4000
MAX_OUTPUT_TOKENS=140
```

Start backend:

```bash
cd backend
npm start
```

Expected log:

```txt
Backend running on http://localhost:3000
```

## 2) Load Extension (Unpacked)

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `extension/` folder
5. After updates, click **Reload** on the extension and refresh target tabs

## 3) Usage

1. Select text in a page (Slack web, docs, web editors)
2. Click **Improve writing**
3. Rewritten text replaces the current selection

## Action Configuration (Single Source of Truth)

All prompts are configured in:

- `backend/config/actions.js`

Each action supports:

- `id`
- `label`
- `template` (must include `{{selection}}`)
- `maxOutputTokens` (optional per-action override)

Default action is controlled by:

- `DEFAULT_ACTION_ID` in `backend/config/actions.js`

Current actions:

- `improve-writing`
- `daily-report`
- `ask-help`
- `request-review`

## Troubleshooting

- **"Cannot reach backend at http://localhost:3000"**
  - Ensure backend is running
  - Ensure `PORT` matches extension backend URL
- **No button appears after selecting text**
  - Reload extension in `chrome://extensions`
  - Refresh the current page tab
  - Extension does not run on `chrome://*` pages
- **"Extension context invalidated" in console**
  - Reload extension and refresh target tab
- **Output too short**
  - Increase `maxOutputTokens` for the specific action in `backend/config/actions.js`
  - Adjust action template wording

## Development Notes

- Keep prompts and behavior defaults in backend config, not in content script.
- Do not commit `.env` files.
- If adding new action types, only backend changes are required unless UI needs multi-action selection.

### Extension layout

Content scripts load in order (see `manifest.json`). Each file has one responsibility; shared state lives in small `*State` objects (`requestState`, `tooltipState`, `selectedState`).

| Change you want | Edit |
|-----------------|------|
| New AI action (prompt) | `backend/config/actions.js` |
| New message type | `config.js` + `background.js` (`MESSAGE_TYPE`, keep in sync) |
| Tooltip UI / styles | `tooltip.js`, `styles.css` |
| Selection behavior | `selection.js` |
| Cancel / API flow | `request.js`, `background.js` |
| When tooltip shows/hides | `content.js`, `tooltip.js` (`refreshTooltip`) |

