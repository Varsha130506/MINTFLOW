import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import {
  addTransaction as addFinancialTransaction,
  applyDecision,
  calculateCategorySpending,
  calculateMetrics,
  createDemoState,
  dateForPlanDay,
  formatINR,
  INITIAL_FUNDS,
  MAX_TRANSACTION_AMOUNT,
  payCommitment as payFinancialCommitment,
  PLAN_LENGTH,
  previewScenario,
  projectCashFlow,
  PLAN_START,
  type Commitment,
  type FinanceMetrics,
  type FinancialScenario as Scenario,
  type FinancialState,
  type Goal,
  type ScenarioPreview,
  type ScenarioKind,
  type Transaction,
  type TransactionKind,
} from './lib/finance'
import { MintiCompanion } from './components/MintiCompanion'
import type { MintiActionSection } from './lib/minti'
import { loadFinancialState, saveFinancialState } from './lib/persistence'
import './App.css'

const STAR_POSITIONS = [
  { x: 3, y: 9 }, { x: 14, y: 21 }, { x: 28, y: 5 }, { x: 42, y: 14 },
  { x: 58, y: 7 }, { x: 71, y: 18 }, { x: 86, y: 8 }, { x: 97, y: 27 },
  { x: 7, y: 38 }, { x: 94, y: 45 }, { x: 2, y: 62 }, { x: 16, y: 79 },
  { x: 29, y: 92 }, { x: 45, y: 84 }, { x: 61, y: 96 }, { x: 77, y: 82 },
  { x: 91, y: 91 }, { x: 99, y: 69 }, { x: 5, y: 97 }, { x: 20, y: 51 },
  { x: 34, y: 32 }, { x: 52, y: 47 }, { x: 68, y: 61 }, { x: 82, y: 37 },
  { x: 39, y: 70 }, { x: 63, y: 29 }, { x: 11, y: 13 }, { x: 89, y: 16 },
]

function Starfield() {
  return (
    <div className="starfield" aria-hidden="true">
      {STAR_POSITIONS.map((position, index) => (
        <span
          className={`starfield__star${[4, 12, 20, 26].includes(index) ? ' starfield__star--sparkle' : ''}`}
          key={`${position.x}-${position.y}`}
          style={{ left: `${position.x}%`, top: `${position.y}%`, animationDelay: `${(index * 0.73) % 5.8}s` }}
        />
      ))}
    </div>
  )
}

type SectionId =
  | 'overview'
  | 'transactions'
  | 'budget'
  | 'savings'
  | 'commitments'
  | 'simulator'
  | 'health'
  | 'settings'
type IconName =
  | 'overview'
  | 'transactions'
  | 'budget'
  | 'savings'
  | 'commitments'
  | 'simulator'
  | 'health'
  | 'settings'
  | 'arrow'
  | 'plus'
  | 'spark'
  | 'coffee'
  | 'bag'
  | 'train'
  | 'music'
  | 'house'
  | 'calendar'
  | 'check'
  | 'close'
  | 'alert'
  | 'download'
  | 'reset'
  | 'chevron'
  | 'clock'

const NAV_ITEMS: { id: SectionId; label: string; icon: IconName }[] = [
  { id: 'overview', label: 'Overview', icon: 'overview' },
  { id: 'transactions', label: 'Transactions', icon: 'transactions' },
  { id: 'budget', label: 'Budget', icon: 'budget' },
  { id: 'savings', label: 'Savings goals', icon: 'savings' },
  { id: 'commitments', label: 'Commitments', icon: 'commitments' },
  { id: 'simulator', label: 'Decision studio', icon: 'simulator' },
  { id: 'health', label: 'Financial health', icon: 'health' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
]

const SCENARIO_DEFAULTS: Record<ScenarioKind, { label: string; category: string }> = {
  purchase: { label: 'Purchase', category: 'Shopping' },
  subscription: { label: 'Subscription', category: 'Subscriptions' },
  unexpected: { label: 'Unexpected expense', category: 'Unexpected' },
  income: { label: 'Extra income', category: 'Freelance' },
  saving: { label: 'Savings contribution', category: 'Savings' },
}

const money = (amount: number, compact = false) =>
  compact && Math.abs(amount) >= 10_000 ? new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
    notation: 'compact',
  }).format(Math.round(amount)) : formatINR(amount)

const shortDate = (date: string) =>
  new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(new Date(`${date}T00:00:00`))

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  let drawing: ReactNode

  switch (name) {
    case 'overview':
      drawing = <><rect x="3" y="3" width="8" height="8" rx="2" /><rect x="13" y="3" width="8" height="5" rx="2" /><rect x="13" y="10" width="8" height="11" rx="2" /><rect x="3" y="13" width="8" height="8" rx="2" /></>
      break
    case 'transactions':
      drawing = <><path d="M8 4H21M8 9H21M8 14H21M8 19H21" /><path d="M3 4h.01M3 9h.01M3 14h.01M3 19h.01" /></>
      break
    case 'budget':
      drawing = <><rect x="3" y="5" width="18" height="15" rx="3" /><path d="M3 10h18M7 15h3M16 3v4" /></>
      break
    case 'savings':
      drawing = <><path d="M12 3v18M17 7.5C17 6.1 15 5 12 5S7 6.1 7 7.5 9 10 12 10s5 1.1 5 2.5-2 2.5-5 2.5-5 1.1-5 2.5S9 20 12 20s5-1.1 5-2.5" /></>
      break
    case 'commitments':
      drawing = <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M16 3v4M8 3v4M3 10h18M8 15h3" /></>
      break
    case 'simulator':
      drawing = <><path d="M12 3 14.5 9.5 21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z" /><path d="m19 3 .7 1.8L21.5 5.5l-1.8.7L19 8l-.7-1.8-1.8-.7 1.8-.7L19 3Z" /></>
      break
    case 'health':
      drawing = <><path d="M20.8 8.8c0 5.2-8.8 10.2-8.8 10.2S3.2 14 3.2 8.8A4.8 4.8 0 0 1 12 6.2a4.8 4.8 0 0 1 8.8 2.6Z" /><path d="M7 12h3l1.2-2.3L13 15l1.2-3H17" /></>
      break
    case 'settings':
      drawing = <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1 1.1 1.9-1.8 3.1-2.2-.1-.2-.1-1.5-.8-1.1.3-1 1.4H8.2l-1-2.1-.1-.2-1.5-.8-2 .5L2 15.1l1.1-1.9.1-.2v-1.7l-1.2-1.8 1.8-3.2 2.1.2.2.1 1.5.8 1.1-.3 1-1.5h3.6l1 2.1.1.2 1.5.8 2-.5 1.7 3.2-1.1 1.8v1.8Z" /></>
      break
    case 'arrow':
      drawing = <><path d="M5 12h14M13 6l6 6-6 6" /></>
      break
    case 'plus':
      drawing = <><path d="M12 5v14M5 12h14" /></>
      break
    case 'spark':
      drawing = <><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z" /><path d="m19 14 1.2 2.3L22 17l-1.8.7L19 20l-1.2-2.3L16 17l1.8-.7L19 14Z" /></>
      break
    case 'coffee':
      drawing = <><path d="M4 9h13v7a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V9ZM17 11h1a3 3 0 1 1 0 6h-2M7 3l1 3M12 3l1 3" /></>
      break
    case 'bag':
      drawing = <><path d="M5 8h14l1 13H4L5 8Z" /><path d="M9 8a3 3 0 0 1 6 0M9 12v2M15 12v2" /></>
      break
    case 'train':
      drawing = <><rect x="5" y="3" width="14" height="16" rx="4" /><path d="M8 7h8v5H8zM8 16h.01M16 16h.01M8 22l2-3M16 22l-2-3" /></>
      break
    case 'music':
      drawing = <><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></>
      break
    case 'house':
      drawing = <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-6v-7h-4v7H4a1 1 0 0 1-1-1V10Z" /></>
      break
    case 'calendar':
      drawing = <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M16 3v4M8 3v4M3 10h18" /></>
      break
    case 'check':
      drawing = <><path d="m5 12 4 4L19 6" /></>
      break
    case 'close':
      drawing = <><path d="m18 6-12 12M6 6l12 12" /></>
      break
    case 'alert':
      drawing = <><path d="M10.3 4.3 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" /></>
      break
    case 'download':
      drawing = <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></>
      break
    case 'reset':
      drawing = <><path d="M3 12a9 9 0 1 0 2.6-6.4L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></>
      break
    case 'chevron':
      drawing = <><path d="m6 9 6 6 6-6" /></>
      break
    case 'clock':
      drawing = <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>
  }

  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {drawing}
    </svg>
  )
}

function ProgressRing({ progress, color = 'lime', size = 74 }: { progress: number; color?: string; size?: number }) {
  const radius = 29
  const circumference = 2 * Math.PI * radius
  const safeProgress = Math.min(Math.max(progress, 0), 1)
  return (
    <svg className={`progress-ring progress-ring--${color}`} width={size} height={size} viewBox="0 0 72 72" role="img" aria-label={`${Math.round(safeProgress * 100)} percent complete`}>
      <circle className="progress-ring__track" cx="36" cy="36" r={radius} />
      <circle
        className="progress-ring__value"
        cx="36"
        cy="36"
        r={radius}
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - safeProgress)}
      />
      <text className="progress-ring__label" x="36" y="40">{Math.round(safeProgress * 100)}%</text>
    </svg>
  )
}

function CashFlowChart({ state, metrics }: { state: FinancialState; metrics: FinanceMetrics }) {
  const width = 720
  const height = 236
  const padding = { top: 14, right: 16, bottom: 30, left: 52 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom
  const points = projectCashFlow(state, metrics)
  const values = points.map((point) => point.balance)
  const low = Math.min(0, ...values)
  const high = Math.max(INITIAL_FUNDS, ...values) * 1.06
  const x = (day: number) => padding.left + ((day - 1) / (PLAN_LENGTH - 1)) * chartWidth
  const y = (value: number) => padding.top + ((high - value) / Math.max(high - low, 1)) * chartHeight
  const actualPoints = points.filter((point) => !point.projected).map((point) => `${x(point.day)},${y(point.balance)}`).join(' ')
  const projectedPoints = points.filter((point) => point.day >= state.currentDay).map((point) => `${x(point.day)},${y(point.balance)}`).join(' ')
  const fillPoints = `${actualPoints} ${points.filter((point) => point.projected).map((point) => `${x(point.day)},${y(point.balance)}`).join(' ')} ${x(PLAN_LENGTH)},${padding.top + chartHeight} ${x(1)},${padding.top + chartHeight}`
  const ticks = [0, 1, 2].map((index) => high - ((high - low) * index) / 2)

  return (
    <div className="chart-wrap">
      <svg className="cash-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby="cash-chart-title cash-chart-description">
        <title id="cash-chart-title">Thirty-day cash-flow forecast</title>
        <desc id="cash-chart-description">Actual balance through day {state.currentDay}, followed by a projection based on recent spending and pending commitments. Projected day-30 balance: {money(metrics.projectedEnd)}.</desc>
        <defs>
          <linearGradient id="balance-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--violet)" stopOpacity=".25" />
            <stop offset="100%" stopColor="var(--violet)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="balance-line" x1="0" x2="1">
            <stop offset="0%" stopColor="var(--violet)" />
            <stop offset="100%" stopColor="var(--lime)" />
          </linearGradient>
        </defs>
        {ticks.map((tick, index) => (
          <g key={index}>
            <line x1={padding.left} x2={width - padding.right} y1={y(tick)} y2={y(tick)} className="chart-grid" />
            <text x={padding.left - 9} y={y(tick) + 4} textAnchor="end" className="chart-axis-label">{money(tick, true)}</text>
          </g>
        ))}
        <polygon points={fillPoints} fill="url(#balance-fill)" />
        <polyline points={actualPoints} className="chart-line chart-line--actual" />
        <polyline points={projectedPoints} className="chart-line chart-line--projected" />
        <line x1={x(state.currentDay)} x2={x(state.currentDay)} y1={padding.top} y2={padding.top + chartHeight} className="chart-today" />
        <circle cx={x(state.currentDay)} cy={y(metrics.available)} r="5" className="chart-current-dot" />
        {[1, 8, 15, 22, 30].map((day) => (
          <text key={day} x={x(day)} y={height - 7} textAnchor="middle" className="chart-axis-label">D{day}</text>
        ))}
      </svg>
    </div>
  )
}

function SectionHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="section-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  )
}

function App() {
  const [initialLoad] = useState(loadFinancialState)
  const [financialState, setFinancialState] = useState<FinancialState>(initialLoad.state)
  const [activeSection, setActiveSection] = useState<SectionId>('overview')
  const [dateFilter, setDateFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [showTransactionForm, setShowTransactionForm] = useState(false)
  const [notice, setNotice] = useState(
    initialLoad.status === 'recovered'
      ? 'Saved plan data was invalid or outdated, so the demo scenario was restored.'
      : initialLoad.status === 'unavailable'
        ? 'Browser storage is unavailable. Your changes will last only for this session.'
        : '',
  )
  const [scenario, setScenario] = useState<Scenario>({
    id: 'scenario-initial',
    kind: 'purchase',
    title: 'New headphones',
    amount: 1_499,
    category: 'Shopping',
    goalId: 'emergency',
  })

  const { transactions, commitments, goals, currentDay } = financialState
  const metrics = useMemo(() => calculateMetrics(financialState), [financialState])

  function updateFinancialState(nextState: FinancialState): boolean {
    setFinancialState(nextState)
    const saved = saveFinancialState(nextState)
    if (!saved) {
      setNotice('Your plan could not be saved in this browser. Changes may not survive a refresh.')
    }
    return saved
  }

  const sortedTransactions = useMemo(
    () => [...transactions].sort((first, second) => second.date.localeCompare(first.date)),
    [transactions],
  )

  const filteredTransactions = useMemo(
    () => sortedTransactions.filter((transaction) => {
      const matchesDate =
        dateFilter === 'all' ||
        (dateFilter === 'plan' && transaction.date >= PLAN_START && transaction.date <= dateForPlanDay(PLAN_LENGTH)) ||
        (dateFilter === '7' && transaction.date >= dateForPlanDay(Math.max(1, currentDay - 6)) && transaction.date <= dateForPlanDay(currentDay))
      const matchesCategory = categoryFilter === 'all' || transaction.category === categoryFilter
      return matchesDate && matchesCategory
    }),
    [categoryFilter, currentDay, dateFilter, sortedTransactions],
  )

  const scenarioPreview = useMemo(() => {
    if (
      !Number.isFinite(scenario.amount) ||
      scenario.amount <= 0 ||
      scenario.amount > MAX_TRANSACTION_AMOUNT ||
      Math.abs(Math.round(scenario.amount * 100) - scenario.amount * 100) > 0.000001
    ) return null
    const normalizedScenario = {
      ...scenario,
      title: scenario.title.trim() || SCENARIO_DEFAULTS[scenario.kind].label,
    }
    return previewScenario(financialState, normalizedScenario)
  }, [scenario, financialState])

  function updateScenario(updates: Partial<Omit<Scenario, 'id'>>) {
    setScenario((current) => ({ ...current, ...updates, id: crypto.randomUUID() }))
  }

  function addTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const amount = Number(form.get('amount'))
    const title = String(form.get('title')).trim()
    const kind = String(form.get('kind')) as TransactionKind
    const category = String(form.get('category')).trim()
    const date = String(form.get('date'))
    if (!title || !category || !Number.isFinite(amount) || amount <= 0 || amount > MAX_TRANSACTION_AMOUNT || !date) {
      setNotice('Add a name, category, valid date, and amount between ₹1 and ₹10,00,000.')
      return
    }
    const goalId = kind === 'saving' ? String(form.get('goalId') || goals[0]?.id || '') : undefined
    const transaction: Transaction = {
      id: `tx-${crypto.randomUUID()}`,
      title,
      category,
      amount,
      kind,
      date,
      goalId: goalId || undefined,
    }
    try {
      const nextState = addFinancialTransaction(financialState, transaction)
      const saved = updateFinancialState(nextState)
      setNotice(saved
        ? `${title} added to your ${kind === 'saving' ? 'savings' : kind === 'income' ? 'income' : 'spending'} activity.`
        : `${title} was added, but your plan could not be saved in this browser.`)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'This transaction could not be added.')
      return
    }
    setShowTransactionForm(false)
  }

  function applyScenario() {
    if (!scenarioPreview) return
    if (financialState.appliedDecisionIds.includes(scenario.id)) {
      setNotice('This decision has already been applied. Change the scenario to confirm a new decision.')
      return
    }
    const confirmedScenario = {
      ...scenario,
      title: scenario.title.trim() || SCENARIO_DEFAULTS[scenario.kind].label,
    }
    try {
      const nextState = applyDecision(financialState, confirmedScenario, scenario.id)
      const saved = updateFinancialState(nextState)
      const title = scenario.title.trim()
      const kind = scenario.kind === 'income' ? 'income' : scenario.kind === 'saving' ? 'savings' : scenario.kind === 'subscription' ? 'commitment' : 'spending'
      setNotice(scenario.kind === 'subscription'
        ? `${title} is now a pending commitment. Your available cash has not been reduced yet.${saved ? '' : ' Your plan could not be saved in this browser.'}`
        : `${title} confirmed and added to your ${kind} activity.${saved ? '' : ' Your plan could not be saved in this browser.'}`)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'This decision could not be applied.')
      return
    }
  }

  function payCommitment(commitment: Commitment) {
    if (commitment.status !== 'pending') return
    const nextState = payFinancialCommitment(financialState, commitment.id)
    const saved = updateFinancialState(nextState)
    setNotice(saved
      ? `${commitment.title} marked paid. The reserved amount moved to actual spending.`
      : `${commitment.title} marked paid, but your plan could not be saved in this browser.`)
  }

  function resetDemo() {
    const saved = updateFinancialState(createDemoState())
    setScenario({ id: crypto.randomUUID(), kind: 'purchase', title: 'New headphones', amount: 1_499, category: 'Shopping', goalId: 'emergency' })
    setNotice(saved
      ? 'Demo data restored. Your 30-day plan is back to its starting point.'
      : 'Demo data restored for this session, but browser storage could not be updated.')
  }

  function openMintiDestination(section: MintiActionSection, purchaseAmount?: number, scenarioKind?: ScenarioKind) {
    if (section === 'simulator' && (purchaseAmount !== undefined || scenarioKind === 'saving')) {
      const kind = scenarioKind ?? 'purchase'
      setScenario({
        id: crypto.randomUUID(),
        kind,
        title: purchaseAmount !== undefined ? 'Purchase check' : 'Savings contribution',
        amount: purchaseAmount ?? 500,
        category: kind === 'saving' ? goals[0]?.category ?? 'Savings' : 'Shopping',
        goalId: goals[0]?.id ?? '',
      })
    }
    setActiveSection(section)
    setShowTransactionForm(false)
  }

  const addButton = (
    <button className="button button--primary" aria-label="Add a new transaction" onClick={() => { setActiveSection('transactions'); setShowTransactionForm(true) }}>
      <Icon name="plus" size={17} />
      <span>New transaction</span>
    </button>
  )

  return (
    <div className="app-shell">
      <Starfield />
      <aside className="sidebar">
        <a className="brand" href="#overview" onClick={(event) => { event.preventDefault(); setActiveSection('overview') }}>
          <span className="brand-mark"><span /></span>
          <span className="brand-name">mint<span>flow</span><sup>®</sup></span>
        </a>
        <div className="sidebar-label">YOUR MONEY SPACE</div>
        <nav className="primary-nav" aria-label="Main navigation">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              className={`nav-item${activeSection === item.id ? ' nav-item--active' : ''}`}
              onClick={() => { setActiveSection(item.id); setShowTransactionForm(false) }}
              aria-current={activeSection === item.id ? 'page' : undefined}
            >
              <Icon name={item.icon} size={18} />
              <span>{item.label}</span>
              {item.id === 'commitments' && metrics.commitments > 0 && <span className="nav-count">{commitments.filter((item) => item.status === 'pending').length}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="plan-mini">
            <span className="plan-mini__icon"><Icon name="spark" size={17} /></span>
            <div>
              <span>30-day reset</span>
              <strong>Day {currentDay} <span>of {PLAN_LENGTH}</span></strong>
            </div>
            <span className="plan-mini__dot" />
          </div>
          <button className="user-card" onClick={() => setActiveSection('settings')}>
            <span className="avatar">A</span>
            <span className="user-card__text"><strong>Alex Morgan</strong><span>Personal plan</span></span>
            <Icon name="chevron" size={16} />
          </button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="mobile-brand">
            <span className="brand-mark"><span /></span>
            <span className="brand-name">mint<span>flow</span><sup>®</sup></span>
          </div>
          <div className="breadcrumb"><span>My money</span><span className="breadcrumb__slash">/</span><strong>{NAV_ITEMS.find((item) => item.id === activeSection)?.label}</strong></div>
          <div className="topbar__right">
            <label className="day-picker">
              <span><Icon name="calendar" size={15} /> 30-day plan</span>
              <select value={currentDay} onChange={(event) => updateFinancialState({ ...financialState, currentDay: Number(event.target.value) })} aria-label="Current day of your plan">
                {Array.from({ length: PLAN_LENGTH }, (_, index) => index + 1).map((day) => <option key={day} value={day}>Day {day}</option>)}
              </select>
              <Icon name="chevron" size={14} />
            </label>
            <button className="avatar avatar--top" aria-label="Open settings" onClick={() => setActiveSection('settings')}>A</button>
          </div>
        </header>

        {notice && (
          <div className="notice" role="status" aria-live="polite" aria-atomic="true">
            <span><Icon name="check" size={16} />{notice}</span>
            <button onClick={() => setNotice('')} aria-label="Dismiss notification"><Icon name="close" size={16} /></button>
          </div>
        )}

        <div className="page-content">
          <div hidden={activeSection !== 'overview'}>
            <MintiCompanion state={financialState} metrics={metrics} onNavigate={openMintiDestination} />
          </div>
          {activeSection === 'overview' && (
            <>
              <SectionHeading eyebrow={new Intl.DateTimeFormat('en-IN', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(`${dateForPlanDay(currentDay)}T12:00:00`)).toUpperCase()} title="Your money, in motion." description="A little clarity goes a long way. Here’s your 30-day snapshot." action={addButton} />
              <section className="overview-grid" aria-label="Financial overview">
                <article className="balance-card glass-card">
                  <div className="balance-card__top">
                    <div><span className="card-label"><span className="status-dot" /> AVAILABLE CASH</span><h2 className="balance-amount">{money(metrics.available)}</h2><span className="balance-card__definition">Goal savings are separate; upcoming bills are reserved below.</span></div>
                    <span className="balance-card__badge"><Icon name="spark" size={15} /> Your 30-day reset</span>
                  </div>
                  <div className="balance-card__bottom">
                    <div className="balance-stat"><span>Starting budget</span><strong>{money(metrics.startingFunds)}</strong></div>
                    <div className="balance-stat"><span>Income added</span><strong className="text-lime">+{money(metrics.income)}</strong></div>
                    <div className="balance-stat"><span>Actual spent</span><strong>−{money(metrics.spending)}</strong></div>
                    <div className="balance-stat"><span>Moved to savings</span><strong>−{money(metrics.savings)}</strong></div>
                  </div>
                  <div className="balance-card__glow" />
                </article>

                <article className="allowance-card glass-card">
                  <div className="card-label"><span className="allowance-icon"><Icon name="spark" size={15} /></span> SAFE TO SPEND TODAY</div>
                  <strong className="allowance-amount">{money(metrics.dailyAllowance)}</strong>
                  <p>per day for the next {metrics.remainingDays} days, after setting aside commitments</p>
                  <div className="allowance-track" role="progressbar" aria-label="Daily safe-to-spend amount relative to ₹500" aria-valuemin={0} aria-valuemax={500} aria-valuenow={Math.max(0, Math.min(metrics.dailyAllowance, 500))}><span style={{ width: `${Math.max(8, Math.min(metrics.dailyAllowance / 500 * 100, 100))}%` }} /></div>
                  <div className="allowance-foot"><span>{money(metrics.spendable)} spendable</span><span>Day {currentDay} / 30</span></div>
                </article>

                <MetricCard icon="transactions" label="SPENT SO FAR" value={money(metrics.spending)} foot={`${money(metrics.averageDailySpend)} average per day`} tone="violet" />
                <MetricCard icon="commitments" label="SET ASIDE" value={money(metrics.commitments)} foot={`${commitments.filter((item) => item.status === 'pending').length} upcoming commitments`} tone="blue" />
                <MetricCard icon="savings" label="SAVINGS BUILT" value={money(metrics.savingsProgress)} foot={`${Math.round((metrics.savingsProgress / Math.max(metrics.savingsTarget, 1)) * 100)}% of your goals`} tone="lime" />
              </section>

              <section className="content-grid content-grid--main">
                <article className="panel chart-panel">
                  <div className="panel-heading">
                    <div><span className="eyebrow">THE BIG PICTURE</span><h2>Cash-flow forecast</h2><p>What your balance could look like through day 30.</p></div>
                    <span className={`forecast-pill${metrics.projectedEnd < 0 ? ' forecast-pill--warning' : ''}`}><span />{metrics.projectedEnd < 0 ? 'Needs a check-in' : 'Looking steady'}</span>
                  </div>
                  <div className="chart-legend"><span><i className="legend-dot legend-dot--actual" /> Actual balance</span><span><i className="legend-dot legend-dot--projected" /> Projected at your recent pace</span></div>
                  <CashFlowChart state={financialState} metrics={metrics} />
                  <div className="chart-callout"><span className="chart-callout__icon"><Icon name="clock" size={16} /></span><span>At your recent pace, your projected day-30 balance is <strong className={metrics.projectedEnd < 0 ? 'text-coral' : 'text-lime'}>{money(metrics.projectedEnd)}</strong>. That’s a projection, not a promise.</span></div>
                </article>
                <article className="panel health-panel">
                  <div className="panel-heading"><div><span className="eyebrow">THE MONEY CHECK-IN</span><h2>Financial health</h2></div><button className="text-link" onClick={() => setActiveSection('health')}>How it works <Icon name="arrow" size={14} /></button></div>
                  <div className="health-score">
                    <ProgressRing progress={metrics.healthScore / 100} color={metrics.healthScore >= 70 ? 'lime' : 'violet'} size={82} />
                    <div><span className="health-score__label">Your money score</span><strong>{metrics.healthScore}<span> / 100</span></strong><span className="health-score__mood"><i />{metrics.healthScore >= 70 ? 'Building momentum' : metrics.healthScore >= 50 ? 'A few things to watch' : 'Time for a reset'}</span></div>
                  </div>
                  <div className="health-divider" />
                  <InsightRow icon="alert" tone={metrics.projectedEnd < 1_500 ? 'coral' : 'blue'} title={metrics.projectedEnd < 1_500 ? 'Your forecast is running low' : 'Your forecast has room'} detail={metrics.healthFactors.find((factor) => factor.id === 'forecast')?.detail ?? `Projected day-30 balance: ${money(metrics.projectedEnd)}`} />
                  <InsightRow icon="savings" tone="violet" title="Give your safety net some love" detail={metrics.riskExplanations.find((explanation) => explanation.startsWith('Emergency reserve')) ?? 'Your emergency savings goal is fully funded.'} />
                  <button className="panel-bottom-link" onClick={() => setActiveSection('health')}>Explore your money health <Icon name="arrow" size={15} /></button>
                </article>
              </section>

              <section className="content-grid content-grid--bottom">
                <article className="panel recent-panel">
                  <div className="panel-heading"><div><span className="eyebrow">JUST THE LATEST</span><h2>Recent activity</h2></div><button className="text-link" onClick={() => setActiveSection('transactions')}>All activity <Icon name="arrow" size={14} /></button></div>
                  <TransactionList transactions={sortedTransactions.slice(0, 4)} />
                </article>
                <article className="panel goals-panel">
                  <div className="panel-heading"><div><span className="eyebrow">A LITTLE AT A TIME</span><h2>Savings goals</h2></div><button className="text-link" onClick={() => setActiveSection('savings')}>All goals <Icon name="arrow" size={14} /></button></div>
                  <GoalList goals={goals} progressByGoal={metrics.goalProgress} compact />
                </article>
              </section>
            </>
          )}

          {activeSection === 'transactions' && (
            <>
              <SectionHeading eyebrow="THE PAPER TRAIL" title="Every little thing." description="Your money in, your money out, and the moments in between." action={addButton} />
              <section className="panel transactions-panel">
                <div className="filter-bar">
                  <label className="filter-control"><span>Show</span><select value={dateFilter} onChange={(event) => setDateFilter(event.target.value)}><option value="all">All activity</option><option value="7">Last 7 days</option><option value="plan">Entire 30-day plan</option></select><Icon name="chevron" size={15} /></label>
                  <label className="filter-control"><span>Category</span><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="all">Every category</option>{[...new Set(transactions.map((transaction) => transaction.category))].sort().map((category) => <option key={category} value={category}>{category}</option>)}</select><Icon name="chevron" size={15} /></label>
                  <span className="filter-count">{filteredTransactions.length} {filteredTransactions.length === 1 ? 'entry' : 'entries'}</span>
                </div>
                {showTransactionForm && <TransactionForm goals={goals} currentDay={currentDay} onSubmit={addTransaction} onCancel={() => setShowTransactionForm(false)} />}
                {filteredTransactions.length > 0 ? <TransactionList transactions={filteredTransactions} showNotes /> : <EmptyState title="Nothing in this slice." detail="Try another date range or category to find an entry." />}
              </section>
            </>
          )}

          {activeSection === 'budget' && (
            <>
              <SectionHeading eyebrow="SPEND WITH INTENTION" title="The shape of spending." description="See where your actual spending is landing this plan." />
              <section className="overview-grid overview-grid--three">
                <MetricCard icon="budget" label="STARTING BUDGET" value={money(INITIAL_FUNDS)} foot="Your 30-day starting line" tone="violet" />
                <MetricCard icon="transactions" label="SPENT SO FAR" value={money(metrics.spending)} foot={`${(metrics.spending / INITIAL_FUNDS * 100).toFixed(1)}% of starting funds`} tone="blue" />
                <MetricCard icon="spark" label="SPENDING PACE" value={money(metrics.averageDailySpend)} foot="Average actual spend per day" tone="lime" />
              </section>
              <section className="content-grid content-grid--main">
                <article className="panel budget-panel"><div className="panel-heading"><div><span className="eyebrow">WHERE IT WENT</span><h2>Spending by category</h2><p>Only completed expenses. Savings transfers and unpaid bills stay separate.</p></div></div><CategoryBreakdown transactions={transactions} /></article>
                <article className="panel budget-panel"><div className="panel-heading"><div><span className="eyebrow">THE PLAN VS. REAL LIFE</span><h2>Spending pace</h2></div></div><PaceCard metrics={metrics} currentDay={currentDay} /></article>
              </section>
            </>
          )}

          {activeSection === 'savings' && (
            <>
              <SectionHeading eyebrow="FUTURE-YOU SAYS THANKS" title="Small steps, big plans." description="Your savings transfers are tracked separately from day-to-day spending." action={addButton} />
              <div className="savings-summary panel"><div><span className="eyebrow">SAVED ACROSS YOUR GOALS</span><strong>{money(metrics.savingsProgress)}</strong><p>Real transfers, not wishful thinking.</p></div><div className="savings-summary__target"><span>Combined goal target</span><strong>{money(metrics.savingsTarget)}</strong><span>{Math.round(metrics.savingsProgress / Math.max(metrics.savingsTarget, 1) * 100)}% there</span></div></div>
              <section className="goal-grid">{goals.map((goal) => <GoalCard key={goal.id} goal={goal} saved={metrics.goalProgress[goal.id] ?? 0} />)}</section>
              <section className="panel savings-activity"><div className="panel-heading"><div><span className="eyebrow">SAVINGS TRANSFERS</span><h2>Building the future</h2></div><button className="button button--secondary" onClick={() => { setActiveSection('transactions'); setShowTransactionForm(true) }}><Icon name="plus" size={16} />Add a transfer</button></div><TransactionList transactions={sortedTransactions.filter((transaction) => transaction.kind === 'saving')} /></section>
            </>
          )}

          {activeSection === 'commitments' && (
            <>
              <SectionHeading eyebrow="ALREADY SPOKEN FOR" title="On the calendar." description="Pending bills are reserved from spendable cash, not counted as spending until paid." />
              <section className="overview-grid overview-grid--three">
                <MetricCard icon="commitments" label="STILL SET ASIDE" value={money(metrics.commitments)} foot="Excluded from safe-to-spend" tone="violet" />
                <MetricCard icon="calendar" label="UPCOMING BILLS" value={String(commitments.filter((item) => item.status === 'pending').length)} foot="Due later in this plan" tone="blue" />
                <MetricCard icon="check" label="ALREADY PAID" value={money(commitments.filter((item) => item.status === 'paid').reduce((sum, item) => sum + item.amount, 0))} foot="Included in actual spending" tone="lime" />
              </section>
              <section className="panel commitments-panel"><div className="panel-heading"><div><span className="eyebrow">YOUR UPCOMING COMMITMENTS</span><h2>No nasty surprises.</h2><p>Paying a bill moves it from reserved to actual spending without double-counting it.</p></div></div>
                {commitments.length ? commitments.slice().sort((a, b) => a.dueDay - b.dueDay).map((item) => <CommitmentRow key={item.id} commitment={item} onPay={() => payCommitment(item)} />) : <EmptyState title="No commitments yet." detail="Your spendable balance is not reserving money for future bills." />}
              </section>
            </>
          )}

          {activeSection === 'simulator' && scenarioPreview && (
            <>
              <SectionHeading eyebrow="BEFORE YOU TAP PAY" title="Try the what-if." description="Explore a money move first. Your actual plan stays untouched until you confirm it." />
              <section className="simulator-layout">
                <article className="panel scenario-panel">
                  <div className="panel-heading"><div><span className="eyebrow">BUILD A SCENARIO</span><h2>What’s on your mind?</h2><p>Nothing changes until you say so.</p></div><span className="scenario-spark"><Icon name="spark" size={18} /></span></div>
                  <div className="scenario-types" role="group" aria-label="Scenario type">
                    {(['purchase', 'subscription', 'unexpected', 'income', 'saving'] as ScenarioKind[]).map((kind) => (
                      <button key={kind} className={`scenario-type${scenario.kind === kind ? ' scenario-type--active' : ''}`} onClick={() => updateScenario({ kind, category: SCENARIO_DEFAULTS[kind].category, title: kind === 'purchase' ? 'New headphones' : '' })}>{SCENARIO_DEFAULTS[kind].label}</button>
                    ))}
                  </div>
                  <label className="field-label" htmlFor="scenario-title">Give this scenario a name</label>
                  <input className="form-input" id="scenario-title" value={scenario.title} onChange={(event) => updateScenario({ title: event.target.value })} placeholder="A name you'll recognize" maxLength={60} />
                  <label className="field-label" htmlFor="scenario-amount">How much? <span>INR</span></label>
                  <div className="amount-field"><span>₹</span><input id="scenario-amount" type="number" min="1" max="1000000" step="0.01" value={scenario.amount || ''} onChange={(event) => updateScenario({ amount: Number(event.target.value) })} /><span>INR</span></div>
                  {scenario.amount > 0 && Math.abs(Math.round(scenario.amount * 100) - scenario.amount * 100) > 0.000001 && <p className="form-hint form-hint--error" role="alert">Use a rupee amount with no more than two decimal places.</p>}
                  {scenario.kind === 'saving' && <><label className="field-label" htmlFor="scenario-goal">Put it toward</label><select className="form-input" id="scenario-goal" value={scenario.goalId} onChange={(event) => updateScenario({ goalId: event.target.value })}>{goals.map((goal) => <option key={goal.id} value={goal.id}>{goal.name}</option>)}</select></>}
                  {scenario.kind === 'purchase' && <p className="form-hint">Small or big, this is treated as a completed purchase if you confirm it.</p>}
                  {scenario.kind === 'subscription' && <p className="form-hint">This is treated as an upcoming commitment. Your available cash changes only when you mark it paid.</p>}
                  <div className="scenario-actions"><button className="button button--secondary" onClick={() => setScenario({ id: crypto.randomUUID(), kind: 'purchase', title: '', amount: 0, category: 'Shopping', goalId: goals[0]?.id ?? '' })}><Icon name="reset" size={16} />Reset</button><button className="button button--primary" onClick={applyScenario} disabled={!scenario.title.trim() || scenario.amount <= 0 || scenario.amount > MAX_TRANSACTION_AMOUNT || Math.abs(Math.round(scenario.amount * 100) - scenario.amount * 100) > 0.000001 || financialState.appliedDecisionIds.includes(scenario.id)}><Icon name="check" size={17} />{financialState.appliedDecisionIds.includes(scenario.id) ? 'Decision applied' : 'Confirm this decision'}</button></div>
                  <p className="privacy-note"><Icon name="health" size={14} /> A preview only. Nothing is saved until you confirm.</p>
                </article>
                <div className="scenario-results">
                  <article className="panel scenario-result-card"><span className="eyebrow">YOUR PLAN, SIDE BY SIDE</span><h2>Here’s what shifts.</h2><div className="comparison-heading"><span>RIGHT NOW</span><span>IF YOU GO AHEAD</span></div>
                    <ComparisonRow label="Available balance" before={scenarioPreview.before.available} after={scenarioPreview.after.available} />
                    <ComparisonRow label="Safe to spend / day" before={scenarioPreview.before.dailyAllowance} after={scenarioPreview.after.dailyAllowance} />
                    <ComparisonRow label="Savings progress" before={scenarioPreview.before.savingsProgress} after={scenarioPreview.after.savingsProgress} isProgress target={scenarioPreview.before.savingsTarget} nextTarget={scenarioPreview.after.savingsTarget} />
                    <ComparisonRow label="Day-30 projection" before={scenarioPreview.before.projectedEnd} after={scenarioPreview.after.projectedEnd} isSigned />
                    <div className="risk-comparison"><span>Plan health</span><strong className={scenarioPreview.after.healthScore < scenarioPreview.before.healthScore ? 'text-coral' : 'text-lime'}>{scenarioPreview.before.healthScore} → {scenarioPreview.after.healthScore}<small> / 100</small></strong></div>
                  </article>
                  <ScenarioExplanation kind={scenario.kind} metrics={metrics} preview={scenarioPreview} />
                </div>
              </section>
            </>
          )}

          {activeSection === 'health' && (
            <>
              <SectionHeading eyebrow="HONEST MATH, NO CRYSTAL BALL" title="A check-in, not a judgment." description="A transparent, educational indicator of how this plan is going. Not financial advice." />
              <section className="health-overview panel">
                <ProgressRing progress={metrics.healthScore / 100} color={metrics.healthScore >= 70 ? 'lime' : 'violet'} size={114} />
                <div><span className="eyebrow">YOUR FINANCIAL HEALTH INDICATOR</span><h2>{metrics.healthScore}<span className="health-total"> / 100</span></h2><p>{metrics.healthScore >= 70 ? 'You’re building a thoughtful rhythm.' : 'A couple of small adjustments could change your trajectory.'}</p></div>
                <div className="health-summary-stat"><span>Projected day-30 balance</span><strong className={metrics.projectedEnd < 0 ? 'text-coral' : ''}>{money(metrics.projectedEnd)}</strong><small>Projection based on your recent expense pace</small></div>
              </section>
              <section className="content-grid content-grid--main health-details">
                <article className="panel"><div className="panel-heading"><div><span className="eyebrow">WHAT'S SHAPING THE SCORE</span><h2>No mystery points.</h2></div></div><ScoreBreakdown metrics={metrics} /></article>
                <article className="panel"><div className="panel-heading"><div><span className="eyebrow">WHAT TO KEEP AN EYE ON</span><h2>Heads-up, not hard rules.</h2></div></div><div className="insight-stack">
                  {metrics.emergencyReserveRemaining > 0 && <InsightRow icon="savings" tone="violet" title="Emergency savings goal" detail={metrics.riskExplanations.find((explanation) => explanation.startsWith('Emergency reserve')) ?? `${money(metrics.emergencyReserveRemaining)} left to reach the goal.`} />}
                  {metrics.healthFactors.filter((factor) => factor.pointsDeducted > 0).map((factor) => <InsightRow key={factor.id} icon={factor.id === 'savings' ? 'savings' : factor.id === 'pace' ? 'budget' : 'alert'} tone={factor.id === 'forecast' || factor.id === 'allowance' ? 'coral' : factor.id === 'savings' ? 'violet' : 'blue'} title={factor.title} detail={factor.detail} />)}
                  {metrics.healthFactors.every((factor) => factor.pointsDeducted === 0) && metrics.emergencyReserveRemaining === 0 && <InsightRow icon="check" tone="blue" title="No score deductions right now" detail="Your forecast, goal progress, spending pace, and daily allowance are all above this indicator’s review thresholds." />}
                </div></article>
              </section>
              <p className="disclaimer">MINTFLOW’s score is a simple, deterministic planning aid based on your demo plan, upcoming commitments, savings-goal progress, and recent expense pace. It is not a credit score, prediction, or professional financial advice.</p>
            </>
          )}

          {activeSection === 'settings' && (
            <>
              <SectionHeading eyebrow="YOUR PLAN, YOUR CALL" title="Make it yours." description="Adjust the planning assumptions or restore the sample data." />
              <div className="settings-layout">
                <article className="panel settings-card"><span className="settings-icon"><Icon name="calendar" size={20} /></span><span className="eyebrow">PLANNING ASSUMPTIONS</span><h2>Your 30-day reset</h2><p>The starting budget is ₹10,000. Change the current plan day to adjust the forecast horizon and daily safe-to-spend amount.</p><label className="field-label" htmlFor="settings-day">Current day of plan <strong>Day {currentDay}</strong></label><input className="range-input" id="settings-day" type="range" min="1" max={PLAN_LENGTH} value={currentDay} onChange={(event) => updateFinancialState({ ...financialState, currentDay: Number(event.target.value) })} /><div className="range-labels"><span>Day 1</span><span>Day 30</span></div><div className="setting-row"><span>Plan length</span><strong>30 days</strong></div><div className="setting-row"><span>Starting funds</span><strong>{money(INITIAL_FUNDS)}</strong></div><div className="setting-row"><span>Plan begins</span><strong>{shortDate(PLAN_START)}</strong></div></article>
                <article className="panel settings-card"><span className="settings-icon settings-icon--violet"><Icon name="reset" size={20} /></span><span className="eyebrow">START FRESH</span><h2>Reset demo data</h2><p>Restore the original demo transactions, savings goals, upcoming commitments, and plan day. This cannot be undone.</p><button className="button button--secondary reset-button" onClick={resetDemo}><Icon name="reset" size={16} />Restore demo scenario</button><div className="settings-callout"><Icon name="alert" size={16} /><span>Your plan is saved locally in this browser. Reset replaces it with the original demo scenario; no bank account is connected.</span></div></article>
                <article className="panel settings-card settings-card--wide"><span className="eyebrow">ABOUT MINTFLOW</span><h2>A softer way to look at the numbers.</h2><p>No bank connections. No mystery scores. Your demo plan is stored locally on this device and remains in your browser.</p><div className="settings-row-grid"><div><span>Accounts connected</span><strong>None — on purpose</strong></div><div><span>Currency</span><strong>INR · Indian rupee</strong></div><div><span>Calculations</span><strong>Transparent &amp; deterministic</strong></div></div></article>
              </div>
            </>
          )}
        </div>
        <footer className="app-footer"><span><span className="footer-dot" />Your demo plan, all in one place.</span><span>Made with care, and ₹10,000 in mind.</span></footer>
      </main>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {mobileMenuOpen && <div className="mobile-nav__more" role="group" aria-label="More sections">{NAV_ITEMS.slice(4).map((item) => <button key={item.id} className={activeSection === item.id ? 'mobile-nav__more-item mobile-nav__more-item--active' : 'mobile-nav__more-item'} onClick={() => { setActiveSection(item.id); setShowTransactionForm(false); setMobileMenuOpen(false) }}><Icon name={item.icon} size={17} /><span>{item.label}</span></button>)}</div>}
        {NAV_ITEMS.slice(0, 4).map((item) => <button key={item.id} className={activeSection === item.id ? 'mobile-nav__item mobile-nav__item--active' : 'mobile-nav__item'} onClick={() => { setActiveSection(item.id); setShowTransactionForm(false); setMobileMenuOpen(false) }} aria-label={item.label} aria-current={activeSection === item.id ? 'page' : undefined}><Icon name={item.icon} size={19} /><span>{item.id === 'savings' ? 'Goals' : item.label.split(' ')[0]}</span></button>)}
        <button className={`mobile-nav__item${mobileMenuOpen || NAV_ITEMS.slice(4).some((item) => item.id === activeSection) ? ' mobile-nav__item--active' : ''}`} onClick={() => setMobileMenuOpen((open) => !open)} aria-expanded={mobileMenuOpen} aria-label="More sections"><Icon name={mobileMenuOpen ? 'close' : 'spark'} size={19} /><span>More</span></button>
      </nav>
    </div>
  )
}

function MetricCard({ icon, label, value, foot, tone }: { icon: IconName; label: string; value: string; foot: string; tone: string }) {
  return <article className="metric-card panel"><span className={`metric-card__icon metric-card__icon--${tone}`}><Icon name={icon} size={17} /></span><span className="eyebrow">{label}</span><strong>{value}</strong><span className="metric-card__foot">{foot}</span></article>
}

function TransactionList({ transactions, showNotes = false }: { transactions: Transaction[]; showNotes?: boolean }) {
  if (!transactions.length) return <EmptyState title="No transactions yet." detail="When you add an income, expense, or savings transfer, it will show up here." />
  const iconFor = (transaction: Transaction): IconName => {
    if (transaction.kind === 'income') return 'arrow'
    if (transaction.kind === 'saving') return 'savings'
    if (transaction.category === 'Transport') return 'train'
    if (transaction.category === 'Food & drink') return 'coffee'
    if (transaction.category === 'Shopping') return 'bag'
    if (transaction.category === 'Subscriptions') return 'music'
    if (transaction.category === 'Home') return 'house'
    return 'transactions'
  }
  return <div className="transaction-list">{transactions.map((transaction) => (
    <div className="transaction-row" key={transaction.id}>
      <span className={`transaction-icon transaction-icon--${transaction.kind}`}><Icon name={iconFor(transaction)} size={17} /></span>
      <div className="transaction-info"><strong>{transaction.title}</strong><span>{transaction.category} <i /> {shortDate(transaction.date)}{showNotes && transaction.note ? ` · ${transaction.note}` : ''}</span></div>
      <strong className={`transaction-amount transaction-amount--${transaction.kind}`}>{transaction.kind === 'income' ? '+' : transaction.kind === 'saving' ? '↗ ' : '−'}{money(transaction.amount)}</strong>
    </div>
  ))}</div>
}

function GoalList({ goals, progressByGoal, compact = false }: { goals: Goal[]; progressByGoal: Record<string, number>; compact?: boolean }) {
  return <div className={`goal-list${compact ? ' goal-list--compact' : ''}`}>{goals.map((goal) => {
    const saved = progressByGoal[goal.id] ?? 0
    const progress = Math.min(saved / goal.target, 1)
    return <div className="goal-row" key={goal.id}><ProgressRing progress={progress} color={goal.color} size={compact ? 60 : 72} /><div className="goal-row__info"><span>{goal.category}</span><strong>{goal.name}</strong>    <div className="goal-progress-track" role="progressbar" aria-label={`${goal.name} savings progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}><span className={`goal-progress-fill goal-progress-fill--${goal.color}`} style={{ width: `${progress * 100}%` }} /></div><small>{money(saved)} saved <i /> {money(goal.target)} goal</small></div><span className="goal-row__percent">{Math.round(progress * 100)}%</span></div>
  })}</div>
}

function GoalCard({ goal, saved }: { goal: Goal; saved: number }) {
  const left = Math.max(goal.target - saved, 0)
  const progress = Math.min(saved / goal.target, 1)
  return <article className={`panel goal-card goal-card--${goal.color}`}><div className="goal-card__top"><span className="goal-card__symbol"><Icon name="savings" size={20} /></span><span className="goal-badge">IN PROGRESS</span></div><span className="eyebrow">{goal.category}</span><h2>{goal.name}</h2><ProgressRing progress={progress} color={goal.color} size={112} /><div className="goal-card__amount"><strong>{money(saved)}</strong><span>of {money(goal.target)}</span></div><p>{left > 0 ? `${money(left)} to go. Every little bit counts.` : 'Goal reached. That’s worth a little celebration.'}</p><div className="goal-progress-track" role="progressbar" aria-label={`${goal.name} savings progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}><span className={`goal-progress-fill goal-progress-fill--${goal.color}`} style={{ width: `${progress * 100}%` }} /></div></article>
}

function TransactionForm({ goals, currentDay, onSubmit, onCancel }: { goals: Goal[]; currentDay: number; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onCancel: () => void }) {
  return <form className="transaction-form" onSubmit={onSubmit}><div className="transaction-form__heading"><div><span className="eyebrow">ADD TO YOUR PLAN</span><h2>A new money moment</h2></div><button type="button" className="icon-button" onClick={onCancel} aria-label="Close transaction form"><Icon name="close" size={18} /></button></div><div className="form-grid"><label className="field-label">Name<input className="form-input" name="title" required maxLength={60} placeholder="e.g. Lunch with friends" /></label><label className="field-label">Amount in rupees<input className="form-input" name="amount" type="number" min="1" max="1000000" step="1" required placeholder="0" /></label><label className="field-label">Type<select className="form-input" name="kind"><option value="expense">Expense</option><option value="income">Income</option><option value="saving">Savings transfer</option></select></label><label className="field-label">Category<select className="form-input" name="category"><option>Food &amp; drink</option><option>Essentials</option><option>Transport</option><option>Shopping</option><option>Fun</option><option>Freelance</option><option>Utilities</option><option>Other</option></select></label><label className="field-label">Date<input className="form-input" name="date" type="date" min={PLAN_START} max={dateForPlanDay(currentDay)} defaultValue={dateForPlanDay(currentDay)} required /></label><label className="field-label">Savings goal (if this is a transfer)<select className="form-input" name="goalId">{goals.map((goal) => <option key={goal.id} value={goal.id}>{goal.name}</option>)}</select></label></div><div className="form-actions"><button type="button" className="button button--secondary" onClick={onCancel}>Cancel</button><button type="submit" className="button button--primary"><Icon name="check" size={16} />Add entry</button></div></form>
}

function CategoryBreakdown({ transactions }: { transactions: Transaction[] }) {
  const categories = calculateCategorySpending(transactions)
  const colors = ['violet', 'lime', 'blue', 'coral', 'pink']
  const rows = Object.entries(categories).sort((first, second) => second[1] - first[1])
  const total = rows.reduce((sum, row) => sum + row[1], 0)
  if (!rows.length) return <EmptyState title="No spending to break down." detail="Completed expenses will appear by category here." />
  return <div className="category-breakdown"><div className="category-total"><span>Actual expenses</span><strong>{money(total)}</strong></div>{rows.map(([name, amount], index) => <div className="category-row" key={name}><div className="category-row__title"><i className={`category-color category-color--${colors[index % colors.length]}`} /><span>{name}</span><strong>{money(amount)}</strong></div><div className="category-track" role="progressbar" aria-label={`${name} share of expenses`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(amount / Math.max(total, 1) * 100)}><span className={`category-fill category-fill--${colors[index % colors.length]}`} style={{ width: `${amount / Math.max(total, 1) * 100}%` }} /></div><small>{(amount / Math.max(total, 1) * 100).toFixed(1)}% of actual spending</small></div>)}</div>
}

function PaceCard({ metrics, currentDay }: { metrics: FinanceMetrics; currentDay: number }) {
  const planPace = INITIAL_FUNDS * currentDay / PLAN_LENGTH
  const maxAmount = Math.max(metrics.spending, planPace, 1)
  return <div className="pace-card"><span className="pace-card__caption">A simple straight-line benchmark for day {currentDay}</span><div className="pace-comparison"><div><span>Actual expenses</span><strong>{money(metrics.spending)}</strong></div><div><span>Budget pace</span><strong>{money(planPace)}</strong></div></div><div className="pace-track" role="progressbar" aria-label="Actual expenses compared with current budget pace" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.min(metrics.spending / maxAmount, 1) * 100)}><span style={{ width: `${Math.min(metrics.spending / maxAmount * 100, 100)}%` }} /><i style={{ left: `${Math.min(planPace / maxAmount * 100, 100)}%` }} /></div><p className={metrics.paceOverrun > 0 ? 'text-coral' : 'text-lime'}>{metrics.paceOverrun > 0 ? `${money(metrics.paceOverrun)} above` : `${money(Math.abs(metrics.paceOverrun))} below`} the simple day-by-day pace.</p><small>This benchmark splits ₹10,000 evenly across 30 days. It’s a reference point—not a spending rule.</small></div>
}

function CommitmentRow({ commitment, onPay }: { commitment: Commitment; onPay: () => void }) {
  return <div className="commitment-row"><span className={`transaction-icon ${commitment.status === 'paid' ? 'transaction-icon--income' : 'transaction-icon--saving'}`}><Icon name={commitment.status === 'paid' ? 'check' : commitment.category === 'Home' ? 'house' : 'calendar'} size={17} /></span><div className="transaction-info"><strong>{commitment.title}</strong><span>{commitment.category} <i /> Day {commitment.dueDay} <i /> {commitment.status === 'pending' ? 'Upcoming' : 'Paid'}</span></div><strong className="transaction-amount">{money(commitment.amount)}</strong>{commitment.status === 'pending' ? <button className="button button--small button--secondary" onClick={onPay}>Mark paid</button> : <span className="paid-badge"><Icon name="check" size={13} /> Paid</span>}</div>
}

function ComparisonRow({ label, before, after, isProgress = false, target = 0, nextTarget = 0, isSigned = false }: { label: string; before: number; after: number; isProgress?: boolean; target?: number; nextTarget?: number; isSigned?: boolean }) {
  const changed = after - before
  return <div className="comparison-row"><span>{label}</span><div><strong>{isProgress ? `${Math.round(before / Math.max(target, 1) * 100)}%` : `${isSigned && before > 0 ? '+' : ''}${money(before)}`}</strong><Icon name="arrow" size={14} /><strong className={changed < 0 ? 'text-coral' : changed > 0 ? 'text-lime' : ''}>{isProgress ? `${Math.round(after / Math.max(nextTarget, 1) * 100)}%` : `${isSigned && after > 0 ? '+' : ''}${money(after)}`}</strong></div></div>
}

function ScenarioExplanation({ kind, metrics, preview }: { kind: ScenarioKind; metrics: FinanceMetrics; preview: ScenarioPreview }) {
  const deltaAllowance = preview.changes.dailyAllowance
  const title = kind === 'income' ? 'A little more breathing room.' : kind === 'saving' ? 'Future-you gets a boost.' : kind === 'subscription' ? 'A new bill on the calendar.' : 'Let’s make space for it.'
  const worsens = preview.after.healthScore < metrics.healthScore || preview.after.projectedEnd < metrics.projectedEnd
  return <article className="scenario-explanation"><span className={`scenario-explanation__icon${worsens ? ' scenario-explanation__icon--warning' : ''}`}><Icon name={worsens ? 'alert' : 'spark'} size={17} /></span><div><strong>{title}</strong><p>{preview.explanation} Daily safe-to-spend changes by {money(deltaAllowance)}.</p><small>{worsens ? 'Worth a pause: the day-30 projection or your plan-health indicator gets tighter.' : 'Your plan stays on track in this scenario.'}</small></div></article>
}

function ScoreBreakdown({ metrics }: { metrics: FinanceMetrics }) {
  return <div className="score-breakdown">{metrics.healthFactors.map((factor) => <div className="score-row" key={factor.id}><div className="score-row__copy"><strong>{factor.title}</strong><span>{factor.detail}</span></div><div className="score-row__result"><strong className={factor.pointsDeducted > 0 ? 'text-coral' : 'text-lime'}>{factor.pointsDeducted > 0 ? `−${factor.pointsDeducted}` : 'Clear'}</strong><span>{factor.pointsDeducted > 0 ? 'points' : 'no deduction'}</span></div><div className="score-row__track" role="progressbar" aria-label={`${factor.title} points deducted`} aria-valuemin={0} aria-valuemax={factor.maximumDeduction} aria-valuenow={factor.pointsDeducted}><span style={{ width: `${factor.pointsDeducted / Math.max(factor.maximumDeduction, 1) * 100}%` }} /></div></div>)}</div>
}

function InsightRow({ icon, tone, title, detail }: { icon: IconName; tone: string; title: string; detail: string }) {
  return <div className="insight-row"><span className={`insight-icon insight-icon--${tone}`}><Icon name={icon} size={15} /></span><div><strong>{title}</strong><span>{detail}</span></div></div>
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="empty-state"><span><Icon name="transactions" size={20} /></span><strong>{title}</strong><p>{detail}</p></div>
}

export default App
