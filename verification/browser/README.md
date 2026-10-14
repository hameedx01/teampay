# Browser and receipt checks

Checked against the public production app on 2026-10-15 using installed Chrome in an isolated temporary profile, without a wallet extension or personal browser data. Chrome DevTools Protocol set exact device metrics; the initial CLI-only screenshot was replaced because its viewport did not match the requested window width.

- `layout-checks.json`: landing page, agreement builder, and standalone receipt at 320, 375, 390, and 1440 CSS pixels. No horizontal overflow detected. Builder screenshots cover form rendering; some capture its asynchronous network-loading message.
- `project-checks.json`: project 2 and its verified receipt opened from the public deep link at 390px, without a wallet. Waited for the receipt dialog to open. No horizontal overflow detected.
- Representative screenshots visually inspected: `landing-390.png`, `workspace-320.png`, `receipt-320.png`, `project-390.png`.
- `team-payment.pdf`: standalone receipt, one page. PDFKit text extraction confirmed the payment amount, allocation amount, and both complete recipient addresses. Its rendered page was visually inspected.
- `dialog-receipt.pdf`: app receipt printed with only the receipt visible. Print styling uses a standard font after the initial web-font output showed rendering problems. After the fix, PDFKit confirmed one page, the payment and allocation amounts, and both full recipient addresses; the rendered page was visually inspected.

Fixes from inspection: keep share percentages on one line, stack receipt details at small widths, and use a standard font for printed app receipts.

These are browser rendering checks, not physical-device wallet tests. No transactions were signed or sent. Account selection, MetaMask permissions on a phone, iOS Safari behavior, physical printer output, user interviews, and a narrated recording are not covered.
