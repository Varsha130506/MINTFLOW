export type TransactionKind = 'expense' | 'income' | 'saving'
export type ScenarioKind = 'purchase' | 'subscription' | 'unexpected' | 'income' | 'saving'

export type Transaction = {
  id: string
  title: string
  category: string
  amount: number
  kind: TransactionKind
  date: string
  note?: string
  goalId?: string
  commitmentId?: string
}

export type Commitment = {
  id: string
  title: string
  category: string
  amount: number
  dueDay: number
  status: 'pending' | 'paid'
}

export type Goal = {
  id: string
  name: string
  target: number
  category: string
  color: string
}

export type FinancialScenario = {
  id: string
  kind: ScenarioKind
  title: string
  amount: number
  category: string
  goalId: string
}

export type FinancialState = {
  startingFunds: number
  planLength: number
  currentDay: number
  transactions: Transaction[]
  commitments: Commitment[]
  goals: Goal[]
  appliedDecisionIds: string[]
}

export type HealthFactor = {
  id: 'forecast' | 'savings' | 'pace' | 'allowance'
  title: string
  detail: string
  pointsDeducted: number
  maximumDeduction: number
}

export type FinanceMetrics = {
  startingFunds: number
  planLength: number
  currentDay: number
  income: number
  spending: number
  categorySpending: Record<string, number>
  savings: number
  available: number
  totalCash: number
  commitments: number
  spendable: number
  remainingDays: number
  dailyAllowance: number
  averageDailySpend: number
  projectedEnd: number
  savingsTarget: number
  savingsProgress: number
  goalProgress: Record<string, number>
  healthScore: number
  healthFactors: HealthFactor[]
  riskExplanations: string[]
  emergencyReserveRemaining: number
  paceOverrun: number
}

export type CashFlowPoint = {
  day: number
  balance: number
  projected: boolean
}

export type ScenarioPreview = {
  before: FinanceMetrics
  after: FinanceMetrics
  changes: {
    available: number
    dailyAllowance: number
    savingsProgress: number
    projectedEnd: number
    healthScore: number
  }
  explanation: string
}

export const PLAN_START = '2026-10-01'
export const PLAN_LENGTH = 30
export const INITIAL_FUNDS = 10_000
export const INITIAL_DAY = 11
export const MAX_TRANSACTION_AMOUNT = 1_000_000

export const INITIAL_GOALS: Goal[] = [
  { id: 'emergency', name: 'Safety net', target: 5_000, category: 'Emergency fund', color: 'lime' },
  { id: 'getaway', name: 'Goa, eventually', target: 3_000, category: 'Little getaway', color: 'violet' },
]

export const INITIAL_TRANSACTIONS: Transaction[] = [
  { id: 'tx-1', title: 'Bean & Bloom', category: 'Food & drink', amount: 465, kind: 'expense', date: '2026-10-11', note: 'Oat latte + a little treat' },
  { id: 'tx-2', title: 'Weekly groceries', category: 'Essentials', amount: 899, kind: 'expense', date: '2026-10-09', note: 'The important stuff' },
  { id: 'tx-3', title: 'Metro recharge', category: 'Transport', amount: 149, kind: 'expense', date: '2026-10-10' },
  { id: 'tx-4', title: 'Weekend sneakers', category: 'Shopping', amount: 1_599, kind: 'expense', date: '2026-10-07' },
  { id: 'tx-5', title: 'Sunday brunch', category: 'Food & drink', amount: 620, kind: 'expense', date: '2026-10-08' },
  { id: 'tx-6', title: 'Film night', category: 'Fun', amount: 399, kind: 'expense', date: '2026-10-06' },
  { id: 'tx-7', title: 'Freelance design gig', category: 'Freelance', amount: 2_500, kind: 'income', date: '2026-10-05' },
  { id: 'tx-8', title: 'Future-you fund', category: 'Emergency fund', amount: 1_000, kind: 'saving', date: '2026-10-10', goalId: 'emergency' },
  { id: 'tx-9', title: 'Getaway jar', category: 'Little getaway', amount: 400, kind: 'saving', date: '2026-10-08', goalId: 'getaway' },
]

export const INITIAL_COMMITMENTS: Commitment[] = [
  { id: 'bill-1', title: 'Phone plan', category: 'Utilities', amount: 399, dueDay: 17, status: 'pending' },
  { id: 'bill-2', title: 'Rent (your share)', category: 'Home', amount: 1_200, dueDay: 20, status: 'pending' },
]

export function createDemoState(): FinancialState {
  return {
    startingFunds: INITIAL_FUNDS,
    planLength: PLAN_LENGTH,
    currentDay: INITIAL_DAY,
    transactions: INITIAL_TRANSACTIONS.map((transaction) => ({ ...transaction })),
    commitments: INITIAL_COMMITMENTS.map((commitment) => ({ ...commitment })),
    goals: INITIAL_GOALS.map((goal) => ({ ...goal })),
    appliedDecisionIds: [],
  }
}

export function dateForPlanDay(day: number, planStart = PLAN_START): string {
  if (!Number.isInteger(day) || day < 1) {
    throw new RangeError('Plan day must be a positive whole number.')
  }
  const date = new Date(`${planStart}T00:00:00Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== planStart) {
    throw new RangeError('Plan start must be a valid ISO calendar date.')
  }
  date.setUTCDate(date.getUTCDate() + day - 1)
  return date.toISOString().slice(0, 10)
}

const toCents = (amount: number) => Math.round(amount * 100)
const fromCents = (amount: number) => amount / 100
const sumMoney = (amounts: number[]) => fromCents(amounts.reduce((total, amount) => total + toCents(amount), 0))

function validateMoneyAmount(amount: number, label: string): void {
  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_TRANSACTION_AMOUNT) {
    throw new RangeError(`${label} must be greater than ₹0 and no more than ₹10,00,000.`)
  }
  if (Math.abs(Math.round(amount * 100) - amount * 100) > 0.000001) {
    throw new RangeError(`${label} must not have more than two decimal places.`)
  }
}

function validateIdentity(value: string, label: string): void {
  if (!value.trim()) throw new TypeError(`${label} is required.`)
}

function validatePlanDate(state: FinancialState, date: string, maximumDay = state.planLength): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new TypeError('Transaction date must be a valid ISO calendar date.')
  }
  const parsedDate = new Date(`${date}T00:00:00Z`)
  if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) {
    throw new TypeError('Transaction date must be a valid ISO calendar date.')
  }
  if (date < PLAN_START || date > dateForPlanDay(maximumDay)) {
    throw new RangeError('Transaction date must fall within the 30-day plan.')
  }
}

function validateTransaction(state: FinancialState, transaction: Transaction): void {
  validateIdentity(transaction.id, 'Transaction ID')
  validateIdentity(transaction.title, 'Transaction name')
  validateIdentity(transaction.category, 'Transaction category')
  validateMoneyAmount(transaction.amount, 'Transaction amount')
  validatePlanDate(state, transaction.date)
  if (!['expense', 'income', 'saving'].includes(transaction.kind)) {
    throw new TypeError('Transaction type must be an expense, income, or savings transfer.')
  }
  if (transaction.kind === 'saving' && !state.goals.some((goal) => goal.id === transaction.goalId)) {
    throw new TypeError('A savings transfer must be assigned to an existing savings goal.')
  }
  if (transaction.kind !== 'expense' && transaction.commitmentId) {
    throw new TypeError('Only a completed expense may be linked to a commitment.')
  }
}

export function validateFinancialState(state: FinancialState): void {
  if (!Number.isFinite(state.startingFunds) || state.startingFunds < 0 || Math.abs(Math.round(state.startingFunds * 100) - state.startingFunds * 100) > 0.000001) {
    throw new RangeError('Starting funds must be a non-negative amount with at most two decimal places.')
  }
  if (!Number.isInteger(state.planLength) || state.planLength < 1 || state.planLength > 365) {
    throw new RangeError('Plan length must be a whole number between 1 and 365 days.')
  }
  if (!Number.isInteger(state.currentDay) || state.currentDay < 1 || state.currentDay > state.planLength) {
    throw new RangeError('Current plan day must fall within the plan.')
  }

  const goalIds = new Set<string>()
  for (const goal of state.goals) {
    validateIdentity(goal.id, 'Savings goal ID')
    validateIdentity(goal.name, 'Savings goal name')
    validateIdentity(goal.category, 'Savings goal category')
    validateMoneyAmount(goal.target, 'Savings goal target')
    if (goalIds.has(goal.id)) throw new TypeError(`Duplicate savings goal ID: ${goal.id}.`)
    goalIds.add(goal.id)
  }

  const commitmentIds = new Set<string>()
  for (const commitment of state.commitments) {
    validateIdentity(commitment.id, 'Commitment ID')
    validateIdentity(commitment.title, 'Commitment name')
    validateIdentity(commitment.category, 'Commitment category')
    validateMoneyAmount(commitment.amount, 'Commitment amount')
    if (!Number.isInteger(commitment.dueDay) || commitment.dueDay < 1 || commitment.dueDay > state.planLength) {
      throw new RangeError('Commitment due day must fall within the plan.')
    }
    if (commitment.status !== 'pending' && commitment.status !== 'paid') {
      throw new TypeError('Commitment status must be pending or paid.')
    }
    if (commitmentIds.has(commitment.id)) throw new TypeError(`Duplicate commitment ID: ${commitment.id}.`)
    commitmentIds.add(commitment.id)
  }

  const transactionIds = new Set<string>()
  const paidCommitmentIds = new Set<string>()
  for (const transaction of state.transactions) {
    validateTransaction(state, transaction)
    if (transactionIds.has(transaction.id)) throw new TypeError(`Duplicate transaction ID: ${transaction.id}.`)
    transactionIds.add(transaction.id)
    if (transaction.commitmentId) {
      const commitment = state.commitments.find((item) => item.id === transaction.commitmentId)
      if (!commitment || commitment.status !== 'paid') {
        throw new TypeError('A paid commitment transaction must reference a paid commitment.')
      }
      if (paidCommitmentIds.has(commitment.id)) {
        throw new TypeError(`Commitment ${commitment.id} has already been paid.`)
      }
      if (transaction.amount !== commitment.amount || transaction.kind !== 'expense') {
        throw new TypeError('A payment must match its commitment amount and be recorded as an expense.')
      }
      paidCommitmentIds.add(commitment.id)
    }
  }
  for (const commitment of state.commitments) {
    if ((commitment.status === 'paid') !== paidCommitmentIds.has(commitment.id)) {
      throw new TypeError(`Commitment ${commitment.id} must have exactly one matching payment record.`)
    }
  }

  if (new Set(state.appliedDecisionIds).size !== state.appliedDecisionIds.length) {
    throw new TypeError('Applied decision IDs must be unique.')
  }
}

export function calculateActualAvailableBalance(state: FinancialState): number {
  validateFinancialState(state)
  const netChange = state.transactions.reduce((balance, transaction) => {
    if (transaction.kind === 'income') return balance + toCents(transaction.amount)
    return balance - toCents(transaction.amount)
  }, toCents(state.startingFunds))
  return fromCents(netChange)
}

export function calculateReservedCommitments(state: FinancialState): number {
  validateFinancialState(state)
  return fromCents(state.commitments.reduce(
    (total, commitment) => total + (commitment.status === 'pending' ? toCents(commitment.amount) : 0),
    0,
  ))
}

export function calculateCategorySpending(transactions: Transaction[]): Record<string, number> {
  const result: Record<string, number> = {}
  for (const transaction of transactions) {
    if (transaction.kind !== 'expense') continue
    validateMoneyAmount(transaction.amount, 'Transaction amount')
    result[transaction.category] = fromCents(toCents(result[transaction.category] ?? 0) + toCents(transaction.amount))
  }
  return result
}

export function calculateGoalProgress(state: FinancialState): Record<string, number> {
  validateFinancialState(state)
  const progress = Object.fromEntries(state.goals.map((goal) => [goal.id, 0])) as Record<string, number>
  for (const transaction of state.transactions) {
    if (transaction.kind === 'saving' && transaction.goalId) {
      progress[transaction.goalId] = fromCents(toCents(progress[transaction.goalId] ?? 0) + toCents(transaction.amount))
    }
  }
  return progress
}

export function calculateHealthFactors(
  projectedEnd: number,
  savingsProgress: number,
  savingsTarget: number,
  paceOverrun: number,
  dailyAllowance: number,
): HealthFactor[] {
  return [
    {
      id: 'forecast',
      title: 'Day-30 cash-flow forecast',
      detail: projectedEnd < 1_500
        ? `Projected end balance is ${formatINR(projectedEnd)}, below the ₹1,500 planning threshold.`
        : `Projected end balance is ${formatINR(projectedEnd)}, at or above the ₹1,500 planning threshold.`,
      pointsDeducted: projectedEnd < 1_500 ? 22 : 0,
      maximumDeduction: 22,
    },
    {
      id: 'savings',
      title: 'Progress toward savings goals',
      detail: savingsTarget > 0
        ? `${Math.round((savingsProgress / savingsTarget) * 100)}% of combined savings-goal targets funded.`
        : 'No savings goals are configured.',
      pointsDeducted: savingsTarget > 0 && savingsProgress / savingsTarget < 0.5 ? 15 : 0,
      maximumDeduction: 15,
    },
    {
      id: 'pace',
      title: 'Spending pace vs. straight-line budget',
      detail: paceOverrun > 0
        ? `Completed expenses are ${formatINR(paceOverrun)} above the even daily budget benchmark.`
        : 'Completed expenses are at or below the even daily budget benchmark.',
      pointsDeducted: paceOverrun > 0 ? 12 : 0,
      maximumDeduction: 12,
    },
    {
      id: 'allowance',
      title: 'Daily spendable balance',
      detail: `${formatINR(dailyAllowance)} per remaining day after pending commitments.`,
      pointsDeducted: dailyAllowance < 200 ? 10 : 0,
      maximumDeduction: 10,
    },
  ]
}

export function calculateMetrics(state: FinancialState): FinanceMetrics {
  validateFinancialState(state)
  const categorySpending = calculateCategorySpending(state.transactions)
  const spending = sumMoney(Object.values(categorySpending))
  const income = sumMoney(state.transactions.filter((transaction) => transaction.kind === 'income').map((transaction) => transaction.amount))
  const savings = sumMoney(state.transactions.filter((transaction) => transaction.kind === 'saving').map((transaction) => transaction.amount))
  const available = calculateActualAvailableBalance(state)
  const commitments = calculateReservedCommitments(state)
  const spendable = sumMoney([available, -commitments])
  const remainingDays = Math.max(state.planLength - state.currentDay, 0)
  const savingsTarget = sumMoney(state.goals.map((goal) => goal.target))
  const goalProgress = calculateGoalProgress(state)
  const savingsProgress = sumMoney(Object.values(goalProgress))
  const averageDailySpend = spending / Math.max(state.currentDay, 1)
  const dailyAllowance = remainingDays > 0 ? spendable / remainingDays : spendable
  const paceOverrun = Math.max(spending - (state.startingFunds * state.currentDay) / state.planLength, 0)
  const projectedEnd = available - averageDailySpend * remainingDays - commitments
  const healthFactors = calculateHealthFactors(projectedEnd, savingsProgress, savingsTarget, paceOverrun, dailyAllowance)
  const healthScore = Math.max(0, 100 - healthFactors.reduce((total, factor) => total + factor.pointsDeducted, 0))
  const riskExplanations = healthFactors
    .filter((factor) => factor.pointsDeducted > 0)
    .map((factor) => factor.detail)
  const emergencyGoal = state.goals.find((goal) => goal.id === 'emergency')
  const emergencyReserveRemaining = emergencyGoal
    ? Math.max(emergencyGoal.target - (goalProgress.emergency ?? 0), 0)
    : 0
  if (emergencyGoal && emergencyReserveRemaining > 0) {
    riskExplanations.push(`Emergency reserve is ${formatINR(emergencyReserveRemaining)} short of its ${formatINR(emergencyGoal.target)} goal.`)
  }

  return {
    startingFunds: state.startingFunds,
    planLength: state.planLength,
    currentDay: state.currentDay,
    income,
    spending,
    categorySpending,
    savings,
    available,
    totalCash: sumMoney([available, savings]),
    commitments,
    spendable,
    remainingDays,
    dailyAllowance,
    averageDailySpend,
    projectedEnd,
    savingsTarget,
    savingsProgress,
    goalProgress,
    healthScore,
    healthFactors,
    riskExplanations,
    emergencyReserveRemaining,
    paceOverrun,
  }
}

export function projectCashFlow(
  state: FinancialState,
  metrics = calculateMetrics(state),
): CashFlowPoint[] {
  validateFinancialState(state)
  return Array.from({ length: state.planLength }, (_, index) => {
    const day = index + 1
    const projected = day > state.currentDay
    if (!projected) {
      const cutoff = dateForPlanDay(day)
      const balance = state.startingFunds + state.transactions
        .filter((transaction) => transaction.date <= cutoff)
        .reduce((total, transaction) => total + (transaction.kind === 'income' ? transaction.amount : -transaction.amount), 0)
      return { day, balance, projected: false }
    }

    const daysAhead = day - state.currentDay
    const projectedExpenses = metrics.averageDailySpend * daysAhead
    const commitmentsDue = state.commitments
      .filter((commitment) => commitment.status === 'pending' && commitment.dueDay <= day)
      .reduce((total, commitment) => total + commitment.amount, 0)
    return {
      day,
      balance: metrics.available - projectedExpenses - commitmentsDue,
      projected: true,
    }
  })
}

function validateScenario(state: FinancialState, scenario: FinancialScenario): void {
  validateIdentity(scenario.id, 'Scenario ID')
  validateIdentity(scenario.title, 'Scenario name')
  validateIdentity(scenario.category, 'Scenario category')
  validateMoneyAmount(scenario.amount, 'Scenario amount')
  if (!['purchase', 'subscription', 'unexpected', 'income', 'saving'].includes(scenario.kind)) {
    throw new TypeError('Unsupported financial scenario type.')
  }
  if (scenario.kind === 'saving' && !state.goals.some((goal) => goal.id === scenario.goalId)) {
    throw new TypeError('Choose an existing savings goal for this contribution.')
  }
}

function applyDecisionToCandidate(
  state: FinancialState,
  scenario: FinancialScenario,
  decisionId: string,
  date: string,
): FinancialState {
  validateScenario(state, scenario)
  validateIdentity(decisionId, 'Decision ID')
  validatePlanDate(state, date)

  if (scenario.kind === 'subscription') {
    const commitment: Commitment = {
      id: `bill-${decisionId}`,
      title: scenario.title,
      category: scenario.category,
      amount: scenario.amount,
      dueDay: Math.min(state.currentDay + 1, state.planLength),
      status: 'pending',
    }
    return { ...state, commitments: [...state.commitments, commitment] }
  }

  const transaction: Transaction = {
    id: `tx-${decisionId}`,
    title: scenario.title,
    category: scenario.category,
    amount: scenario.amount,
    kind: scenario.kind === 'income' ? 'income' : scenario.kind === 'saving' ? 'saving' : 'expense',
    date,
    goalId: scenario.kind === 'saving' ? scenario.goalId : undefined,
  }
  return { ...state, transactions: [...state.transactions, transaction] }
}

export function previewScenario(state: FinancialState, scenario: FinancialScenario): ScenarioPreview {
  validateFinancialState(state)
  const before = calculateMetrics(state)
  const candidate = applyDecisionToCandidate(state, scenario, `preview-${scenario.id}`, dateForPlanDay(state.currentDay))
  const after = calculateMetrics(candidate)
  const changes = {
    available: after.available - before.available,
    dailyAllowance: after.dailyAllowance - before.dailyAllowance,
    savingsProgress: after.savingsProgress - before.savingsProgress,
    projectedEnd: after.projectedEnd - before.projectedEnd,
    healthScore: after.healthScore - before.healthScore,
  }
  const explanation = scenario.kind === 'income'
    ? `${formatINR(scenario.amount)} in extra income increases available cash.`
    : scenario.kind === 'saving'
      ? `${formatINR(scenario.amount)} moves from available cash to the selected savings allocation; total cash is unchanged.`
      : scenario.kind === 'subscription'
        ? `${formatINR(scenario.amount)} is reserved for a future payment; available cash changes only when it is paid.`
        : `${formatINR(scenario.amount)} is added to completed expenses.`

  return { before, after, changes, explanation }
}

export function applyDecision(
  state: FinancialState,
  scenario: FinancialScenario,
  decisionId: string,
  date = dateForPlanDay(state.currentDay),
): FinancialState {
  validateFinancialState(state)
  validateScenario(state, scenario)
  validateIdentity(decisionId, 'Decision ID')
  if (state.appliedDecisionIds.includes(decisionId)) return state
  const candidate = applyDecisionToCandidate(state, scenario, decisionId, date)
  const nextState = { ...candidate, appliedDecisionIds: [...state.appliedDecisionIds, decisionId] }
  validateFinancialState(nextState)
  return nextState
}

export function addTransaction(state: FinancialState, transaction: Transaction): FinancialState {
  validateFinancialState(state)
  validateTransaction(state, transaction)
  if (transaction.date > dateForPlanDay(state.currentDay)) {
    throw new RangeError('New transactions must be dated on or before the current plan day.')
  }
  if (state.transactions.some((item) => item.id === transaction.id)) {
    throw new TypeError(`Transaction ID ${transaction.id} already exists.`)
  }
  const nextState = { ...state, transactions: [...state.transactions, { ...transaction }] }
  validateFinancialState(nextState)
  return nextState
}

export function payCommitment(state: FinancialState, commitmentId: string, date = dateForPlanDay(state.currentDay)): FinancialState {
  validateFinancialState(state)
  const commitment = state.commitments.find((item) => item.id === commitmentId)
  if (!commitment) throw new TypeError(`Commitment ${commitmentId} does not exist.`)
  if (commitment.status === 'paid') return state
  const nextState: FinancialState = {
    ...state,
    commitments: state.commitments.map((item) => item.id === commitmentId ? { ...item, status: 'paid' } : item),
    transactions: [...state.transactions, {
      id: `tx-payment-${commitment.id}`,
      title: commitment.title,
      category: commitment.category,
      amount: commitment.amount,
      kind: 'expense',
      date,
      commitmentId: commitment.id,
    }],
  }
  validateFinancialState(nextState)
  return nextState
}

export function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Math.round(amount))
}
