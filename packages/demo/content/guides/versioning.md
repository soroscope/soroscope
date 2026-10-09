---
title: Stability and versioning
description: What can change between releases, and how the packages are versioned.
---

Soroscope is **pre-1.0**. Minor versions may change APIs; patch versions will not.

## Versions move together

`@soroscope/core`, `invoke`, `cli`, `ci` and `mcp` are released as a fixed group: they always share a version number, so a matching set of versions always works together.

## What counts as stable

| | |
|---|---|
| Exit codes of the CLI | Stable. Scripts depend on them. |
| `soroscope.config.json` and the baseline format | Versioned with `"version": 1`; a breaking change will bump it and the tools will say so. |
| Decoded shapes (`ScVal`, events, auth entries, reports) | May gain fields. Existing fields will not change meaning without a minor-version note. |
| Router internals, the registry's snapshot format | May change. |
| Scaffolded packages | No API promise at all. |

## Protocol changes

The decoders throw `XdrUnsupportedError`, naming the union arm and byte offset, when they meet a form from a newer protocol than they know. They never guess. If you see one, upgrade Soroscope.

## Deprecation

A deprecated export keeps working for at least one minor version and is named in the changelog.
