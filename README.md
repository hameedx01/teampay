# TeamPay

One client payment. Expenses repaid first. The remainder shared with your team.

TeamPay helps freelance teams agree on upfront costs and revenue shares, publish immutable payment rules, and share a payment link. Teammates withdraw their allocated USDC independently.

- [Live website](https://product-ruby-chi.vercel.app) · [Payment workspace](https://product-ruby-chi.vercel.app/workspace)
- [Narrated demo with clickable chapters](https://product-ruby-chi.vercel.app/demo) · [Download video](https://product-ruby-chi.vercel.app/demo/teampay-demo.mp4)
- [Confirmed mainnet payment receipt](https://product-ruby-chi.vercel.app/proof/team-payment) — inspect without connecting a wallet.

The demo distinguishes example calculations, an unpublished draft, and confirmed mainnet activity. Its narration is synthetic; the mainnet transactions are builder-controlled acceptance tests, not customer traction.

## Deployment status

The TeamPay contract is deployed on **Arc Mainnet (5042)** at [`0xB8A30476424DF1b2954e9a934a66fC52463C62cD`](https://explorer.arc.io/address/0xB8A30476424DF1b2954e9a934a66fC52463C62cD). Creation and runtime bytecode match this repository. Source is publicly verified on [Sourcify](https://sourcify.dev/server/v2/contract/5042/0xB8A30476424DF1b2954e9a934a66fC52463C62cD), with exact creation and runtime matches. Arc Explorer also shows verified TeamPay source, confirmed by the builder’s screenshot; see [verification details](verification/README.md).

The hosted workspace uses the shared contract; ordinary users do not deploy a contract. Arc Mainnet is chain **5042**, using native USDC with 18 decimals for gas and payments.

Two mainnet acceptance flows are recorded:

- **Single recipient:** 0.01 USDC paid, including 0.001 USDC expense repayment and 0.009 USDC revenue; the full 0.01 USDC was withdrawn. See [transaction evidence](verification/mainnet-flow.json).
- **Two wallets:** four payments totaling 0.006 USDC repaid a 0.001 USDC expense, then split the remaining 0.005 USDC equally. The first recipient withdrew 0.0035 USDC including the expense; the second withdrew 0.0025 USDC. Both claimable balances were zero at reconciliation. See [mainnet reconciliation](verification/mainnet-reconciliation.json).

These were small tests performed by the builder. Source verification establishes a bytecode match, not a security audit.

## Run locally

Serve the static frontend with Python 3:

```sh
python3 -m http.server 8080 --directory dist
```

Open `http://localhost:8080` for the landing page, `/workspace.html` for the workspace, or `/demo.html` for the demo. Python's basic server does not reproduce Vercel's clean-URL routing; production project and receipt links use the routes configured in `vercel.json`. The workspace still connects to the configured Arc network: serving it locally does not turn real transactions into simulated ones.

Run application tests with Node.js 22 or newer:

```sh
node --test *.test.mjs
```

Contract development additionally requires Foundry (`forge`, `anvil`, `cast`):

```sh
forge test --root feasibility
node feasibility/check-workspace.mjs
node feasibility/check-parity.mjs
```

`node sync-contract.mjs` rebuilds and synchronizes contract artifacts when intentionally developing contract code. It is not required to view the app. No npm install is required. Ethers 6.17.0 is vendored with its license. Solidity is pinned to 0.8.30, Cancun, optimizer 200 runs.

## How payments work

1. Set teammates, wallet addresses, shares totaling 100%, and optional expenses in repayment order.
2. Review and publish an immutable agreement.
3. Share its project link. Each client payment first repays outstanding expenses in order, then splits the remainder.
4. Recipients withdraw their balances. Balances combine allocations across projects in the same contract.

Partial payments carry unpaid expenses forward. The final teammate receives smallest-unit rounding dust. Names do not imply teammate approval. Metadata is public. Receipts document payments and allocations, not withdrawals.

## Workspace features

- **My projects:** discover agreements where the connected wallet is the creator, teammate, or expense recipient, including unfunded projects. Search is paginated; continue searching when the displayed range is incomplete.
- **Saved drafts:** incomplete agreements save in this browser. Choose Restore or Discard after returning. Drafts never publish automatically and do not sync between devices.
- **Payment history:** inspect confirmed payments, view readable receipts, print/save PDF, or export JSON. Searches work backward in bounded batches, with an option to search earlier payments.
- **Your activity:** view agreements published, payments sent, allocations received, and withdrawals, with names, dates, and filters. Activity scans forward from deployment in 5,000-block pages; load more until the displayed range reaches the current block.
- **Wallet controls:** connect, switch to the required network, and disconnect from the header. Changing accounts or disconnecting clears the previous wallet's activity and project list.

Disconnect clears the local session and attempts to revoke the site's account permissions in the wallet. If the wallet does not support revocation or the request fails, TeamPay stays locally disconnected and provides manual instructions. Disconnecting does not cancel submitted transactions.

Project discovery and history use bounded RPC searches, not an external indexer. An incomplete search is not proof that no earlier activity exists. Withdrawals combine the recipient's balance across projects in the same contract.

## Validation and remaining checks

The latest recorded checks passed **54 application tests** and **11 Solidity tests**, including fuzz testing. Browser checks cover responsive layouts, readable receipts and PDFs, draft restoration, wallet account changes, project discovery, and payment-history searches. See [browser evidence](verification/browser/README.md) and [latest feature validation](verification/workspace-improvements.md).

Automated wallet checks use a read-only provider fixture; they do not establish that every real wallet or phone works. Physical-device wallet testing and feedback from an independent freelance team remain outstanding. See the [post-submission review](submission/post-submission-review.md).

## Repository

- `dist/`: landing page, wallet-free example, wallet workspace, and browser contract client.
- `feasibility/src/`: authoritative Solidity sources; `contracts/` contains matching published copies.
- `feasibility/test/`: contract accounting and fuzz tests.
- `*.test.mjs`: accounting, validation, wallet state, and transaction review regression tests.
- `configure-deployment.mjs`: verifies an existing deployment and records shared configuration; it never signs.
- `dist/project-library.mjs`, `dist/history-search.mjs`, `dist/drafts.mjs`: project discovery, bounded payment searches, and browser draft storage.
- `verification/`: source verification, transaction reconciliation, and browser-check evidence.
- `submission/`: application copy, walkthrough, logo, and reproducible demo recording/rendering scripts.
- `vercel.json`: static hosting configuration.

## Deployment maintenance

The live app already uses the verified shared mainnet deployment. A separate builder page at `/mainnet-setup` prepares a deployment through the connected wallet and guards against duplicate deployment. It is not part of the customer flow. The app requests a maximum fee of 0.10 USDC for that deployment; wallet estimates must still be reviewed before signing.

For a deliberately prepared new deployment, verify its creation receipt and runtime code without signing:

```sh
node configure-deployment.mjs <contract-address> <deployment-tx-hash> --mainnet
```

This writes `dist/mainnet-deployment.json`; the live `dist/deployment.json` must also match the intended verified deployment. Changing a network label alone does not deploy a contract.

Refresh the recorded mainnet transaction evidence with a read-only check:

```sh
node verification/reconcile-mainnet.mjs
```

## Limitations

Contracts are experimental and unaudited. Tests cover accounting conservation, partial payments, withdrawal isolation, metadata verification, history, and wallet changes. Local EVM tests do not replace real Arc wallet testing. Mobile wallet pairing is not implemented; transactions require a supported injected browser wallet. See [security limitations](SECURITY.md).

## License

Original TeamPay code is MIT licensed. Vendored dependencies retain their own license notices.

## Microgrant submission

The builder reports that the Arc Microgrants application has been submitted. Submission status and selection have not been independently verified here.

[Application copy](submission/arc-microgrants.md) · [Walkthrough and manual checks](submission/walkthrough.md) · [Demo recording sources](submission/demo/README.md) · [480 × 480 submission logo](submission/teampay-logo-480.png)
