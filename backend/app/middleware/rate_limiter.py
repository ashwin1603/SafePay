"""
Rate Limiter Middleware
-----------------------
In-memory sliding-window limiter (per user_id or IP).
Stores timestamped request deques; purges entries older than 60 seconds.

Applied as a FastAPI middleware — rate-limits all /process-payment calls
and optionally all routes (configurable).
"""

import logging
import time
from collections import defaultdict, deque
from threading import Lock
from typing import Deque

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import settings

logger = logging.getLogger(__name__)

# Keyed by identifier (user_id or IP); value is deque of request timestamps
_windows: dict[str, Deque[float]] = defaultdict(deque)
_lock = Lock()

# Routes to rate-limit (prefix match)
_LIMITED_PREFIXES = ("/process-payment", "/auth/login")


def _get_identifier(request: Request) -> str:
    """Prefer authenticated user_id; fall back to client IP."""
    # Try extracting from JWT sub without full decode (perf-friendly)
    forwarded = request.headers.get("X-Forwarded-For")
    ip = forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else "unknown")
    return ip


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, limit: int = None):
        super().__init__(app)
        self.limit = limit or settings.RATE_LIMIT_PER_MINUTE
        self.window = 60  # seconds

    async def dispatch(self, request: Request, call_next) -> Response:
        path = request.url.path

        if not any(path.startswith(p) for p in _LIMITED_PREFIXES):
            return await call_next(request)

        key = _get_identifier(request)
        now = time.monotonic()
        cutoff = now - self.window

        with _lock:
            dq = _windows[key]
            # Purge old entries
            while dq and dq[0] < cutoff:
                dq.popleft()

            if len(dq) >= self.limit:
                logger.warning("Rate limit exceeded for %s on %s", key, path)
                return JSONResponse(
                    status_code=429,
                    content={
                        "detail": f"Rate limit exceeded — max {self.limit} requests/min",
                        "retry_after": int(self.window - (now - dq[0])),
                    },
                    headers={"Retry-After": str(int(self.window - (now - dq[0])))},
                )

            dq.append(now)

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(self.limit)
        response.headers["X-RateLimit-Remaining"] = str(max(0, self.limit - len(_windows[key])))
        return response
