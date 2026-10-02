import asyncpg

from . import config

SCHEMA = f"""
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS chunks (
    id          bigserial PRIMARY KEY,
    document_id text        NOT NULL,
    text        text        NOT NULL,
    embedding vector({config.EMBED_DIM}) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chunks_document_id_idx ON chunks (document_id);
"""

async def connect() -> asyncpg.Pool:
    pool = await asyncpg.create_pool(config.DATABASE_URL)
    async with pool.acquire() as con:
        await con.execute(SCHEMA)
    return pool


# Chat session tables
CHAT_SCHEMA = f"""
CREATE TABLE IF NOT EXISTS chats (
    chat_id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title       text NOT NULL DEFAULT 'New Chat',
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id          bigserial PRIMARY KEY,
    chat_id     uuid NOT NULL REFERENCES chats(chat_id) ON DELETE CASCADE,
    role        text NOT NULL CHECK (role IN ('user', 'assistant')),
    content     text NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_messages_chat_id_idx ON chat_messages (chat_id);
CREATE INDEX IF NOT EXISTS chats_updated_at_idx ON chats (updated_at DESC);
"""


async def init_schema(pool: asyncpg.Pool):
    async with pool.acquire() as con:
        await con.execute("CREATE EXTENSION IF NOT EXISTS vector;")
        await con.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto;")  # for gen_random_uuid
        await con.execute(SCHEMA)
        await con.execute(CHAT_SCHEMA)
