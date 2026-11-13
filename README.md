# WinWin Hotel AI Assistant

A full-stack starter for turning natural-language hotel requests into a structured search. The FastAPI backend uses OpenAI's `gpt-4o` structured-output support to extract destinations, dates, guests, and must-have/nice-to-have filters. The React interface shows the evolving search state and lets you review/apply the filters.

> **Scope note:** This starter does not connect to a hotel booking or inventory provider. Its count is an illustrative estimate only; it is not live availability, pricing, or a booking.

## Requirements

- Python 3.10+
- Node.js 20.19+ or 22.12+
- An OpenAI API key with access to `gpt-4o`

## Project layout

```text
backend/
  .env.example
  requirements.txt
  filters_catalog.json
  tools.py
  main.py
frontend/
  package.json
  vite.config.js
  index.html
  src/
    main.jsx
    App.jsx
    index.css
```

## Configure the backend

From the project root, create a local environment file from the example:

```powershell
Copy-Item backend\.env.example backend\.env
```

Set `OPENAI_API_KEY` in `backend\.env`. The optional settings are:

| Variable | Default | Description |
| --- | --- | --- |
| `OPENAI_API_KEY` | — | Required API credential |
| `OPENAI_MODEL` | `gpt-4o` | OpenAI model used for structured extraction |
| `FRONTEND_ORIGINS` | `http://localhost:5173` | Comma-separated browser origins allowed by CORS |

Install dependencies and run the API:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

The API health check is at `http://127.0.0.1:8000/api/health`; interactive API documentation is at `http://127.0.0.1:8000/docs`.

## Run the frontend

Open a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open the Vite URL shown in the terminal (normally `http://127.0.0.1:5173`). To point the UI at a different backend, create `frontend\.env.local` and set:

```dotenv
VITE_API_URL=http://127.0.0.1:8000
```

The frontend talks to `POST /api/chat`, which accepts a message, the current structured state, and recent conversation history. It returns an assistant reply, updated structured search, and an explicitly illustrative count estimate.

## Filter catalog and estimation

`backend/filters_catalog.json` defines the canonical filters. `backend/tools.py` provides a token-based semantic lookup helper and a deterministic inventory estimate. The estimate is a demo placeholder and must be replaced with a real, authorized inventory API integration before showing availability to customers.

## Production considerations

- Keep `.env` and all API keys out of source control; use a secret manager in deployment.
- Configure `FRONTEND_ORIGINS` to only include trusted deployed frontend origins.
- Add authentication, rate limiting, request monitoring, and API timeouts appropriate to your deployment.
- Connect the search to a real hotel provider before presenting prices, availability, or reservable results.
- Build the frontend for deployment with `npm run build`; the production assets are emitted to `frontend/dist`.
