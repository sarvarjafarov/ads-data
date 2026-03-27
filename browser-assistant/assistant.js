#!/usr/bin/env node

/**
 * Browser Assistant — Playwright + Claude LLM
 *
 * Flow:
 *   1. Launch a Chromium browser via Playwright.
 *   2. Navigate to the target URL (default http://localhost:3000).
 *   3. Enter the agent loop:
 *        a. Capture a screenshot and extract visible text from the page.
 *        b. Send both to Claude, along with the user's goal and action history.
 *        c. Claude responds with a JSON action (click, type, navigate, scroll,
 *           screenshot, done).
 *        d. Execute the action in the browser.
 *        e. Repeat until Claude returns "done" or we hit the max-steps limit.
 *   4. Print a final summary and close the browser.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-... node assistant.js "navigate to the dashboard and check metrics"
 *   node assistant.js --url http://localhost:8080 "find the top campaign by impressions"
 */

const { chromium } = require("playwright");
const Anthropic = require("@anthropic-ai/sdk").default;
const path = require("path");
const fs = require("fs");

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DEFAULT_URL = "http://localhost:3000";
const MAX_STEPS = 20; // safety limit to avoid infinite loops
const SCREENSHOT_DIR = path.join(__dirname, "screenshots");
const MODEL = "claude-sonnet-4-20250514";

// ---------------------------------------------------------------------------
// Argument parsing (intentionally minimal — no extra deps)
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  let url = DEFAULT_URL;
  let goal = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--url" && args[i + 1]) {
      url = args[++i];
    } else if (!args[i].startsWith("--")) {
      goal = args[i];
    }
  }

  if (!goal) {
    console.error(
      "Usage: node assistant.js [--url <url>] <goal>\n" +
        'Example: node assistant.js "navigate to the dashboard and check the metrics"'
    );
    process.exit(1);
  }

  return { url, goal };
}

// ---------------------------------------------------------------------------
// Helper: ensure screenshot directory exists
// ---------------------------------------------------------------------------

function ensureScreenshotDir() {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
}

// ---------------------------------------------------------------------------
// Helper: take a screenshot and return its base64 representation
// ---------------------------------------------------------------------------

async function takeScreenshot(page, stepNumber) {
  ensureScreenshotDir();
  const filePath = path.join(SCREENSHOT_DIR, `step-${stepNumber}.png`);
  await page.screenshot({ path: filePath, fullPage: false });
  const buffer = fs.readFileSync(filePath);
  return { filePath, base64: buffer.toString("base64") };
}

// ---------------------------------------------------------------------------
// Helper: extract visible text from the page (trimmed to a reasonable size)
// ---------------------------------------------------------------------------

async function getPageText(page) {
  const text = await page.evaluate(() => {
    // Grab innerText of <body>, which gives a rough readable version of the
    // page excluding hidden elements, scripts, styles, etc.
    return document.body?.innerText ?? "";
  });
  // Truncate to avoid blowing up the context window.
  const MAX_CHARS = 8000;
  if (text.length > MAX_CHARS) {
    return text.slice(0, MAX_CHARS) + "\n... [truncated]";
  }
  return text;
}

// ---------------------------------------------------------------------------
// Build the prompt that tells Claude what it can do
// ---------------------------------------------------------------------------

function buildSystemPrompt() {
  return `You are a browser automation assistant. You control a web browser to accomplish the user's goal.

You will receive:
- A screenshot of the current page (as an image).
- The visible text content of the page.
- The history of actions you have already taken.

Respond with EXACTLY ONE JSON object (no markdown, no explanation) describing the next action. Supported actions:

1. click — click an element
   {"action": "click", "selector": "<CSS selector>", "description": "<why>"}

2. type — type text into a focused or selected input
   {"action": "type", "selector": "<CSS selector>", "text": "<text to type>", "description": "<why>"}

3. navigate — go to a URL
   {"action": "navigate", "url": "<full URL>", "description": "<why>"}

4. scroll — scroll the page
   {"action": "scroll", "direction": "down" | "up", "amount": <pixels>, "description": "<why>"}

5. screenshot — just observe the current state (no-op, next iteration will capture a fresh screenshot)
   {"action": "screenshot", "description": "<why>"}

6. done — the goal has been accomplished (or is impossible)
   {"action": "done", "summary": "<what was accomplished or why it cannot be done>"}

Rules:
- Always return valid JSON — nothing else.
- Use robust CSS selectors. Prefer selectors with visible text, data attributes, or IDs.
- If a click or type fails, try an alternative selector on the next step.
- If the page hasn't changed after several attempts, consider that the goal may be unreachable and return "done".
- Be concise in descriptions.`;
}

// ---------------------------------------------------------------------------
// Ask Claude for the next action
// ---------------------------------------------------------------------------

async function askLLM(client, goal, pageText, screenshotBase64, history) {
  // Build user message content: text context + screenshot image
  const userContent = [
    {
      type: "text",
      text: [
        `## Goal\n${goal}`,
        `## Action history\n${history.length === 0 ? "(none yet)" : history.map((h, i) => `${i + 1}. ${JSON.stringify(h)}`).join("\n")}`,
        `## Current page text\n${pageText}`,
      ].join("\n\n"),
    },
  ];

  // Attach screenshot if available
  if (screenshotBase64) {
    userContent.push({
      type: "image",
      source: {
        type: "base64",
        media_type: "image/png",
        data: screenshotBase64,
      },
    });
  }

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: buildSystemPrompt(),
    messages: [{ role: "user", content: userContent }],
  });

  // Extract the text block from Claude's response
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock) {
    throw new Error("No text block in Claude response");
  }

  // Parse the JSON action — strip possible markdown fences just in case
  const raw = textBlock.text.replace(/```json\s*/g, "").replace(/```/g, "").trim();
  return JSON.parse(raw);
}

// ---------------------------------------------------------------------------
// Execute a single action in the browser
// ---------------------------------------------------------------------------

async function executeAction(page, action) {
  switch (action.action) {
    case "click":
      console.log(`  -> click: ${action.selector} (${action.description})`);
      await page.click(action.selector, { timeout: 5000 });
      // Short wait for any navigation or rendering triggered by the click.
      await page.waitForTimeout(1000);
      break;

    case "type":
      console.log(`  -> type into ${action.selector}: "${action.text}" (${action.description})`);
      await page.fill(action.selector, action.text);
      await page.waitForTimeout(500);
      break;

    case "navigate":
      console.log(`  -> navigate: ${action.url} (${action.description})`);
      await page.goto(action.url, { waitUntil: "domcontentloaded", timeout: 15000 });
      await page.waitForTimeout(1000);
      break;

    case "scroll": {
      const amount = action.amount || 500;
      const dir = action.direction === "up" ? -amount : amount;
      console.log(`  -> scroll ${action.direction} by ${amount}px (${action.description})`);
      await page.evaluate((y) => window.scrollBy(0, y), dir);
      await page.waitForTimeout(500);
      break;
    }

    case "screenshot":
      console.log(`  -> screenshot (observe only) (${action.description})`);
      // No-op — the next iteration captures a screenshot automatically.
      break;

    case "done":
      console.log(`  -> done: ${action.summary}`);
      break;

    default:
      console.log(`  -> unknown action: ${action.action}, skipping`);
  }
}

// ---------------------------------------------------------------------------
// Main agent loop
// ---------------------------------------------------------------------------

async function run() {
  const { url, goal } = parseArgs();

  // Verify API key is set
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Error: ANTHROPIC_API_KEY environment variable is not set.");
    process.exit(1);
  }

  const client = new Anthropic();

  console.log(`\nBrowser Assistant`);
  console.log(`=================`);
  console.log(`Goal : ${goal}`);
  console.log(`URL  : ${url}`);
  console.log(`Model: ${MODEL}`);
  console.log();

  // Launch browser
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  // Navigate to the starting URL
  console.log(`Navigating to ${url} ...`);
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
  } catch (err) {
    console.error(`Failed to load ${url}: ${err.message}`);
    console.error("Make sure the dev server is running (e.g. npm run dev).");
    await browser.close();
    process.exit(1);
  }
  await page.waitForTimeout(2000); // let JS render

  const history = []; // track actions taken

  // ---- Agent loop ----
  for (let step = 1; step <= MAX_STEPS; step++) {
    console.log(`\n--- Step ${step}/${MAX_STEPS} ---`);

    // 1. Capture current state
    const { base64 } = await takeScreenshot(page, step);
    const pageText = await getPageText(page);

    // 2. Ask Claude for next action
    let action;
    try {
      action = await askLLM(client, goal, pageText, base64, history);
    } catch (err) {
      console.error(`LLM error: ${err.message}`);
      // If parsing failed, give it one more chance with a nudge
      console.log("Retrying with a reminder to return valid JSON...");
      try {
        action = await askLLM(client, goal, pageText, base64, [
          ...history,
          { note: "Previous response was not valid JSON. Please return only a JSON object." },
        ]);
      } catch (retryErr) {
        console.error(`LLM retry failed: ${retryErr.message}. Stopping.`);
        break;
      }
    }

    console.log(`LLM action: ${JSON.stringify(action)}`);

    // 3. Execute the action
    try {
      await executeAction(page, action);
    } catch (execErr) {
      console.error(`Action failed: ${execErr.message}`);
      // Record the failure so Claude can adapt
      history.push({ ...action, error: execErr.message });
      continue;
    }

    // 4. Record in history
    history.push(action);

    // 5. Check if done
    if (action.action === "done") {
      console.log(`\nGoal completed.`);
      break;
    }
  }

  // Final screenshot
  await takeScreenshot(page, "final");
  console.log(`\nScreenshots saved to ${SCREENSHOT_DIR}/`);

  // Keep browser open for a few seconds so the user can see the result
  console.log("Closing browser in 5 seconds...");
  await page.waitForTimeout(5000);
  await browser.close();
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

run().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
