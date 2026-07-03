from datetime import datetime

from pydantic import BaseModel, Field


class MenuModifierOption(BaseModel):
    id: str
    group_id: str
    name: str
    price_delta_cents: int
    is_default: bool
    sort_order: int


class MenuModifierOptionCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    price_delta_cents: int = 0
    is_default: bool = False
    sort_order: int = 0


class MenuModifierOptionUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    price_delta_cents: int | None = None
    is_default: bool | None = None
    sort_order: int | None = None


class MenuModifierGroup(BaseModel):
    id: str
    item_id: str
    name: str
    min_select: int
    max_select: int
    required: bool
    sort_order: int
    options: list[MenuModifierOption] = []


class MenuModifierGroupCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    min_select: int = Field(default=0, ge=0)
    max_select: int = Field(default=1, ge=1)
    required: bool = False
    sort_order: int = 0


class MenuModifierGroupUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    min_select: int | None = Field(default=None, ge=0)
    max_select: int | None = Field(default=None, ge=1)
    required: bool | None = None
    sort_order: int | None = None


class MenuItem(BaseModel):
    id: str
    workspace_id: str
    category_id: str
    name: str
    description: str | None
    price_cents: int
    image_url: str | None
    is_active: bool
    sort_order: int
    created_at: datetime
    updated_at: datetime
    modifier_groups: list[MenuModifierGroup] = []


class MenuItemCreate(BaseModel):
    category_id: str
    name: str = Field(..., min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    price_cents: int = Field(..., ge=0)
    image_url: str | None = None
    is_active: bool = True
    sort_order: int = 0


class MenuItemUpdate(BaseModel):
    category_id: str | None = None
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    price_cents: int | None = Field(default=None, ge=0)
    image_url: str | None = None
    is_active: bool | None = None
    sort_order: int | None = None


class MenuCategory(BaseModel):
    id: str
    workspace_id: str
    name: str
    description: str | None
    sort_order: int
    is_active: bool
    created_at: datetime
    updated_at: datetime
    item_count: int = 0


class MenuCategoryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=500)
    sort_order: int = 0
    is_active: bool = True


class MenuCategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=500)
    sort_order: int | None = None
    is_active: bool | None = None


class MenuImportRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=20000)


class MenuImportResult(BaseModel):
    categories_created: int
    items_created: int
    modifier_groups_created: int
    modifier_options_created: int
