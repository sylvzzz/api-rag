import os
from pathlib import Path
from pypdf import PdfReader

UPLOAD_DIR = Path("files")


def ensure_upload_dir():
    UPLOAD_DIR.mkdir(exist_ok=True)


def extract_text_from_pdf(file_path: Path) -> str:
    reader = PdfReader(file_path)
    text_parts = []
    for page in reader.pages:
        text = page.extract_text()
        if text:
            text_parts.append(text)
    return "\n\n".join(text_parts)


def extract_text_from_file(file_path: Path) -> str:
    suffix = file_path.suffix.lower()
    if suffix == ".pdf":
        return extract_text_from_pdf(file_path)
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            return f.read()
    except UnicodeDecodeError:
        try:
            with open(file_path, "r", encoding="latin-1") as f:
                return f.read()
        except Exception:
            return ""


def is_text_based(filename: str) -> bool:
    allowed = {
        ".pdf",
        ".txt",
        ".md",
        ".markdown",
        ".json",
        ".csv",
        ".tsv",
        ".xml",
        ".html",
        ".htm",
        ".rst",
        ".log",
        ".py",
        ".js",
        ".ts",
        ".jsx",
        ".tsx",
        ".java",
        ".cpp",
        ".c",
        ".h",
        ".go",
        ".rs",
        ".rb",
        ".php",
        ".sh",
        ".yaml",
        ".yml",
        ".toml",
        ".ini",
        ".cfg",
        ".conf",
    }
    return Path(filename).suffix.lower() in allowed
