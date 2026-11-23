# Analytics data infrastructure

This directory contains the isolated data contracts, demonstration fixtures, and
pure calculations intended for the future analytics dashboard. It is not wired
to any current route or visual component.

## Money representation

All monetary values are non-negative integers in cents. For example, the
demonstration annual budget of R$ 180.000,00 is represented as `18_000_000`.
This avoids floating-point rounding errors in sums.

The demonstration fixture validates these invariants when imported:

- `available + provisioned + utilized = annualTotal`;
- no budget or aggregated monetary value is negative;
- provisioned requests equal the budget's provisioned amount;
- utilized requests and completed payments equal the budget's utilized amount.

## Provisional financial hypotheses

The following rules are hypotheses used only to shape the frontend contracts.
They are **not definitive business rules** and must be validated with the
backend and the department's financial domain owner before integration:

1. **Provisioning:** an approved request affects the provisioned balance only
   after an explicit provisioning event. Approval alone is represented as a
   pending situation.
2. **Payment:** a completed payment moves its amount from provisioned to
   utilized. Scheduled or cancelled payments do not increase utilized funds.
3. **Cancellation:** cancelling an unpaid provisioned request is expected to
   release its provisioned amount back to available funds.
4. **Return:** a refund or resource return is expected to reduce utilized funds
   and increase available funds, with an immutable audit event linking the
   original payment.
5. **Partial payment:** partially paid requests may have both provisioned and
   utilized amounts until completion.

The frontend must consume balances calculated or confirmed by the backend. It
must not infer official accounting balances solely from request statuses.

## Future use

The dashboard can import from this directory to obtain:

- strongly typed API response shapes;
- validated demonstration data while the API is unavailable;
- budget totals and percentages;
- monthly payment series;
- request situation summaries;
- distributions by request purpose;
- analytics filter and audit event contracts.

Replace the demonstration dataset with an API adapter without changing the
calculation consumers or existing operational pages.
