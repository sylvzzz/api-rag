from dataclasses import dataclass

import asyncpg


@dataclass
class Chunk:
    document_id: str
    text: str


def as_pgvector_text(vector: list[float]) -> str:
    return "[" + ",".join(str(number) for number in vector) + "]"


async def replace_document(
    pool: asyncpg.Pool,
    document_id: str,
    texts: list[str],
    vectors: list[list[float]],
) -> int:
    if len(texts) != len(vectors):
        raise ValueError("every chunk needs its own vector")

    async with pool.acquire() as connection:
        async with connection.transaction():
            await connection.execute(
                "DELETE FROM chunks WHERE document_id = $1", document_id
            )
            await connection.executemany(
                "INSERT INTO chunks (document_id, text, embedding) "
                "VALUES ($1, $2, $3::vector)",
                [
                    (document_id, text, as_pgvector_text(vector))
                    for text, vector in zip(texts, vectors)
                ],
            )
    return len(texts)


async def search(
    pool: asyncpg.Pool, question_vector: list[float], how_many: int
) -> list[Chunk]:
    async with pool.acquire() as connection:
        rows = await connection.fetch(
            "SELECT document_id, text FROM chunks "
            "ORDER BY embedding <=> $1::vector LIMIT $2",
            as_pgvector_text(question_vector),
            how_many,
        )
    return [
        Chunk(document_id=row["document_id"], text=row["text"]) for row in rows
    ]


async def get_documents(pool: asyncpg.Pool) -> list[dict]:
    async with pool.acquire() as connection:
        rows = await connection.fetch(
            "SELECT document_id, COUNT(*) as chunk_count, MIN(created_at) as uploaded_at "
            "FROM chunks "
            "GROUP BY document_id "
            "ORDER BY uploaded_at DESC"
        )
    return [
        {
            "document_id": row["document_id"],
            "chunk_count": row["chunk_count"],
            "uploaded_at": row["uploaded_at"],
        }
        for row in rows
    ]


async def store_document_metadata(pool: asyncpg.Pool, document_id: str, original_name: str):
    async with pool.acquire() as connection:
        await connection.execute(
            "CREATE TABLE IF NOT EXISTS documents_meta (document_id text PRIMARY KEY, original_name text, stored_at timestamptz DEFAULT now())"
        )
        await connection.execute(
            "INSERT INTO documents_meta (document_id, original_name) VALUES ($1, $2) ON CONFLICT (document_id) DO UPDATE SET original_name = $2",
            document_id,
            original_name,
        )


async def get_document_metadata(pool: asyncpg.Pool, document_id: str):
    async with pool.acquire() as connection:
        await connection.execute(
            "CREATE TABLE IF NOT EXISTS documents_meta (document_id text PRIMARY KEY, original_name text, stored_at timestamptz DEFAULT now())"
        )
        row = await connection.fetchrow(
            "SELECT original_name FROM documents_meta WHERE document_id = $1",
            document_id,
        )
    return row["original_name"] if row else document_id


async def get_documents_with_meta(pool: asyncpg.Pool) -> list[dict]:
    async with pool.acquire() as connection:
        await connection.execute(
            "CREATE TABLE IF NOT EXISTS documents_meta (document_id text PRIMARY KEY, original_name text, stored_at timestamptz DEFAULT now())"
        )
        rows = await connection.fetch(
            """
            SELECT c.document_id, COUNT(*) as chunk_count, MIN(c.created_at) as uploaded_at, COALESCE(m.original_name, c.document_id) as original_name
            FROM chunks c
            LEFT JOIN documents_meta m ON m.document_id = c.document_id
            GROUP BY c.document_id, m.original_name
            ORDER BY uploaded_at DESC
            """
        )
    return [
        {
            "document_id": row["document_id"],
            "original_name": row["original_name"],
            "chunk_count": row["chunk_count"],
            "uploaded_at": row["uploaded_at"],
        }
        for row in rows
    ]
