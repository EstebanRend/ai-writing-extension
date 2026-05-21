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

## Add a new tooltip option

The dropdown is built automatically from the backend. You add the **prompt + API support** on the server; the **tooltip** picks it up on the next load.

```text
actions.js  →  /api/actions (menu labels)  →  tooltip dropdown
            →  /api/improve (runs prompt)   →  replaces selected text
```

### 1) Backend (required)

File: **`backend/config/actions.js`**

Add one object to `ACTIONS`:

| Field | Purpose |
|-------|---------|
| `id` | Sent to the API when user picks this option (e.g. `meeting-notes`) |
| `label` | Shown in the tooltip menu |
| `template` | Prompt for OpenAI; must include `{{selection}}` |
| `maxOutputTokens` | Optional output length cap |

Set **`DEFAULT_ACTION_ID`** if this should be the main wand button (not only in the menu).

You do **not** need to change `server.js` — it already exposes actions and runs any `id` from `ACTIONS`.

### 2) Extension / tooltip (usually nothing)

| File | When to edit |
|------|----------------|
| `tooltip.js` | No change — menu is built from the API list |
| `request.js` | No change — sends `actionId` + selected text |
| `extension/config.js` | Optional — add `{ id, label }` to `fallbackActions` if you want the label visible when the backend is offline (no prompt there) |

### 3) Apply changes

1. Restart backend: `cd backend && npm start`
2. Reload extension at `chrome://extensions`
3. Refresh the browser tab, select text, open the **▲** menu — new option should appear

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

- Do not commit `.env` files

| Goal | Where |
|------|--------|
| New tooltip option + AI behavior | `backend/config/actions.js` |
| Default wand button | `DEFAULT_ACTION_ID` in `backend/config/actions.js` |
| Offline menu label only | `fallbackActions` in `extension/config.js` |
| Tooltip styling | `extension/styles.css` |
| Editable vs read-only text | `extension/selection.js` |

