from typing import Literal

from pydantic import BaseModel, Field


class HelpChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., min_length=1, max_length=4000)


class HelpChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    page_path: str = Field(default="/dashboard", max_length=200)
    history: list[HelpChatTurn] = Field(default_factory=list, max_length=10)


class HelpChatReply(BaseModel):
    reply: str
