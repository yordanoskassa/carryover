#!/usr/bin/env python3
"""
Migrate all Carryover data from the current (Observability) Elasticsearch project
to a new Elasticsearch (Search) Serverless project — so we can use Agent Builder
without re-crawling.

How it works: scroll every document out of the old project and bulk-index it into
the new one. Indices are created in the new project first with the SAME mappings,
so ELSER `semantic_text` fields re-embed automatically on arrival.

Usage:
  OLD creds come from .env (ELASTICSEARCH_URL / ELASTICSEARCH_API_KEY).
  NEW creds come from env vars:
    NEW_ES_URL="https://<new-project>.es.<region>.gcp.elastic.cloud" \
    NEW_ES_API_KEY="<encoded key>" \
    python scripts/migrate_to_new_project.py
"""
import os
import sys

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from elasticsearch import Elasticsearch, helpers

INDICES = [
    "crawled-visa-pages",
    "visa-policies",
    "structured-policies",
    "known-scams",
    "agency-posts",
    "policy-history",
    "visa-news",
]


def _client(url: str, key: str) -> Elasticsearch:
    if url.startswith("https://") and ":" not in url.split("//", 1)[1]:
        url += ":443"
    return Elasticsearch(url, api_key=key, request_timeout=120,
                         retry_on_timeout=True, max_retries=3)


def main():
    old = _client(os.environ["ELASTICSEARCH_URL"], os.environ["ELASTICSEARCH_API_KEY"])
    new_url, new_key = os.environ.get("NEW_ES_URL"), os.environ.get("NEW_ES_API_KEY")
    if not new_url or not new_key:
        sys.exit("Set NEW_ES_URL and NEW_ES_API_KEY to the new Search project.")
    new = _client(new_url, new_key)

    print("Source:", os.environ["ELASTICSEARCH_URL"][:50])
    print("Target:", new_url[:50])

    for name in INDICES:
        if not old.indices.exists(index=name):
            print(f"  {name}: not in source, skipping")
            continue
        src_count = old.count(index=name).get("count", 0)

        # 1. Create the index in the new project with the same mappings so
        #    semantic_text fields re-embed. (No settings — managed on serverless.)
        try:
            mapping = old.indices.get_mapping(index=name)[name]["mappings"]
            if not new.indices.exists(index=name):
                new.indices.create(index=name, mappings=mapping)
                print(f"  {name}: created in target")
        except Exception as e:
            print(f"  {name}: mapping/create note: {str(e)[:120]}")

        # 2. Scroll source → bulk target (preserve _id where present).
        def actions():
            for doc in helpers.scan(old, index=name, size=200, scroll="10m"):
                yield {"_index": name, "_id": doc["_id"], "_source": doc["_source"]}

        ok, errors = 0, 0
        try:
            for success, info in helpers.streaming_bulk(
                new, actions(), chunk_size=100, request_timeout=120, raise_on_error=False,
            ):
                if success:
                    ok += 1
                else:
                    errors += 1
        except Exception as e:
            print(f"  {name}: bulk error: {str(e)[:140]}")

        print(f"  {name}: {src_count} source docs → {ok} copied"
              + (f", {errors} errors" if errors else ""))

    print("\nMigration complete. ELSER re-embedding finishes asynchronously on the "
          "new project for semantic_text indices (visa-policies, known-scams).")


if __name__ == "__main__":
    main()
