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

function money(cents: number, symbol = '$') {
  return `${symbol}${(cents / 100).toFixed(2)}`;
}

function lineKey(itemId: string, optionIds: string[]) {
  return `${itemId}::${[...optionIds].sort().join(',')}`;
}

interface KioskManualOrderProps {
  token: string;
  accentColor: string;
  onExit: () => void;
}

export function KioskManualOrder({ token, accentColor, onExit }: KioskManualOrderProps) {
  const [menu, setMenu] = useState<KioskMenu | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [configuring, setConfiguring] = useState<KioskMenuItem | null>(null);
  const [placing, setPlacing] = useState(false);
  const [confirmed, setConfirmed] = useState<{ number: string | null; total: string | null } | null>(
    null,
  );

  useEffect(() => {
    let active = true;
    getKioskMenu(token).then((res) => {
      if (!active) return;
      if ('error' in res) setLoadError(res.error.message);
      else setMenu(res.data);
    });
    return () => {
      active = false;
    };
  }, [token]);

  const symbol = menu?.currency_symbol ?? '$';
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
        <h1 className="text-4xl font-black text-white">Order placed!</h1>
        {confirmed.number && (
          <p className="mt-3 text-2xl font-bold text-white/90">Order {confirmed.number}</p>
        )}
        {confirmed.total && <p className="mt-1 text-lg text-white/60">{confirmed.total}</p>}
        <button
          type="button"
          onClick={onExit}
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
        <h1 className="text-2xl font-black text-white">Tap to order</h1>
        <button
          type="button"
          onClick={onExit}
          className="flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white/80 hover:bg-white/20"
        >
          <X className="h-4 w-4" /> Back to voice
        </button>
      </div>

      {loadError ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-center text-white/70">{loadError}</p>
        </div>
      ) : !menu ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-white/50" />
        </div>
      ) : (
        <div className="flex flex-1 gap-4 overflow-hidden">
          {/* Menu */}
          <div className="flex-1 overflow-y-auto pr-1">
            {menu.categories.map((cat) => (
              <div key={cat.id} className="mb-5">
                <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-white/50">
                  {cat.name}
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {cat.items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onItemTap(item)}
                      className="rounded-xl border border-white/10 bg-white/5 p-3 text-left transition-colors hover:bg-white/10"
                    >
                      <p className="text-sm font-semibold text-white">{item.name}</p>
                      <p className="mt-1 text-xs text-white/50">
                        {money(item.price_cents, symbol)}
                        {item.modifier_groups.length > 0 && ' · options'}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Cart */}
          <div className="flex w-64 flex-shrink-0 flex-col rounded-xl border border-white/10 bg-black/20">
            <div className="flex items-center gap-2 border-b border-white/10 p-3 text-white/80">
              <ShoppingCart className="h-4 w-4" />
              <span className="text-sm font-semibold">Your order ({cartCount})</span>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {cart.length === 0 ? (
                <p className="px-2 py-6 text-center text-xs text-white/40">
                  Tap items to add them here.
                </p>
              ) : (
                cart.map((l) => (
                  <div key={l.key} className="mb-2 rounded-lg bg-white/5 p-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white">{l.item.name}</p>
                        {l.optionNames.length > 0 && (
                          <p className="truncate text-[11px] text-white/50">
                            {l.optionNames.join(', ')}
                          </p>
                        )}
                        <p className="text-xs text-white/60">{money(l.unitCents, symbol)}</p>
                      </div>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => changeQty(l.key, -1)}
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-white"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-5 text-center text-sm font-semibold text-white">
                        {l.qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => changeQty(l.key, 1)}
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-white"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="border-t border-white/10 p-3">
              <div className="mb-2 flex justify-between text-sm text-white/70">
                <span>Subtotal</span>
                <span className="font-semibold text-white">{money(cartTotal, symbol)}</span>
              </div>
              <p className="mb-2 text-[10px] text-white/40">Tax added at checkout.</p>
              <button
                type="button"
                onClick={submit}
                disabled={cart.length === 0 || placing}
                className="flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-bold text-white disabled:opacity-40"
                style={{ background: accentColor }}
              >
                {placing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Place order'}
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
  onCancel,
  onConfirm,
}: {
  item: KioskMenuItem;
  accentColor: string;
  symbol: string;
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
                      {o.price_delta_cents > 0 ? `+${money(o.price_delta_cents, symbol)}` : ''}
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
