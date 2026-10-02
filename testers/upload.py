import json
from pathlib import Path
from urllib.request import Request, urlopen

from pypdf import PdfReader


def read_file(path: str) -> str:
    if path.lower().endswith(".pdf"):
        pages = PdfReader(path).pages
        return "\n".join(page.extract_text() or "" for page in pages)

    return Path(path).read_text(encoding="utf-8")


def send_file(path: str) -> dict:
    body = json.dumps(
        {"document_id": path, "text": read_file(path)}
    ).encode()
    request = Request(
        "http://localhost:8000/ingest",
        data=body,
        headers={"Content-Type": "application/json"},
    )
    return json.load(urlopen(request))


if __name__ == "__main__":
    try:
        path = input('File to upload (quote it if it has spaces): ')
        path = path.strip('"').strip("'")
        path = "files/" + path
        try:
            print(f"File uploaded with success!")
        except FileNotFoundError:
            print(f"File not found: {path}")
    except KeyboardInterrupt:
        print()
    except ImportError as error:
            print("Missing dependencies ...")
            print("Please run pip install requests pypdf ...")
