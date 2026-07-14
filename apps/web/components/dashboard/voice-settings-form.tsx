'use client';

import { useEffect, useRef, useState } from 'react';
import { Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useActionState } from '@/lib/use-action-state';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field } from '@/components/ui/field';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  updateVoiceSettingsAction,
  type FormResult,
} from '@/app/actions/voice-action';
import type { VoiceLanguage, VoiceSettings, VoiceCapabilities } from '@/lib/types';
import {
  DEFAULT_GREETING_BY_LANG,
  DEFAULT_SYSTEM_PROMPT_BY_LANG,
  isDefaultGreeting,
  isDefaultPrompt,
} from '@/lib/voice-language-defaults';
import { VoicePromptGeneratorModal } from '@/components/dashboard/voice-prompt-generator-modal';

const INITIAL: FormResult = { error: null };

interface VoiceSettingsFormProps {
  settings: VoiceSettings;
  capabilities: VoiceCapabilities;
  disabled?: boolean;
  /** Workspace name — pre-fills the generator modal's business name field */
  workspaceName?: string;
  /** Workspace vertical — tailors the auto-generated prompt (salon vs restaurant) */
  vertical?: string;
}

export function VoiceSettingsForm({
  settings,
  capabilities,
  disabled,
  workspaceName = '',
  vertical = 'restaurant',
}: VoiceSettingsFormProps) {
  const [state, formAction, pending] = useActionState(updateVoiceSettingsAction, INITIAL);
  const fieldErrors = state.fieldErrors;
  const wasPending = useRef(false);

  type SyncPhase = 'idle' | 'saving' | 'done' | 'failed';
  const [syncPhase, setSyncPhase] = useState<SyncPhase>('idle');
  const [progress, setProgress] = useState(0);
  const [msgIdx, setMsgIdx] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const SYNC_MESSAGES = [
    'Saving your settings...',
    'Getting your AI ready...',
    'Bringing your assistant online...',
    'Almost there — final checks in progress...',
    'Just a moment more...',
  ] as const;

  // Controlled inputs so we can swap their contents when the language
  // dropdown changes. Greeting + prompt start as whatever the workspace
  // saved last; on language change we auto-swap iff the current value is
  // still a canned default (any language).
  const [language, setLanguage] = useState<VoiceLanguage>(settings.language);
  const [greeting, setGreeting] = useState<string>(settings.greeting);
  const [systemPrompt, setSystemPrompt] = useState<string>(settings.system_prompt);

  // Generator modal
  const [generatorOpen, setGeneratorOpen] = useState(false);

  // Voice selection: "custom" is a sentinel that reveals a freeform text
  // input so owners can paste any ElevenLabs voice id directly.
  const knownVoiceIds = new Set(capabilities.voices.map((v) => v.id));
  const isKnownVoice = knownVoiceIds.has(settings.voice);
  const [voiceSelect, setVoiceSelect] = useState<string>(
    isKnownVoice ? settings.voice : 'custom',
  );
  const [customVoiceId, setCustomVoiceId] = useState<string>(
    isKnownVoice ? '' : settings.voice,
  );
  // The actual value sent in the form submission.
  const effectiveVoice = voiceSelect === 'custom' ? customVoiceId.trim() : voiceSelect;

  function handleLanguageChange(next: string) {
    const nextLang = next as VoiceLanguage;
    setLanguage(nextLang);

    // Only swap the greeting/prompt if the owner hasn't customized them
    // (i.e. they still match one of the canned defaults). If they've
    // edited the text we leave it alone — owner intent wins.
    if (isDefaultGreeting(greeting)) {
      setGreeting(DEFAULT_GREETING_BY_LANG[nextLang]);
    }
    if (isDefaultPrompt(systemPrompt)) {
      setSystemPrompt(DEFAULT_SYSTEM_PROMPT_BY_LANG[nextLang]);
    }
  }

  // Split voices into "recommended for this language" vs "also works"
  const recommendedVoices = capabilities.voices.filter((v) =>
    v.best_for.includes(language),
  );
  const otherVoices = capabilities.voices.filter(
    (v) => !v.best_for.includes(language),
  );
  const isNonEnglishLang = language !== 'en';

  useEffect(() => {
    const wasP = wasPending.current;

    if (!wasP && pending) {
      // Save started
      setSyncPhase('saving');
      setProgress(4);
      setMsgIdx(0);
      const start = Date.now();
      timerRef.current = setInterval(() => {
        const elapsed = Date.now() - start;
        // Asymptotic crawl toward 84% — slows down as it gets closer
        const p = Math.floor(84 * (1 - Math.exp(-0.0005 * elapsed))) + 4;
        setProgress(Math.min(p, 84));
        setMsgIdx(Math.min(Math.floor(elapsed / 5000), SYNC_MESSAGES.length - 1));
      }, 250);
    }

    if (wasP && !pending) {
      if (timerRef.current) clearInterval(timerRef.current);

      if (state.error && !state.fieldErrors) {
        setSyncPhase('failed');
        setProgress(0);
        toast.error(state.error);
      } else if (!state.error) {
        setSyncPhase('done');
        setProgress(100);
        const dismiss = setTimeout(() => {
          setSyncPhase('idle');
          setProgress(0);
        }, 3500);
        return () => clearTimeout(dismiss);
      }
    }

    wasPending.current = pending;

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, state]);

  return (
    <form action={formAction} className="space-y-5">
      <Field
        label="Language"
        htmlFor="language"
        error={fieldErrors?.language}
        hint="Switching language auto-fills a fresh prompt and greeting in that language — unless you've customized them."
      >
        <Select
          name="language"
          value={language}
          onValueChange={handleLanguageChange}
          disabled={disabled || pending}
        >
          <SelectTrigger id="language">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {capabilities.languages.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {l.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {/* Auto-generate button — opens the template modal */}
      {!disabled && (
        <div className="flex items-center justify-between rounded-lg border border-accent/30 bg-accent/5 px-4 py-3">
          <div>
            <p className="text-sm font-medium">Not sure what to write?</p>
            <p className="text-xs text-muted-foreground">
              Generate a prompt and greeting from your tone preferences — no AI needed.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 gap-2 border-accent/40 text-accent hover:bg-accent/10 hover:text-accent"
            onClick={() => setGeneratorOpen(true)}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Auto-generate
          </Button>
        </div>
      )}

      <Field label="Greeting" htmlFor="greeting" required error={fieldErrors?.greeting}>
        <Input
          id="greeting"
          name="greeting"
          value={greeting}
          onChange={(e) => setGreeting(e.target.value)}
          required
          disabled={disabled || pending}
          dir="auto"
        />
      </Field>

      <Field
        label="System prompt"
        htmlFor="system_prompt"
        required
        error={fieldErrors?.system_prompt}
        hint="What the agent should sound like and do. Your menu is appended automatically."
      >
        <Textarea
          id="system_prompt"
          name="system_prompt"
          rows={10}
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          required
          disabled={disabled || pending}
          className="font-mono text-xs"
          dir="auto"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Voice"
          htmlFor="voice-select"
          error={fieldErrors?.voice}
          hint={
            isNonEnglishLang && voiceSelect !== 'custom'
              ? recommendedVoices.some((v) => v.id === voiceSelect)
                ? undefined
                : 'This voice has a Western accent in Arabic/Urdu. Choose a multilingual voice for a more natural sound.'
              : undefined
          }
        >
          {/* Hidden input carries the real voice value for form submission */}
          <input type="hidden" name="voice" value={effectiveVoice} />
          <Select
            value={voiceSelect}
            onValueChange={setVoiceSelect}
            disabled={disabled || pending}
          >
            <SelectTrigger id="voice-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {/* Recommended for the current language */}
              {recommendedVoices.length > 0 && (
                <>
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                    {isNonEnglishLang ? '⭐ Recommended for this language' : 'Voices'}
                  </div>
                  {recommendedVoices.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.label}
                    </SelectItem>
                  ))}
                </>
              )}
              {/* Other voices (still usable, just accent-flagged) */}
              {otherVoices.length > 0 && (
                <>
                  {isNonEnglishLang && (
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                      Also works (Western accent)
                    </div>
                  )}
                  {otherVoices.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.label}
                    </SelectItem>
                  ))}
                </>
              )}
              {/* Custom escape hatch */}
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                Advanced
              </div>
              <SelectItem value="custom">Custom ElevenLabs voice ID…</SelectItem>
            </SelectContent>
          </Select>
          {/* Revealed when "Custom" is chosen */}
          {voiceSelect === 'custom' && (
            <div className="mt-2 space-y-1">
              <Input
                placeholder="e.g. 9BWtsMINqrJLrRacOk9x"
                value={customVoiceId}
                onChange={(e) => setCustomVoiceId(e.target.value)}
                disabled={disabled || pending}
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                Paste any voice ID from{' '}
                <a
                  href="https://elevenlabs.io/voice-library"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-foreground"
                >
                  ElevenLabs Voice Library
                </a>
                . Filter by Arabic or Urdu to find a native-accent voice.
              </p>
            </div>
          )}
        </Field>

        <Field label="LLM" htmlFor="model" error={fieldErrors?.model}>
          <Select name="model" defaultValue={settings.model} disabled={disabled || pending}>
            <SelectTrigger id="model">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {capabilities.models.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="enabled"
          defaultChecked={settings.enabled}
          className="h-4 w-4 rounded border-input"
          disabled={disabled || pending}
        />
        Voice agent enabled (incoming calls answered)
      </label>

      <Field label="Order confirmations" htmlFor="send_order_confirmations">
        <div className="flex items-center gap-3">
          <Switch
            id="send_order_confirmations"
            name="send_order_confirmations"
            defaultChecked={settings.send_order_confirmations}
            disabled={disabled || pending}
          />
          <span className="text-sm text-muted-foreground">
            Automatically send a WhatsApp/SMS confirmation after every order
          </span>
        </div>
      </Field>

      <Button type="submit" disabled={disabled || pending}>
        {pending ? 'Saving…' : 'Save & Sync'}
      </Button>

      {syncPhase !== 'idle' && (
        <div
          className={cn(
            'rounded-lg border p-4 transition-colors',
            syncPhase === 'done'
              ? 'border-success/30 bg-success/5'
              : syncPhase === 'failed'
                ? 'border-error/30 bg-error/5'
                : 'border-border bg-secondary/30',
          )}
        >
          {/* Progress bar */}
          <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                'absolute left-0 top-0 h-full rounded-full',
                syncPhase === 'done'
                  ? 'bg-success transition-all duration-500'
                  : syncPhase === 'failed'
                    ? 'bg-error transition-all duration-200'
                    : 'bg-accent transition-all duration-300',
              )}
              style={{ width: `${progress}%` }}
            />
            {syncPhase === 'saving' && (
              <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            )}
          </div>

          {/* Status message */}
          <div className="mt-2.5 flex items-center gap-2">
            {syncPhase === 'done' && (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-success" />
                <p className="text-xs font-medium text-success">
                  Your assistant is live and ready to take calls.
                </p>
              </>
            )}
            {syncPhase === 'failed' && (
              <>
                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 text-error" />
                <p className="text-xs text-error">{state.error}</p>
              </>
            )}
            {syncPhase === 'saving' && (
              <p className="text-xs text-muted-foreground">{SYNC_MESSAGES[msgIdx]}</p>
            )}
          </div>
        </div>
      )}

      {disabled && (
        <p className="text-xs text-muted-foreground">Only workspace owners can edit voice settings.</p>
      )}

      <VoicePromptGeneratorModal
        open={generatorOpen}
        onClose={() => setGeneratorOpen(false)}
        onApply={(generatedPrompt, generatedGreeting) => {
          setSystemPrompt(generatedPrompt);
          setGreeting(generatedGreeting);
          toast.success('Prompt and greeting applied — review and save when ready.');
        }}
        workspaceName={workspaceName}
        language={language}
        vertical={vertical === 'salon' ? 'salon' : 'restaurant'}
      />
    </form>
  );
}
