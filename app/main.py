from contextlib import asynccontextmanager
import uuid

from fastapi import Depends, FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from openai import AsyncOpenAI
from pydantic import BaseModel

from . import chunking, config, db, embed, rag, store, chat, upload, schemas


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.pool = await db.connect()
    await db.init_schema(app.state.pool)
    app.state.embed_client = AsyncOpenAI(
        base_url=config.NVIDIA_BASE_URL,
        api_key=config.EMBED_API_KEY,
        timeout=120.0,
    )
    app.state.chat_client = AsyncOpenAI(
        base_url=config.LLM_BASE_URL,
        api_key=config.LLM_API_KEY,
        timeout=120.0,
    )
    upload.ensure_upload_dir()
    yield
    await app.state.pool.close()


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_pool():
    return app.state.pool


def get_embed_client() -> AsyncOpenAI:
    return app.state.embed_client


def get_chat_client() -> AsyncOpenAI:
    return app.state.chat_client


@app.post("/ingest")
async def ingest(
    request: schemas.IngestRequest,
    pool=Depends(get_pool),
    client: AsyncOpenAI = Depends(get_embed_client),
) -> dict:
    chunks = chunking.split_into_chunks(request.text)
    if not chunks:
        return {"document_id": request.document_id, "chunks": 0}

    vectors = await embed.embed(client, chunks, "passage")
    saved = await store.replace_document(
        pool, request.document_id, chunks, vectors
    )
    return {"document_id": request.document_id, "chunks": saved}


@app.post("/upload", response_model=dict)
async def upload_file(
    file: UploadFile = File(...),
    pool=Depends(get_pool),
    client: AsyncOpenAI = Depends(get_embed_client),
):
    if not upload.is_text_based(file.filename):
        raise HTTPException(
            status_code=400,
            detail="Only text-based files are supported (PDF, Markdown, TXT, source code, etc.). Images and videos are not supported.",
        )
    
    upload.ensure_upload_dir()
    file_id = str(uuid.uuid4())
    safe_name = file.filename or "document"
    ext = upload.Path(safe_name).suffix
    stored_name = f"{file_id}{ext}"
    file_path = upload.UPLOAD_DIR / stored_name
    
    try:
        content = await file.read()
        with open(file_path, "wb") as f:
            f.write(content)
        
        text = upload.extract_text_from_file(file_path)
        if not text or len(text.strip()) == 0:
            file_path.unlink(missing_ok=True)
            raise HTTPException(status_code=400, detail="Could not extract text from file")
        
        chunks = chunking.split_into_chunks(text)
        if not chunks:
            file_path.unlink(missing_ok=True)
            return {"document_id": stored_name, "chunks": 0}
        
        vectors = await embed.embed(client, chunks, "passage")
        saved = await store.replace_document(
            pool, stored_name, chunks, vectors
        )
        await store.store_document_metadata(pool, stored_name, safe_name)
        return {
            "document_id": stored_name,
            "original_name": safe_name,
            "chunks": saved,
        }
    except HTTPException:
        raise
    except Exception as e:
        file_path.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail=f"Failed to process file: {str(e)}")


@app.post("/ask", response_model=schemas.AskResponse)
async def ask(
    request: schemas.AskRequest,
    pool=Depends(get_pool),
    embed_client: AsyncOpenAI = Depends(get_embed_client),
    chat_client: AsyncOpenAI = Depends(get_chat_client),
):
    chat_id = request.chat_id
    if not chat_id:
        chat_id = await chat.create_chat(pool)
    
    try:
        await chat.add_message(pool, chat_id, "user", request.question)
        history = await chat.get_chat_messages(pool, chat_id)
        history = history[:-1] if history else []
        
        answer, chunks = await rag.ask(
            pool, embed_client, chat_client, request.question, request.how_many, chat_id=chat_id, chat_history=history
        )
        
        if answer is None:
            answer = "I couldn't process your question."
        
        await chat.add_message(pool, chat_id, "assistant", answer)
    except Exception as e:
        answer = "An error occurred while processing your request."
        await chat.add_message(pool, chat_id, "assistant", answer)
        chunks = []

    return {
        "answer": answer,
        "sources": [
            {"document_id": chunk.document_id, "text": chunk.text[:200]}
            for chunk in chunks
        ],
        "chat_id": chat_id,
    }


@app.get("/chats", response_model=schemas.ChatListResponse)
async def list_chats(pool=Depends(get_pool)):
    chats = await chat.get_chat_list(pool)
    return {"chats": chats}


@app.get("/chats/{chat_id}", response_model=schemas.ChatHistoryResponse)
async def get_chat(chat_id: str, pool=Depends(get_pool)):
    messages = await chat.get_chat_messages(pool, chat_id)
    chats = await chat.get_chat_list(pool)
    chat_info = next((c for c in chats if c["chat_id"] == chat_id), None)
    if not chat_info:
        raise HTTPException(status_code=404, detail="Chat not found")
    return {
        "chat_id": chat_id,
        "title": chat_info["title"],
        "messages": messages,
        "created_at": chat_info["created_at"],
        "updated_at": chat_info["updated_at"],
    }


@app.delete("/chats/{chat_id}")
async def delete_chat(chat_id: str, pool=Depends(get_pool)):
    await chat.delete_chat(pool, chat_id)
    return {"status": "ok"}


@app.get("/documents")
async def list_documents(pool=Depends(get_pool)):
    from . import store
    docs = await store.get_documents_with_meta(pool)
    return {"documents": docs}


@app.get("/documents/{document_id}/content")
async def get_document_content(document_id: str, pool=Depends(get_pool)):
    from . import store, upload
    from pathlib import Path
    docs = await store.get_documents(pool)
    doc_ids = [d["document_id"] for d in docs]
    if document_id not in doc_ids:
        raise HTTPException(status_code=404, detail="Document not found")
    upload.ensure_upload_dir()
    file_path = None
    for search_dir in [upload.UPLOAD_DIR, Path("."), Path("./files")]:
        if search_dir.exists():
            c = search_dir / document_id
            if c.exists() and c.is_file():
                file_path = c
                break
            for f in search_dir.iterdir():
                try:
                    if f.is_file() and (f.name == document_id or f.name == Path(document_id).name or f.stem == Path(document_id).stem):
                        file_path = f
                        break
                except:
                    pass
            if file_path:
                break
    if not file_path or not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")
    try:
        text = upload.extract_text_from_file(file_path)
        return {"document_id": document_id, "content": text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to extract content: {str(e)}")


@app.delete("/documents/{document_id}")
async def delete_document(document_id: str, pool=Depends(get_pool)):
    from . import store, upload
    from pathlib import Path
    # Delete from DB
    async with pool.acquire() as connection:
        await connection.execute("DELETE FROM chunks WHERE document_id = $1", document_id)
    # Delete file from disk
    upload.ensure_upload_dir()
    for search_dir in [upload.UPLOAD_DIR, Path("."), Path("./files")]:
        if search_dir.exists():
            for pattern in [document_id, Path(document_id).name]:
                c = search_dir / pattern
                if c.exists() and c.is_file():
                    try:
                        c.unlink()
                    except:
                        pass
    return {"status": "ok"}


@app.get("/documents/{document_id}/download")
async def download_document(document_id: str, pool=Depends(get_pool)):
    from . import store, upload
    from pathlib import Path
    from fastapi.responses import FileResponse
    docs = await store.get_documents(pool)
    doc_ids = [d["document_id"] for d in docs]
    if document_id not in doc_ids:
        raise HTTPException(status_code=404, detail="Document not found")
    upload.ensure_upload_dir()
    file_path = None
    for search_dir in [upload.UPLOAD_DIR, Path("."), Path("./files")]:
        if search_dir.exists():
            c = search_dir / document_id
            if c.exists() and c.is_file():
                file_path = c
                break
            for f in search_dir.iterdir():
                try:
                    if f.is_file() and (f.name == document_id or f.name == Path(document_id).name or f.stem == Path(document_id).stem):
                        file_path = f
                        break
                except:
                    pass
            if file_path:
                break
    if not file_path or not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")
    original_name = await store.get_document_metadata(pool, document_id)
    return FileResponse(path=file_path, filename=original_name, media_type='application/octet-stream')
