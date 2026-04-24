"""
Dashly MCP Server (HW3).

Exposes a thin MCP surface over the Dashly GenAI Evaluation API (Milestone 6):
- 1 resource: current ELO leaderboard for the four GenAI approaches
- 2 tools: generate a single-approach insight, compare two approaches side by side
- 1 optional prompt: structured campaign-analysis template

Transport: stdio (default for FastMCP). The client spawns this as a subprocess.
"""

from __future__ import annotations

import json
import os
from typing import Any, Optional

from dotenv import load_dotenv
from mcp.server.fastmcp import FastMCP

from dashly_client import DashlyClient

# Load env from .env in the same directory as this file so running from anywhere works.
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

mcp = FastMCP("dashly-genai")

# Single shared Dashly client. Lazy login on first call.
_dashly: Optional[DashlyClient] = None


def _client() -> DashlyClient:
    global _dashly
    if _dashly is None:
        _dashly = DashlyClient()
    return _dashly


# ---------------------------------------------------------------------------
# Resource: current GenAI leaderboard
# ---------------------------------------------------------------------------

@mcp.resource("dashly://genai/leaderboard")
def leaderboard() -> str:
    """Current ELO leaderboard of the four GenAI approaches.

    Returns JSON with rank, approach name, rating, wins, losses, and total
    comparisons per approach. Content changes over time as users submit
    preferences via POST /api/genai-eval/preference.
    """
    body = _client().get("/api/genai-eval/leaderboard")
    return json.dumps(body.get("data", body), indent=2)


# ---------------------------------------------------------------------------
# Tools
# ---------------------------------------------------------------------------

@mcp.tool()
def generate_ad_insight(prompt: str, approach: Optional[str] = None) -> dict[str, Any]:
    """Generate an ad-performance insight from one GenAI approach.

    Args:
        prompt: A natural-language question or dataset description about ad
            performance (e.g. "Analyze Meta Ads: $5k spend, 250 conv, ROAS 3.2").
        approach: Optional approach name. Valid values: "concise", "detailed",
            "executive", "technical". If omitted, the backend picks at random.

    Returns:
        Dict with: approach, model, response, tokensUsed, durationMs.
    """
    body: dict[str, Any] = {"prompt": prompt}
    if approach:
        body["approach"] = approach
    resp = _client().post("/api/genai-eval/generate", body)
    return resp.get("data", resp)


@mcp.tool()
def compare_ad_insights(prompt: str) -> dict[str, Any]:
    """Produce two side-by-side insights from two different random approaches.

    Args:
        prompt: Same-shape prompt as `generate_ad_insight`.

    Returns:
        Dict with comparisonId, optionA, optionB. Each option contains approach,
        model, response text, tokensUsed, durationMs. The comparisonId can be
        used by a client to later record a preference.
    """
    resp = _client().post("/api/genai-eval/compare", {"prompt": prompt})
    return resp.get("data", resp)


# ---------------------------------------------------------------------------
# Prompt template (optional per the assignment)
# ---------------------------------------------------------------------------

@mcp.prompt()
def campaign_analysis_template(
    campaign_name: str,
    platform: str,
    spend: float,
    conversions: int,
    cpa: float,
    roas: float,
) -> str:
    """Structured ad-performance analysis prompt.

    Produces a single well-formed prompt string that the caller can feed to
    `generate_ad_insight` or `compare_ad_insights`. Enforces a consistent
    metric layout so the LLM answers match expected structure.
    """
    return (
        f"Analyze the performance of our {platform} campaign '{campaign_name}'.\n\n"
        f"METRICS:\n"
        f"- Spend: ${spend:,.2f}\n"
        f"- Conversions: {conversions}\n"
        f"- CPA: ${cpa:,.2f}\n"
        f"- ROAS: {roas:.2f}x\n\n"
        "What's the headline status of this campaign? What should we change this week?"
    )


if __name__ == "__main__":
    mcp.run()
