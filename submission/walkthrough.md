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

Record existing evidence; do not send a new payment merely for a recording. The example is simulated and the real acceptance tests used builder-controlled wallets. Keep those distinct in narration.

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

Completed on project 2. Four confirmed payments totaled 0.006 USDC. The contract repaid 0.001 USDC to HameedX, then split the remaining 0.005 USDC equally. HameedX withdrew 0.0035 USDC; the second wallet withdrew 0.0025 USDC. Both available balances are zero at the reconciliation block. See `verification/mainnet-reconciliation.json` for every event and withdrawal hash.

The original planned sequence was submitted twice. This exposed confusing post-payment UI, since fixed by clearing the amount and displaying a completion message. An additional agreement (project 3) is unfunded. Do not send more payments or publish another agreement for the walkthrough.

## Five-minute usability conversation

Show someone the landing page without explaining it. Ask:

1. What does this product do, and who is it for?
2. What happens if the client pays less than the expenses?
3. Can you find who will receive the next payment?
4. Can you find the receipt and explain why available earnings become zero after withdrawal?
5. Would this solve a problem on your last team project? What is missing?

Record their actual wording. Do not invent interviews, testimonials, or usage metrics.

## Recording the completed test

Open https://product-ruby-chi.vercel.app/workspace?network=5042&contract=0xB8A30476424DF1b2954e9a934a66fC52463C62cD&project=2 . Show the 0.006 USDC received, zero expenses remaining, two 50% shares, and confirmed payment receipts. Use the withdrawal explorer links in the reconciliation evidence to demonstrate each recipient collected their funds. No further signatures are needed.
