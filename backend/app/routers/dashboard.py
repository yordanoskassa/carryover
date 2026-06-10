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
                "FROM known-scams "
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
                corridor=record.get("corridor", "unknown"),
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
                "| WHERE date_reported >= \"2025-01-01T00:00:00Z\" "
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
                corridor=record.get("corridor", "unknown"),
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
async def get_visa_overview(nationality: str = "ET"):
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

    # Build restriction entries — every destination with indexed policy data,
    # plus the baseline set so the list is never empty before a crawl.
    destinations = sorted(baseline | {d for d in policy_counts if d in dest_names})
    max_policies = max(policy_counts.values()) if policy_counts else 1
    max_scams = max(scam_counts.values()) if scam_counts else 1

    entries = []
    for dest in destinations:
        policies = policy_counts.get(dest, 0)
        scams = scam_counts.get(dest, 0)

        # Score: more policies = more open, more scams = riskier
        policy_score = (policies / max_policies * 60) if max_policies else 30
        scam_penalty = (scams / max_scams * 40) if max_scams else 0
        score = max(5, min(95, int(policy_score + 30 - scam_penalty)))

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

    entries.sort(key=lambda x: x["score"], reverse=True)

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
