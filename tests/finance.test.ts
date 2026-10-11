import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  addTransaction,
  applyDecision,
  calculateActualAvailableBalance,
  calculateMetrics,
  calculateReservedCommitments,
  createDemoState,
  dateForPlanDay,
  payCommitment,
  previewScenario,
  projectCashFlow,
  validateFinancialState,
  type FinancialScenario,
} from '../src/lib/finance.ts'

const purchaseScenario = (amount = 500): FinancialScenario => ({
  id: 'scenario-purchase',
  kind: 'purchase',
  title: 'A considered purchase',
  amount,
  category: 'Shopping',
  goalId: 'emergency',
})

describe('MINTFLOW financial engine', () => {
  it('starts with ₹10,000 and separates available cash, allocated savings, and reserved bills', () => {
    const state = createDemoState()
    const metrics = calculateMetrics(state)

    assert.equal(metrics.startingFunds, 10_000)
    assert.equal(metrics.available, 6_969)
    assert.equal(metrics.savings, 1_400)
    assert.equal(metrics.totalCash, 8_369)
    assert.equal(metrics.spending, 4_131)
    assert.equal(metrics.commitments, 1_599)
    assert.equal(metrics.spendable, 5_370)
    assert.equal(metrics.totalCash + metrics.spending, 10_000 + metrics.income)
  })

  it('previews a purchase without mutating the actual state', () => {
    const state = createDemoState()
    const original = structuredClone(state)
    const preview = previewScenario(state, purchaseScenario())

    assert.deepEqual(state, original)
    assert.equal(preview.before.available, 6_969)
    assert.equal(preview.after.available, 6_469)
    assert.equal(preview.changes.available, -500)
  })

  it('applies a confirmed purchase exactly once', () => {
    const state = createDemoState()
    const scenario = purchaseScenario()
    const applied = applyDecision(state, scenario, scenario.id)
    const duplicate = applyDecision(applied, scenario, scenario.id)

    assert.equal(applied.transactions.length, state.transactions.length + 1)
    assert.equal(applied.transactions.filter((transaction) => transaction.id === 'tx-scenario-purchase').length, 1)
    assert.equal(calculateMetrics(applied).available, 6_469)
    assert.equal(duplicate, applied)
  })

  it('applies an upcoming subscription as a reservation rather than an expense', () => {
    const state = createDemoState()
    const subscription: FinancialScenario = {
      id: 'scenario-subscription',
      kind: 'subscription',
      title: 'Music subscription',
      amount: 149,
      category: 'Subscriptions',
      goalId: '',
    }
    const preview = previewScenario(state, subscription)
    const applied = applyDecision(state, subscription, subscription.id)

    assert.equal(preview.after.available, preview.before.available)
    assert.equal(preview.after.commitments, preview.before.commitments + 149)
    assert.equal(preview.after.spendable, preview.before.spendable - 149)
    assert.equal(calculateMetrics(applied).spending, calculateMetrics(state).spending)
    assert.equal(calculateMetrics(applied).commitments, calculateMetrics(state).commitments + 149)
  })

  it('updates available cash consistently for income and unexpected expenses', () => {
    const state = createDemoState()
    const withIncome = applyDecision(state, {
      id: 'scenario-income',
      kind: 'income',
      title: 'A little freelance work',
      amount: 1_200,
      category: 'Freelance',
      goalId: '',
    }, 'income-1')
    const withUnexpectedExpense = applyDecision(withIncome, {
      id: 'scenario-unexpected',
      kind: 'unexpected',
      title: 'Replacement charger',
      amount: 750,
      category: 'Unexpected',
      goalId: '',
    }, 'unexpected-1')

    assert.equal(calculateMetrics(withIncome).available, 8_169)
    assert.equal(calculateMetrics(withUnexpectedExpense).income, 3_700)
    assert.equal(calculateMetrics(withUnexpectedExpense).spending, 4_881)
    assert.equal(calculateMetrics(withUnexpectedExpense).available, 7_419)
    assert.equal(calculateMetrics(withUnexpectedExpense).totalCash, 8_819)
  })

  it('reserves a commitment once and turns payment into spending without double-counting', () => {
    const state = createDemoState()
    const before = calculateMetrics(state)
    const paid = payCommitment(state, 'bill-1')
    const after = calculateMetrics(paid)

    assert.equal(calculateReservedCommitments(state), 1_599)
    assert.equal(before.spendable, 5_370)
    assert.equal(after.commitments, 1_200)
    assert.equal(after.spending, 4_530)
    assert.equal(after.available, 6_570)
    assert.equal(after.spendable, 5_370)
    assert.equal(paid.transactions.filter((transaction) => transaction.commitmentId === 'bill-1').length, 1)
    assert.equal(payCommitment(paid, 'bill-1'), paid)
  })

  it('records savings contributions in goal progress without creating or destroying total cash', () => {
    const state = createDemoState()
    const before = calculateMetrics(state)
    const contribution = {
      id: 'tx-savings-1',
      title: 'Safety net top-up',
      category: 'Emergency fund',
      amount: 600,
      kind: 'saving' as const,
      date: dateForPlanDay(state.currentDay),
      goalId: 'emergency',
    }
    const updated = addTransaction(state, contribution)
    const after = calculateMetrics(updated)

    assert.equal(after.available, before.available - 600)
    assert.equal(after.savings, before.savings + 600)
    assert.equal(after.totalCash, before.totalCash)
    assert.equal(after.goalProgress.emergency, 1_600)
    assert.equal(after.savingsProgress, 2_000)
  })

  it('preserves cent precision when summing valid monetary inputs', () => {
    const state = createDemoState()
    const first = addTransaction(state, {
      id: 'tx-cent-1',
      title: 'Small expense one',
      category: 'Other',
      amount: 0.29,
      kind: 'expense',
      date: dateForPlanDay(state.currentDay),
    })
    const second = addTransaction(first, {
      id: 'tx-cent-2',
      title: 'Small expense two',
      category: 'Other',
      amount: 0.1,
      kind: 'expense',
      date: dateForPlanDay(state.currentDay),
    })

    assert.equal(calculateMetrics(second).categorySpending.Other, 0.39)
  })

  it('calculates daily allowance and a 30-day forecast after reserved bills', () => {
    const state = createDemoState()
    const metrics = calculateMetrics(state)
    const forecast = projectCashFlow(state)
    const projectedEnd = metrics.available - (metrics.spending / state.currentDay) * metrics.remainingDays - metrics.commitments

    assert.equal(metrics.remainingDays, 19)
    assert.equal(metrics.dailyAllowance, 5_370 / 19)
    assert.equal(metrics.projectedEnd, projectedEnd)
    assert.equal(forecast.length, 30)
    assert.equal(forecast[10]?.projected, false)
    assert.equal(forecast[10]?.balance, metrics.available)
    assert.equal(forecast[29]?.projected, true)
    assert.equal(forecast[29]?.balance, metrics.projectedEnd)
    assert.deepEqual(projectCashFlow(state, metrics), forecast)
  })

  it('uses spendable cash as the day-30 allowance when no days remain', () => {
    const state = { ...createDemoState(), currentDay: 30 }
    const metrics = calculateMetrics(state)
    const finalForecast = projectCashFlow(state).at(-1)

    assert.equal(metrics.remainingDays, 0)
    assert.equal(metrics.dailyAllowance, metrics.spendable)
    assert.equal(finalForecast?.balance, metrics.available)
    assert.equal(metrics.projectedEnd, metrics.spendable)
  })

  it('rejects invalid, unsupported, and over-precision monetary amounts', () => {
    const state = createDemoState()
    const invalidAmounts = [0, -1, Number.NaN, Number.POSITIVE_INFINITY, 1_000_001, 1.001]

    for (const amount of invalidAmounts) {
      assert.throws(() => previewScenario(state, purchaseScenario(amount)), RangeError)
      assert.throws(() => addTransaction(state, {
        id: `invalid-${String(amount)}`,
        title: 'Invalid expense',
        category: 'Other',
        amount,
        kind: 'expense',
        date: dateForPlanDay(state.currentDay),
      }), RangeError)
    }
  })

  it('produces a deterministic health score and explicit explanations for each deduction', () => {
    const metrics = calculateMetrics(createDemoState())

    assert.equal(metrics.healthScore, 51)
    assert.deepEqual(metrics.healthFactors.map((factor) => factor.pointsDeducted), [22, 15, 12, 0])
    assert.equal(metrics.riskExplanations.length, 4)
    assert.match(metrics.healthFactors[0]?.detail ?? '', /below the ₹1,500 planning threshold/)
    assert.match(metrics.healthFactors[1]?.detail ?? '', /18% of combined savings-goal targets funded/)
    assert.match(metrics.healthFactors[2]?.detail ?? '', /above the even daily budget benchmark/)
    assert.match(metrics.riskExplanations[3] ?? '', /Emergency reserve is ₹4,000 short/)
  })

  it('leaves actual records unchanged when a scenario is abandoned and restores demo data on reset', () => {
    const state = createDemoState()
    const original = structuredClone(state)
    previewScenario(state, purchaseScenario(999))
    const reset = createDemoState()

    assert.deepEqual(state, original)
    assert.deepEqual(reset, original)
    assert.notEqual(reset.transactions, state.transactions)
    assert.equal(calculateActualAvailableBalance(reset), 6_969)
    assert.doesNotThrow(() => validateFinancialState(reset))
  })
})
