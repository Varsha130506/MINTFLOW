import { formatINR, MAX_TRANSACTION_AMOUNT, type FinanceMetrics, type FinancialState, type ScenarioKind } from './finance.ts'

export type MintiMood = 'happy' | 'encouraging' | 'warning' | 'helpful' | 'success'
export type MintiActionSection = 'simulator' | 'savings' | 'health' | 'budget'

export type MintiMoment = {
  mood: MintiMood
  message: string
  actionLabel: string
  actionSection: MintiActionSection
}

export type MintiReply = {
  message: string
  actionLabel?: string
  actionSection?: MintiActionSection
  purchaseAmount?: number
  scenarioKind?: ScenarioKind
}

const format = (amount: number) => formatINR(amount)

export function selectMintiMoment(state: FinancialState, metrics: FinanceMetrics): MintiMoment {
  const completedGoal = state.goals.find((goal) => (metrics.goalProgress[goal.id] ?? 0) >= goal.target)
  if (completedGoal) {
    return {
      mood: 'success',
      message: `${completedGoal.name} is fully funded. Take a moment to enjoy that progress.`,
      actionLabel: 'See my goals',
      actionSection: 'savings',
    }
  }

  if (metrics.currentDay === 1 && metrics.spending === 0) {
    return {
      mood: 'happy',
      message: 'A fresh start, at your pace. I’m here if you want a little clarity.',
      actionLabel: 'See my money check-in',
      actionSection: 'health',
    }
  }

  const recentUnexpected = [...state.transactions]
    .filter((transaction) => transaction.kind === 'expense' && transaction.category.toLowerCase() === 'unexpected')
    .sort((first, second) => second.date.localeCompare(first.date))[0]
  if (recentUnexpected) {
    return {
      mood: 'helpful',
      message: `That ${recentUnexpected.title.toLowerCase()} is part of the plan now. Take a breath; you can explore what feels manageable next.`,
      actionLabel: 'Explore a what-if',
      actionSection: 'simulator',
    }
  }

  const forecastFactor = metrics.healthFactors.find((factor) => factor.id === 'forecast')
  if (forecastFactor?.pointsDeducted) {
    return {
      mood: 'warning',
      message: `A gentle heads-up: ${forecastFactor.detail} Your projection is a planning signal, not a promise.`,
      actionLabel: 'Review my plan',
      actionSection: 'health',
    }
  }

  const paceFactor = metrics.healthFactors.find((factor) => factor.id === 'pace')
  if (paceFactor?.pointsDeducted) {
    return {
      mood: 'helpful',
      message: `${paceFactor.detail} A quick category check can help you decide what matters most next.`,
      actionLabel: 'Review categories',
      actionSection: 'budget',
    }
  }

  if (metrics.savingsProgress > 0) {
    return {
      mood: 'encouraging',
      message: `You’ve set aside ${format(metrics.savingsProgress)} toward your goals. Small, steady steps count.`,
      actionLabel: 'See my goals',
      actionSection: 'savings',
    }
  }

  return {
    mood: 'encouraging',
    message: 'You’re checking in with your money, and that’s a solid place to start.',
    actionLabel: 'See my plan',
    actionSection: 'health',
  }
}

export function replyAsMinti(
  prompt: string,
  state: FinancialState,
  metrics: FinanceMetrics,
): MintiReply {
  const normalized = prompt.trim().toLowerCase()

  if (/\b(can i afford|afford|buy|purchase|spend on)\b/.test(normalized)) {
    const amountMatch = normalized.match(/₹?\s*([\d,]+(?:\.\d{1,2})?)/)
    const purchaseAmount = amountMatch ? Number(amountMatch[1].replaceAll(',', '')) : undefined
    if (purchaseAmount !== undefined && (!Number.isFinite(purchaseAmount) || purchaseAmount > MAX_TRANSACTION_AMOUNT)) {
      return {
        message: `The simulator supports amounts up to ${format(MAX_TRANSACTION_AMOUNT)}. You can enter a supported amount there to compare the impact before deciding.`,
        actionLabel: 'Open Decision Studio',
        actionSection: 'simulator',
      }
    }
    return {
      message: `You have ${format(metrics.spendable)} spendable after pending commitments.${purchaseAmount === undefined ? '' : ` ${format(purchaseAmount)} is ${purchaseAmount > metrics.spendable ? 'above' : 'within'} that current spendable amount before considering your other plans.`} I can’t decide what is affordable for you, but the simulator can compare a purchase with your balance and plan before anything is recorded.`,
      actionLabel: purchaseAmount ? `Compare ${format(purchaseAmount)} in Decision Studio` : 'Open Decision Studio',
      actionSection: 'simulator',
      purchaseAmount,
      scenarioKind: 'purchase',
    }
  }

  if (/\b(balance|available cash|spendable|how much.*(have|left|available)|cash left)\b/.test(normalized)) {
    return {
      message: `Your current available cash is ${format(metrics.available)}. Of that, ${format(metrics.commitments)} is reserved for pending commitments, leaving ${format(metrics.spendable)} spendable. Savings allocations are tracked separately at ${format(metrics.savings)}.`,
      actionLabel: 'Review my plan',
      actionSection: 'health',
    }
  }

  if (/\b(save|saving|savings|goal|goals)\b/.test(normalized)) {
    const goalSummary = state.goals.length
      ? state.goals.map((goal) => `${goal.name}: ${format(metrics.goalProgress[goal.id] ?? 0)} of ${format(goal.target)}`).join('; ')
      : 'You have no savings goals set up right now.'
    return {
      message: `Your current savings progress is ${format(metrics.savingsProgress)} of ${format(metrics.savingsTarget)} across goals. ${goalSummary} You can preview a contribution without changing your records.`,
      actionLabel: 'Preview a contribution',
      actionSection: 'simulator',
      scenarioKind: 'saving',
    }
  }

  if (/\b(how am i|how['’]?s it going|health|score|plan)\b/.test(normalized)) {
    const explanation = metrics.riskExplanations[0]
      ?? `Your projected day-30 balance is ${format(metrics.projectedEnd)}.`
    return {
      message: `Your educational money check-in is ${metrics.healthScore} out of 100. You have ${format(metrics.spendable)} spendable and ${format(metrics.dailyAllowance)} per remaining day. ${explanation}`,
      actionLabel: 'See how the score works',
      actionSection: 'health',
    }
  }

  if (/\b(category|categories|budget|spending|spent|expense|expenses|allowance|safe to spend)\b/.test(normalized)) {
    const topCategory = Object.entries(metrics.categorySpending).sort((first, second) => second[1] - first[1])[0]
    const categorySummary = topCategory
      ? `${topCategory[0]} is currently your highest expense category at ${format(topCategory[1])}.`
      : 'There are no completed expenses in your plan yet.'
    const spendingIsOverPace = metrics.paceOverrun > 0
    return {
      message: `Your actual spending so far is ${format(metrics.spending)} of ${format(metrics.startingFunds)} starting funds. ${categorySummary} ${spendingIsOverPace ? `Spending is ${format(metrics.paceOverrun)} above the straight-line plan pace.` : 'Spending is at or below the straight-line plan pace.'} Your daily safe-to-spend amount is ${format(metrics.dailyAllowance)} after pending commitments. Reservations and savings transfers are tracked separately.`,
      actionLabel: 'Review my budget',
      actionSection: 'budget',
    }
  }

  return {
    message: 'I’m a rule-based money companion, not an AI adviser. I can help with your current balance, budget and safe-to-spend amount, purchase what-ifs, savings goals, and your plan check-in.',
    actionLabel: 'Explore a what-if',
    actionSection: 'simulator',
  }
}
