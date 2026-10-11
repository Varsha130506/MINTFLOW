import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createDemoState, type FinancialState } from '../src/lib/finance.ts'
import {
  FINANCIAL_STATE_SCHEMA_VERSION,
  FINANCIAL_STATE_STORAGE_KEY,
  loadFinancialState,
  resetPersistedFinancialState,
  saveFinancialState,
  type StorageAdapter,
} from '../src/lib/persistence.ts'

function createMemoryStorage(initial: Record<string, string> = {}): StorageAdapter {
  const data = new Map(Object.entries(initial))
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => { data.set(key, value) },
    removeItem: (key) => { data.delete(key) },
  }
}

describe('financial state persistence', () => {
  it('loads demo data when no saved state exists', () => {
    const result = loadFinancialState(createMemoryStorage())

    assert.equal(result.status, 'missing')
    assert.equal(result.state.startingFunds, 10_000)
  })

  it('persists and restores transactions, goals, commitments, plan day, and decisions', () => {
    const storage = createMemoryStorage()
    const state: FinancialState = {
      ...createDemoState(),
      currentDay: 14,
      appliedDecisionIds: ['decision-1'],
      transactions: [
        ...createDemoState().transactions,
        { id: 'persisted-income', title: 'Weekend work', category: 'Freelance', amount: 800, kind: 'income', date: '2026-10-14' },
      ],
      goals: createDemoState().goals.map((goal) => ({ ...goal, target: goal.target + 250 })),
      commitments: createDemoState().commitments.map((commitment) => ({ ...commitment })),
    }

    assert.equal(saveFinancialState(state, storage), true)
    const result = loadFinancialState(storage)
    assert.equal(result.status, 'loaded')
    assert.deepEqual(result.state, state)
  })

  it('rejects malformed, invalid, and outdated saved state and falls back to demo data', () => {
    for (const raw of [
      '{not valid json',
      JSON.stringify({ version: FINANCIAL_STATE_SCHEMA_VERSION - 1, state: createDemoState() }),
      JSON.stringify({ version: FINANCIAL_STATE_SCHEMA_VERSION, state: { ...createDemoState(), currentDay: 99 } }),
      JSON.stringify({ version: FINANCIAL_STATE_SCHEMA_VERSION, state: { ...createDemoState(), password: 'not-allowed' } }),
      JSON.stringify({ version: FINANCIAL_STATE_SCHEMA_VERSION, state: { ...createDemoState(), transactions: [null] } }),
    ]) {
      const storage = createMemoryStorage({ [FINANCIAL_STATE_STORAGE_KEY]: raw })
      const result = loadFinancialState(storage)

      assert.equal(result.status, 'recovered')
      assert.equal(result.state.currentDay, 11)
      assert.equal(
        JSON.parse(storage.getItem(FINANCIAL_STATE_STORAGE_KEY) ?? 'null').state.currentDay,
        11,
      )
    }
  })

  it('does not save an invalid state', () => {
    const storage = createMemoryStorage()
    const invalidState = { ...createDemoState(), currentDay: 0 }

    assert.equal(saveFinancialState(invalidState, storage), false)
    assert.equal(storage.getItem(FINANCIAL_STATE_STORAGE_KEY), null)
  })

  it('replaces saved changes with the demo scenario on reset', () => {
    const storage = createMemoryStorage()
    const changed = { ...createDemoState(), currentDay: 20 }
    assert.equal(saveFinancialState(changed, storage), true)

    assert.equal(resetPersistedFinancialState(storage), true)
    const restored = loadFinancialState(storage)
    assert.equal(restored.status, 'loaded')
    assert.deepEqual(restored.state, createDemoState())
  })

  it('recovers safely when the browser storage API is unavailable', () => {
    assert.equal(loadFinancialState(null).status, 'unavailable')
    assert.equal(saveFinancialState(createDemoState(), null), false)
    assert.equal(resetPersistedFinancialState(null), false)
  })

  it('reports unavailable storage access and failed writes without throwing', () => {
    const blockedStorage: StorageAdapter = {
      getItem: () => { throw new Error('Storage access denied') },
      setItem: () => { throw new Error('Storage quota exceeded') },
      removeItem: () => { throw new Error('Storage access denied') },
    }

    assert.equal(loadFinancialState(blockedStorage).status, 'unavailable')
    assert.equal(saveFinancialState(createDemoState(), blockedStorage), false)
  })
})
