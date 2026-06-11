from pydantic_settings import BaseSettings
from functools import lru_cache
from pathlib import Path

_ENV_FILE = Path(__file__).resolve().parent.parent.parent / ".env"


class Settings(BaseSettings):
    # Elastic Cloud
    elasticsearch_url: str = ""
    elasticsearch_api_key: str = ""
    kibana_url: str = ""

    # Agent Builder
    agent_builder_api_key: str = ""

    # Google / Gemini
    google_project_id: str = ""
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.5-flash"

    # App
    app_env: str = "development"
    cors_origins: str = "http://localhost:5173"

    # Reporter — real outbound complaint channel (Resend email API).
    # All optional: with no key set, the Reporter still files the Elastic
    # warning and returns the drafted complaint (delivery reports "draft").
    resend_api_key: str = ""
    report_from_email: str = "Carryover Reporter <onboarding@resend.dev>"
    report_to_email: str = ""  # community/reports inbox that receives complaints

    model_config = {"env_file": str(_ENV_FILE), "env_file_encoding": "utf-8"}

    @property
    def kibana_agent_builder_url(self) -> str:
        return f"{self.kibana_url}/api/agent_builder"

    @property
    def kibana_mcp_url(self) -> str:
        return f"{self.kibana_url}/api/agent_builder/mcp"


@lru_cache
def get_settings() -> Settings:
    return Settings()
