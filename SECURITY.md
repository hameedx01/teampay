# Security status

TeamPay is experimental and has not received an independent audit. Passing tests does not guarantee safety.

## Review performed before the first mainnet deployment

Reviewed the payment allocation, native-USDC withdrawal, and metadata publication paths. No confirmed critical issue was identified in this review. There is no administrator, upgrade path, or function that redirects a recipient's credit. Anyone can trigger a claim, but payment goes only to the credited recipient.

Withdrawal zeroes credit before the external call and guards nested claims. A failed transfer reverts, restoring credit; it does not block other recipients. Payment allocation performs no external calls, uses bounded recipient arrays, and allocates rounding remainder to the final teammate. Metadata publication is atomic.

Targeted regression tests cover nested claims against the same and other recipients, third-party claims paying only the recipient, rejected native transfers, invalid metadata rolling back project creation, and the contract rejecting itself as a recipient. Accounting fuzz tests use 256 cases per run. Local client integration tests cover receipts, project isolation, and runtime-code checks.

## Known limitations

- Agreements are immutable and do not collect recipient consent. Wrong addresses cannot be corrected after publishing.
- Native USDC must enter through `pay(projectId)`. Plain native transfers revert; unsupported token transfers or forced balances have no recovery path.
- Recipient balances aggregate across projects. A recipient whose wallet cannot accept a native transfer cannot redirect its credit.
- Public metadata is untrusted. The client validates it against on-chain payment rules; labels do not establish identity.
- The deployed code must exactly match `dist/contract.json`. Local EVM tests do not prove Arc-specific runtime behavior.
- Browser fee guards limit the app's prepared transaction. A user changing fees in their wallet can override those limits.
- Mainnet deployment does not make the public workspace mainnet-ready. Configuration and a real payment/withdrawal check are still required.

Do not post private keys or seed phrases in issues or support requests.
