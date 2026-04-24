# Dashly MCP Server and Client (HW3)

This package implements a Model Context Protocol (MCP) server that exposes the Dashly GenAI Evaluation API to AI applications, and a client that discovers and invokes its capabilities.

---

## What is exposed

### Resource
- `dashly://genai/leaderboard` — Current ELO leaderboard of the four GenAI approaches (concise, detailed, executive, technical). Live data that changes as users submit preferences via Dashly's comparison endpoint.

### Tools
- `generate_ad_insight(prompt, approach=None)` — Generates an ad-performance insight from a single GenAI approach. If `approach` is omitted, the backend picks one at random.
- `compare_ad_insights(prompt)` — Produces two side-by-side insights from two different randomly selected approaches, for pairwise evaluation.

### Prompt (optional per the assignment)
- `campaign_analysis_template(campaign_name, platform, spend, conversions, cpa, roas)` — Structured parameterized prompt that produces a consistent ad-analysis question. Designed to be chained with `generate_ad_insight` or `compare_ad_insights`.

---

## Architecture

```
 ┌────────────────────┐   stdio   ┌────────────────────┐   HTTP   ┌────────────────────┐
 │   client.py        │ ────────▶ │   server.py        │ ───────▶ │  Dashly Express API │
 │   (mcp SDK)        │           │   (FastMCP)        │          │  /api/genai-eval/* │
 └────────────────────┘           └────────────────────┘          └────────────────────┘
```

- `client.py` spawns `server.py` as a subprocess and talks to it over stdio.
- `server.py` uses FastMCP decorators to expose the resource, tools, and prompt.
- Both handlers call `dashly_client.py`, a thin httpx wrapper that authenticates once with the Dashly API and caches the JWT.

The MCP server does not touch the database directly. Every capability is backed by an authenticated call to the existing Dashly REST API.

---

## Prerequisites

1. Python 3.10 or newer.
2. The Dashly API running locally (or any reachable URL). To run it locally:
   ```bash
   cd ..            # back to the repo root
   npm install
   npm start
   ```
   The API listens on `http://localhost:3000` by default.
3. A Dashly user account. For local development the seeded admin account works: `admin@adsdata.com` / `admin123`.

---

## Setup

```bash
cd mcp
python3 -m venv venv
source venv/bin/activate       # or `venv\Scripts\activate` on Windows
pip install -r requirements.txt
cp .env.example .env
```

Open `.env` and verify `DASHLY_BASE_URL`, `DASHLY_EMAIL`, and `DASHLY_PASSWORD` match your environment.

---

## Running the client

The client automatically spawns the server as a subprocess. You do not start the server separately.

```bash
source venv/bin/activate       # if not already active
python client.py
```

### Expected output

The client prints four sections:

1. **RESOURCES** — Lists the `dashly://genai/leaderboard` resource with name, description, and MIME type.
2. **TOOLS** — Lists `generate_ad_insight` and `compare_ad_insights` with their JSON schema parameters.
3. **PROMPTS** — Lists `campaign_analysis_template` with its arguments.
4. **DEMO** — Invokes `generate_ad_insight` with a sample Meta Ads prompt. Prints the arguments sent to the server and the response returned (approach used, model, response text, token count, duration). Then reads the leaderboard resource.

### Example trimmed output

```
======================================================================
  RESOURCES
======================================================================
- URI:         dashly://genai/leaderboard
  Name:        leaderboard
  Description: Current ELO leaderboard of the four GenAI approaches.
  MIME type:   text/plain

======================================================================
  TOOLS
======================================================================
- Name:        generate_ad_insight
  Description: Generate an ad-performance insight from one GenAI approach.
  Parameters:  {
    "properties": {
      "prompt":   {"title": "Prompt",   "type": "string"},
      "approach": {"default": null, "title": "Approach", "type": ["string","null"]}
    },
    "required": ["prompt"],
    "type": "object"
  }

- Name:        compare_ad_insights
  ...

======================================================================
  DEMO: invoke tool 'generate_ad_insight'
======================================================================
Arguments sent:
{
  "prompt": "Analyze our Meta Ads campaign performance: $5,000 monthly spend, ...",
  "approach": "concise"
}

Response returned:
{
  "approach": "concise",
  "model": "claude-haiku-4-5-20251001",
  "response": "- CPA of $20 is solid for a 3.2x ROAS ...",
  "tokensUsed": 512,
  "durationMs": 1180
}
```

---

## Testing invocation from the command line

You can also sanity-check the underlying Dashly endpoints with curl to confirm the MCP server is only a thin translation layer:

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@adsdata.com","password":"admin123"}' | jq -r .token)

curl -s http://localhost:3000/api/genai-eval/leaderboard \
  -H "Authorization: Bearer $TOKEN" | jq
```

If this works, the MCP server will also work.

---

## File reference

| File | Purpose |
|---|---|
| `server.py` | FastMCP server. Four decorated handlers: 1 resource, 2 tools, 1 prompt. Runs with stdio transport. |
| `client.py` | Spawns the server over stdio, lists every capability with its schema, and invokes `generate_ad_insight` end-to-end. |
| `dashly_client.py` | Minimal httpx wrapper around the Dashly REST API. Handles login, JWT caching, and one-retry on 401. |
| `requirements.txt` | Python dependencies (`mcp`, `httpx`, `python-dotenv`). |
| `.env.example` | Template env file (base URL plus Dashly credentials). |
| `Instructions-HW3.md` | This document. |

---

## Troubleshooting

**"Login failed (401)"** — The seeded admin password is `admin123`. If you changed it or the seed did not run, create a user via `POST /api/auth/register` or `node src/database/seed.js`.

**"Connection refused" on http://localhost:3000** — The Dashly API is not running. Start it with `npm start` in the repo root.

**"PROMPT_INJECTION_DETECTED" 400 response** — Milestone 7's prompt guard is doing its job. The demo prompt is a legitimate analytics query and should not trigger the guard. If your custom prompt contains phrases like "ignore all previous instructions", the guard will block it. See `Milestones.md` Milestone 7 section for details.

**"Resource read failed"** — The server is running but the Dashly API is not reachable. Check the `DASHLY_BASE_URL` in `.env`.

---

## Canvas submission

The zip at `/Desktop/dashly-mcp-hw3.zip` contains only the contents of this `mcp/` directory. External packages are excluded per assignment instructions; the grader runs `pip install -r requirements.txt` to install them.

Build the zip from scratch with:

```bash
cd mcp
zip -r ../../../Desktop/dashly-mcp-hw3.zip . \
  -x "venv/*" "__pycache__/*" ".env" "*.pyc" ".pytest_cache/*" ".gitignore"
```
