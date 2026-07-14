# SafePay — Features & Security Architecture

SafePay has been upgraded with **seven major features** focused on transparent, self-hostable, explainable fraud detection and access control. This document details each feature's security architecture.

---

## 1. Explainable Fraud Decisions (Glass-Box Scoring)
- **Concept:** Traditional black-box vendors block payments without explanation. SafePay returns per-signal contributions (e.g., amount z-score, hourly risk, velocity) alongside plain-language reasoning.
- **Data Model:** Saved in the `Transaction` record under `fraud_explanation` (JSON column).
- **Access Control:** Gated by `transaction:read:own` (for cardholders inspecting their transactions) and `transaction:read:all` (for operations staff).

## 2. Customer Appeals Workflow
- **Concept:** When a transaction is blocked/flagged, cardholders can submit an appeal explaining the legitimacy of their payment. Operators review the pending appeal queue to approve/reject.
- **Data Model:** Appeal status fields (`appeal_status`, `appeal_reason`, `appeal_reviewed_by`, `appeal_reviewed_at`) in `Transaction`.
- **API Endpoints:**
  - `POST /appeals/transactions/{txn_id}` (Gated by `appeal:submit`)
  - `GET /appeals/pending` (Gated by `appeal:review`)
  - `PUT /appeals/{txn_id}/review` (Gated by `appeal:review`)

## 3. Fraud Rules Studio & Backtesting
- **Concept:** Enables operators to write custom logical rules (e.g., `amount > 500 AND hour_of_day < 6`) that execute alongside the ML model. Backtesting lets operators evaluate a rule against historical transaction data before deploying it.
- **Data Model:** `FraudRule` model containing JSON condition blocks.
- **API Endpoints:** Gated by `fraud_rules:manage` and `fraud_rules:test`.

## 4. Risk-Adaptive Step-Up 2FA
- **Concept:** If a transaction has a borderline fraud score (above `STEPUP_THRESHOLD` but below the absolute block threshold), the payment is placed in a `STEPUP_REQUIRED` state and prompts the user for a 6-digit SMS verification code.
- **Verification Service:** Managed in-memory in the backend step-up service (`app/services/stepup.py`) with short-lived TTLs (5 minutes) and cryptographically secure codes.

## 5. Privacy-Preserving Consortium Network
- **Concept:** Allows multiple federated instances of SafePay to share malicious risk signals (e.g., credit card hashes or IP addresses) without sharing actual client PII.
- **Mechanism:** Leverages **Bloom filters** exported as Base64 strings. Merges filters locally using logical OR operations.
- **API Endpoints:** Gated by `consortium:manage` (Admin only).

## 6. Observability Telemetry Dashboard
- **Concept:** Monitor real-time performance of the fraud engine and model status.
- **Telemetry Indicators:** Risk score distributions, firing rates of signals, and Kolmogorov-Smirnov drift analytics comparing recent scores against baseline statistics.
- **API Endpoints:** Gated by `analytics:view`.

## 7. Attack Simulation Sandbox & Dispute Predictor
- **Concept:** Allows testing of threshold rules by firing synthetic attack vectors (card testing, account takeover) in a safe environment. Pre-settlement scanner predicts chargeback probability using multi-factorial metrics.
- **API Endpoints:** Gated by `simulation:run` and `chargeback:view`.
