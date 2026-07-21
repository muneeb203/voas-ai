'use client';

import { useEffect, useState } from 'react';
import { Loader2, Minus, Plus, ShoppingCart, X, Check } from 'lucide-react';
import {
  getKioskMenu,
  placeManualOrder,
  type KioskMenu,
  type KioskMenuItem,
  type KioskMenuOption,
  type ManualOrderLine,
} from '@/lib/api/kiosk-public';

interface CartLine {
  key: string; // item id + sorted option ids, so same config stacks
  item: KioskMenuItem;
  optionIds: string[];
  optionNames: string[];
  unitCents: number; // base + option deltas, for display only
  qty: number;
}

function money(cents: number, symbol = '$', decimals = 2) {
  const sep = symbol.length > 1 ? ' ' : '';
  const amount = (cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${symbol}${sep}${amount}`;
}

function lineKey(itemId: string, optionIds: string[]) {
  return `${itemId}::${[...optionIds].sort().join(',')}`;
}

interface KioskManualOrderProps {
  token: string;
  accentColor: string;
  isLight: boolean;
  // In 'manual only' mode there's no voice to return to, so the exit button hides.
  canExit: boolean;
  onExit: () => void;
}

// One palette so the panel reads correctly on the light theme (dark text on the
// off-white kiosk background) as well as the dark themes (white text).
function palette(isLight: boolean) {
  return isLight
    ? {
        textMain: 'text-[#0A2540]',
        textMuted: 'text-slate-500',
        textFaint: 'text-slate-400',
        border: 'border-[#0A2540]/10',
        tileBg: 'border-[#0A2540]/10 bg-[#0A2540]/[0.03] hover:bg-[#0A2540]/[0.07]',
        cartBg: 'border-[#0A2540]/10 bg-[#0A2540]/[0.03]',
        lineBg: 'bg-[#0A2540]/[0.05]',
        chip: 'bg-[#0A2540]/10 text-[#0A2540]',
        backBtn: 'bg-[#0A2540]/10 text-[#0A2540] hover:bg-[#0A2540]/20',
      }
    : {
        textMain: 'text-white',
        textMuted: 'text-white/50',
        textFaint: 'text-white/40',
        border: 'border-white/10',
        tileBg: 'border-white/10 bg-white/5 hover:bg-white/10',
        cartBg: 'border-white/10 bg-black/20',
        lineBg: 'bg-white/5',
        chip: 'bg-white/10 text-white',
        backBtn: 'bg-white/10 text-white/80 hover:bg-white/20',
      };
}

export function KioskManualOrder({ token, accentColor, isLight, canExit, onExit }: KioskManualOrderProps) {
  const c = palette(isLight);
  const [menu, setMenu] = useState<KioskMenu | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [configuring, setConfiguring] = useState<KioskMenuItem | null>(null);
  const [placing, setPlacing] = useState(false);
  const [confirmed, setConfirmed] = useState<{ number: string | null; total: string | null } | null>(
    null,
  );
  // McDonald's-style: one category shown at a time, chosen from a rail.
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    let active = true;
    getKioskMenu(token).then((res) => {
      if (!active) return;
      if ('error' in res) setLoadError(res.error.message);
      else {
        setMenu(res.data);
        setActiveCat(res.data.categories[0]?.id ?? null);
      }
    });
    return () => {
      active = false;
    };
  }, [token]);

  const symbol = menu?.currency_symbol ?? '$';
  const decimals = menu?.currency_decimals ?? 2;
  const cartCount = cart.reduce((n, l) => n + l.qty, 0);
  const cartTotal = cart.reduce((n, l) => n + l.unitCents * l.qty, 0);

  function addToCart(item: KioskMenuItem, optionIds: string[]) {
    const options = item.modifier_groups
      .flatMap((g) => g.options)
      .filter((o) => optionIds.includes(o.id));
    const delta = options.reduce((n, o) => n + o.price_delta_cents, 0);
    const key = lineKey(item.id, optionIds);
    setCart((prev) => {
      const existing = prev.find((l) => l.key === key);
      if (existing) {
        return prev.map((l) => (l.key === key ? { ...l, qty: l.qty + 1 } : l));
      }
      return [
        ...prev,
        {
          key,
          item,
          optionIds,
          optionNames: options.map((o) => o.name),
          unitCents: item.price_cents + delta,
          qty: 1,
        },
      ];
    });
  }

  function onItemTap(item: KioskMenuItem) {
    if (item.modifier_groups.length > 0) {
      setConfiguring(item);
    } else {
      addToCart(item, []);
    }
  }

  function changeQty(key: string, delta: number) {
    setCart((prev) =>
      prev
        .map((l) => (l.key === key ? { ...l, qty: l.qty + delta } : l))
        .filter((l) => l.qty > 0),
    );
  }

  async function submit() {
    if (!cart.length || placing) return;
    setPlacing(true);
    const items: ManualOrderLine[] = cart.map((l) => ({
      item_id: l.item.id,
      quantity: l.qty,
      option_ids: l.optionIds,
    }));
    const res = await placeManualOrder(token, items);
    setPlacing(false);
    if ('error' in res) {
      setLoadError(res.error.message);
      return;
    }
    setConfirmed({ number: res.data.order_number, total: res.data.total });
    setCart([]);
  }

  // ── Confirmation ──
  if (confirmed) {
    return (
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div
          className="mb-6 flex h-24 w-24 items-center justify-center rounded-full"
          style={{ background: `${accentColor}22` }}
        >
          <Check className="h-12 w-12" style={{ color: accentColor }} />
        </div>
        <h1 className={`text-4xl font-black ${c.textMain}`}>Order placed!</h1>
        {confirmed.number && (
          <p className={`mt-3 text-2xl font-bold ${c.textMain}`}>Order {confirmed.number}</p>
        )}
        {confirmed.total && <p className={`mt-1 text-lg ${c.textMuted}`}>{confirmed.total}</p>}
        <button
          type="button"
          onClick={() => {
            // 'both' mode: hand back to the voice home screen. 'manual only':
            // there's no voice, so reset to a fresh menu for the next customer.
            if (canExit) {
              onExit();
            } else {
              setConfirmed(null);
              setCartOpen(false);
              setActiveCat(menu?.categories[0]?.id ?? null);
            }
          }}
          className="mt-10 rounded-full px-8 py-3 text-lg font-semibold text-white"
          style={{ background: accentColor }}
        >
          Done
        </button>
      </div>
    );
  }

  return (
    <div className="relative z-10 flex flex-1 flex-col overflow-hidden px-4 pb-4">
      <div className="mb-3 flex items-center justify-between">
        <h1 className={`text-2xl font-black ${c.textMain}`}>Tap to order</h1>
        {canExit && (
          <button
            type="button"
            onClick={onExit}
            className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium ${c.backBtn}`}
          >
            <X className="h-4 w-4" /> Back to voice
          </button>
        )}
      </div>

      {loadError ? (
        <div className="flex flex-1 items-center justify-center">
          <p className={`text-center ${c.textMuted}`}>{loadError}</p>
        </div>
      ) : !menu ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className={`h-8 w-8 animate-spin ${c.textMuted}`} />
        </div>
      ) : (
        <div className="flex flex-1 gap-4 overflow-hidden">
          {/* Category rail — always visible, one tap to switch */}
          <nav className="w-44 flex-shrink-0 space-y-1 overflow-y-auto pr-1">
            {menu.categories.map((cat) => {
              const on = cat.id === activeCat;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCat(cat.id)}
                  className={`w-full rounded-lg px-3 py-3 text-left text-sm font-semibold transition-colors ${
                    on ? 'text-white' : `${c.tileBg} border ${c.textMain}`
                  }`}
                  style={on ? { background: accentColor } : undefined}
                >
                  {cat.name}
                  <span className={`ml-1 text-xs font-normal ${on ? 'text-white/70' : c.textMuted}`}>
                    ({cat.items.length})
                  </span>
                </button>
              );
            })}
          </nav>

          {/* Items for the selected category */}
          <div className="flex-1 overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {menu.categories
                .find((cat) => cat.id === activeCat)
                ?.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onItemTap(item)}
                    className={`rounded-xl border p-4 text-left transition-colors ${c.tileBg}`}
                  >
                    <p className={`text-base font-semibold ${c.textMain}`}>{item.name}</p>
                    <p className={`mt-1 text-sm ${c.textMuted}`}>
                      {money(item.price_cents, symbol, decimals)}
                      {item.modifier_groups.length > 0 && ' · options'}
                    </p>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Floating "view order" button — appears once something's in the cart */}
      {cartCount > 0 && !cartOpen && (
        <button
          type="button"
          onClick={() => setCartOpen(true)}
          className="absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-full px-7 py-4 text-base font-bold text-white shadow-xl"
          style={{ background: accentColor }}
        >
          <ShoppingCart className="h-5 w-5" />
          View order ({cartCount})
          <span className="opacity-80">·</span>
          {money(cartTotal, symbol, decimals)}
        </button>
      )}

      {/* Cart drawer */}
      {cartOpen && (
        <div className="absolute inset-0 z-20 flex justify-end bg-black/40" onClick={() => setCartOpen(false)}>
          <div
            className={`flex h-full w-full max-w-sm flex-col ${isLight ? 'bg-[#fafaf8]' : 'bg-[#0A2540]'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`flex items-center justify-between border-b p-4 ${c.border}`}>
              <span className={`text-lg font-bold ${c.textMain}`}>Your order ({cartCount})</span>
              <button
                type="button"
                onClick={() => setCartOpen(false)}
                className={`rounded-full p-1.5 ${c.chip}`}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {cart.map((l) => (
                <div key={l.key} className={`mb-2 rounded-lg p-3 ${c.lineBg}`}>
                  <p className={`text-sm font-medium ${c.textMain}`}>{l.item.name}</p>
                  {l.optionNames.length > 0 && (
                    <p className={`text-[11px] ${c.textMuted}`}>{l.optionNames.join(', ')}</p>
                  )}
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => changeQty(l.key, -1)}
                        className={`flex h-7 w-7 items-center justify-center rounded-full ${c.chip}`}
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className={`w-5 text-center text-sm font-semibold ${c.textMain}`}>
                        {l.qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => changeQty(l.key, 1)}
                        className={`flex h-7 w-7 items-center justify-center rounded-full ${c.chip}`}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <span className={`text-sm ${c.textMuted}`}>
                      {money(l.unitCents * l.qty, symbol, decimals)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className={`border-t p-4 ${c.border}`}>
              <div className={`mb-1 flex justify-between text-sm ${c.textMuted}`}>
                <span>Subtotal</span>
                <span className={`font-semibold ${c.textMain}`}>{money(cartTotal, symbol, decimals)}</span>
              </div>
              <p className={`mb-3 text-[10px] ${c.textFaint}`}>Tax added at checkout.</p>
              <button
                type="button"
                onClick={submit}
                disabled={cart.length === 0 || placing}
                className="flex w-full items-center justify-center gap-2 rounded-lg py-4 text-base font-bold text-white disabled:opacity-40"
                style={{ background: accentColor }}
              >
                {placing ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Place order'}
              </button>
            </div>
          </div>
        </div>
      )}

      {configuring && (
        <ModifierPicker
          item={configuring}
          accentColor={accentColor}
          symbol={symbol}
          decimals={decimals}
          onCancel={() => setConfiguring(null)}
          onConfirm={(optionIds) => {
            addToCart(configuring, optionIds);
            setConfiguring(null);
          }}
        />
      )}
    </div>
  );
}

// ── Modifier picker ──

function ModifierPicker({
  item,
  accentColor,
  symbol,
  decimals,
  onCancel,
  onConfirm,
}: {
  item: KioskMenuItem;
  accentColor: string;
  symbol: string;
  decimals: number;
  onCancel: () => void;
  onConfirm: (optionIds: string[]) => void;
}) {
  // Pre-select defaults for required single-choice groups so the picker opens valid.
  const [selected, setSelected] = useState<Record<string, string[]>>(() => {
    const init: Record<string, string[]> = {};
    for (const g of item.modifier_groups) {
      const def = g.options.find((o) => o.is_default);
      init[g.id] = g.required && g.max_select === 1 && def ? [def.id] : [];
    }
    return init;
  });

  function toggle(group: KioskMenuItem['modifier_groups'][number], opt: KioskMenuOption) {
    setSelected((prev) => {
      const cur = prev[group.id] ?? [];
      if (group.max_select === 1) {
        return { ...prev, [group.id]: [opt.id] };
      }
      if (cur.includes(opt.id)) {
        return { ...prev, [group.id]: cur.filter((id) => id !== opt.id) };
      }
      if (cur.length >= group.max_select) return prev; // at limit
      return { ...prev, [group.id]: [...cur, opt.id] };
    });
  }

  const unmetRequired = item.modifier_groups.filter(
    (g) => g.required && (selected[g.id]?.length ?? 0) < Math.max(1, g.min_select),
  );
  const canConfirm = unmetRequired.length === 0;

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 p-4">
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl bg-[#0A2540] p-5 text-white shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">{item.name}</h2>
          <button type="button" onClick={onCancel} className="rounded-full bg-white/10 p-1.5">
            <X className="h-4 w-4" />
          </button>
        </div>

        {item.modifier_groups.map((g) => (
          <div key={g.id} className="mb-4">
            <p className="mb-1.5 text-sm font-semibold">
              {g.name}
              <span className="ml-2 text-xs font-normal text-white/50">
                {g.required ? 'Required' : 'Optional'}
                {g.max_select > 1 ? ` · up to ${g.max_select}` : ''}
              </span>
            </p>
            <div className="space-y-1.5">
              {g.options.map((o) => {
                const on = (selected[g.id] ?? []).includes(o.id);
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => toggle(g, o)}
                    className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm ${
                      on ? 'border-transparent text-white' : 'border-white/15 text-white/80'
                    }`}
                    style={on ? { background: accentColor } : undefined}
                  >
                    <span>{o.name}</span>
                    <span className="text-xs opacity-80">
                      {o.price_delta_cents > 0 ? `+${money(o.price_delta_cents, symbol, decimals)}` : ''}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={() => onConfirm(Object.values(selected).flat())}
          disabled={!canConfirm}
          className="mt-2 w-full rounded-lg py-3 text-sm font-bold text-white disabled:opacity-40"
          style={{ background: accentColor }}
        >
          {canConfirm ? 'Add to order' : 'Choose required options'}
        </button>
      </div>
    </div>
  );
}
