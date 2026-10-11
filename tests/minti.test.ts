import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { calculateMetrics, createDemoState, type FinancialState } from '../src/lib/finance.ts'
import { replyAsMinti, selectMintiMoment } from '../src/lib/minti.ts'

describe('Minti companion rules', () => {
  it('selects a warning from the engine forecast explanation', () => {
    const state = createDemoState()
    const moment = selectMintiMoment(state, calculateMetrics(state))

    assert.equal(moment.mood, 'warning')
    assert.match(moment.message, /Projected end balance/)
    assert.equal(moment.actionSection, 'health')
  })

  it('answers balance and budget questions with current shared metrics', () => {
    const state = createDemoState()
    const balanceReply = replyAsMinti('What’s my balance?', state, calculateMetrics(state))
    const budgetReply = replyAsMinti('How is my budget doing?', state, calculateMetrics(state))

    assert.match(balanceReply.message, /current available cash is ₹6,969/)
    assert.match(balanceReply.message, /₹5,370 spendable/)
    assert.match(budgetReply.message, /₹4,131 of ₹10,000 starting funds/)
    assert.match(budgetReply.message, /₹464 above the straight-line plan pace/)
  })

  it('answers affordability amounts from current spendable funds without mutating state', () => {
    const state = createDemoState()
    const before = structuredClone(state)
    const reply = replyAsMinti('Can I afford ₹6,000?', state, calculateMetrics(state))

    assert.match(reply.message, /₹6,000 is above that current spendable amount/)
    assert.equal(reply.actionSection, 'simulator')
    assert.equal(reply.purchaseAmount, 6_000)
    assert.deepEqual(state, before)
  })

  it('celebrates a goal funded by real savings transactions', () => {
    const state = createDemoState()
    const celebrated: FinancialState = {
      ...state,
      transactions: [
        ...state.transactions,
        { id: 'goal-finish', title: 'Final top-up', category: 'Emergency fund', amount: 4_000, kind: 'saving', date: '2026-10-11', goalId: 'emergency' },
      ],
    }
    const moment = selectMintiMoment(celebrated, calculateMetrics(celebrated))

    assert.equal(moment.mood, 'success')
    assert.match(moment.message, /Safety net is fully funded/)
  })

  it('responds to an unexpected expense with support and a what-if path', () => {
    const state = createDemoState()
    const updated: FinancialState = {
      ...state,
      transactions: [
        ...state.transactions,
        { id: 'unexpected-test', title: 'A lost key', category: 'Unexpected', amount: 250, kind: 'expense', date: '2026-10-11' },
      ],
    }
    const moment = selectMintiMoment(updated, calculateMetrics(updated))

    assert.equal(moment.mood, 'helpful')
    assert.match(moment.message, /part of the plan now/)
    assert.equal(moment.actionSection, 'simulator')
  })

  it('provides a simulator path for a purchase without changing financial records', () => {
    const state = createDemoState()
    const before = structuredClone(state)
    const reply = replyAsMinti('Can I afford ₹1,200 headphones?', state, calculateMetrics(state))

    assert.equal(reply.actionSection, 'simulator')
    assert.equal(reply.purchaseAmount, 1_200)
    assert.match(reply.message, /₹5,370 spendable/)
    assert.deepEqual(state, before)
  })

  it('answers savings and financial-health prompts from current engine metrics', () => {
    const state = createDemoState()
    const metrics = calculateMetrics(state)
    const savingReply = replyAsMinti('Help me save', state, metrics)
    const healthReply = replyAsMinti('How am I doing?', state, metrics)

    assert.match(savingReply.message, /₹1,400 of ₹8,000/)
    assert.equal(savingReply.scenarioKind, 'saving')
    assert.equal(savingReply.actionSection, 'simulator')
    assert.match(healthReply.message, /51 out of 100/)
    assert.equal(healthReply.actionSection, 'health')
  })

  it('uses a happy mood on a fresh plan and encouraging mood when the forecast is steady', () => {
    const state = createDemoState()
    const freshState: FinancialState = { ...state, currentDay: 1, transactions: [] }
    assert.equal(selectMintiMoment(freshState, calculateMetrics(freshState)).mood, 'happy')

    const steadyState: FinancialState = {
      ...state,
      startingFunds: 50_000,
      transactions: state.transactions.filter((transaction) => transaction.kind !== 'expense'),
    }
    assert.equal(selectMintiMoment(steadyState, calculateMetrics(steadyState)).mood, 'encouraging')
  })

  it('is transparent about unsupported prompts and excessive purchase amounts', () => {
    const state = createDemoState()
    const metrics = calculateMetrics(state)

    assert.match(replyAsMinti('Tell me a joke', state, metrics).message, /rule-based money companion/)
    assert.match(replyAsMinti('Can I afford ₹2,000,000?', state, metrics).message, /supports amounts up to/)
  })
})
