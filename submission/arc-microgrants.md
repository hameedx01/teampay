# TeamPay — Arc Microgrants submission draft

This is prepared application copy, not a submitted application. Confirm the applicant eligibility declarations in DoraHacks before submitting.

## Name

TeamPay

## One sentence

One client payment: repay your freelance team’s expenses first, then share the remaining USDC automatically on Arc.

## Short description

Freelance teams often collect a client payment into one person’s wallet, then work out who should recover upfront costs and how to split the rest. TeamPay makes those payment rules explicit before money arrives.

Create an agreement with teammates, wallet addresses, expense repayment order, and percentage shares. Share one project link with the client. Each payment repays outstanding expenses first, then allocates the remainder to the team. Recipients withdraw their balances independently. Partial payments carry unpaid expenses forward. The app shows the allocation before payment and provides readable, printable receipts plus JSON exports.

TeamPay is deployed on Arc Mainnet, with public source and verified Solidity contracts.

## Why Arc

TeamPay uses Arc for immutable payment agreements, native-USDC payment allocation, and independent withdrawals. USDC is used for both payments and network fees, so users do not need a separate gas token. The product targets small teams that want stable-denominated payments and an inspectable record of the agreed split.

## What works today

- Public landing page and wallet-free interactive example.
- Mainnet agreement publishing and shareable project links.
- Ordered expense repayment, percentage sharing, and partial-payment accounting.
- Wallet/network checks, fee review, and pending-transaction recovery.
- Independent withdrawals, wallet disconnect, and wallet-wide on-chain activity history.
- Readable payment receipts with print/save-as-PDF and JSON export.

## Evidence

- Live product: https://product-ruby-chi.vercel.app
- Public repository: https://github.com/hameedx01/teampay
- Builder profile: https://github.com/hameedx01
- Mainnet contract: https://explorer.arc.io/address/0xB8A30476424DF1b2954e9a934a66fC52463C62cD
- Completed agreement: https://product-ruby-chi.vercel.app/workspace?network=5042&contract=0xB8A30476424DF1b2954e9a934a66fC52463C62cD&project=1
- Confirmed payment: https://explorer.arc.io/tx/0x90e25ec0c7875a18f9feb010e6132a723640dd39469f8c70dca3bbdaf9e1b586
- Confirmed withdrawal: https://explorer.arc.io/tx/0x0e16a6b63d75049fbefd06b19c426608b451b351b53a3d7dc7a80dc93efd5a46
- Reproducible evidence: https://github.com/hameedx01/teampay/blob/main/verification/mainnet-flow.json

The first mainnet acceptance test used the builder’s own wallet as payer and sole recipient. It paid 0.01 USDC, repaid a 0.001 USDC expense, allocated 0.009 USDC as revenue, and withdrew the full 0.01 USDC. Deployment plus agreement, payment, and withdrawal consumed 0.035129921828512336 USDC in gas. This is a real mainnet test, not evidence of customer traction.

## Technical credibility and limits

The repository includes 44 app tests, 11 Solidity tests (including a 256-case accounting fuzz run), and local EVM integration checks. Coverage includes accounting conservation, partial payments, multiple recipients, isolated project accounting, re-entrant claim attempts, receipt verification, and wallet changes during transaction review.

Solidity source is verified on Sourcify with exact creation/runtime matches, and Arc Explorer displays verified source. Verification is not an audit. No independent audit or customer traction is claimed. Multiple-recipient mainnet validation, real-team feedback, mobile visual QA, and receipt print-preview QA remain outstanding. Mobile wallet pairing is not implemented; an injected browser wallet is required.

## Inspiration

The expense-first workflow is inspired by the existing Splits Recoup template. TeamPay implements its own small Solidity contract and freelance-team interface on Arc. It is not affiliated with Splits and does not claim to be a hackathon-winning project or a direct port of their contracts.

## Proposed next steps

Validate the workflow with small freelance teams, improve mobile wallet access, and refine expense approval and project discovery based on actual feedback. Do not imply that teammates have approved an agreement unless an approval feature is implemented.

## Applicant-only declarations to confirm

- The work has not already been funded by a Circle or Arc program.
- The submitting builder has the right to submit all included work.
- The applicant meets the program’s eligibility requirements.
- The public builder profile and payout wallet are the intended ones.

These facts cannot be inferred from the repository. Do not submit declarations on the builder’s behalf without their confirmation.
