'use client';

import { useState, useEffect } from 'react';
import { Sparkles } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  generateVoicePrompt,
  LANGUAGE_FORMALITY_LABELS,
  PERSONALITY_LABELS,
  FRIENDLINESS_LABELS,
  GREETING_LENGTH_LABELS,
  type Language,
  type Friendliness,
  type GreetingLength,
  type LanguageFormality,
  type BusinessPersonality,
} from '@/lib/voice-prompt-templates';

// ── Tone toggle ──────────────────────────────────────────────────────────────

function ToneToggle<T extends string>({
  label,
  optionA,
  labelA,
  optionB,
  labelB,
  value,
  onChange,
  dir,
}: {
  label: string
  optionA: T
  labelA: string
  optionB: T
  labelB: string
  value: T
  onChange: (v: T) => void
  dir?: 'rtl' | 'ltr'
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-foreground">{label}</p>
      <div className="flex overflow-hidden rounded-md border border-input">
        <button
          type="button"
          onClick={() => onChange(optionA)}
          className={`flex-1 px-3 py-1.5 text-xs transition-colors ${
            value === optionA
              ? 'bg-primary text-primary-foreground font-medium'
              : 'bg-background text-muted-foreground hover:bg-muted'
          }`}
          dir={dir}
        >
          {labelA}
        </button>
        <div className="w-px bg-input" />
        <button
          type="button"
          onClick={() => onChange(optionB)}
          className={`flex-1 px-3 py-1.5 text-xs transition-colors ${
            value === optionB
              ? 'bg-primary text-primary-foreground font-medium'
              : 'bg-background text-muted-foreground hover:bg-muted'
          }`}
          dir={dir}
        >
          {labelB}
        </button>
      </div>
    </div>
  )
}

// ── Main modal ───────────────────────────────────────────────────────────────

interface VoicePromptGeneratorModalProps {
  open: boolean
  onClose: () => void
  /** Called when user clicks "Apply" — fills the form fields */
  onApply: (systemPrompt: string, greeting: string) => void
  /** Pre-filled from the workspace name */
  workspaceName: string
  /** Current language selected in the voice settings form */
  language: Language
}

export function VoicePromptGeneratorModal({
  open,
  onClose,
  onApply,
  workspaceName,
  language,
}: VoicePromptGeneratorModalProps) {
  // Business info
  const [businessName, setBusinessName] = useState(workspaceName)
  const [description, setDescription] = useState('')

  // Tone controls — sensible defaults per language
  const [friendliness, setFriendliness] = useState<Friendliness>('friendly')
  const [greetingLength, setGreetingLength] = useState<GreetingLength>('brief')
  const [languageFormality, setLanguageFormality] = useState<LanguageFormality>('formal')
  const [businessPersonality, setBusinessPersonality] = useState<BusinessPersonality>('quick-service')

  // Sync workspace name when it changes externally
  useEffect(() => {
    setBusinessName(workspaceName)
  }, [workspaceName])

  // Re-apply language-appropriate defaults when language changes
  useEffect(() => {
    if (language === 'ar') {
      setFriendliness('formal')
      setGreetingLength('brief')
      setLanguageFormality('formal')
    } else if (language === 'ur') {
      setFriendliness('friendly')
      setGreetingLength('brief')
      setLanguageFormality('formal')
    } else {
      setFriendliness('friendly')
      setGreetingLength('brief')
      setLanguageFormality('casual')
    }
  }, [language])

  // Live-generated preview — updates on every control change
  const preview = generateVoicePrompt({
    language,
    businessName,
    description,
    friendliness,
    greetingLength,
    languageFormality,
    businessPersonality,
  })

  const formalityLabels = LANGUAGE_FORMALITY_LABELS[language]
  const personalityLabels = PERSONALITY_LABELS[language]
  const friendlinessLabels = FRIENDLINESS_LABELS[language]
  const greetingLengthLabels = GREETING_LENGTH_LABELS[language]

  // For RTL languages the preview text should render right-to-left
  const previewDir = language === 'ar' || language === 'ur' ? 'rtl' : 'ltr'

  function handleApply() {
    onApply(preview.systemPrompt, preview.greeting)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="flex max-h-[90vh] w-full max-w-2xl flex-col gap-0 overflow-hidden p-0">
        {/* Header */}
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-accent" />
            Auto-generate prompt &amp; greeting
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Adjust the controls below. The preview updates live. Apply to fill your settings fields.
          </p>
        </DialogHeader>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid gap-6 p-6 md:grid-cols-[1fr_1fr]">
            {/* Left column — inputs + controls */}
            <div className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="gen-business-name" className="text-xs font-medium">
                  Business name
                </Label>
                <Input
                  id="gen-business-name"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="e.g. The Corner Grill"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="gen-description" className="text-xs font-medium">
                  Short description{' '}
                  <span className="font-normal text-muted-foreground">(optional but recommended)</span>
                </Label>
                <Textarea
                  id="gen-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={
                    language === 'ur'
                      ? 'مثلاً: اسلام آباد میں پاکستانی کھانوں کا ریستوران'
                      : language === 'ar'
                      ? 'مثلاً: مطعم عربي في الرياض متخصص في المشويات'
                      : 'e.g. a 24-hour diner in Chicago specialising in burgers and pizza'
                  }
                  rows={2}
                  dir={previewDir}
                />
                <p className="text-xs text-muted-foreground">
                  The more detail you add, the more tailored the generated prompt will be.
                </p>
              </div>

              <div className="space-y-4 rounded-lg border border-border p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Tone controls
                </p>

                <ToneToggle<Friendliness>
                  label="Warmth"
                  optionA="formal"
                  labelA={friendlinessLabels.formal}
                  optionB="friendly"
                  labelB={friendlinessLabels.friendly}
                  value={friendliness}
                  onChange={setFriendliness}
                  dir={previewDir}
                />

                <ToneToggle<GreetingLength>
                  label="Greeting length"
                  optionA="brief"
                  labelA={greetingLengthLabels.brief}
                  optionB="detailed"
                  labelB={greetingLengthLabels.detailed}
                  value={greetingLength}
                  onChange={setGreetingLength}
                  dir={previewDir}
                />

                <ToneToggle<LanguageFormality>
                  label="Language style"
                  optionA="formal"
                  labelA={formalityLabels.formal}
                  optionB="casual"
                  labelB={formalityLabels.casual}
                  value={languageFormality}
                  onChange={setLanguageFormality}
                  dir={previewDir}
                />

                <ToneToggle<BusinessPersonality>
                  label="Business type"
                  optionA="fine-dining"
                  labelA={personalityLabels['fine-dining']}
                  optionB="quick-service"
                  labelB={personalityLabels['quick-service']}
                  value={businessPersonality}
                  onChange={setBusinessPersonality}
                  dir={previewDir}
                />
              </div>
            </div>

            {/* Right column — live preview */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-foreground">Greeting preview</p>
                <div
                  className="min-h-[60px] rounded-md border border-input bg-muted/40 px-3 py-2.5 text-sm leading-relaxed"
                  dir={previewDir}
                >
                  {preview.greeting}
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-medium text-foreground">System prompt preview</p>
                <div
                  className="max-h-72 overflow-y-auto rounded-md border border-input bg-muted/40 px-3 py-2.5 font-mono text-xs leading-relaxed whitespace-pre-wrap"
                  dir={previewDir}
                >
                  {preview.systemPrompt}
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                After applying, you can freely edit both fields before saving.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="border-t border-border px-6 py-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleApply} className="gap-2">
            <Sparkles className="h-3.5 w-3.5" />
            Apply to settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
