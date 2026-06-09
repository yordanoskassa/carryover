#!/usr/bin/env python3
"""
One-shot setup script for ElastiPath on Elastic Cloud Serverless.
Creates indices, registers Agent Builder tools, and creates agents.

Usage:
    python scripts/setup_elastic.py

Requires .env with ELASTICSEARCH_URL, ELASTICSEARCH_API_KEY, KIBANA_URL, AGENT_BUILDER_API_KEY
"""

import asyncio
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from app.services.elastic import create_indices, es
from app.services.agent_builder import setup_all_tools, setup_all_agents


async def main():
    print("=" * 60)
    print("ElastiPath — Elastic Cloud Setup")
    print("=" * 60)

    # 1. Test connection
    print("\n[1/4] Testing Elasticsearch connection...")
    try:
        info = es.info()
        print(f"  Connected to: {info['cluster_name']}")
        print(f"  Version: {info['version']['number']}")
    except Exception as e:
        print(f"  FAILED: {e}")
        print("  Check ELASTICSEARCH_URL and ELASTICSEARCH_API_KEY in .env")
        return

    # 2. Create indices
    print("\n[2/4] Creating indices...")
    results = create_indices()
    for name, status in results.items():
        print(f"  {name}: {status}")

    # 3. Register tools in Agent Builder
    print("\n[3/4] Registering tools in Agent Builder...")
    try:
        tools = await setup_all_tools()
        for name, status in tools.items():
            print(f"  {name}: {status}")
    except Exception as e:
        print(f"  FAILED: {e}")
        print("  Check KIBANA_URL and AGENT_BUILDER_API_KEY in .env")

    # 4. Create agents
    print("\n[4/4] Creating agents in Agent Builder...")
    try:
        agents = await setup_all_agents()
        for name, status in agents.items():
            print(f"  {name}: {status}")
    except Exception as e:
        print(f"  FAILED: {e}")

    print("\n" + "=" * 60)
    print("Setup complete.")
    print(f"MCP endpoint: <your-kibana-url>/api/agent_builder/mcp")
    print("All tools are now auto-exposed to Gemini via MCP.")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
