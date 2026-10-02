from openai import AsyncOpenAI

from . import config


async def embed(
    client: AsyncOpenAI, texts: list[str], input_type: str
) -> list[list[float]]:
    response = await client.embeddings.create(
        model=config.EMBED_MODEL,
        input=texts,
        encoding_format="float",
        extra_body={"input_type": input_type, "truncate": "NONE"},
    )
    return [item.embedding for item in response.data]
