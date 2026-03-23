from typing import Dict, Any
from .lang_es import lang_es
from .lang_en import lang_en

languages: Dict[str, Dict[str, Any]] = {
    "es": lang_es,
    "en": lang_en,
}

def get_text(key: str, lang: str = "es") -> str:
    if lang not in languages:
        lang = "es"

    keys = key.split(".")
    value = languages[lang]

    for k in keys:
        if isinstance(value, dict) and k in value:
            value = value[k]
        else:
            return key

    return str(value) if not isinstance(value, dict) else key

def get_translation_dict(lang: str = "es") -> Dict[str, Any]:
    if lang not in languages:
        lang = "es"
    return languages[lang]
