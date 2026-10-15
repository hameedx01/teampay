# Project discovery, history search, and saved drafts

## Scope

Frontend additions only. Existing contract, project URLs, receipt links, demo page, and MP4 are unchanged.

- My projects scans verified publication events and reads on-chain collaborators and expense recipients. It includes creators and unfunded participants. Searches are paginated, with explicit incomplete-search messaging; descriptions that cannot load fall back to a project number.
- Payment history automatically searches up to six 2,000-block pages per request, stopping when it finds payments or reaches contract deployment. Users can continue searching earlier history; empty recent blocks are not treated as proof of no payments.
- Partial drafts save in localStorage. The user chooses Restore or Discard. Saving preserves incomplete fields and never publishes or sends funds. Publication clears only the matching stored snapshot, preserving edits saved later. New project starts a clean form and offers any existing saved draft.

## Validation

54 application tests pass, including new coverage for partial-draft validation, history pagination and cancellation, creator/recipient discovery, and preserving later draft edits.

Chrome at 390px against a local build, using public Arc RPC reads and a read-only injected provider fixture (all signing methods disabled):

- Entered an incomplete draft, reloaded, verified no automatic restoration, restored explicitly, and discarded its saved copy.
- Second-wallet project search found funded project 2 and unfunded project 3; excluded unrelated project 1.
- Account change removed the previous wallet's project list.
- Bounded history searches found all four project 2 payments.
- No horizontal overflow in the tested project page.

The MP4 SHA-256 remains `3e1813673348530af08490502fdaebd4925305aa1c240c791a0e798d4894b751`.

No mainnet transactions were signed or sent. Physical-device wallet behavior remains outside these browser checks. Project discovery and history currently use bounded RPC scans, not an external indexer; older/later records can require additional search clicks.
