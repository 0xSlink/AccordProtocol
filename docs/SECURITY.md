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
- The contract does not impose spending limits or per-owner quotas; the threshold is the primary access-control mechanism.

## Explicit Trust Assumptions

- Owner keys are kept secret and not shared. If that assumption fails, the multisig should be treated as compromised until the exposed owner is removed and any impacted proposals are reviewed.
- The Stellar RPC node used by the frontend returns accurate ledger state. If it lies or falls behind, the UI can show stale proposal status, incorrect balances, or misleading approval state.
- Token contracts used in proposals follow the Soroban token interface and are not upgraded to malicious code after proposal creation. If that assumption fails, execution can transfer an asset the owners no longer intended to trust.
- Owners remain available to participate in quorum when operational changes are needed. If they are not, urgent rotations or threshold changes can stall and leave the multisig in a risky intermediate state.

## Threat Model

### Attack Surfaces

The protocol's attack surface includes the following external entry points:
- **Public Contract Functions**: `create_proposal` (and variants), `approve`, `revoke`, `execute`, `cancel_expired` (planned), and `upgrade`. These are reachable by any actor via the Stellar network.
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

### Residual Risks

The following risks are currently unmitigated by the protocol design:
- **No SOS Recovery**: If enough owner keys are lost, there is no emergency "recovery" mode; the funds remain locked if the threshold cannot be met.
- **Lack of Spending Limits**: There are no per-owner or per-day spending caps; once threshold is reached, any amount can be transferred.
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
