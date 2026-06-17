'use client';

import { useState, useTransition, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CircleHelp, X, Send, Loader2 } from 'lucide-react';
import { helpChatAction } from '@/app/actions/help-action';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { HelpChatTurn } from '@/lib/types';

const GREETING =
  "Hi! I'm the VOAS help assistant. Ask me how to set up voice, WhatsApp, your menu, team invites, or find things in the dashboard.";

export function HelpBot() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<HelpChatTurn[]>([
    { role: 'assistant', content: GREETING },
  ]);
  const [pending, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [open, messages, pending]);

  function sendMessage() {
    const text = input.trim();
    if (!text || pending) return;

    const userTurn: HelpChatTurn = { role: 'user', content: text };
    const history = [...messages, userTurn];
    setMessages(history);
    setInput('');

    startTransition(async () => {
      const prior = history
        .slice(0, -1)
        .filter((m) => !(m.role === 'assistant' && m.content === GREETING));
      const result = await helpChatAction(text, pathname, prior);
      if (result.error) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: result.error ?? 'Something went wrong. Try Support in the sidebar.',
          },
        ]);
        return;
      }
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: result.reply ?? 'No reply received.' },
      ]);
    });
  }

  return (
    <>
      {open && (
        <div
          className="fixed bottom-24 right-4 z-50 flex w-[min(100vw-2rem,380px)] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-lg"
          role="dialog"
          aria-label="VOAS help assistant"
        >
          <div className="flex items-center justify-between border-b border-border bg-brand px-4 py-3 text-white">
            <div>
              <p className="text-sm font-semibold">VOAS Help</p>
              <p className="text-xs text-white/80">Product guide · powered by Gemini</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/10 hover:text-white"
              onClick={() => setOpen(false)}
              aria-label="Close help"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div ref={scrollRef} className="max-h-80 flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((msg, i) => (
              <div
                key={`${msg.role}-${i}`}
                className={cn(
                  'max-w-[90%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap',
                  msg.role === 'user'
                    ? 'ml-auto bg-accent/15 text-foreground'
                    : 'mr-auto bg-muted text-foreground',
                )}
              >
                {msg.content}
              </div>
            ))}
            {pending && (
              <div className="mr-auto flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Thinking…
              </div>
            )}
          </div>

          <div className="border-t border-border p-3">
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage();
              }}
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask how to set something up…"
                className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                disabled={pending}
                maxLength={2000}
              />
              <Button type="submit" size="icon" disabled={pending || !input.trim()} aria-label="Send">
                <Send className="h-4 w-4" />
              </Button>
            </form>
            <p className="mt-2 text-center text-[10px] text-muted-foreground">
              Billing or bugs?{' '}
              <Link href="/support" className="underline hover:text-foreground">
                Open Support
              </Link>
            </p>
          </div>
        </div>
      )}

      <Button
        type="button"
        size="icon"
        className="fixed bottom-6 right-4 z-50 h-12 w-12 rounded-full shadow-md"
        variant={open ? 'secondary' : 'default'}
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close help' : 'Open help'}
        aria-expanded={open}
      >
        {open ? <X className="h-5 w-5" /> : <CircleHelp className="h-5 w-5" />}
      </Button>
    </>
  );
}
