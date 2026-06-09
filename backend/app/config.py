from pydantic_settings import BaseSettings
from functools import lru_cache


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

    # App
    app_env: str = "development"
    cors_origins: str = "http://localhost:5173"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    @property
    def kibana_agent_builder_url(self) -> str:
        return f"{self.kibana_url}/api/agent_builder"

    @property
    def kibana_mcp_url(self) -> str:
        return f"{self.kibana_url}/api/agent_builder/mcp"


@lru_cache
def get_settings() -> Settings:
    return Settings()
