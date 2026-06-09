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
