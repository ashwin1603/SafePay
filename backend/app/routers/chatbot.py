from typing import List, Optional

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session

from app.core.dependencies import _bearer_token, get_db
from app.core.security import decode_token
from app.services.chatbot_service import answer

router = APIRouter(prefix="/chat", tags=["Assistant"])


class ChatRequest(BaseModel):
    message: str

    @field_validator("message")
    @classmethod
    def _len(cls, v: str) -> str:
        if len(v) > 1000:
            raise ValueError("message too long")
        return v


class ChatResponse(BaseModel):
    reply: str
    intent: str
    suggestions: List[str]


@router.post("", response_model=ChatResponse)
def chat(payload: ChatRequest, request: Request, db: Session = Depends(get_db)):
    """Public assistant endpoint. If a valid token is present, it can also look
    up the caller's own transactions — otherwise it answers general questions."""
    user_id: Optional[int] = None
    token = _bearer_token(request)
    if token:
        try:
            user_id = int(decode_token(token, "access")["sub"])
        except Exception:
            user_id = None
    res = answer(payload.message, db=db, user_id=user_id)
    return ChatResponse(reply=res.reply, intent=res.intent, suggestions=res.suggestions)
