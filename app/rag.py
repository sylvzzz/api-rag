import asyncpg
from openai import AsyncOpenAI

from . import config, embed, store

PROMPT = """You are an assistant that answers questions about the documents the user has uploaded. Talk like a normal person: natural, direct, conversational.

Rules:
1. Answer only from the information below. Don't use outside knowledge and don't invent details.
2. If the information isn't there, or only partly there, say so naturally, e.g. "I don't have any information on that." If you only know part of the answer, give that part and say what's missing.
3. If you have the answer, just give it. No preamble, no filler.
4. Never mention "the context", "the provided documents", "the excerpt" or "based on the text". Answer as if you simply know it.
5. Always reply in the language of the question, and keep it short unless the question calls for more detail.
6. You are sending text, not markdown

Information:
{context}

Previous conversation:
{history}

Current question: {question}

Answer:"""


def build_prompt(question: str, chunks: list[store.Chunk], history: str = "") -> str:
    context = "\n\n".join(chunk.text for chunk in chunks)
    if history:
        return PROMPT.replace("Previous conversation:\n{history}\n\n", f"Previous conversation:\n{history}\n\n").format(
            context=context, history=history, question=question
        )
    # Remove history section if empty
    prompt = PROMPT.replace("Previous conversation:\n{history}\n\n", "")
    return prompt.format(context=context, question=question)


async def ask(
    pool: asyncpg.Pool,
    embed_client: AsyncOpenAI,
    chat_client: AsyncOpenAI,
    question: str,
    how_many: int = 5,
    chat_id: str = None,
    chat_history: list = None,
) -> tuple[str, list[store.Chunk]]:
    if not question:
        return None, []

    vectors = await embed.embed(embed_client, [question], "query")
    question_vector = vectors[0]
    chunks = await store.search(pool, question_vector, how_many)

    history_text = ""
    if chat_history:
        for msg in chat_history[-10:]:  # Include last 10 messages for context
            role = msg.get("role", "")
            content = msg.get("content", "")
            if role and content:
                history_text += f"{role}: {content}\n"

    prompt = build_prompt(question, chunks, history_text)

    messages = [{"role": "user", "content": prompt}]

    answer = await chat_client.chat.completions.create(
        model=config.LLM_MODEL,
        messages=messages,
    )
    text = answer.choices[0].message.content
    return text or "", chunks
