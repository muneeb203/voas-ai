from pydantic import BaseModel


class DailyCount(BaseModel):
    date: str  # "YYYY-MM-DD"
    count: int


class DailyRevenue(BaseModel):
    date: str  # "YYYY-MM-DD"
    cents: int


class TopItem(BaseModel):
    name: str
    count: int
    revenue_cents: int


class HourlyCount(BaseModel):
    hour: int  # 0-23
    count: int


class AnalyticsSummary(BaseModel):
    # Conversations
    total_conversations: int
    conversations_by_channel: dict[str, int]
    conversations_by_status: dict[str, int]
    conversations_by_outcome: dict[str, int]
    avg_duration_seconds: float | None
    avg_sentiment: float | None

    # Orders
    total_orders: int
    total_revenue_cents: int
    avg_order_value_cents: float | None
    orders_by_status: dict[str, int]

    # Customers
    total_customers: int
    new_customers: int
    returning_customers: int

    # Time series (one entry per day across the range)
    daily_conversations: list[DailyCount]
    daily_orders: list[DailyCount]
    daily_revenue_cents: list[DailyRevenue]

    # Top items
    top_menu_items: list[TopItem]

    # Hourly distribution (0-23)
    conversations_by_hour: list[HourlyCount]


class TodayStats(BaseModel):
    conversations_today: int
    orders_today: int
    revenue_today_cents: int
    avg_sentiment_today: float | None
