# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| testnet (current) | Yes |
| mainnet | Not yet deployed — audit pending |

## Audit Status

Accord Protocol is **unaudited**. Do not deploy to mainnet with significant funds until a formal third-party audit is completed. The contract has been reviewed for common Soroban anti-patterns but has not undergone a professional security review.

Known areas that require attention before mainnet:
- Reentrancy via external token calls (currently mitigated by Soroban's single-contract-call model, but warrants formal review)
- TTL expiry edge cases under high ledger load

## Security Best Practices for Multisig Administrators

### Key Management

- Use a hardware wallet or an air-gapped signing device for each multisig owner key whenever possible.
- Do not store a private key in a shared password manager, team vault, or any system that more than one person can access.
- Treat each Stellar signing key like a root credential: if it is exposed, assume an attacker can act as that owner until the owner is removed from the multisig.
- Keep recovery material, seed phrases, and backup exports offline and separate from day-to-day operational devices.

### Threshold Sizing

- Choose an M-of-N threshold that makes a single compromised key insufficient to move funds or approve sensitive actions on its own.
- At the same time, leave enough slack for normal operations when one owner is traveling, offline, or otherwise unavailable.
- For small teams, `2-of-3` is usually a practical baseline because it resists one-key compromise while still allowing continuity if one signer is down.
- For larger teams, `3-of-5` is a common starting point because it raises the approval bar without making routine coordination unworkable.
- Review the threshold whenever the team changes size, the treasury grows, or the approval process becomes operationally brittle.

### Owner Rotation

- Replace owners through the on-chain proposal flow rather than by sharing keys or making out-of-band changes.
- First submit an `add_owner` proposal for the new signer and wait for it to pass so the threshold is still met during the transition.
- Verify the new owner can sign a test transaction before removing the departing owner.
- After the replacement signer is confirmed, submit a `remove_owner` proposal for the old owner and wait for that proposal to execute.
- If you also need to adjust quorum, use the `change_threshold` proposal flow as part of the same planned rotation.

### What to Do If a Key Is Compromised

- Immediately assume the compromised owner can approve pending or future proposals until removed.
- Use a quorum of the remaining uncompromised owners to submit and approve a `remove_owner` proposal for the exposed key as soon as possible.
- Pause or cancel any pending proposals that the compromised owner already approved, then re-evaluate them after the owner set is cleaned up.
- If the threshold no longer makes quorum possible after the compromise, raise the issue operationally first and restore a safe threshold before resuming normal use.

## Known Limitations

- A stolen owner key can still create and approve proposals up to the threshold gap before it is removed.
- There is no automatic on-chain emergency recovery; owner removal and threshold changes still require coordinated proposal approval.
- Token contracts are validated when a proposal is created, but not re-validated at execution time, so a contract upgrade between those events can change the risk profile.
- A malicious owner can deliberately fill the active proposal cap and temporarily block new proposals from being created.
- Per-owner, per-token spending limits are available via `SetSpendingLimit` proposals and are enforced when a transfer proposal is created, but they are opt-in: an owner with no configured limit for a given token remains unrestricted for it, so the threshold is still the primary access-control mechanism.

## Explicit Trust Assumptions

- Owner keys are kept secret and not shared. If that assumption fails, the multisig should be treated as compromised until the exposed owner is removed and any impacted proposals are reviewed.
- The Stellar RPC node used by the frontend returns accurate ledger state. If it lies or falls behind, the UI can show stale proposal status, incorrect balances, or misleading approval state.
- Token contracts used in proposals follow the Soroban token interface and are not upgraded to malicious code after proposal creation. If that assumption fails, execution can transfer an asset the owners no longer intended to trust.
- Owners remain available to participate in quorum when operational changes are needed. If they are not, urgent rotations or threshold changes can stall and leave the multisig in a risky intermediate state.

## Threat Model

### Attack Surfaces

The protocol's attack surface includes the following external entry points:
- **Public Contract Functions**: `create_proposal` (and variants), `approve`, `revoke`, `execute`, `cancel_expired`, and `upgrade`. These are reachable by any actor via the Stellar network.
- **Guardian / Emergency Pause**: `set_guardian`, `freeze`, and `unfreeze`. `set_guardian` assigns or replaces the guardian address and requires a set of *distinct* owners whose combined voting weight reaches the current threshold to co-sign in a single call. `freeze` can be called **only** by the currently registered guardian and immediately blocks new proposal creation and all proposal execution. `unfreeze` lifts the freeze and, like `set_guardian`, requires distinct owners whose combined weight reaches the threshold. A misconfigured or captured guardian key can therefore halt the contract (a denial-of-service pause), but on its own cannot move funds, change the owner set, or change the threshold.
- **Concurrent Governance Proposals**: Two governance proposals that each pass their own creation-time checks can be approved in parallel and executed back-to-back — for example two `RemoveOwner` proposals, or a `RemoveOwner` alongside a `ChangeThreshold`. Because each creation-time check evaluates the owner set and total weight as they stand at creation, executing both together can move the owner-count or total-weight past the point where the threshold is still reachable, risking a multisig that can no longer reach quorum.
- **Frontend Wallet Connection**: The boundary where the dApp interacts with browser-based wallets (Freighter). Malicious sites could attempt to intercept or spoof these calls.
- **RPC Layer Boundary**: The communication path between the frontend and a Stellar RPC node. A compromised node can feed dishonest state data to the user.

### Trust Assumptions

Accord relies on several explicit assumptions for its security properties to hold:
1. **Key Confidentiality**: Owner private keys are not compromised or shared.
2. **Honest RPC Node**: The RPC node used by the frontend and integrators returns accurate ledger state.
3. **Asset Integrity**: Token contracts passed to the multisig are non-malicious and do not contain backdoors or non-standard callback logic.
4. **Soroban Platform**: The underlying Soroban runtime correctly enforces `require_auth` and handles cryptographic verification.

### Mitigations

Specific mechanisms are in place to enforce security boundaries:
- **M-of-N Threshold Guard**: The `execute` and `upgrade` functions enforce a strict approval count, preventing single-key fund transfers or governance takeovers. Threshold alone is not enough for upgrades: owners must still verify the WASM hash and follow the operational checks in [`docs/UPGRADE_SAFETY.md`](./UPGRADE_SAFETY.md).
- **Proposal Deadlines**: The `deadline` field and `derive_status` logic ensure proposals cannot be executed indefinitely, protecting against stale approvals.
- **Active Proposal Cap**: The `MAX_ACTIVE_PROPOSALS` check in `create_proposal` prevents an attacker from exhausting contract storage.
- **Owner-Only Authentication**: Every state-changing call (`approve`, `revoke`, etc.) uses `require_owner` to ensure only the authorized set can act.
- **Weighted sensitive-action co-signing (audit conclusion)**: `set_guardian`, `unfreeze`, and `upgrade` reject duplicate addresses before summing approver weights, so a single owner cannot repeat its address to count its weight more than once. They intentionally accept the smallest *distinct* approver list whose combined weight reaches quorum; this may be one owner when that owner legitimately holds enough configured weight. This is acceptable only as an explicit weighted-governance outcome, and the default 50% `ChangeOwnerWeight` cap prevents granting a strict majority through a later weight-change proposal. **Follow-up concern:** initialization can establish a concentrated allocation, so deployers must review initial weights and quorum together; a future release could apply the cap at initialization too if that policy is required.
- **Guardian Emergency Pause**: A guardian registered through `set_guardian` (itself co-signed by owners whose combined weight meets the threshold) can call `freeze` to immediately block all new proposal creation and execution the moment a compromise or incident is detected. This bounds the damage from a detected compromise: it buys time to remove an exposed owner key or investigate before any funds move, without granting the guardian any power to transfer funds or alter the owner set or threshold. Resuming normal operation requires `unfreeze`, which again needs distinct owners whose combined weight reaches the threshold — so no single party, including the guardian, can both pause and silently resume the contract.
- **Execute-time invariant re-validation for weight changes**: Governance proposals are validated when created but executed later, so a `ChangeOwnerWeight` proposal re-checks *at execution time* that the resulting total weight would not leave any still-active (Pending/Ready) proposal un-quorumable — if any active proposal's snapshotted `quorum_weight` would exceed the new total weight, execution is rejected with `WouldBreakThreshold`. Owner-removal is guarded at creation time (a removal that would drop remaining weight below the threshold is rejected up front by `create_remove_owner_proposal`), and threshold changes are validated against total weight at creation. Because those removal and threshold checks evaluate state at creation rather than the combined effect of several proposals executing together, operators should still sequence interacting governance proposals deliberately — approving and executing one before creating the next — so two concurrent removals (or a removal plus a threshold change) cannot combine to push the multisig below a reachable quorum.

### Residual Risks

The following risks are currently unmitigated by the protocol design:
- **No SOS Recovery**: If enough owner keys are lost, there is no emergency "recovery" mode; the funds remain locked if the threshold cannot be met.
- **Opt-in Spending Limits**: Per-owner, per-token spending limits exist via `SetSpendingLimit` proposals and are enforced at proposal creation (against a fixed 30-day spending window). They are not applied by default, however: an owner with no configured limit for a token can still propose any amount up to the treasury balance once the threshold is reached, so unrestricted tokens remain gated only by the approval threshold.
- **The Validation Gap**: A token contract could be upgraded to malicious code between a proposal's creation (where it is validated) and its execution.

## Responsible Disclosure

**Do not open a public GitHub issue for a security vulnerability.**

To report a security issue:

1. Navigate to the GitHub repository's **Security** tab.
2. Click **"Report a vulnerability"** to open a private advisory.
3. Describe the issue clearly: affected function(s), reproduction steps, and potential impact.

We aim to acknowledge reports within 72 hours and publish a fix within 14 days for confirmed Critical/High issues.

## In-Scope

- `contracts/accord/src/lib.rs` — the on-chain contract
- Contract ↔ frontend integration (authentication bypass, event spoofing)
- Denial-of-service patterns that make funds permanently inaccessible

## Out-of-Scope

- Stellar protocol-level issues (report to Stellar Development Foundation)
- Frontend-only UI bugs with no on-chain consequence
- Issues in third-party libraries we depend on (report upstream)
