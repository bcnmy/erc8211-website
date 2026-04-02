# ERC: Smart Batching — Runtime-Resolved Parameters and Predicate-Gated Execution for Smart Accounts

## Abstract

Smart Batching is a batch encoding standard where each parameter declares *how to obtain its value at execution time* and *what conditions that value must satisfy*. Parameters can be literals, live `staticcall` results, or balance queries — each independently resolved on-chain and validated against inline constraints before being assembled into the call.

Critically, a batch is no longer just a sequence of steps — it can include inline **assertions**: conditions on chain state that must hold for execution to proceed. A user doesn't merely say "do A, then B"; they say "do A, *assert the result is acceptable*, then B." Steps and assertions are peers in the same batch encoding, turning a blind transaction list into a verifiable program with built-in safety guarantees.

This eliminates the fundamental limitation of static batching (ERC-4337, EIP-5792): every parameter is frozen at signing time, blind to on-chain state at execution. If a swap returns fewer tokens than estimated, gas costs shift, or a bridge delivers with unexpected slippage — the batch reverts. The only workaround today is deploying custom smart contracts for each multi-step flow, or relying on protocol-level slippage parameters that not every target contract exposes.

**Pull Request:** https://github.com/ethereum/ERCs/pull/1638

**Full Specification:** https://github.com/oxshaman/ERCs/blob/smart-batching/ERCS/erc-xxxx.md

---

## Motivation

Real-world DeFi flows produce dynamic, unpredictable outputs. A swap yields a variable token amount. A withdrawal from a lending vault returns a variable share-to-asset conversion. A bridge delivers tokens after an unpredictable delay with variable fees. Static batching forces two bad choices: hardcode optimistic amounts (risking reverts) or underestimate conservatively (leaving value stranded).

Smart Batching resolves parameters at execution time. Instead of pre-encoding a static calldata blob, the user signs a batch where each parameter specifies *how to obtain its value* — as a literal, a `staticcall`, or a balance query. The execution logic resolves each parameter and constructs the calldata from scratch during the transaction.

But dynamic resolution alone is half the story. The other half is **assertions** — the ability for a batch to declare conditions that must be true at any point during execution. Today's batches are flat lists of actions: "call A, call B, call C." If the outcome of call A is unfavorable, you find out only after the entire batch reverts (or worse, succeeds with a bad result). With Smart Batching, assertions sit between steps as first-class entries, letting the user express: "call A, *verify the output is at least X*, then call B." The batch becomes a program with embedded safety checks, not a hopeful script.

```
STATIC BATCHING (current model)
  Step 1: swap(100 USDC)           → OK
  Step 2: supply(0.05 WETH)        → REVERT (actual output was 0.0495)
  Problem: "0.05" was a guess at signature time.
  No way to express "only proceed if output ≥ threshold."

SMART BATCHING (this standard)
  Step 1: swap(100 USDC)           → OK, returns 0.0495
  Assert: BALANCE(WETH, account) ≥ 0.04    ✓ (user-defined safety floor)
  Step 2: supply(amount)           → amount = BALANCE(WETH, account) = 0.0495 ✓
  Parameters resolve on-chain. Assertions guard each transition.
```

## Key Design Decisions

### 1. Calldata Construction, Not Placeholder Patching

Rather than pre-encoding calldata with sentinel bytes at known offsets and patching them, Smart Batching builds calldata from scratch — each `InputParam` is self-contained with its fetcher type, routing destination, and constraints. No offset arithmetic, no knowledge of the target function's ABI layout required.

### 2. Encoding-First, Account-Standard-Agnostic

The standard defines encoding schemes and interfaces — not a specific module. The same `ComposableExecution[]` encoding works as:
- An **ERC-7579** executor module
- An **ERC-6900** plugin
- A **native account** method
- An **ERC-7702** delegation target

One wire format. One interface (`IComposableExecution`). Thin adapters handle installation and permissions; the core logic is shared.

### 3. Assertions as First-Class Batch Entries

In every existing batching standard, a batch entry means "execute this call." Smart Batching introduces a second kind of entry: the **assertion** — a condition on chain state that must hold for the batch to continue. Assertions are not a bolt-on; they use the same `InputParam` resolution and constraint mechanism as action entries, just with no call target.

This matters for three reasons:

**Safety without custom contracts.** Today, if you want to enforce "only supply to Aave if my swap output exceeds a threshold," you need a bespoke contract (or a protocol that happens to expose a `minAmountOut` parameter). With assertions, the safety check is part of the batch itself — any user can express arbitrary conditions on any resolved value, against any protocol, without deploying anything.

**Protection against MEV and state manipulation.** Assertions let users guard against sandwich attacks, oracle manipulation, and unfavorable execution conditions. A batch can assert a price feed is within an expected range, a pool's reserves haven't been distorted, or a balance meets a minimum — all evaluated atomically within the same transaction. If any assertion fails, the entire batch reverts before value is lost.

**Composable intent expression.** Assertions transform batches from imperative scripts ("do X, do Y") into declarative programs ("do X, *require* P, do Y"). Users express what outcomes they consider acceptable, not just what actions to take. This is a fundamentally different model — the batch encodes intent, and the EVM enforces it.

### 4. Emergent Predicates via Constraints

Each resolved value can carry inline constraints (GTE, LTE, EQ, IN). An entry with no call target (`address(0)`) becomes a pure boolean gate on chain state — a **predicate entry**. No separate predicate mechanism needed.

This produces cross-chain orchestration for free: relayers simulate batches via `eth_call`, submit when predicates are satisfied. Multi-chain flows execute as a single signed program, each step gated by verifiable on-chain predicates — agnostic to the interoperability layer (native bridges, ERC-7683, ERC-7786, any messaging protocol).

### 5. From Transactions to Programs

```typescript
const batch = smartBatch([
  swap({ from: WETH, to: USDC, amount: fullBalance() }),
  assert({ balance: gte(USDC, account, 2500e6) }),     // abort if swap output too low
  supply({ protocol: "aave", token: USDC, amount: fullBalance() }),
  assert({ balance: gte(aUSDC, account, 2400e6) }),    // verify supply was credited
  stake({ token: aUSDC, amount: fullBalance() }),
]);
```

Steps and assertions interleave freely. Developers author multi-step, multi-chain programs in TypeScript — actions *and* safety conditions side by side — compiled to a standard on-chain encoding, signed once, and executed entirely by the EVM. No contract deployment. No audit cycles for new flows.

## Core Primitives

**Input Parameters** — Each specifies two orthogonal concerns:
- **Where the value goes** (`TARGET`, `VALUE`, `CALL_DATA`)
- **How the value is obtained** (`RAW_BYTES`, `STATIC_CALL`, `BALANCE`)

**Output Parameters** — Capture return values to an external Storage contract for use by subsequent entries (`EXEC_RESULT`, `STATIC_CALL`).

**Constraints** — Inline predicates on resolved values (`EQ`, `GTE`, `LTE`, `IN`). If any constraint fails, the entire batch reverts.

**Storage Contract** — Namespaced key-value storage with per-account, per-caller isolation. Supports transient storage (EIP-1153) for gas efficiency.

## Backwards Compatibility

Fully backwards compatible. The encoding is self-contained and additive — no existing smart account requires migration. Works alongside existing `executeBatch` operations, and forward-compatible with EIP-8141 Frame Transactions.

## Reference Implementation

https://github.com/bcnmy/composable-batch-erc/tree/main/contracts

The reference implementation includes:
- `IComposableExecution.sol` — Standard interface
- `ComposableExecutionLib.sol` — Shared library with full resolution algorithm
- `Storage.sol` — External namespaced storage contract
- `ComposableExecutionModule.sol` — ERC-7579 adapter
- `ComposableExecutionBase.sol` — Native account integration base

The reference implementation has been audited, with all findings remediated.

---

**Authors:** Mislav Javor ([@oxshaman](https://github.com/oxshaman)), Filip Dujmušić ([@fichiokaku](https://github.com/fichiokaku)), Filipp Makarov ([@filmakarov](https://github.com/filmakarov)), Venkatesh Rajendran ([@vr16x](https://github.com/vr16x))


We welcome feedback on the specification, especially around:
- The constraint mechanism and whether the four constraint types (EQ, GTE, LTE, IN) are sufficient
- The Storage contract design and transient storage trade-offs
- The predicate entry pattern for cross-chain orchestration
- Integration considerations for different account standards (ERC-7579, ERC-6900, ERC-7702)