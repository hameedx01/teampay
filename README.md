# TeamPay

One client payment. Expenses repaid first. The remainder shared with your team.

TeamPay helps freelance teams agree on upfront costs and revenue shares, publish immutable payment rules, and share a payment link. Teammates withdraw their allocated USDC independently.

**Website:** https://product-ruby-chi.vercel.app

## Deployment status

The hosted workspace currently targets **Arc Testnet (5042002)**. The shared contract is not configured. **No Arc mainnet deployment is claimed.** The Arc Microgrants submission requires a working mainnet deployment; this is a remaining release requirement.

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

## Repository

- `dist/`: landing page, wallet-free example, wallet workspace, and browser contract client.
- `feasibility/src/`: authoritative Solidity sources; `contracts/` contains matching published copies.
- `feasibility/test/`: contract accounting and fuzz tests.
- `*.test.mjs`: accounting, validation, wallet state, and transaction review regression tests.
- `configure-deployment.mjs`: verifies an existing deployment and records shared configuration; it never signs.
- `vercel.json`: static hosting configuration.

## Mainnet release work

Deploy and verify the contract on Arc mainnet, configure the app and wallet flow for that chain, complete a small real payment and withdrawal, and record explorer links. The builder has a **1 USDC gas budget**; estimates must be refreshed before any signing. Payment principal is separate from gas.

Read-only deployment estimate (no transaction is sent):

```sh
node sync-contract.mjs
python3 feasibility/estimate.py --contract TeamPay
```

The normal workspace builder tool targets testnet only. A separate builder page at `/mainnet-setup` prepares an **Arc Mainnet** deployment through the connected wallet. It sends no principal, caps the app-requested fee at 0.10 USDC, requires an explicit review, and records pending attempts to discourage duplicate deployments. Do not increase the reviewed fee in your wallet. It is not part of the ordinary customer flow.

After confirmation, verify the creation receipt and runtime code without signing:

```sh
node configure-deployment.mjs <contract-address> <deployment-tx-hash> --mainnet
```

This writes `dist/mainnet-deployment.json` separately. It deliberately does not activate the currently testnet-only workspace. Mainnet app configuration and real payment/withdrawal verification remain release steps.

## Inspiration and limitations

The expense-first workflow is inspired by [Splits Recoup](https://splits.org/protocol/docs/templates/recoup/). TeamPay implements its own small contract and interface; it is not affiliated with Splits and does not claim to be a port of their contracts or a hackathon winner.

Contracts are experimental and unaudited. Tests cover accounting conservation, partial payments, withdrawal isolation, metadata verification, history, and wallet changes. Local EVM tests do not replace real Arc wallet testing. Mobile wallet pairing is not implemented.

## License

Original TeamPay code is MIT licensed. Vendored dependencies retain their own license notices.
