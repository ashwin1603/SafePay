from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    JWT_SECRET_KEY: str = "changeme"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    DATABASE_URL: str = "sqlite:///./safepay.db"

    RATE_LIMIT_PER_MINUTE: int = 60

    FRAUD_BLOCK_THRESHOLD: float = 0.8
    FRAUD_FLAG_THRESHOLD: float = 0.5


settings = Settings()
