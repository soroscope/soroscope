# soroscope-vscode

A VS Code extension that shows decoded diagnostic events, authorization trees and footprints for Soroban transactions, inline.

| Status | |
|---|---|
| Maturity | **scaffold**: no extension code yet, only this package manifest |
| Published | no (private until implemented) |

## Plan

Reuse `@soroscope/core` decoders to render a failed transaction's event tree, who must authorize it, and which ledger entries it touches, without leaving the editor.

See the [roadmap](../../README.md#roadmap).
