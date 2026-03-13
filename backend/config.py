from pydantic_settings import BaseSettings
from typing import List
import json


class Settings(BaseSettings):
    azure_openai_endpoint: str = "https://placeholder.openai.azure.com/"
    azure_openai_key: str = "placeholder-key"
    azure_openai_deployment: str = "gpt-4o"
    azure_di_endpoint: str = "https://placeholder.cognitiveservices.azure.com/"
    azure_di_key: str = "placeholder-key"
    tavily_api_key: str = "tvly-placeholder"
    database_url: str = "sqlite+aiosqlite:///./intellicredit.db"
    upload_dir: str = "./uploads"
    max_file_size_mb: int = 50
    cors_origins: List[str] = ["*"]
    port: int = 8000

    class Config:
        env_file = ".env"


settings = Settings()
