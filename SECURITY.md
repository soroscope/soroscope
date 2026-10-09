# Security Policy

The Soroscope maintainers take the security of Soroscope and its dependencies seriously. This document describes how to report a vulnerability and what to expect once a report is submitted.

## Supported Versions

Security fixes are provided for the latest minor release of the published `@soroscope/*` packages (`core`, `invoke`, `cli`, `ci`, `mcp`, which are versioned together) on npm. Older minor versions do not receive backports; please upgrade to the latest minor before requesting a fix.

| Version           | Supported          |
| ----------------- | ------------------ |
| Latest minor      | :white_check_mark: |
| Older minors      | :x:                |

## Reporting a Vulnerability

**Do not open a public GitHub issue, discussion, or pull request to report a security vulnerability.** Public disclosure before a fix is available puts users at risk.

Instead, email a detailed report to:

```
CONTACT_EMAIL_PLACEHOLDER
```

Please include as much of the following as you can:

- A description of the vulnerability and the affected component or code path
- The package and version you tested against
- Step-by-step reproduction instructions or a proof-of-concept
- The impact you believe the issue has
- Any suggested mitigation or patch

### What to expect

- **Acknowledgement** within 48 hours of receipt.
- **Resolution timeline:** critical issues will be patched and a release issued within 7 days of confirmation; non-critical issues will be addressed within 30 days.
- **Coordinated disclosure:** the maintainers will work with the reporter to develop and verify a fix, prepare a security advisory, and publish both before any public disclosure. Credit will be given to the reporter unless anonymity is requested.

## Scope

The following classes of issue are in scope for this policy:

- Authentication or transaction-signing vulnerabilities (for example, incorrect signature construction, key exposure, or replay-attack surfaces in SDK helpers)
- Code execution vulnerabilities (remote code execution, prototype pollution, sandbox escape)
- Data exposure or leakage (unintentional disclosure of secrets, private keys, mnemonics, or sensitive metadata through logs, errors, or telemetry)
- Supply chain vulnerabilities in direct dependencies of the published packages that materially affect their users
- In `@soroscope/mcp`: any way to make a tool sign, send or fund a transaction; any way to extract or exfiltrate a secret key; bypassing the secret-key refusal, the custom-RPC restrictions (SSRF) or the workspace path restriction
- In the GitHub Action (`@soroscope/ci`): any way to leak the `deployer-secret` input or the GitHub token, or to run code from a pull request with more privilege than intended

## Out of Scope

The following are not considered security issues for this project. Reports of these will be redirected or closed:

- Issues in third-party services that the SDK communicates with, including the public Stellar testnet, mainnet, and any RPC, Horizon, or indexer providers. Report these to the operator of the affected service.
- Theoretical issues without a practical exploit path against current SDK code.
- Self-inflicted issues caused by user misconfiguration, such as committing private keys to a public repository, running with unsafe environment variables, or disabling SDK validation knowingly.
- Vulnerabilities in transitive dependencies that are not reachable through any public SDK code path. (A `pnpm audit` finding is not by itself a vulnerability in Soroscope.)
