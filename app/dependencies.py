from fastapi import Request
from app.config.i18n import get_text

def get_lang(request: Request) -> str:
    return getattr(request.state, 'lang', 'es')

def t(key: str, request: Request) -> str:
    lang = get_lang(request)
    return get_text(key, lang)
