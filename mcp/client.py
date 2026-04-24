"""
Dashly MCP Client (HW3).

Spawns server.py over stdio, discovers every capability (resources, tools,
prompts), prints a readable summary of each, and demonstrates one tool call
end-to-end.

Run with:
    python client.py
"""

from __future__ import annotations

import asyncio
import json
import os
import sys

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client


SERVER_SCRIPT = os.path.join(os.path.dirname(__file__), "server.py")

DEMO_PROMPT = (
    "Analyze our Meta Ads campaign performance: $5,000 monthly spend, "
    "250 conversions, CPA of $20, and a ROAS of 3.2. What should we optimize?"
)


def header(title: str) -> None:
    bar = "=" * 70
    print(f"\n{bar}\n  {title}\n{bar}")


def pretty(obj) -> str:
    try:
        return json.dumps(obj, indent=2, default=str)
    except TypeError:
        return str(obj)


async def run() -> int:
    server_params = StdioServerParameters(
        command=sys.executable,
        args=[SERVER_SCRIPT],
        env=os.environ.copy(),
    )

    async with stdio_client(server_params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()

            # -----------------------------------------------------------------
            # Discover capabilities
            # -----------------------------------------------------------------
            header("RESOURCES")
            resources = await session.list_resources()
            if not resources.resources:
                print("(none)")
            for r in resources.resources:
                print(f"- URI:         {r.uri}")
                print(f"  Name:        {r.name}")
                print(f"  Description: {r.description or '(none)'}")
                print(f"  MIME type:   {r.mimeType or '(default)'}")

            header("TOOLS")
            tools = await session.list_tools()
            if not tools.tools:
                print("(none)")
            for t in tools.tools:
                print(f"- Name:        {t.name}")
                print(f"  Description: {t.description or '(none)'}")
                print(f"  Parameters:  {pretty(t.inputSchema)}")

            header("PROMPTS")
            prompts = await session.list_prompts()
            if not prompts.prompts:
                print("(none)")
            for p in prompts.prompts:
                print(f"- Name:        {p.name}")
                print(f"  Description: {p.description or '(none)'}")
                args = [
                    {
                        "name": a.name,
                        "description": a.description,
                        "required": a.required,
                    }
                    for a in (p.arguments or [])
                ]
                print(f"  Arguments:   {pretty(args)}")

            # -----------------------------------------------------------------
            # Demonstrate one tool call end-to-end
            # -----------------------------------------------------------------
            header("DEMO: invoke tool 'generate_ad_insight'")
            demo_args = {"prompt": DEMO_PROMPT, "approach": "concise"}
            print("Arguments sent:")
            print(pretty(demo_args))

            result = await session.call_tool("generate_ad_insight", demo_args)
            print("\nResponse returned:")
            for block in result.content:
                if getattr(block, "type", None) == "text":
                    # The tool returns a dict; FastMCP serializes it to text
                    try:
                        parsed = json.loads(block.text)
                        print(pretty(parsed))
                    except (ValueError, TypeError):
                        print(block.text)
                else:
                    print(pretty(block.model_dump() if hasattr(block, "model_dump") else block))

            # -----------------------------------------------------------------
            # Also read the resource so the user can see it works too
            # -----------------------------------------------------------------
            header("DEMO: read resource 'dashly://genai/leaderboard'")
            try:
                res = await session.read_resource("dashly://genai/leaderboard")
                for content in res.contents:
                    text = getattr(content, "text", None)
                    if text:
                        try:
                            print(pretty(json.loads(text)))
                        except (ValueError, TypeError):
                            print(text)
                    else:
                        print(pretty(content.model_dump() if hasattr(content, "model_dump") else content))
            except Exception as err:
                print(f"(resource read failed: {err})")

            print("\n" + "=" * 70)
            print("  Discovery + demo complete.")
            print("=" * 70)
            return 0


if __name__ == "__main__":
    try:
        sys.exit(asyncio.run(run()))
    except KeyboardInterrupt:
        sys.exit(130)
