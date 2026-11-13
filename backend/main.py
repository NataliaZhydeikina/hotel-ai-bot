"""FastAPI service for the WinWin hotel booking search assistant."""

from __future__ import annotations

import os
from datetime import date
from typing import Literal

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from openai import APIError, AsyncOpenAI
from pydantic import BaseModel, ConfigDict, Field

from tools import estimate_inventory, load_filter_catalog, lookup_filter


load_dotenv()


class SearchFilter(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str | None = Field(default=None, description="Canonical filter id when identified")
    label: str = Field(description="Human-readable filter requirement")
    priority: Literal["must", "nice"] = Field(description="Whether this is required or preferred")
    value: str | None = Field(default=None, description="Optional requested value or detail")


class HotelSearch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    destination: str | None = Field(description="City, region, or area to stay in")
    check_in: str | None = Field(description="Arrival date in ISO YYYY-MM-DD format")
    check_out: str | None = Field(description="Departure date in ISO YYYY-MM-DD format")
    guests: int = Field(ge=1, le=30, description="Total number of guests")
    filters: list[SearchFilter] = Field(description="Requested hotel features and constraints")


class AssistantOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    assistant_message: str = Field(description="A concise, friendly reply or follow-up question")
    search: HotelSearch


class ChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message: str = Field(min_length=1, max_length=4000)
    state: HotelSearch | None = None
    history: list[dict[str, str]] = Field(default_factory=list, max_length=12)


class ChatResponse(BaseModel):
    assistant_message: str
    state: HotelSearch
    estimate: dict[str, int | str | bool | None]


app = FastAPI(title="WinWin Hotel AI Assistant", version="1.0.0")
origins = [
    origin.strip()
    for origin in os.getenv("FRONTEND_ORIGINS", "http://localhost:5173").split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization"],
)


def _client() -> AsyncOpenAI:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="The assistant is not configured. Set OPENAI_API_KEY.")
    return AsyncOpenAI(api_key=api_key)


def _normalise_filters(filters: list[SearchFilter]) -> list[SearchFilter]:
    catalog = load_filter_catalog()
    resolved: list[SearchFilter] = []
    seen: set[tuple[str, str]] = set()
    for requested in filters:
        match = lookup_filter(requested.id or requested.label, catalog)
        canonical_id = match["id"] if match else requested.id
        key = (canonical_id or requested.label.casefold(), requested.priority)
        if key in seen:
            continue
        seen.add(key)
        resolved.append(requested.model_copy(update={"id": canonical_id}))
    return resolved


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    """Extract and update a structured hotel search from a natural-language message."""
    client = _client()
    today = date.today().isoformat()
    current_state = request.state.model_dump(mode="json") if request.state else None
    messages = [
        {
            "role": "system",
            "content": (
                "You are a helpful hotel booking search assistant. Extract and update the user's hotel search "
                "and provide a concise assistant_message plus the updated search object. Resolve relative dates using today's date "
                f"({today}) and output ISO dates (YYYY-MM-DD); never invent dates when they are unclear. "
                "Keep previously provided search details unless the user changes them. Use null for unknown "
                "destination or dates, and default guests to 2 unless context indicates otherwise. "
                "Classify explicit requirements and non-negotiables as priority='must'; classify preferences "
                "as priority='nice'. If required details are missing, ask a concise follow-up question. "
                "Do not claim to have searched live hotel inventory or made a booking."
            ),
        },
    ]
    for turn in request.history:
        role = turn.get("role")
        content = turn.get("content", "").strip()
        if role in {"user", "assistant"} and content:
            messages.append({"role": role, "content": content[:4000]})
    context = f"\n\nCurrent structured search state: {current_state}" if current_state else ""
    messages.append({"role": "user", "content": request.message + context})

    try:
        completion = await client.beta.chat.completions.parse(
            model=os.getenv("OPENAI_MODEL", "gpt-4o"),
            messages=messages,
            response_format=AssistantOutput,
            temperature=0.2,
        )
    except APIError as exc:
        raise HTTPException(status_code=502, detail="The AI provider could not process this request.") from exc

    choice = completion.choices[0] if completion.choices else None
    parsed = choice.message.parsed if choice and choice.message else None
    if parsed is None:
        raise HTTPException(status_code=502, detail="The AI provider returned no structured search.")

    state = parsed.search.model_copy(update={"filters": _normalise_filters(parsed.search.filters)})
    estimate = estimate_inventory(
        state.destination,
        state.check_in,
        state.check_out,
        state.guests,
        [item.model_dump() for item in state.filters],
    )
    return ChatResponse(
        assistant_message=parsed.assistant_message,
        state=state,
        estimate=estimate,
    )
