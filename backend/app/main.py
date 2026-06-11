from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.routers import advisor, inspector, dashboard, ingest, kibo, elastic_info, news, reporter
from app.services import agent_builder

settings = get_settings()

app = FastAPI(
    title="Carryover API",
    description="Protect migrants from fraudulent agencies. Powered by Elastic Agent Builder + Gemini.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(advisor.router)
app.include_router(inspector.router)
app.include_router(dashboard.router)
app.include_router(ingest.router)
app.include_router(kibo.router)
app.include_router(elastic_info.router)
app.include_router(news.router)
app.include_router(reporter.router)


@app.get("/")
async def root():
    return {
        "name": "Carryover",
        "tagline": "Your safe path to migrate.",
        "version": "0.1.0",
    }


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/api/setup")
async def full_setup():
    """One-click setup: create indices + register tools + create agents in Agent Builder."""
    from app.services.elastic import create_indices

    indices = create_indices()
    tools = await agent_builder.setup_all_tools()
    agents = await agent_builder.setup_all_agents()

    return {
        "indices": indices,
        "tools": tools,
        "agents": agents,
    }
