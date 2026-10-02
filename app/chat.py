import asyncpg
from datetime import datetime
from typing import List, Optional


async def create_chat(pool: asyncpg.Pool, title: str = "New Chat") -> str:
    async with pool.acquire() as con:
        row = await con.fetchrow(
            "INSERT INTO chats (title) VALUES ($1) RETURNING chat_id",
            title,
        )
    return str(row["chat_id"])


async def add_message(
    pool: asyncpg.Pool, chat_id: str, role: str, content: str
):
    async with pool.acquire() as con:
        await con.execute(
            "INSERT INTO chat_messages (chat_id, role, content) VALUES ($1, $2, $3)",
            chat_id,
            role,
            content,
        )
        await con.execute(
            "UPDATE chats SET updated_at = now() WHERE chat_id = $1",
            chat_id,
        )
        # Update title if it's still default and this is the first user message
        chat = await con.fetchrow(
            "SELECT title, (SELECT COUNT(*) FROM chat_messages cm WHERE cm.chat_id = c.chat_id) as msg_count FROM chats c WHERE c.chat_id = $1",
            chat_id,
        )
        if chat and chat["title"] == "New Chat" and chat["msg_count"] >= 1:
            # Get first user message to use as title
            first = await con.fetchrow(
                "SELECT content FROM chat_messages WHERE chat_id = $1 AND role = 'user' ORDER BY created_at ASC LIMIT 1",
                chat_id,
            )
            if first and first["content"]:
                title = first["content"][:50]
                await con.execute(
                    "UPDATE chats SET title = $2 WHERE chat_id = $1",
                    chat_id,
                    title,
                )


async def get_chat_messages(pool: asyncpg.Pool, chat_id: str) -> List[dict]:
    async with pool.acquire() as con:
        rows = await con.fetch(
            "SELECT role, content, created_at FROM chat_messages WHERE chat_id = $1 ORDER BY created_at ASC",
            chat_id,
        )
    return [
        {"role": row["role"], "content": row["content"], "created_at": row["created_at"]}
        for row in rows
    ]


async def get_chat_list(pool: asyncpg.Pool) -> List[dict]:
    async with pool.acquire() as con:
        rows = await con.fetch(
            "SELECT chat_id, title, created_at, updated_at FROM chats ORDER BY updated_at DESC"
        )
    return [
        {
            "chat_id": str(row["chat_id"]),
            "title": row["title"],
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
        }
        for row in rows
    ]


async def delete_chat(pool: asyncpg.Pool, chat_id: str):
    async with pool.acquire() as con:
        await con.execute("DELETE FROM chats WHERE chat_id = $1", chat_id)
