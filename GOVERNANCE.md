# Governance

This document describes how Soroscope is governed and how decisions are made. It is intentionally lightweight and reflects the project's current size.

## Project Leadership

Soroscope is currently maintained by [@blockchain-maxis](https://github.com/blockchain-maxis) as the sole maintainer. The maintainer is responsible for the overall direction of the project, the release cadence, and the health of the contributor community.

## Decision Making

The maintainer makes the final call on technical direction and on individual pull requests. For day-to-day decisions — bug fixes, small features, documentation, internal refactors — the maintainer may decide unilaterally and merge.

Significant changes are discussed in [GitHub Discussions](https://github.com/soroscope/soroscope/discussions) before implementation begins. "Significant" includes:

- Major version bumps
- Breaking changes to the public API of `@soroscope/core`
- Adding a new package to the workspace
- Substantial changes to project tooling, build, or release process

Discussions are open to all contributors. The maintainer will summarise the outcome and document the decision in the relevant pull request or issue.

## Merge Rights

Only the maintainer has merge access to the `main` branch. Every pull request, including those opened by the maintainer, requires at least one maintainer approval before it can be merged. Branch protection rules enforce this on the upstream repository.

## Becoming a Maintainer

The project is open to growing the maintainer team. Contributors who demonstrate sustained, high-quality contributions over time may be invited to become maintainers. The criteria are:

- At least five merged pull requests of substantive work (not trivial fixes)
- Demonstrated understanding of the codebase and its design constraints
- Alignment with the project direction as set out in discussions and the roadmap
- Active participation in code review of other contributors' pull requests

Invitations are extended by the existing maintainer team. There is no formal application process; sustained involvement is the path.

## Changes to Governance

This document may be updated by the current maintainer. Significant changes — for example, moving to a multi-maintainer model, adopting a steering committee, or changing the decision-making process — will be announced in [GitHub Discussions](https://github.com/soroscope/soroscope/discussions) and a pull request will be opened so that the change is visible and can be reviewed.
