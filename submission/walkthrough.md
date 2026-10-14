# TeamPay walkthrough and remaining checks

## 30-second walkthrough script

**0–6 seconds — landing page**
“TeamPay lets a freelance team collect one client payment, repay project expenses, and split the rest in USDC.”

**6–15 seconds — wallet-free example**
“Ada paid 60 USDC upfront. From a 300 USDC payment, that expense is repaid first. The remaining 240 follows the agreed team shares.”

**15–24 seconds — completed mainnet receipt**
“This real Arc payment split USDC between two wallets. The expense was repaid first, and both teammates have withdrawn their earnings.”

**24–30 seconds — agreement builder**
“Create the agreement, share a payment link, and let each teammate collect their share. The source and deployed contract are public.”

Record existing evidence; do not send a new payment merely for a recording. The example is simulated and the real acceptance tests used builder-controlled wallets. Keep those distinct in narration.

## Screenshots to capture

1. Landing page with the one-sentence value proposition.
2. Agreement builder and live allocation preview.
3. Completed mainnet project showing the paid expense and payment history.
4. Readable receipt and the explorer’s verified contract.

Capture the application area only. Exclude wallet extensions, account balances unrelated to the example, personal browser tabs, bookmarks, and notifications. Browser screenshots and receipt PDFs are saved in `verification/browser/`. A narrated recording is still outstanding.

## Manual browser checks still needed

- Browser layout checks passed at 320/375/390px and 1440px for the landing page, builder, and standalone receipt. Screenshots were inspected. A physical-device wallet check is still needed.
- Wallet browser: connect, wrong-network recovery, and cancellation. Standard mobile browsers without an injected wallet should give clear instructions.
- The live project receipt opens without a wallet at 390px. The standalone receipt PDF was generated and visually checked on one page with full addresses and totals. Workspace dialog print checks are recorded in `verification/browser/README.md`.
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

## Public receipt for review

https://product-ruby-chi.vercel.app/proof/team-payment is a standalone receipt generated from the confirmed project 2 payment of 0.0025 USDC. It opens without a wallet or live RPC request and includes full recipient addresses, amounts, transaction hash, and an explorer link. Use the browser Print command to save it as PDF. Its responsive rendering was checked in Chrome at 320, 375, 390, and 1440 pixels. The generated PDF is one page and its amounts and full recipient addresses were checked. This does not validate physical mobile wallet behavior.

## Submission availability

The DoraHacks detail page could not be fetched during the final link check (HTTP 405), and search returned no matching result. Current submission availability or a deadline extension has not been verified. The application is prepared, not submitted. Check the actual DoraHacks page while logged in before making eligibility declarations or submitting.
