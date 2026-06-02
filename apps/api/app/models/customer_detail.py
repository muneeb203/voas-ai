"""CustomerDetail lives in its own module on purpose.

It references both Order and Conversation. Conversation already imports
Customer (for ConversationDetail), so defining CustomerDetail inside
customer.py would create a customer <-> conversation import cycle that breaks
depending on which module loads first. Keeping it here — imported only by the
customers service/router (leaf consumers) — sidesteps the cycle entirely.
"""

from app.models.conversation import Conversation
from app.models.customer import Customer
from app.models.order import Order


class CustomerDetail(Customer):
    recent_orders: list[Order]
    recent_conversations: list[Conversation]
