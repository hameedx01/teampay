# Mainnet verification

Contract: `0xB8A30476424DF1b2954e9a934a66fC52463C62cD`

Transaction: `0x5753f681d1a21184e96710739bab944164e439f3d268ca4c88e8070e104a1899`

Deployment succeeded on Arc Mainnet, chain 5042. Creation and runtime bytecode match our artifacts. The standard JSON input was independently recompiled and matches both exactly.

**Sourcify source verification succeeded on 2026-10-14**, with exact matches for creation and runtime code. Public verification record: https://sourcify.dev/server/v2/contract/5042/0xB8A30476424DF1b2954e9a934a66fC52463C62cD

Arc Explorer source verification is **confirmed by the builder’s screenshot**, displaying TeamPay, both Solidity files, compiler 0.8.30, Cancun, optimizer 200, and a verification timestamp of Oct 14, 2026 23:17:36 (explorer display time). Automated API access remains blocked by Cloudflare. Source verification is not a security audit.

## Submit in your browser

Open the contract address on https://explorer.arc.io and choose Contract → Verify and publish.

- Method: Solidity standard JSON input.
- Compiler: `v0.8.30+commit.73712a01`.
- File: `TeamPay.standard-input.json` from this directory.
- Contract, if requested: `src/TeamPay.sol:TeamPay`.
- Constructor arguments: empty.
- License: MIT.
- Settings are included: optimizer enabled with 200 runs; Cancun; viaIR false.

Submit verification and confirm the explorer shows verified source. No wallet signature, deployment, or gas is required.

## Retry CLI when the explorer API is available

```sh
forge verify-contract 0xB8A30476424DF1b2954e9a934a66fC52463C62cD src/TeamPay.sol:TeamPay --root feasibility --chain 5042 --verifier blockscout --verifier-url https://explorer.arc.io/api/ --watch
```
