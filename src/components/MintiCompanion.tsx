import { useEffect, useRef, useState, type FormEvent } from 'react'
import { formatINR, type FinanceMetrics, type FinancialState, type ScenarioKind } from '../lib/finance'
import { replyAsMinti, selectMintiMoment, type MintiActionSection, type MintiMood } from '../lib/minti'

type ChatMessage = {
  sender: 'you' | 'minti'
  text: string
  actionLabel?: string
  actionSection?: MintiActionSection
  purchaseAmount?: number
  scenarioKind?: ScenarioKind
}

type MintiCompanionProps = {
  state: FinancialState
  metrics: FinanceMetrics
  onNavigate: (section: MintiActionSection, purchaseAmount?: number, scenarioKind?: ScenarioKind) => void
}

const PROMPTS = ['What’s my balance?', 'Can I afford this?', 'Help me save', 'How am I doing?']

const MOOD_LABELS: Record<MintiMood, string> = {
  happy: 'Here with you',
  encouraging: 'You’re making progress',
  warning: 'A gentle heads-up',
  helpful: 'A little idea',
  success: 'A goal reached',
}

function MintiCharacter({ mood, large = false }: { mood: MintiMood; large?: boolean }) {
  return (
    <svg
      className={`minti-character${large ? ' minti-character--large' : ''} minti-character--${mood}`}
      viewBox="0 0 96 104"
      role="img"
      aria-label={`Minti, ${MOOD_LABELS[mood].toLowerCase()}`}
    >
      <ellipse className="minti-shadow" cx="48" cy="96" rx="30" ry="5" />
      <path className="minti-sprout-stem" d="M47 37c1-8 2-13 5-18" />
      <path className="minti-leaf minti-leaf--left" d="M51 24C33 24 28 13 31 5c13 0 22 6 23 17" />
      <path className="minti-leaf minti-leaf--right" d="M51 22C54 8 65 5 75 9c-2 12-10 18-23 17" />
      <path className="minti-body" d="M17 66c0-19 12-32 31-32s31 13 31 32c0 18-12 27-31 27S17 84 17 66Z" />
      <path className="minti-cheek" d="M27 66c4-3 8-2 10 1-2 4-6 5-10 3m32-3c4-3 8-2 10 1-2 4-6 5-10 3" />
      <g className="minti-eyes"><ellipse cx="39" cy="65" rx="2.2" ry="3.3" /><ellipse cx="57" cy="65" rx="2.2" ry="3.3" /></g>
      <path className="minti-mouth" d={mood === 'warning' ? 'M42 78c3-4 9-4 12 0' : mood === 'success' ? 'M40 72c4 9 12 9 16 0' : 'M42 75c3 4 9 4 12 0'} />
      <path className="minti-shine" d="M26 53c4-7 10-11 17-12" />
    </svg>
  )
}

export function MintiCompanion({ state, metrics, onNavigate }: MintiCompanionProps) {
  const moment = selectMintiMoment(state, metrics)
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
    bottomRef.current?.scrollIntoView({ behavior, block: 'nearest' })
  }, [messages, open])

  function sendMessage(text: string) {
    const prompt = text.trim()
    if (!prompt) return
    const reply = replyAsMinti(prompt, state, metrics)
    setMessages((current) => [
      ...current,
      { sender: 'you', text: prompt },
      {
        sender: 'minti',
        text: reply.message,
        actionLabel: reply.actionLabel,
        actionSection: reply.actionSection,
        purchaseAmount: reply.purchaseAmount,
        scenarioKind: reply.scenarioKind,
      },
    ])
    setInput('')
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    sendMessage(input)
  }

  return (
    <section className={`minti-companion minti-companion--${moment.mood}`} aria-label="Minti money companion">
      <div className="minti-buddy-card">
        <div className="minti-avatar"><MintiCharacter mood={moment.mood} /></div>
        <div className="minti-buddy-copy">
          <div className="minti-buddy-label"><span className="minti-online-dot" /> MINTI <span>·</span> {MOOD_LABELS[moment.mood]}</div>
          <p>{moment.message}</p>
        </div>
        <div className="minti-buddy-actions">
          <button className="minti-action-button" onClick={() => onNavigate(moment.actionSection)}>{moment.actionLabel}<span aria-hidden="true">↗</span></button>
          <button
            className="minti-chat-toggle"
            aria-expanded={open}
            aria-controls="minti-chat-panel"
            onClick={() => setOpen((current) => !current)}
          >
            {open ? 'Close chat' : 'Chat with Minti'}
          </button>
        </div>
      </div>

      {open && (
        <div className="minti-chat-panel" id="minti-chat-panel">
          <div className="minti-chat-heading">
            <span className="minti-chat-avatar"><MintiCharacter mood={moment.mood} /></span>
            <div><strong>A little money check-in?</strong><span>Rule-based support · not AI advice</span></div>
            <button className="minti-close-button" aria-label="Close Minti chat" onClick={() => setOpen(false)}>×</button>
          </div>
          <div className="minti-chat-messages" role="log" aria-label="Conversation with Minti" aria-live="polite">
            <div className="minti-message minti-message--buddy">
              <strong>Hey, I’m Minti 🌱</strong>
              <p>I can help you explore your numbers. Nothing changes unless you choose to confirm it.</p>
            </div>
            {messages.map((message, index) => (
              <div className={`minti-message${message.sender === 'you' ? ' minti-message--you' : ' minti-message--buddy'}`} key={`${message.sender}-${index}`}>
                {message.sender === 'minti' && <strong>Minti</strong>}
                <p>{message.text}</p>
                {message.actionLabel && message.actionSection && (
                  <button className="minti-reply-action" onClick={() => {
                    if (message.actionSection) onNavigate(message.actionSection, message.purchaseAmount, message.scenarioKind)
                  }}>
                    {message.actionLabel} <span aria-hidden="true">↗</span>
                  </button>
                )}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
          <div className="minti-prompts" aria-label="Suggested questions">
            {PROMPTS.map((prompt) => <button key={prompt} onClick={() => sendMessage(prompt)}>{prompt}</button>)}
          </div>
          <form className="minti-chat-form" onSubmit={handleSubmit}>
            <label className="sr-only" htmlFor="minti-chat-input">Message Minti</label>
            <input
              id="minti-chat-input"
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask about your money…"
              autoComplete="off"
            />
            <button type="submit" aria-label="Send message" disabled={!input.trim()}>Send <span aria-hidden="true">↑</span></button>
          </form>
          <p className="minti-disclaimer">Your current plan: {formatINR(metrics.available)} available · {formatINR(metrics.commitments)} reserved. No accounts connected.</p>
        </div>
      )}
    </section>
  )
}
