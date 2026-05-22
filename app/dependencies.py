from fastapi import Request


def get_lang(request: Request) -> str:
    lang = request.headers.get("Accept-Language", "es")
    if lang not in ["es", "en"]:
        return "es"
    return lang
