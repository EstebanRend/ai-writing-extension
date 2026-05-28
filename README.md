# AI Writing Assistant (Chrome Extension + Node Backend)

Lightweight Chrome extension that adds an **Improve writing** button when text is selected, sends a built prompt to a local backend, and replaces the selected text with the AI rewrite.

Designed for everyday software communication (Slack messages, status updates, help requests, review requests).

## Project Structure


- `extension/` - Chrome extension (Manifest V3)
  - `config.js` - shared IDs, message types, icons
  - `actions.js` - action tree, prompts, and menu helpers
  - `runtime.js` - extension messaging helpers
  - `selection.js` - read/replace selected text, anchor positioning
  - `request.js` - build prompts, run/stop improve requests
  - `tooltip.js` - floating UI (split button, nested menu, loading/stop)
  - `content.js` - document event wiring (entry point)
  - `background.js` - service worker, backend `fetch` + abort
  - `manifest.json` - extension permissions and script wiring
- `backend/` - local API service
  - `server.js` - OpenAI proxy (`POST /api/improve`)
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
PORT=3847
MAX_PROMPT_CHARS=12000
MAX_OUTPUT_TOKENS=140
MAX_OUTPUT_TOKENS_CAP=500
```

Start backend:

```bash
cd backend
npm start
```

Expected log:

```txt
Backend running on http://localhost:3847
```

## 2) Load Extension (Unpacked)

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `extension/` folder
5. After updates, click **Reload** on the extension and refresh target tabs

## 3) Usage

1. Select text in a page (Slack web, docs, web editors)
2. Click **Improve writing** (or open the menu and pick another action)
3. For grouped actions (e.g. **Workplace messages**), hover the row to open the flyout, then pick a sub-option
4. Rewritten text replaces the current selection

## Add a new tooltip option

Prompts and menu structure live in the extension. The backend only runs the prompt you send.

```text
extension/actions.js  →  tooltip menu + prompt build
                      →  POST /api/improve { prompt, maxOutputTokens }
backend/server.js     →  OpenAI call + length limits
```

### 1) Extension (required)

File: **`extension/actions.js`**

**Leaf action** (single menu row):

| Field | Purpose |
|-------|---------|
| `id` | Unique action id |
| `label` | Shown in the menu |
| `template` | Prompt for OpenAI; must include `{{selection}}` |
| `maxOutputTokens` | Output length hint (server clamps to cap) |

**Group** (row with right chevron → flyout):

| Field | Purpose |
|-------|---------|
| `id` | Group id (UI only) |
| `label` | Parent row label |
| `children` | Array of leaf actions |

Set `defaultActionId` in `AIW_ACTIONS` for the main wand button default.

### 2) Apply changes

1. Edit `extension/actions.js`
2. Reload extension at `chrome://extensions`
3. Refresh the browser tab, select text, open the **▲** menu

Backend restart is only needed if you changed `server.js` or `.env`.

## Troubleshooting

- **"Cannot reach backend at http://localhost:3847"**
  - Ensure backend is running
  - Ensure `PORT` matches extension backend URL
- **No button appears after selecting text**
  - Reload extension in `chrome://extensions`
  - Refresh the current page tab
  - Extension does not run on `chrome://*` pages
- **"Extension context invalidated" in console**
  - Reload extension and refresh target tab
- **Output too short**
  - Increase `maxOutputTokens` on the action in `extension/actions.js`
  - Adjust the action template wording
- **"Prompt is too long"**
  - Shorten selection or raise `MAX_PROMPT_CHARS` in `backend/.env`

## Development Notes

- Do not commit `.env` files

| Goal | Where |
|------|--------|
| New tooltip option + AI behavior | `extension/actions.js` |
| Default wand button | `defaultActionId` in `extension/actions.js` |
| Tooltip styling / flyout | `extension/styles.css`, `extension/tooltip.js` |
| Editable vs read-only text | `extension/selection.js` |
| OpenAI model / token caps | `backend/.env`, `backend/server.js` |
