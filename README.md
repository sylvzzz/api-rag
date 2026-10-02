# rag-api

A REST API that answers questions about your documents. It reads a file, splits it into chunks, turns each chunk into a vector, stores the vectors in Postgres, then finds the chunks closest to a question and asks a language model to answer from them.

That last part is RAG: retrieval augmented generation. The model never learns your documents. You look up the relevant parts at question time and paste them into the prompt.

<img src="img/chat.png">
<img src="img/upload.png">

## How it works

Every chunk becomes a list of 2048 numbers. Two texts about the same topic end up with similar numbers, because the embedding model was trained to place them close together. A question goes through the same process, and Postgres sorts the chunks by how close they are to that question.

`app/store.py` does the sorting with one operator:

```sql
ORDER BY embedding <=> $1::vector LIMIT $2
```

`<=>` is cosine distance, so lower is closer. The five closest chunks go into the prompt.

`app/embed.py` needs one argument that trips people up. `input_type` is `passage` when indexing a document and `query` when embedding a question. Same model, same function, two modes. Get it wrong and retrieval quietly returns the wrong chunks. There is no error, only bad answers.

## Requirements

- Python 3.10 or newer
- Postgres 15 or newer with the pgvector extension
- A free NVIDIA API key from https://build.nvidia.com/ (embeddings)
- A free Groq API key from https://console.groq.com/keys (chat)

Check that pgvector is available:

```bash
ls /usr/share/postgresql/*/extension/vector*
```

If nothing shows up: `sudo apt install postgresql-18-pgvector`

## Setup

Create the role and database:

```bash
sudo -u postgres psql -c "CREATE ROLE your_username LOGIN PASSWORD 'choose-something'"
sudo -u postgres psql -c "CREATE DATABASE rag OWNER your_username"
```

Install the dependencies and copy the environment file:

```bash
make install
cp .env.example .env
cp docker-compose-example.yml docker-compose.yml
```

Fill in `.env`:

```
NVIDIA_API_KEY=nvapi-...
DATABASE_URL=postgresql://your_username:your_password@localhost:5432/rag
GROQ_API_KEY=gsk-...
LLM_BASE_URL=https://api.groq.com/openai/v1
LLM_MODEL=qwen/qwen3.8-27b
LLM_API_KEY=gsk-...
```

Fill in `docker-compose.yml`:

```
  image: pgvector/pgvector:pg16
    environment:
      POSTGRES_USER: your_username
      POSTGRES_PASSWORD: your_password
      POSTGRES_DB: rag
    ports:
      - "5432:5432"
```

```
  app:
    build: .
    env_file: .env
    environment:
      DATABASE_URL: postgresql://your_username:your_password@localhost:5432/rag
```

Each variable on its own line. A missing newline between two lines silently merges them, and the second variable disappears.

To see which chat models your key can reach:

```bash
curl -s https://api.groq.com/openai/v1/models \
  -H "Authorization: Bearer $GROQ_API_KEY"
```

## Providers

Embeddings and chat come from different services. `app/main.py` builds two clients at startup, and the routes depend on the one they need.

| Part | Provider | Why |
|---|---|---|
| Embeddings | NVIDIA | `nvidia/nemotron-3-embed-1b`, 2048 dimensions |
| Chat | Groq | `qwen/qwen3.8-27b` answers in under two seconds |

Both clients set a 30 second timeout. Without it a provider that stops responding leaves a request hanging until the client gives up on its own schedule, which is minutes.

To move the chat model to another provider, change `LLM_BASE_URL` and `LLM_API_KEY`. Any OpenAI-compatible endpoint works, which is most of them.

## Running

```bash
make server
```

The server starts on http://localhost:8000. Interactive docs are at http://localhost:8000/docs.

`make install` creates the virtualenv and installs dependencies. It runs on its own first, so you can call `make server` on a fresh clone and it will set things up.

## Using it

Add a document. The text is split into chunks and each one is stored:

```bash
make ui  # starts the frontend with upload and chat pages 
```

Re-sending the same `document_id` replaces the earlier version instead of duplicating it.


The reply has the answer and the chunks that produced it:

```json
{
  "answer": "The room costs 80 euros per night.",
  "sources": [{"document_id": "hotel", "text": "..."}]
}
```

`sources` is worth reading. When an answer comes out wrong, those chunks tell you whether the retrieval failed or the model did.

I have made 2 helper scripts to test the API before making the Web App:

```bash
python3 testers/cli.py  # Making a chat in the the terminal
Ask anything: How much does a night cost?
```

And for uploads

```bash
python3 testers/upload.py  # choose a file to upload
```

Both use the virtualenv, so they pick up the same dependencies the server uses. To remove it when you are done:

```bash
make clean
```

## Files

| File | What it does |
|---|---|
| `app/config.py` | Environment variables and model names |
| `app/db.py` | Database pool and the table definitions |
| `app/schemas.py` | Request and response models |
| `app/chunking.py` | Splits a document into overlapping pieces |
| `app/upload.py` | Saves the uploaded file and pulls the text out of it |
| `app/embed.py` | Calls the embedding API |
| `app/store.py` | Inserts chunks and searches by cosine distance |
| `app/chat.py` | Chat sessions and their messages in the database |
| `app/rag.py` | Search, build the prompt, call the model |
| `app/main.py` | The HTTP routes (FastAPI) |

## Notes

Re-uploading a document with the same `document_id` deletes its old chunks first, in a transaction, so a failed upload cannot leave half a document behind.

There is no vector index. pgvector's brute force search is exact and handles up to roughly 100k chunks. Add an HNSW index when a query gets slow, not before.

If you change `EMBED_MODEL`, change `EMBED_DIM` on the line below it as well and drop the chunks table. Vectors from one model cannot be compared with vectors from another, and the dimension mismatch is the only thing Postgres will warn you about.

## Problems faced in development

**`input[0] length 177732 exceeds maximum of 65536 characters`** — Some docs exceeded model capacity. Now documents get split before they are sent.

**`The model ... has reached its end of life`** — NVIDIA descontinued a model i have used in another project, so i had to refactor some parts. Picked another from the `/v1/models` list and update `EMBED_MODEL`. The dimensions usually change with it.
