import { createDemoState, validateFinancialState, type FinancialState } from './finance.ts'

export const FINANCIAL_STATE_STORAGE_KEY = 'mintflow:financial-state'
export const FINANCIAL_STATE_SCHEMA_VERSION = 1

export type StorageAdapter = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export type FinancialStateLoadResult = {
  state: FinancialState
  status: 'loaded' | 'missing' | 'recovered' | 'unavailable'
}

function getBrowserStorage(): StorageAdapter | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasOnlyKeys(value: Record<string, unknown>, allowedKeys: string[]): boolean {
  return Object.keys(value).every((key) => allowedKeys.includes(key))
}

function isTransaction(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ['id', 'title', 'category', 'amount', 'kind', 'date', 'note', 'goalId', 'commitmentId']) &&
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    typeof value.category === 'string' &&
    typeof value.amount === 'number' &&
    ['expense', 'income', 'saving'].includes(String(value.kind)) &&
    typeof value.date === 'string' &&
    (value.note === undefined || typeof value.note === 'string') &&
    (value.goalId === undefined || typeof value.goalId === 'string') &&
    (value.commitmentId === undefined || typeof value.commitmentId === 'string')
  )
}

function isCommitment(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ['id', 'title', 'category', 'amount', 'dueDay', 'status']) &&
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    typeof value.category === 'string' &&
    typeof value.amount === 'number' &&
    typeof value.dueDay === 'number' &&
    (value.status === 'pending' || value.status === 'paid')
  )
}

function isGoal(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ['id', 'name', 'target', 'category', 'color']) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.target === 'number' &&
    typeof value.category === 'string' &&
    typeof value.color === 'string'
  )
}

function isFinancialStateShape(value: unknown): value is FinancialState {
  if (!isRecord(value)) return false
  return (
    hasOnlyKeys(value, [
      'startingFunds',
      'planLength',
      'currentDay',
      'transactions',
      'commitments',
      'goals',
      'appliedDecisionIds',
    ]) &&
    typeof value.startingFunds === 'number' &&
    typeof value.planLength === 'number' &&
    typeof value.currentDay === 'number' &&
    Array.isArray(value.transactions) && value.transactions.every(isTransaction) &&
    Array.isArray(value.commitments) && value.commitments.every(isCommitment) &&
    Array.isArray(value.goals) && value.goals.every(isGoal) &&
    Array.isArray(value.appliedDecisionIds) && value.appliedDecisionIds.every((id) => typeof id === 'string')
  )
}

export function loadFinancialState(storage: StorageAdapter | null = getBrowserStorage()): FinancialStateLoadResult {
  if (!storage) return { state: createDemoState(), status: 'unavailable' }

  let raw: string | null
  try {
    raw = storage.getItem(FINANCIAL_STATE_STORAGE_KEY)
  } catch {
    return { state: createDemoState(), status: 'unavailable' }
  }
  if (raw === null) {
    const state = createDemoState()
    return {
      state,
      status: saveFinancialState(state, storage) ? 'missing' : 'unavailable',
    }
  }

  try {
    const parsed: unknown = JSON.parse(raw)
    if (
      !isRecord(parsed) ||
      !hasOnlyKeys(parsed, ['version', 'state']) ||
      parsed.version !== FINANCIAL_STATE_SCHEMA_VERSION ||
      !isFinancialStateShape(parsed.state)
    ) {
      throw new TypeError('Saved plan has an unsupported format or version.')
    }

    validateFinancialState(parsed.state)
    return { state: parsed.state, status: 'loaded' }
  } catch {
    try {
      storage.removeItem(FINANCIAL_STATE_STORAGE_KEY)
    } catch {
      // Keep the demo usable even if a browser blocks storage cleanup.
    }
    const state = createDemoState()
    return {
      state,
      status: saveFinancialState(state, storage) ? 'recovered' : 'unavailable',
    }
  }
}

export function saveFinancialState(
  state: FinancialState,
  storage: StorageAdapter | null = getBrowserStorage(),
): boolean {
  if (!storage) return false

  try {
    if (!isFinancialStateShape(state)) return false
    validateFinancialState(state)
    storage.setItem(
      FINANCIAL_STATE_STORAGE_KEY,
      JSON.stringify({ version: FINANCIAL_STATE_SCHEMA_VERSION, state }),
    )
    return true
  } catch {
    return false
  }
}

export function resetPersistedFinancialState(storage: StorageAdapter | null = getBrowserStorage()): boolean {
  return saveFinancialState(createDemoState(), storage)
}
