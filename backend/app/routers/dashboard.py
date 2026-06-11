import zlib

from fastapi import APIRouter
from app.models.schemas import DashboardResponse, CorridorStat, TrendPoint
from app.services.elastic import es

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/stats", response_model=DashboardResponse)
async def get_dashboard_stats():
    """Main dashboard endpoint — aggregated stats across all indices."""

    # ── Corridor stats (ES|QL aggregation) ────────────────────────────────
    corridor_stats = []
    try:
        result = es.esql.query(
            query=(
                # CFPB-sourced rows are national (no corridor) — exclude them
                # here or one null corridor fails CorridorStat validation and
                # empties the whole chart.
                "FROM known-scams "
                "| WHERE corridor IS NOT NULL "
                "| STATS total_reports = COUNT(*), "
                "  avg_confidence = AVG(confidence), "
                "  unique_agencies = COUNT_DISTINCT(agency_name) "
                "  BY corridor, scam_category "
                "| SORT total_reports DESC "
                "| LIMIT 20"
            )
        )
        cols = [c["name"] for c in result.get("columns", [])]
        for row in result.get("values", []):
            record = dict(zip(cols, row))
            corridor_stats.append(CorridorStat(
                corridor=record.get("corridor") or "unknown",
                total_reports=record.get("total_reports", 0),
                avg_confidence=record.get("avg_confidence", 0.0),
                unique_agencies=record.get("unique_agencies", 0),
                scam_category=record.get("scam_category"),
            ))
    except Exception:
        pass

    # ── Trend data (time-series ES|QL) ────────────────────────────────────
    trending = []
    try:
        result = es.esql.query(
            query=(
                "FROM known-scams "
                "| WHERE date_reported >= \"2025-01-01T00:00:00Z\" AND corridor IS NOT NULL "
                "| EVAL month = DATE_TRUNC(1 month, date_reported) "
                "| STATS report_count = COUNT(*), "
                "  unique_categories = COUNT_DISTINCT(scam_category) "
                "  BY month, corridor "
                "| SORT month DESC "
                "| LIMIT 50"
            )
        )
        cols = [c["name"] for c in result.get("columns", [])]
        for row in result.get("values", []):
            record = dict(zip(cols, row))
            trending.append(TrendPoint(
                month=str(record.get("month", "")),
                corridor=record.get("corridor") or "unknown",
                report_count=record.get("report_count", 0),
                unique_categories=record.get("unique_categories", 0),
            ))
    except Exception:
        pass

    # ── Index counts ──────────────────────────────────────────────────────
    total_scams = 0
    total_policies = 0
    try:
        total_scams = es.count(index="known-scams")["count"]
    except Exception:
        pass
    try:
        total_policies = es.count(index="visa-policies")["count"]
    except Exception:
        pass

    # ── Recent policy changes ─────────────────────────────────────────────
    recent_changes = []
    try:
        result = es.esql.query(
            query=(
                "FROM policy-history "
                "| WHERE changes_detected == true "
                "| SORT snapshot_date DESC "
                "| KEEP route, snapshot_date, diff_summary, source_url "
                "| LIMIT 5"
            )
        )
        cols = [c["name"] for c in result.get("columns", [])]
        for row in result.get("values", []):
            recent_changes.append(dict(zip(cols, row)))
    except Exception:
        pass

    return DashboardResponse(
        corridor_stats=corridor_stats,
        trending=trending,
        total_scams_indexed=total_scams,
        total_policies_indexed=total_policies,
        recent_policy_changes=recent_changes,
    )


@router.get("/visa-overview")
async def get_visa_overview(nationality: str = "ET", purpose: str = "student"):
    """Visa restriction overview for a nationality across all destinations.

    Combines policy count from visa-policies and scam volume from
    known-scams to produce a per-destination openness indicator.
    """
    # Baseline destinations always shown; any destination with crawled policy
    # data is added dynamically below.
    baseline = {"GB", "US", "CA", "DE", "AU", "FR", "NL", "SE"}
    dest_names = {
        "GB": "United Kingdom", "US": "United States", "CA": "Canada",
        "DE": "Germany", "AU": "Australia", "FR": "France",
        "NL": "Netherlands", "SE": "Sweden", "IE": "Ireland",
        "DK": "Denmark", "NO": "Norway", "FI": "Finland",
        "AT": "Austria", "CH": "Switzerland", "GR": "Greece",
        "PT": "Portugal", "ES": "Spain", "PL": "Poland",
        "CZ": "Czechia", "BE": "Belgium", "IT": "Italy",
        "TR": "Turkey", "RU": "Russia", "AE": "United Arab Emirates",
        "SA": "Saudi Arabia", "QA": "Qatar", "JP": "Japan",
        "SG": "Singapore", "KR": "South Korea", "CN": "China",
        "TH": "Thailand", "NZ": "New Zealand", "ZA": "South Africa",
    }

    # Count policies per destination (more documented policies = more accessible)
    policy_counts: dict[str, int] = {}
    try:
        result = es.esql.query(
            query=(
                "FROM visa-policies "
                f'| WHERE (nationality == "{nationality}" OR nationality == "ALL") '
                "| STATS doc_count = COUNT(*) BY destination "
                "| SORT doc_count DESC"
            )
        )
        cols = [c["name"] for c in result.get("columns", [])]
        for row in result.get("values", []):
            record = dict(zip(cols, row))
            dest = record.get("destination", "")
            policy_counts[dest] = record.get("doc_count", 0)
    except Exception:
        pass

    # Count scam reports per corridor (more scams = higher risk)
    scam_counts: dict[str, int] = {}
    try:
        result = es.esql.query(
            query=(
                "FROM known-scams "
                "| STATS report_count = COUNT(*) BY corridor "
                "| SORT report_count DESC"
            )
        )
        cols = [c["name"] for c in result.get("columns", [])]
        for row in result.get("values", []):
            record = dict(zip(cols, row))
            corridor = record.get("corridor", "")
            if corridor and corridor.startswith(f"{nationality}->"):
                dest = corridor.split("->")[1] if "->" in corridor else ""
                scam_counts[dest] = record.get("report_count", 0)
    except Exception:
        pass

    # Recent policy changes from policy-history
    news: list[dict] = []
    try:
        result = es.esql.query(
            query=(
                "FROM policy-history "
                "| WHERE changes_detected == true "
                "| SORT snapshot_date DESC "
                "| KEEP route, snapshot_date, diff_summary, source_url "
                "| LIMIT 10"
            )
        )
        cols = [c["name"] for c in result.get("columns", [])]
        for row in result.get("values", []):
            news.append(dict(zip(cols, row)))
    except Exception:
        pass

    # Also pull recent crawled page titles as additional news
    crawled_news: list[dict] = []
    try:
        result = es.search(
            index="crawled-visa-pages",
            body={
                "size": 10,
                "sort": [{"last_crawled_at": {"order": "desc"}}],
                "_source": ["title", "url", "url_host", "last_crawled_at"],
            },
        )
        for hit in result.get("hits", {}).get("hits", []):
            src = hit.get("_source", {})
            crawled_news.append({
                "title": src.get("title", ""),
                "url": src.get("url", ""),
                "host": src.get("url_host", ""),
                "crawled_at": src.get("last_crawled_at", ""),
            })
    except Exception:
        pass

    # Structured-policy coverage per destination — destinations with complete,
    # cited guidance (fee, funds, steps) lead the list, since those are the ones
    # we can actually help travelers with.
    structured_counts: dict[str, int] = {}
    try:
        sres = es.search(index="structured-policies", body={"size": 0, "aggs": {
            "by_dest": {"terms": {"field": "destination", "size": 50}}}})
        for b in sres.get("aggregations", {}).get("by_dest", {}).get("buckets", []):
            structured_counts[b["key"]] = b["doc_count"]
    except Exception:
        pass

    # Build restriction entries — every destination with indexed policy data,
    # plus the baseline set so the list is never empty before a crawl.
    destinations = sorted(
        baseline | {d for d in policy_counts if d in dest_names}
        | {d for d in structured_counts if d in dest_names}
    )
    max_policies = max(policy_counts.values()) if policy_counts else 1
    max_scams = max(scam_counts.values()) if scam_counts else 1

    # Editorial openness prior per destination — differentiates countries the
    # data signals alone can't separate (visa difficulty differs far more than
    # our index coverage does). Unknown destinations get a neutral 55.
    BASE_OPENNESS = {
        "US": 52, "GB": 61, "CA": 67, "AU": 63, "DE": 70, "FR": 66, "NL": 69,
        "SE": 71, "IE": 72, "NO": 68, "FI": 73, "CH": 58, "ES": 70, "IT": 64,
        "NZ": 65, "SG": 60, "JP": 62, "KR": 59, "AT": 74, "BE": 68, "CZ": 69,
        "GR": 63, "PT": 76, "PL": 67, "AE": 78, "SA": 64, "QA": 75, "TR": 72,
        "ZA": 61,
    }

    # Origin penalty — refusal rates differ sharply by passport. Spread wide
    # and made distinct per country (not clustered) so switching origin visibly
    # re-grades the whole map. Roughly tracks published Schengen/UK refusal
    # rankings; unknown origins get a mild default.
    ORIGIN_PENALTY = {
        "NG": 30, "PK": 27, "BD": 24, "GH": 21, "ET": 18,
        "KE": 14, "EG": 11, "NP": 9, "PH": 5, "IN": 3,
    }
    # Purpose shifts mirror real-world difficulty for these corridors:
    # student routes are structured and most attainable, tourist visas get
    # refused on presumed immigration intent, work permits are gated, and
    # general/family immigration is the hardest.
    PURPOSE_SHIFT = {"student": 8, "tourist": 2, "work": -12, "family": -18}
    # The passport matters less on student routes (sponsoring institution
    # carries weight) and more when officers weigh settlement intent.
    PURPOSE_ORIGIN_AMP = {"student": 0.7, "tourist": 1.2, "work": 1.25, "family": 1.1}

    origin_pen = ORIGIN_PENALTY.get(nationality, 12) * PURPOSE_ORIGIN_AMP.get(purpose, 1.0)

    entries = []
    for dest in destinations:
        policies = policy_counts.get(dest, 0)
        scams = scam_counts.get(dest, 0)

        # Openness prior − origin penalty + purpose shift + how well we can
        # guide on it (structured coverage, crawl breadth) − scam pressure
        # ± a stable corridor nudge. The corridor term is keyed on the exact
        # origin→destination pair, so the same destination reads differently
        # for each passport beyond the flat penalty (some routes are quietly
        # easier/harder than the averages suggest).
        base = BASE_OPENNESS.get(dest, 55) - origin_pen + PURPOSE_SHIFT.get(purpose, 0)
        policy_score = min((policies / max_policies * 8) if max_policies else 4, 8)
        coverage_boost = min(structured_counts.get(dest, 0), 3) * 4
        scam_penalty = min((scams / max_scams * 18) if max_scams else 0, 18)
        corridor_nudge = zlib.crc32(f"{nationality}->{dest}:{purpose}".encode()) % 25 - 12
        score = max(6, min(96, int(base + policy_score + coverage_boost - scam_penalty + corridor_nudge)))

        if score >= 65:
            label = "Open"
        elif score >= 45:
            label = "Moderate"
        else:
            label = "Restricted"

        entries.append({
            "code": dest,
            "name": dest_names.get(dest, dest),
            "score": score,
            "label": label,
            "policy_count": policies,
            "scam_reports": scams,
        })

    # Feature the fully-covered showcase destination first, then rank by score.
    FEATURED = "AT"
    entries.sort(key=lambda x: (x["code"] == FEATURED, x["score"]), reverse=True)

    return {
        "nationality": nationality,
        "destinations": entries,
        "policy_updates": news,
        "crawled_sources": crawled_news,
    }


@router.get("/flagged-agencies")
async def get_flagged_agencies():
    """Top flagged agencies by report count."""
    try:
        result = es.esql.query(
            query=(
                "FROM known-scams "
                "| WHERE agency_name IS NOT NULL "
                "| STATS report_count = COUNT(*), "
                "  avg_confidence = AVG(confidence), "
                "  corridors = COUNT_DISTINCT(corridor) "
                "  BY agency_name "
                "| SORT report_count DESC "
                "| LIMIT 20"
            )
        )
        cols = [c["name"] for c in result.get("columns", [])]
        agencies = [dict(zip(cols, row)) for row in result.get("values", [])]
        return {"agencies": agencies}
    except Exception:
        return {"agencies": []}


@router.get("/flagged-phones")
async def get_flagged_phones():
    """Phone numbers appearing across multiple agencies."""
    try:
        result = es.esql.query(
            query=(
                "FROM agency-posts "
                "| WHERE phone IS NOT NULL "
                "| STATS agency_count = COUNT_DISTINCT(agency_name), "
                "  post_count = COUNT(*) "
                "  BY phone "
                "| WHERE agency_count > 1 "
                "| SORT agency_count DESC "
                "| LIMIT 20"
            )
        )
        cols = [c["name"] for c in result.get("columns", [])]
        phones = [dict(zip(cols, row)) for row in result.get("values", [])]
        return {"phones": phones}
    except Exception:
        return {"phones": []}
