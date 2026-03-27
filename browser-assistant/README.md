# Browser Assistant

A Playwright + Claude LLM browser automation assistant for the ads analytics dashboard.

The assistant opens a real browser, takes screenshots, sends them to Claude, and executes whatever actions Claude decides are needed to accomplish your goal.

## Prerequisites

- Node.js 18+
- An Anthropic API key (`ANTHROPIC_API_KEY`)
- The ads analytics dashboard running locally (default `http://localhost:3000`)

## Setup

```bash
cd browser-assistant

# Install dependencies
npm install

# Install the Chromium browser binary for Playwright
npm run install-browsers
```

## Usage

```bash
# Set your API key
export ANTHROPIC_API_KEY=sk-ant-...

# Run with a goal
node assistant.js "navigate to the dashboard and check the metrics"

# Specify a custom URL
node assistant.js --url http://localhost:8080 "find the top campaign by impressions"
```

## How it works

1. Playwright launches a visible Chromium browser and navigates to the target URL.
2. The agent loop begins (max 20 steps):
   - A screenshot is captured and visible page text is extracted.
   - Both are sent to Claude along with the goal and action history.
   - Claude returns a single JSON action: `click`, `type`, `navigate`, `scroll`, `screenshot`, or `done`.
   - The action is executed in the browser.
   - The loop repeats until Claude returns `done` or the step limit is reached.
3. All screenshots are saved to `screenshots/` for review.

## Supported actions

| Action       | Description                                    |
|-------------|------------------------------------------------|
| `click`      | Click an element by CSS selector              |
| `type`       | Type text into an input field                 |
| `navigate`   | Go to a specific URL                          |
| `scroll`     | Scroll up or down by a pixel amount           |
| `screenshot` | No-op observe step (captures state next loop) |
| `done`       | Signal that the goal is complete              |

## Extending

To add new actions:

1. Add the action schema to `buildSystemPrompt()` so Claude knows about it.
2. Add a `case` branch in `executeAction()` to handle it.

Examples of actions you could add:
- `select` -- choose a value from a dropdown
- `hover` -- hover over an element to reveal tooltips
- `wait` -- wait for a specific element to appear
- `extract` -- pull structured data from the page into a file

## Configuration

Edit the constants at the top of `assistant.js`:

| Constant         | Default                  | Description                        |
|-----------------|--------------------------|------------------------------------|
| `DEFAULT_URL`    | `http://localhost:3000`  | Starting URL                       |
| `MAX_STEPS`      | `20`                     | Maximum agent loop iterations      |
| `SCREENSHOT_DIR` | `./screenshots`          | Where screenshots are saved        |
| `MODEL`          | `claude-sonnet-4-20250514` | Claude model to use              |
