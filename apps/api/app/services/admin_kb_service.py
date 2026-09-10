"""Read-only view of a business's knowledge base for the admin panel.

"Knowledge base" means whatever the AI is actually working from, which differs
by vertical: a restaurant's is its menu (categories → items → modifiers), a
salon's is its services plus the staff and hours that drive availability. The
voice prompt is included because the agent's instructions are as much a part of
what it "knows" as the catalogue.

Every source is fetched independently — one missing piece should grey out a
section, not blank the whole tab.
"""

from app.core.logging import get_logger
from app.core.supabase import get_supabase_admin
from app.models.admin import AdminKbVoice, AdminKnowledgeBase
from app.services import menu_service

log = get_logger(__name__)


def _voice(workspace_id: str) -> AdminKbVoice | None:
    try:
        res = (
            get_supabase_admin()
            .table("voice_settings")
            .select("enabled, system_prompt, greeting, voice, model, language")
            .eq("workspace_id", workspace_id)
            .limit(1)
            .execute()
        )
        return AdminKbVoice(**res.data[0]) if res.data else None
    except Exception as exc:
        log.error("kb_voice_failed", workspace_id=workspace_id, error=str(exc))
        return None


def get_knowledge_base(workspace_id: str) -> AdminKnowledgeBase:
    kb = AdminKnowledgeBase(voice=_voice(workspace_id))

    try:
        kb.categories = menu_service.list_categories(workspace_id)
    except Exception as exc:
        log.error("kb_categories_failed", workspace_id=workspace_id, error=str(exc))
    try:
        kb.items = menu_service.list_items(workspace_id)
    except Exception as exc:
        log.error("kb_items_failed", workspace_id=workspace_id, error=str(exc))
    return kb
