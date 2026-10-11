# MINTFLOW

MINTFLOW is a self-contained, educational 30-day money-planning demo. It is for people who want a clearer picture of day-to-day spending, upcoming bills, and savings progress without connecting a bank account or being told what financial choice to make. It is a planning aid, not financial advice.

## What it does

- **Overview:** Shows available cash, income, expenses, savings allocations, reserved commitments, and a daily safe-to-spend estimate. The cash-flow chart distinguishes recorded balances from a projection based on recent spending.
- **Transactions:** Records dated income, expenses, and savings transfers, with date and category filters.
- **Budget:** Groups completed expenses by category and compares actual spending with a straight-line benchmark.
- **Savings goals:** Tracks contributions against the demo goals. A contribution moves cash into a savings allocation; it does not create or destroy total cash.
- **Commitments:** Reserves pending bills from spendable cash. Marking a bill paid moves it into recorded expenses without counting it twice.
- **Decision Studio:** Previews a purchase, subscription, unexpected expense, income, or savings contribution before applying it. Nothing is recorded until it is confirmed.
- **Financial health:** Explains a deterministic, educational 0–100 indicator using the forecast, savings progress, spending pace, and daily allowance. It is not a credit score or a prediction.
- **Settings:** Changes the current day of the demo plan or restores its original sample data.
- **Minti:** An optional, rule-based companion that answers a limited set of questions from the current plan and links to relevant screens. It is not an AI adviser and cannot access external accounts.

## Technology and architecture

- React 19 and TypeScript
- Vite 8 for local development and production builds
- Native browser `localStorage` for persistence
- Node's built-in test runner for finance, Minti, and persistence tests
- Oxlint for linting

The app is a client-side single-page application. `src/App.tsx` coordinates navigation, forms, and screen composition; `src/components/MintiCompanion.tsx` owns the companion UI; and `src/lib/finance.ts` contains validated financial state transitions and calculations. `src/lib/persistence.ts` isolates storage access and validates saved data before using it. There is no backend, account integration, or network-based financial service.

## Requirements

- Node.js 20.19+ or 22.12+ (Vite 8 requirement)
- npm

## Setup and commands

```sh
npm ci
npm run dev
```

Other project commands:

```sh
npm test       # Run the finance, Minti, and persistence test suites
npm run lint   # Run Oxlint
npm run build  # Type-check and create the production bundle in dist/
npm run preview
```

## Data and limitations

On first load, MINTFLOW creates a sample plan and attempts to save it in the current browser's `localStorage`. Changes stay in that browser on that device; they are not synchronized, backed up, or encrypted by the app. If storage is blocked, changes remain available for the current session only. Invalid or unsupported saved data is replaced with the sample scenario.

The plan uses INR, sample transactions, a fixed 30-day calendar beginning October 1, 2026, and illustrative commitments and goals. Financial projections assume recent expense pace continues and are not guarantees. MINTFLOW does not connect to banks, move money, provide personalized financial advice, or use an external AI service. Clearing browser storage removes the locally saved plan.
