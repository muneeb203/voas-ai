"""Display-currency formatting.

Amounts are always stored as minor units (cents). Currency only affects the
symbol and how many decimals are shown — never the stored value, and never a
conversion. Zero-decimal currencies (PKR) render "Rs 630", not "Rs 630.00".
"""

from __future__ import annotations

from typing import TypedDict


class _Currency(TypedDict):
    symbol: str
    decimals: int
    label: str


CURRENCIES: dict[str, _Currency] = {
    "USD": {"symbol": "$", "decimals": 2, "label": "US Dollar"},
    "PKR": {"symbol": "Rs", "decimals": 0, "label": "Pakistani Rupee"},
    "AED": {"symbol": "AED", "decimals": 2, "label": "UAE Dirham"},
    "SAR": {"symbol": "SAR", "decimals": 2, "label": "Saudi Riyal"},
    "GBP": {"symbol": "£", "decimals": 2, "label": "British Pound"},
    "EUR": {"symbol": "€", "decimals": 2, "label": "Euro"},
    "INR": {"symbol": "₹", "decimals": 2, "label": "Indian Rupee"},
}

DEFAULT_CURRENCY = "USD"


def _cfg(code: str | None) -> _Currency:
    return CURRENCIES.get((code or DEFAULT_CURRENCY).upper(), CURRENCIES[DEFAULT_CURRENCY])


def is_valid(code: str) -> bool:
    return code.upper() in CURRENCIES


def symbol_for(code: str | None) -> str:
    return _cfg(code)["symbol"]


def decimals_for(code: str | None) -> int:
    return _cfg(code)["decimals"]


def format_cents(cents: int, code: str | None) -> str:
    """e.g. (63000, 'PKR') -> 'Rs 630'; (1450, 'USD') -> '$14.50'."""
    cfg = _cfg(code)
    amount = cents / 100
    # A word-like symbol (Rs, AED, SAR) needs a space; a glyph ($, £, €) doesn't.
    sep = " " if len(cfg["symbol"]) > 1 else ""
    if cfg["decimals"] == 0:
        return f"{cfg['symbol']}{sep}{round(amount):,}"
    return f"{cfg['symbol']}{sep}{amount:,.{cfg['decimals']}f}"
