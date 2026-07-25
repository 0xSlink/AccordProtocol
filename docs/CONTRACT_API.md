# Accord Contract API Reference

All amounts are in the token's smallest unit (stroops for XLM-derived tokens).
All deadlines are Unix timestamps (seconds since epoch).

### Token Amounts and Decimals

All `amount` fields in function parameters and event data use the token's smallest unit. The table below lists the conventions for common tokens:

| Token | Decimals | Smallest Unit | Conversion Formula |
|-------|----------|--------------|-------------------|
| **XLM** | 7 | stroop | `human_amount × 10⁷ = on_chain_amount` |
| **USDC** | 7 | micro-dollar | `human_amount × 10⁷ = on_chain_amount` |
| **EURC** | 7 | micro-euro | `human_amount × 10⁷ = on_chain_amount` |

To convert a human-readable amount to the value passed to the contract: multiply by `10^decimals`. Every `amount` field — both in function parameters and event data — uses this smallest-unit representation (see the [Event Payloads](#event-payloads) section for per-field annotations).

---

## Common Errors Quick Reference

Scan this table when you hit an error code and need a fast answer. Errors developers hit most often during normal development are listed first. For full cause descriptions and remediation detail, see the [Error Reference](#error-reference) section below.

| Code / Variant | Most common root cause | One-line resolution |
|----------------|------------------------|---------------------|
| 3 `Unauthorized` | Signer is not a registered owner (or wrong Freighter account). | Switch to a registered owner address and retry. |
| 6 `ProposalNotFound` | Wrong `proposal_id`, network, or contract address. | Confirm the ID with `get_total_proposals` on the correct contract. |
| 12 `InvalidAmount` | Amount is less than 1, empty transfer list, or more than 3 transfers. | Pass 1–3 transfers with each amount ≥ 1 in the token's smallest unit. |
| 13 `InvalidDeadline` | Deadline is not strictly after the current ledger timestamp. | Set a future Unix deadline with a few minutes of buffer. |
| 7 `ProposalNotActive` | Proposal is already `Executed`, `Expired`, or `Revoked`. | Check status via `get_proposal`; create a new proposal if needed. |
| 8 `AlreadyApproved` | This owner already approved the proposal. | Call `revoke` before approving again, or skip. |
| 10 `ThresholdNotMet` | Not enough approvals (or too few co-signers on guardian/upgrade). | Gather threshold approvals / approvers, then retry. |
| 11 `ProposalExpired` | Deadline passed before `execute`. | Create a new proposal; sweep the expired ID if needed. |
| 15 `TransferFailed` | Contract treasury lacks sufficient token balance. | Fund the contract, then retry `execute`. |
| 14 `InvalidToken` | Token address does not implement the Soroban token interface. | Use a verified SEP-41 token (e.g. canonical XLM/USDC). |
| 16 `EmptyDescription` | Description string is empty. | Provide a non-empty description. |
| 17 `DescriptionTooLong` | Description exceeds 300 characters. | Trim the description to ≤ 300 characters. |
| 9 `NotApproved` | `revoke` called without a prior approval from this owner. | Only revoke after a successful `approve`. |
| 18 `TooManyActiveProposals` | Active (`Pending`/`Ready`) proposals hit the cap of 50. | Execute or sweep expired proposals, then retry. |
| 21 `InvalidDuration` | Deadline is more than 90 days from now. | Cap the deadline at ≤ 90 days ahead. |
| 22 `InvalidRecipient` | Transfer recipient is the contract's own address. | Use an external recipient address. |
| 28 `SpendingLimitExceeded` | Proposal amount exceeds the proposer's per-token spending limit. | Lower the amount or raise/remove the spending limit. |
| 29 `InvalidWeight` | An owner weight is zero or outside the supported range. | Use a positive valid weight; use `RemoveOwner` rather than setting weight to zero. |
| 31 `SingleOwnerWeightCapExceeded` | A weight change would give one owner more than the configured share of total voting weight. | Choose a lower weight or adjust the quorum-authorized cap deliberately. |
| 23 `TimeLockActive` | Time-lock delay after reaching `Ready` has not elapsed. | Wait until `ready_at + time_lock_delay`, then execute. |
| 26 `ContractFrozen` | Contract is frozen; create/execute paths are blocked. | Co-sign `unfreeze` with threshold owners. |
| 27 `NoGuardian` | `freeze` called before a guardian was registered. | Call `set_guardian` first, then freeze. |
| 1 `AlreadyInitialized` | `initialize` called twice on the same instance. | Deploy a fresh contract; do not re-initialize. |
| 2 `NotInitialized` | Contract used before `initialize` completed. | Call `initialize` and wait for finality first. |
| 4 `InvalidThreshold` | Threshold is 0 or greater than the owner count. | Use a threshold in `[1, owners.len()]`. |
| 5 `InvalidOwners` | Owner list empty, or adding an owner would exceed 20. | Provide 1–20 owners; remove one before adding at cap. |
| 19 `DuplicateOwner` | Duplicate address in owners/approvers or add-owner list. | Deduplicate addresses before submitting. |
| 24 `WouldBreakThreshold` | Removing an owner would leave fewer owners than threshold. | Lower threshold first, then remove the owner. |
| 25 `OwnerNotFound` | Address to remove is not in the current owner list. | Verify with `is_owner` / `get_owners` first. |
| 20 `ArithmeticError` | Integer overflow/underflow guard tripped (rare). | Contact maintainers; should not occur in normal use. |

---

## Owner weights and `ChangeOwnerWeight`

`ChangeOwnerWeight(target_owner, new_weight)` accepts only positive weights.
**Zero is never a valid weight**: leaving an address on the owner list with no
meaningful vote is ambiguous, so use the `RemoveOwner` proposal flow when an
owner must lose voting rights. The contract checks this both when the proposal
is created and again immediately before it is executed.

The resulting weight is also limited by the configurable
`get_max_single_owner_weight_pct()` parameter (50% by default). A weighted,
distinct-owner quorum may tighten it through
`set_max_single_owner_weight_pct(approvers, max_pct)` (1–50 only).

## `initialize`

```rust
fn initialize(env: Env, owners: Vec<Address>, threshold: u32) -> Result<(), ContractError>
```

One-shot initializer. Must be called before any other function. All owners must authorize this call.

| Parameter | Type | Constraints |
|-----------|------|-------------|
| `owners` | `Vec<Address>` | 1–20 unique addresses |
| `threshold` | `u32` | 1 ≤ threshold ≤ owners.len() |

**Errors:** `AlreadyInitialized`, `InvalidOwners`, `InvalidThreshold`, `DuplicateOwner`

---

## `create_proposal`

```rust
fn create_proposal(
    env: Env,
    proposer: Address,
    to: Address,
    amount: i128,
    token: Address,
    description: String,
    deadline: u64,
) -> Result<u64, ContractError>
```

Creates a transfer proposal. Returns the new proposal ID.

| Parameter | Type | Constraints |
|-----------|------|-------------|
| `proposer` | `Address` | Must be an owner. Must authorize. |
| `to` | `Address` | Recipient address |
| `amount` | `i128` | ≥ 1 |
| `token` | `Address` | Must implement Soroban token interface (`decimals()` + `symbol()`) |
| `description` | `String` | 1–300 characters |
| `deadline` | `u64` | > current ledger timestamp, ≤ now + 90 days |

**Emits:** `("created",)` → `ProposalCreatedEvent`

**Errors:** `Unauthorized`, `InvalidAmount`, `EmptyDescription`, `DescriptionTooLong`, `InvalidDeadline`, `InvalidDuration`, `InvalidToken`, `TooManyActiveProposals`

---

## `approve`

```rust
fn approve(env: Env, approver: Address, proposal_id: u64) -> Result<(), ContractError>
```

Records an approval for `proposal_id` from `approver`. Transitions status to `Ready` when threshold is reached.

| Parameter | Type | Constraints |
|-----------|------|-------------|
| `approver` | `Address` | Must be an owner. Must authorize. |
| `proposal_id` | `u64` | Must refer to an existing Pending or Ready proposal |

**Emits:** `("approved",)` → `ProposalApprovedEvent`

**Errors:** `Unauthorized`, `ProposalNotFound`, `ProposalNotActive`, `AlreadyApproved`

---

## `revoke`

```rust
fn revoke(env: Env, approver: Address, proposal_id: u64) -> Result<(), ContractError>
```

Withdraws the caller's approval. Transitions status back to `Pending` if approvals drop below threshold.

| Parameter | Type | Constraints |
|-----------|------|-------------|
| `approver` | `Address` | Must be an owner with an existing approval. Must authorize. |
| `proposal_id` | `u64` | Must refer to an existing Pending or Ready proposal |

**Emits:** `("revoked",)` → `ProposalRevokedEvent`

**Errors:** `Unauthorized`, `ProposalNotFound`, `ProposalNotActive`, `NotApproved`

---

## `execute`

```rust
fn execute(env: Env, executor: Address, proposal_id: u64) -> Result<(), ContractError>
```

Executes a `Ready` proposal. Transfers `amount` of `token` from the contract to `proposal.to`. The contract must hold sufficient token balance.

| Parameter | Type | Constraints |
|-----------|------|-------------|
| `executor` | `Address` | Must be an owner. Must authorize. |
| `proposal_id` | `u64` | Must refer to a Ready proposal whose deadline has not passed |

**Emits:** `("executed",)` → `ProposalExecutedEvent`

**Errors:** `Unauthorized`, `ProposalNotFound`, `ProposalNotActive`, `ThresholdNotMet`, `ProposalExpired`, `TransferFailed`

---

## `get_proposal`

```rust
fn get_proposal(env: Env, proposal_id: u64) -> Result<Proposal, ContractError>
```

Returns the current proposal state with a freshly derived status (Expired status is derived from the current ledger timestamp without requiring a write).

**Errors:** `NotInitialized`, `ProposalNotFound`

---

## `get_proposals_paged`

```rust
fn get_proposals_paged(env: Env, offset: u64, limit: u32) -> Vec<Proposal>
```

Returns a page of proposals. `offset` is 0-based (first proposal is at offset 0). `limit` is capped at 20. Proposals are returned in creation order.

---

## `get_owners`

```rust
fn get_owners(env: Env) -> Result<Vec<Address>, ContractError>
```

Returns the current owner list.

---

## `get_threshold`

```rust
fn get_threshold(env: Env) -> Result<u32, ContractError>
```

Returns the approval threshold.

---

## `get_total_proposals`

```rust
fn get_total_proposals(env: Env) -> u64
```

Returns the total number of proposals ever created (including expired and executed).

---

## `is_owner`

```rust
fn is_owner(env: Env, address: Address) -> bool
```

Returns `true` if `address` is a current owner.

---

## `has_approved`

```rust
fn has_approved(env: Env, proposal_id: u64, owner: Address) -> bool
```

Returns `true` if `owner` has approved `proposal_id`.

---

## Error Reference

The table below maps every `ContractError` discriminant to its cause and the recommended remediation. All codes are `u32` values encoded as `ScVal::Error` in XDR responses.

| Code | Variant Name | Cause / Description | Recommended Action |
|------|--------------|--------------------|--------------------|
| 1 | `AlreadyInitialized` | `initialize` was called on a contract instance that has already been set up. The `INIT` storage flag is already `true`. | Deploy a fresh contract instance; do not call `initialize` twice on the same address. |
| 2 | `NotInitialized` | A function that requires contract state (threshold, owners) was invoked before `initialize` completed successfully. | Call `initialize` first and confirm the transaction is finalized on-chain before calling any other function. |
| 3 | `Unauthorized` | The caller's address is not present in the current owner list, or the guardian address did not match when calling `freeze`. | Ensure the signing address is a registered owner. For `freeze`, ensure the address matches the stored guardian. |
| 4 | `InvalidThreshold` | The proposed threshold is either `0` or exceeds the current owner count (`threshold > owners.len()`). Thrown by `initialize` and `create_change_threshold_proposal`. | Supply a threshold in the range `[1, owners.len()]`. |
| 5 | `InvalidOwners` | The owner list passed to `initialize` is empty, or `create_add_owner_proposal` was called when the owner count is already at the maximum of **20** (`MAX_OWNERS = 20`). | Provide 1–20 unique owner addresses. If the cap is reached, remove an owner before adding another. |
| 6 | `ProposalNotFound` | No proposal record exists in persistent storage for the given `proposal_id`. | Verify the ID with `get_total_proposals` and confirm the proposal was created on the correct network/contract. |
| 7 | `ProposalNotActive` | The proposal's derived status is `Executed`, `Expired`, or `Revoked` — any terminal state that blocks further `approve`, `revoke`, or `execute` calls. | Check the proposal status via `get_proposal` before acting. Expired proposals can only be swept via `cancel_expired`. |
| 8 | `AlreadyApproved` | The calling owner has already cast an approval for this proposal (the approval flag in persistent storage is `true`). | Use `revoke` first to withdraw the prior approval, then re-approve if needed. |
| 9 | `NotApproved` | `revoke` was called by an owner who has not yet approved the proposal (approval flag is `false` or absent). | Only call `revoke` after successfully calling `approve` for the same proposal. |
| 10 | `ThresholdNotMet` | `execute` was called before the required approval weight was reached. Also raised by `set_guardian`, `unfreeze`, and `upgrade` when distinct approvers' combined weight is below the current threshold. | Gather enough owner voting weight, then retry. Check the current threshold via `get_threshold`. |
| 11 | `ProposalExpired` | The ledger timestamp has surpassed the proposal's `deadline`. Raised by `execute` when it detects expiry; the proposal status is persisted as `Expired` and the active-proposal counter is decremented. | Create a new proposal with a fresh deadline. Use `cancel_expired` to sweep stale IDs and free the active-proposal slot. |
| 12 | `InvalidAmount` | The `amount` field in `create_proposal` is less than **1** stroop (`MIN_AMOUNT = 1`). Negative and zero values are both rejected. | Pass a positive integer ≥ 1 in the token's smallest unit. For XLM this is stroops (1 XLM = 10,000,000 stroops). |
| 13 | `InvalidDeadline` | The `deadline` timestamp is ≤ the current ledger timestamp at the time the proposal creation transaction is processed. | Set a deadline strictly in the future. Account for block-time variance by adding a buffer of at least a few minutes. |
| 14 | `InvalidToken` | The address passed as `token` does not implement the Soroban token interface — specifically, at least one of `decimals()`, `symbol()`, or `name()` failed when probed. | Use a verified SEP-41 token address. On Testnet, use the canonical XLM, USDC, or EURC addresses listed in the frontend constants. |
| 15 | `TransferFailed` | The on-chain `token.transfer(contract_address, recipient, amount)` call failed, typically because the contract does not hold sufficient token balance. | Fund the contract with the required token balance before executing the proposal, then retry `execute`. |
| 16 | `EmptyDescription` | The `description` field is an empty string (length = 0). Checked in all four proposal-creation functions. | Provide a non-empty, human-readable description of the proposal's intent. |
| 17 | `DescriptionTooLong` | The `description` field exceeds **300 characters** (`MAX_DESCRIPTION_LEN = 300`). Checked in all four proposal-creation functions. | Trim the description to 300 characters or fewer before submitting. |
| 18 | `TooManyActiveProposals` | The number of proposals currently in `Pending` or `Ready` status has reached the cap of **50** (`MAX_ACTIVE_PROPOSALS = 50`). New proposals cannot be created until existing ones are executed or expired. | Execute or sweep at least one active proposal using `execute` or `cancel_expired`, then retry creation. |
| 19 | `DuplicateOwner` | Two or more identical addresses appear in the owner list during `initialize`, or an address being added via `create_add_owner_proposal` already exists in the current owner list. Also checked in `set_guardian`, `unfreeze`, and `upgrade` for duplicate approver addresses. | Deduplicate all address lists before submitting. |
| 20 | `ArithmeticError` | An integer overflow occurred — for example, the internal proposal ID counter wrapped when incrementing past `u64::MAX`, or an `approvals` counter underflowed during `checked_sub`. This is a safety guard that should never trigger in normal operation. | If encountered, contact the contract maintainers; this indicates an edge case at extreme scale. |
| 21 | `InvalidDuration` | The gap between the current ledger timestamp and the `deadline` exceeds **7,776,000 seconds** (90 days, `MAX_PROPOSAL_DURATION`). Checked in all four proposal-creation functions. | Set a deadline no more than 90 days in the future from the current time. |
| 22 | `InvalidRecipient` | The `to` address in `create_proposal` is the contract's own address (`env.current_contract_address()`). Self-transfers are explicitly rejected to prevent accidental fund loops. | Supply an external recipient address. The contract cannot transfer tokens to itself. |
| 23 | `TimeLockActive` | `execute` was called before the time-lock delay has elapsed since the proposal first reached `Ready` status (`now < ready_at + time_lock_delay`). Only raised when a non-zero `time_lock_delay` was set during `initialize`. | Wait until `ready_at + time_lock_delay` has passed. Query `get_time_lock_delay` to determine the required wait period. |
| 24 | `WouldBreakThreshold` | `create_remove_owner_proposal` was rejected because executing the removal would leave fewer owners than the current threshold (`owners.len() <= threshold`). | Lower the threshold first via `create_change_threshold_proposal`, then remove the owner, or ensure the owner count exceeds the threshold before attempting removal. |
| 25 | `OwnerNotFound` | The address supplied to `create_remove_owner_proposal` as `owner_to_remove` is not present in the current owner list. | Verify the address is a registered owner with `is_owner` or `get_owners` before submitting a removal proposal. |
| 26 | `ContractFrozen` | The contract's frozen flag is `true`. `create_proposal`, `create_add_owner_proposal`, `create_remove_owner_proposal`, `create_change_threshold_proposal`, and `execute` are all blocked while frozen. | The guardian must call `freeze` (already done if this error appears). Only `unfreeze` (requiring threshold co-signers) can restore normal operation. |
| 27 | `NoGuardian` | `freeze` was called but no guardian address has been stored in the contract (the `GUARD` storage key is absent). | Call `set_guardian` with distinct owner co-signers whose combined weight reaches threshold. |
| 28 | `SpendingLimitExceeded` | The proposer's aggregate amount for a token in `create_proposal` exceeds the per-owner spending limit stored for that `(owner, token)` pair. Raised only when a limit has been set; unrestricted owners are unaffected. | Lower the proposal amount so it fits under the limit, or raise/clear the limit via the spending-limit governance path before retrying. |

---

## XDR Type Reference

When calling contract functions from JavaScript, each parameter must be converted to the XDR `SCVal` format that the Soroban RPC expects. The Stellar SDK provides `nativeToScVal` for encoding and `scValToNative` for decoding.

> **Important:** `u64` and `i128` values exceed JavaScript's safe integer range (`Number.MAX_SAFE_INTEGER` = 2⁵³ − 1). They **must** be passed as JavaScript `BigInt` — not `Number`. Using `Number` silently truncates the value.

| Rust Type | SCVal Variant | Build with `nativeToScVal` | Decode with `scValToNative` |
|-----------|---------------|----------------------------|-----------------------------|
| `Address` | `ScVal::Address` | `nativeToScVal(address, { type: 'address' })` | `scValToNative(scval)` → `"G…"` string |
| `Vec<T>` | `ScVal::Vec` | `nativeToScVal(array, { type: 'vec' })` | `scValToNative(scval)` → JavaScript `Array` |
| `u32` | `ScVal::U32` | `nativeToScVal(n, { type: 'u32' })` | `scValToNative(scval)` → JavaScript `Number` |
| `u64` | `ScVal::U64` | `nativeToScVal(BigInt(n), { type: 'u64' })` | `scValToNative(scval)` → JavaScript `BigInt` |
| `i128` | `ScVal::I128` | `nativeToScVal(BigInt(n), { type: 'i128' })` | `scValToNative(scval)` → JavaScript `BigInt` |
| `String` | `ScVal::String` | `nativeToScVal(s, { type: 'string' })` | `scValToNative(scval)` → JavaScript `String` |
| `bool` | `ScVal::Bool` | `nativeToScVal(b, { type: 'bool' })` | `scValToNative(scval)` → JavaScript `Boolean` |
| `Proposal` | `ScVal::Map` | N/A (output only) | `scValToNative(scval)` → plain JavaScript object whose field names match the `Proposal` struct in [ARCHITECTURE.md §3](../ARCHITECTURE.md#3-storage-layout-soroban) |
| `()` (unit) | `ScVal::Void` | N/A (no input) | `scValToNative(scval)` → `undefined` |

---

## Event Payloads

Each Soroban event has an ordered **topics array** followed by a **data payload**. The contract address is implicitly prepended as the first element of the topics array by the network. The remainder is published explicitly by the contract via `env.events().publish((symbol,), data)`.

### `ProposalCreatedEvent`

**Topics:**
| Index | Value | XDR Type |
|-------|-------|----------|
| 0 | Contract address (implicit) | `ScVal::Address` |
| 1 | `"created"` | `ScVal::Symbol` |

**Data fields:**
| Field | Rust Type | XDR SCVal Type | Description |
|-------|-----------|----------------|-------------|
| `id` | `u64` | `ScVal::U64` | Unique proposal ID assigned by the counter |
| `proposer` | `Address` | `ScVal::Address` | Owner who created the proposal |
| `threshold` | `u32` | `ScVal::U32` | Approval threshold in effect at creation |
| `category` | `ProposalCategory` | `ScVal::U32` (enum discriminant) | Spending category tag (`Transfer`, `Payroll`, `Grant`, `Ops`, `Other`) |
| `transfers` | `Vec<Transfer>` | `ScVal::Vec` | Asset transfers attached to the proposal; empty for governance proposals (add/remove owner, change threshold, spending limit) |
| `quorum_weight` | `u32` | `ScVal::U32` | The weighted quorum this proposal must reach to become `Ready`. Snapshotted from the threshold at the moment of creation so auditors can reconstruct the exact approval requirement even if the threshold is changed by a later governance proposal. |
| `total_weight_at_creation` | `u32` | `ScVal::U32` | Sum of all owner weights at the moment this proposal was created. Because owners can be added, removed, or re-weighted after creation, this field is the only way to recover the original total-weight context from the event log alone — it is not derivable from current contract state once ownership changes. |

```rust
struct ProposalCreatedEvent {
    id: u64,
    proposer: Address,
    threshold: u32,
    category: ProposalCategory,
    transfers: Vec<Transfer>,
    quorum_weight: u32,
    total_weight_at_creation: u32,
}
```

### `ProposalApprovedEvent`

**Topics:**
| Index | Value | XDR Type |
|-------|-------|----------|
| 0 | Contract address (implicit) | `ScVal::Address` |
| 1 | `"approved"` | `ScVal::Symbol` |

**Data fields:**
| Field | Rust Type | XDR SCVal Type | Description |
|-------|-----------|----------------|-------------|
| `id` | `u64` | `ScVal::U64` | Proposal ID that received the approval |
| `approver` | `Address` | `ScVal::Address` | Owner who approved |
| `approvals` | `u32` | `ScVal::U32` | Running total of approvals after this vote |
| `threshold` | `u32` | `ScVal::U32` | Approval threshold at vote time |

```rust
struct ProposalApprovedEvent {
    id: u64,
    approver: Address,
    approvals: u32,
    threshold: u32,
}
```

### `ProposalRevokedEvent`

**Topics:**
| Index | Value | XDR Type |
|-------|-------|----------|
| 0 | Contract address (implicit) | `ScVal::Address` |
| 1 | `"revoked"` | `ScVal::Symbol` |

**Data fields:**
| Field | Rust Type | XDR SCVal Type | Description |
|-------|-----------|----------------|-------------|
| `id` | `u64` | `ScVal::U64` | Proposal ID the approval was revoked from |
| `approver` | `Address` | `ScVal::Address` | Owner who revoked their approval |
| `approvals` | `u32` | `ScVal::U32` | Remaining approval count after the revoke |

```rust
struct ProposalRevokedEvent {
    id: u64,
    approver: Address,
    approvals: u32,
}
```

### `ProposalExecutedEvent`

**Topics:**
| Index | Value | XDR Type |
|-------|-------|----------|
| 0 | Contract address (implicit) | `ScVal::Address` |
| 1 | `"executed"` | `ScVal::Symbol` |

**Data fields:**
| Field | Rust Type | XDR SCVal Type | Description |
|-------|-----------|----------------|-------------|
| `id` | `u64` | `ScVal::U64` | Proposal ID that was executed |
| `executor` | `Address` | `ScVal::Address` | Owner who triggered the execution |
| `to` | `Address` | `ScVal::Address` | Recipient of the transferred tokens |
| `amount` | `i128` | `ScVal::I128` | Transferred amount (see [Token Amounts](#token-amounts-and-decimals)) |

```rust
struct ProposalExecutedEvent {
    id: u64,
    executor: Address,
    to: Address,
    amount: i128,
}
```
