# TeamPay

One client payment. Expenses repaid first. The remainder shared with your team.

TeamPay helps freelance teams agree on upfront costs and revenue shares, publish immutable payment rules, and share a payment link. Teammates withdraw their allocated USDC independently.

**Website:** https://product-ruby-chi.vercel.app

[View a confirmed mainnet payment receipt](https://product-ruby-chi.vercel.app/workspace?network=5042&contract=0xB8A30476424DF1b2954e9a934a66fC52463C62cD&project=1&receipt=0x90e25ec0c7875a18f9feb010e6132a723640dd39469f8c70dca3bbdaf9e1b586) — no wallet connection needed to inspect it.

## Deployment status

The TeamPay contract is deployed on **Arc Mainnet (5042)** at [`0xB8A30476424DF1b2954e9a934a66fC52463C62cD`](https://explorer.arc.io/address/0xB8A30476424DF1b2954e9a934a66fC52463C62cD). Creation and runtime bytecode match this repository. Source is publicly verified on [Sourcify](https://sourcify.dev/server/v2/contract/5042/0xB8A30476424DF1b2954e9a934a66fC52463C62cD), with exact creation and runtime matches. Arc Explorer also shows verified TeamPay source, confirmed by the builder’s screenshot; see [verification details](verification/README.md).

The hosted payment workspace targets **Arc Mainnet (5042)** and uses the shared deployed contract. A real single-recipient agreement/payment/withdrawal acceptance test passed on mainnet: 0.01 USDC paid, 0.001 USDC expense repaid, 0.009 USDC revenue allocated, and the full 0.01 USDC withdrawn. See [transaction evidence](verification/mainnet-flow.json). Multiple-recipient and instalment behavior has been tested locally, not yet with a separate mainnet team.

Arc Mainnet is chain **5042**, using native USDC with 18 decimals for gas and payments. Changing the network label alone does not constitute deployment. `dist/deployment.json` must contain a verified deployment on the selected chain.

## Run locally

Requires Node.js 22 or newer, Python 3, and Foundry (`forge`, `anvil`, `cast`) for contract checks.

```sh
python3 -m http.server 8080 --directory dist
# Open http://localhost:8080
node --test *.test.mjs
node sync-contract.mjs
forge test --root feasibility
node feasibility/check-workspace.mjs
node feasibility/check-parity.mjs
```

No npm install is required. Ethers 6.17.0 is vendored with its license. Solidity is pinned to 0.8.30, Cancun, optimizer 200 runs.

## How payments work

1. Set teammates, wallet addresses, shares totaling 100%, and optional expenses in repayment order.
2. Review and publish an immutable agreement.
3. Share its project link. Each client payment first repays outstanding expenses in order, then splits the remainder.
4. Recipients withdraw their balances. Balances combine allocations across projects in the same contract.

Partial payments carry unpaid expenses forward. The final teammate receives smallest-unit rounding dust. Names do not imply teammate approval. Metadata is public. Receipts document payments and allocations, not withdrawals.

## Wallet and activity

Use **Disconnect** in the workspace header to disconnect from TeamPay. This choice persists on this browser until an explicit reconnection. It does not revoke extension permissions or cancel transactions already submitted.

**Your activity** reads confirmed events for the connected wallet from the shared contract: agreements published, payments sent, allocations received, and withdrawals. History starts at deployment and scans 5,000-block pages. Use **Load more activity** until the status reaches the current block. Changing accounts or disconnecting clears the previous wallet’s history from view. Withdrawals are wallet-wide, not tied to a single project.

## Repository

- `dist/`: landing page, wallet-free example, wallet workspace, and browser contract client.
- `feasibility/src/`: authoritative Solidity sources; `contracts/` contains matching published copies.
- `feasibility/test/`: contract accounting and fuzz tests.
- `*.test.mjs`: accounting, validation, wallet state, and transaction review regression tests.
- `configure-deployment.mjs`: verifies an existing deployment and records shared configuration; it never signs.
- `vercel.json`: static hosting configuration.

## Mainnet release work

Deployment, source verification, and mainnet app configuration are complete. The first small real payment and withdrawal are complete with explorer hashes recorded. Remaining product work includes mobile/browser checks and feedback from a separate freelance team. The builder has a **1 USDC gas budget**; estimates must be refreshed before any signing. Payment principal is separate from gas.

Read-only deployment estimate (no transaction is sent):

```sh
node sync-contract.mjs
python3 feasibility/estimate.py --contract TeamPay
```

The normal workspace uses the existing mainnet contract; users do not deploy contracts. A separate builder page at `/mainnet-setup` prepares an **Arc Mainnet** deployment through the connected wallet. It sends no principal, caps the app-requested fee at 0.10 USDC, requires an explicit review, and records pending attempts to discourage duplicate deployments. Do not increase the reviewed fee in your wallet. It is not part of the ordinary customer flow.

After confirmation, verify the creation receipt and runtime code without signing:

```sh
node configure-deployment.mjs <contract-address> <deployment-tx-hash> --mainnet
```

This writes `dist/mainnet-deployment.json`. The active `dist/deployment.json` contains the same verified mainnet configuration. The single-recipient and two-recipient mainnet payments and withdrawals have been verified. Full event reconciliation is in `verification/mainnet-reconciliation.json`; run `node verification/reconcile-mainnet.mjs` to refresh this read-only evidence.

## Inspiration and limitations

The expense-first workflow is inspired by [Splits Recoup](https://splits.org/protocol/docs/templates/recoup/). TeamPay implements its own small contract and interface; it is not affiliated with Splits and does not claim to be a port of their contracts or a hackathon winner.

Contracts are experimental and unaudited. Tests cover accounting conservation, partial payments, withdrawal isolation, metadata verification, history, and wallet changes. Local EVM tests do not replace real Arc wallet testing. Mobile wallet pairing is not implemented.

## License

Original TeamPay code is MIT licensed. Vendored dependencies retain their own license notices.

## Submission preparation

[Microgrant application draft](submission/arc-microgrants.md) and [walkthrough / remaining manual checks](submission/walkthrough.md). These are preparation materials; no grant application has been submitted.
