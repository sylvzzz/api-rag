import os

from dotenv import load_dotenv

load_dotenv()

NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1"
GROQ_BASE_URL = "https://api.groq.com/openai/v1"

# Two lines together on purpose. Swapping the model without swapping the
# dimension breaks inserts silently. Change both or neither.
EMBED_MODEL = "nvidia/nemotron-3-embed-1b"
EMBED_DIM = 2048

LLM_MODEL = os.environ["LLM_MODEL"]
LLM_BASE_URL = os.environ["LLM_BASE_URL"]
LLM_API_KEY = os.environ["LLM_API_KEY"]
EMBED_API_KEY = os.environ["NVIDIA_API_KEY"]
DATABASE_URL = os.environ["DATABASE_URL"]
