from fastapi import APIRouter, Query, status

from app.deps import OwnerContextDep, WorkspaceContextDep
from app.models.menu import (
    MenuCategory,
    MenuCategoryCreate,
    MenuCategoryUpdate,
    MenuItem,
    MenuItemCreate,
    MenuItemUpdate,
    MenuModifierGroup,
    MenuModifierGroupCreate,
    MenuModifierGroupUpdate,
    MenuModifierOption,
    MenuModifierOptionCreate,
    MenuModifierOptionUpdate,
)
from app.services import menu_service
from app.utils.responses import DataResponse, ok

router = APIRouter(tags=["menu"])


# --- Categories -------------------------------------------------------------


@router.get(
    "/workspaces/{workspace_id}/menu/categories",
    response_model=DataResponse[list[MenuCategory]],
)
async def list_categories(ctx: WorkspaceContextDep) -> DataResponse[list[MenuCategory]]:
    return ok(menu_service.list_categories(ctx.workspace_id))


@router.post(
    "/workspaces/{workspace_id}/menu/categories",
    response_model=DataResponse[MenuCategory],
    status_code=status.HTTP_201_CREATED,
)
async def create_category(
    payload: MenuCategoryCreate, ctx: OwnerContextDep
) -> DataResponse[MenuCategory]:
    return ok(menu_service.create_category(ctx.workspace_id, payload, ctx.user.id))


@router.patch(
    "/workspaces/{workspace_id}/menu/categories/{category_id}",
    response_model=DataResponse[MenuCategory],
)
async def update_category(
    category_id: str, payload: MenuCategoryUpdate, ctx: OwnerContextDep
) -> DataResponse[MenuCategory]:
    return ok(menu_service.update_category(ctx.workspace_id, category_id, payload, ctx.user.id))


@router.delete(
    "/workspaces/{workspace_id}/menu/categories/{category_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_category(category_id: str, ctx: OwnerContextDep) -> None:
    menu_service.delete_category(ctx.workspace_id, category_id, ctx.user.id)


# --- Items ------------------------------------------------------------------


@router.get(
    "/workspaces/{workspace_id}/menu/items", response_model=DataResponse[list[MenuItem]]
)
async def list_items(
    ctx: WorkspaceContextDep,
    category_id: str | None = Query(default=None),
) -> DataResponse[list[MenuItem]]:
    return ok(menu_service.list_items(ctx.workspace_id, category_id=category_id))


@router.post(
    "/workspaces/{workspace_id}/menu/items",
    response_model=DataResponse[MenuItem],
    status_code=status.HTTP_201_CREATED,
)
async def create_item(payload: MenuItemCreate, ctx: OwnerContextDep) -> DataResponse[MenuItem]:
    return ok(menu_service.create_item(ctx.workspace_id, payload, ctx.user.id))


@router.patch(
    "/workspaces/{workspace_id}/menu/items/{item_id}", response_model=DataResponse[MenuItem]
)
async def update_item(
    item_id: str, payload: MenuItemUpdate, ctx: OwnerContextDep
) -> DataResponse[MenuItem]:
    return ok(menu_service.update_item(ctx.workspace_id, item_id, payload, ctx.user.id))


@router.delete(
    "/workspaces/{workspace_id}/menu/items/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_item(item_id: str, ctx: OwnerContextDep) -> None:
    menu_service.delete_item(ctx.workspace_id, item_id, ctx.user.id)


# --- Modifier groups --------------------------------------------------------


@router.post(
    "/workspaces/{workspace_id}/menu/items/{item_id}/modifier-groups",
    response_model=DataResponse[MenuModifierGroup],
    status_code=status.HTTP_201_CREATED,
)
async def create_group(
    item_id: str, payload: MenuModifierGroupCreate, ctx: OwnerContextDep
) -> DataResponse[MenuModifierGroup]:
    return ok(menu_service.create_modifier_group(ctx.workspace_id, item_id, payload, ctx.user.id))


@router.patch(
    "/workspaces/{workspace_id}/menu/modifier-groups/{group_id}",
    response_model=DataResponse[MenuModifierGroup],
)
async def update_group(
    group_id: str, payload: MenuModifierGroupUpdate, ctx: OwnerContextDep
) -> DataResponse[MenuModifierGroup]:
    return ok(menu_service.update_modifier_group(ctx.workspace_id, group_id, payload, ctx.user.id))


@router.delete(
    "/workspaces/{workspace_id}/menu/modifier-groups/{group_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_group(group_id: str, ctx: OwnerContextDep) -> None:
    menu_service.delete_modifier_group(ctx.workspace_id, group_id, ctx.user.id)


# --- Modifier options -------------------------------------------------------


@router.post(
    "/workspaces/{workspace_id}/menu/modifier-groups/{group_id}/options",
    response_model=DataResponse[MenuModifierOption],
    status_code=status.HTTP_201_CREATED,
)
async def create_option(
    group_id: str, payload: MenuModifierOptionCreate, ctx: OwnerContextDep
) -> DataResponse[MenuModifierOption]:
    return ok(menu_service.create_modifier_option(ctx.workspace_id, group_id, payload, ctx.user.id))


@router.patch(
    "/workspaces/{workspace_id}/menu/modifier-options/{option_id}",
    response_model=DataResponse[MenuModifierOption],
)
async def update_option(
    option_id: str, payload: MenuModifierOptionUpdate, ctx: OwnerContextDep
) -> DataResponse[MenuModifierOption]:
    return ok(menu_service.update_modifier_option(ctx.workspace_id, option_id, payload, ctx.user.id))


@router.delete(
    "/workspaces/{workspace_id}/menu/modifier-options/{option_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_option(option_id: str, ctx: OwnerContextDep) -> None:
    menu_service.delete_modifier_option(ctx.workspace_id, option_id, ctx.user.id)
