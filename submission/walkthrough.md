# TeamPay walkthrough and remaining checks

## 30-second walkthrough script

**0–6 seconds — landing page**
“TeamPay lets a freelance team collect one client payment, repay project expenses, and split the rest in USDC.”

**6–15 seconds — wallet-free example**
“Ada paid 60 USDC upfront. From a 300 USDC payment, that expense is repaid first. The remaining 240 follows the agreed team shares.”

**15–24 seconds — completed mainnet receipt**
“This smaller payment actually ran on Arc Mainnet. The receipt is read from confirmed transaction events, and the withdrawal is visible on the explorer.”

**24–30 seconds — agreement builder**
“Create the agreement, share a payment link, and let each teammate collect their share. The source and deployed contract are public.”

Record existing evidence; do not send a new payment merely for a recording. The example is simulated and the real acceptance test used a single builder wallet. Keep those distinct in narration.

## Screenshots to capture

1. Landing page with the one-sentence value proposition.
2. Agreement builder and live allocation preview.
3. Completed mainnet project showing the paid expense and payment history.
4. Readable receipt and the explorer’s verified contract.

Capture the application area only. Exclude wallet extensions, account balances unrelated to the example, personal browser tabs, bookmarks, and notifications. No screenshots or recording are claimed to be complete yet.

## Manual browser checks still needed

- 320/375/390px phone widths: no horizontal scrolling; readable labels and amounts; usable buttons.
- Wallet browser: connect, wrong-network recovery, and cancellation. Standard mobile browsers without an injected wallet should give clear instructions.
- Receipt: open from the landing-page evidence link without connecting a wallet, print/save as PDF, confirm full addresses and totals are visible, then close and resume the project.
- Wallet changes during a transaction review must require a fresh review.
- A second person opens a shared project link and explains what payment does before using it.

## Two-wallet acceptance test

This is still pending. Use a second wallet controlled by the builder or a willing teammate; do not use an invented recipient address. Review current fees before every signature and remain inside the original 1 USDC gas budget. Never share wallet secrets.

Create a project with two known recipients, a small expense for the first, and explicit shares totaling 100%. Preview a partial payment and confirm unpaid expenses carry forward. Preview a second payment that clears the expense and splits the remainder. Confirm each recipient’s credit and withdrawal destination. Record transaction hashes, actual gas, and any UX confusion. This test requires wallet approvals; no additional funds have been sent by the assistant.

## Five-minute usability conversation

Show someone the landing page without explaining it. Ask:

1. What does this product do, and who is it for?
2. What happens if the client pays less than the expenses?
3. Can you find who will receive the next payment?
4. Can you find the receipt and explain why available earnings become zero after withdrawal?
5. Would this solve a problem on your last team project? What is missing?

Record their actual wording. Do not invent interviews, testimonials, or usage metrics.

## Prepared two-wallet draft

Open https://product-ruby-chi.vercel.app/workspace?acceptance=two-wallet to load the editable draft. It does not connect, publish, or send funds automatically.

- HameedX: `0x940D6F7F596Aa65342fE490510b74282156C949B`, 50%.
- Second teammate: `0xef4D5945A4F48943b74af0957d61638CF645Ad2b`, 50%.
- Expense: 0.001 USDC to HameedX.
- First payment: 0.0005 USDC; expected unpaid expense 0.0005 USDC, no revenue allocation yet.
- Second payment: 0.0025 USDC; expected final allocated totals 0.002 USDC to HameedX and 0.001 USDC to the second wallet.
- Each wallet withdraws its own balance. The second wallet currently has no mainnet USDC for gas; fund it before testing its direct withdrawal.

Do not publish the draft twice. After publishing, use the resulting project link for both payments. These actions still require explicit wallet signatures. Visual browser checks remain outstanding.
