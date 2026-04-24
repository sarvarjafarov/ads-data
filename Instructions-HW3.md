# HW3: Dashly MCP Server and Client

The full Instructions file, source code, and runnable client for HW3 live in the [`mcp/`](mcp/) directory:

- **[mcp/Instructions-HW3.md](mcp/Instructions-HW3.md)** — Complete setup and usage documentation
- **[mcp/server.py](mcp/server.py)** — FastMCP server (1 resource, 2 tools, 1 prompt)
- **[mcp/client.py](mcp/client.py)** — Discovery and demo client
- **[mcp/dashly_client.py](mcp/dashly_client.py)** — HTTP wrapper around the Dashly REST API

## Quick start

```bash
# Start the Dashly API in one terminal
npm start

# Set up and run the MCP client in another terminal
cd mcp
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python client.py
```

See [mcp/Instructions-HW3.md](mcp/Instructions-HW3.md) for full details, expected output, and troubleshooting.
