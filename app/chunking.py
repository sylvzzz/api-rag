def split_into_chunks(
    text: str, size: int = 2000, overlap: int = 200
) -> list[str]:
    if size <= 0:
        raise ValueError("size must be greater than zero")
    if overlap >= size:
        raise ValueError("overlap must be smaller than size")
    if not text.strip():
        return []

    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = min(start + size, len(text))
        if end < len(text):
            word_end = text.rfind(" ", start, end)
            if word_end > start:
                end = word_end
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end >= len(text):
            break
        start = end - overlap

    return chunks
