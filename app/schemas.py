from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime


class IngestRequest(BaseModel):
    document_id: str
    text: str


class AskRequest(BaseModel):
    question: str
    how_many: int = 5
    chat_id: Optional[str] = None


class AskResponse(BaseModel):
    answer: str
    sources: List[dict]
    chat_id: str


class ChatMessage(BaseModel):
    role: str  # 'user' or 'assistant'
    content: str
    created_at: Optional[datetime] = None


class ChatSession(BaseModel):
    chat_id: str
    title: str
    created_at: datetime
    updated_at: datetime


class ChatHistoryResponse(BaseModel):
    chat_id: str
    title: str
    messages: List[ChatMessage]
    created_at: datetime
    updated_at: datetime


class ChatListResponse(BaseModel):
    chats: List[ChatSession]
