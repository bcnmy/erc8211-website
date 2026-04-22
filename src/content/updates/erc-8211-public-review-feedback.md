---
title: 'From Draft to Dialogue: The First Weeks of ERC-8211 in Public Review'
description: >-
  ERC-8211 — "Smart Batching" — is a Draft standard. The whole point of Draft
  status is to be changed by the people who read it. Here is what we heard in
  the first weeks of public review, and what we did with it.
publishedAt: 2026-04-22
author: 'Biconomy'
tags: ['public-review', 'spec-update']
---

*ERC-8211 — "Smart Batching" — is a Draft standard. The whole point of
Draft status is to be changed by the people who read it. Since the
proposal was opened as PR #1638 on the `ethereum/ERCs` repository, we
have had some genuinely good feedback from reviewers, other ERC authors,
and developers building on top of the idea. This post is a public write-up
of what we heard and what we did with it.*

---

## Why this post exists

Proposing a standard is not the same thing as shipping a product. A
product can be useful if one team believes in it. A standard is only
useful if the ecosystem it targets agrees that it solves the right
problem in the right way.

That is why ERC-8211 went into the public review process instead of
living as an internal spec forever. The reviewers on the ERC repo,
the authors of adjacent standards, and the developers who have started
building against the draft are exactly the audience whose pushback we
need before anything gets frozen.

In the weeks since the PR opened, we have had three kinds of feedback:

1. **Line-level review** from other ERC authors on the GitHub PR
   itself.
2. **Design-level critique** on the tradeoff between a structured,
   declarative encoding (what ERC-8211 is) and a general-purpose
   on-chain interpreter (what projects like Weiroll and similar
   EVM interpreters offer).
3. **Build-level feedback** from developers — in particular people
   shipping agentic DeFi flows — who have started trying to slot
   ERC-8211 into their actual workloads.

We want to summarise each of these, credit the reviewers, and be
explicit about which suggestions we have already adopted, which we
are still working through, and which we have intentionally pushed
back on.

If you read the spec and something bothers you, that's exactly the
signal we're asking for.

---

## The biggest change so far: Merkle trees are out, ERC-7964 is in

The most consequential piece of feedback came from **ernestognw**,
author of ERC-7964 (Cross-Chain EIP-712 Signatures). The original
ERC-8211 draft described cross-chain orchestration using a
Merkle-tree authorization scheme: the user signs one Merkle root,
and each per-chain batch becomes a leaf that can be revealed and
executed independently.

Ernesto's review (paraphrasing): *Merkle trees for signing are
obscure to the user. The leaf hashes don't tell the wallet what
the user is signing. There's a better answer — pre-hashed EIP-712
typed arrays — and it's what ERC-7964 standardises.*

He was right. And in fact, the Biconomy implementation had already
migrated to that exact flow internally — the public demo at the
time was using pre-hashed EIP-712 arrays even for single-chain
flows. The Merkle-tree language in the draft was stale, a holdover
from an earlier iteration that we hadn't yet reflected in the spec.

So the response was short: yes, thank you, you're correct, let's
fix it.

Ernesto then went a step further and opened a PR against the
ERC-8211 branch to do the rewrite himself — replacing the
Merkle-tree diagrams and references with an ERC-7964-shaped
diagram, adding `requires: 7964` to the frontmatter, and tightening
the Motivation and Security sections. That PR landed, merged into
the main PR, and is now part of ERC-8211 as it stands.

The upshot for anyone reading the spec today:

- Cross-chain authorization uses **one user-signed ERC-7964
  signature** covering a typed array of per-chain operations.
- Each per-chain operation is a structured EIP-712 type, so a
  wallet can render what's being signed *on every chain* — not an
  opaque 32-byte leaf.
- ERC-8211 keeps the part it was actually designed to solve:
  predicate entries that gate execution on observed on-chain state
  (balances arriving, nonces advancing, timestamps clearing),
  credibly neutral to which bridge or interop layer delivered them.

One small caveat Ernesto also flagged, which we're passing along
because it matters for anyone reading about full wallet
transparency: the EIP-712 structs signed in today's ERC-4337 v0.7
EntryPoint still contain a `userOpHash` field that a wallet can't
fully introspect, because v0.7 doesn't use EIP-712 structured
hashing for the UserOp itself. v0.8 and v0.9 fix that. Until
bundler infrastructure catches up, some of the "the wallet shows
you exactly what you're signing" story has a bounded asterisk next
to it. That's a property of the bundler stack, not of ERC-8211 or
ERC-7964, but we want it said out loud.

## Line-level review: dynamic return values and constraint comparisons

Ernesto also raised two more focused points on the encoding itself.

**Dynamic return types.** The original text described how a step's
return value gets stored and later referenced by subsequent steps.
Reading the spec literally, this would only work cleanly for static
return types. A function returning `bytes` or `string` or a dynamic
array starts with an offset pointer at word 0 — so a naive read of
"word 0" would capture the offset, not the length or content.

This was an error by omission, not by design. Biconomy's reference
implementation already ships a small "unwrap" utility contract
that lets you address any offset inside a return value, specifically
to handle dynamic types cleanly. It just wasn't in the spec text.
We're adding it explicitly, so the encoding story covers dynamic
return types rather than implicitly leaving them as an exercise.

**Signed integer comparisons.** The `Constraint` enum currently
defines `GTE` and `LTE` as unsigned comparisons on `bytes32`. Ernesto
pointed out that some DeFi contexts — funding rates, PnL checks,
tick math — genuinely want signed comparisons, and under unsigned
rules, `-1` as `int256` encodes as `0xffff…ffff` and compares as
"greater than everything."

This one we're still working through. The simplest answer is to add
signed variants (`GTE_SIGNED` / `LTE_SIGNED`) so authors can pick
the right semantics per parameter. There's also a version where
the comparator is annotated with an "interpret as" flag rather
than duplicating opcodes. We don't want to ship either of those
without looking at actual use sites, because the encoding has knock-
on effects for wallet rendering and static analysis — the two
things we're specifically trying not to make worse. Expect a
concrete proposal in the next revision.

**OR composition.** The current spec composes constraints with AND
semantics: every constraint on an input must hold, and every predicate
entry in a batch must hold. Ernesto asked whether OR composition was
worth a first-class slot in the encoding, pointing out that the
workaround today is deploying a helper contract that computes OR
logic and returns a boolean — which partially defeats the point of
declarative, contract-free constraints.

This is a genuinely interesting open question. Our current answer
is "not yet, and probably not at the top level." A full Boolean
algebra inside the encoding starts to look like the interpreter
direction we've deliberately stepped away from (more on that in
the next section). But a bounded form — say, an `IN` set that
generalises, or a small `ANY_OF` primitive over a list of scalar
comparators — might be worth including. Again, we're looking for
real use sites before committing to a specific shape.

---

## The bigger design question: why not just ship a general-purpose interpreter?

The most substantive *design-level* conversation on the PR — and in
parallel on Ethereum Magicians — has been the "why not Weiroll?"
question. Or more generally: *why is ERC-8211 a constrained,
declarative encoding instead of a small, general-purpose on-chain
interpreter?*

The argument for an interpreter is real. Weiroll has been in
production for years. `evm-interpreter`-style projects show up
periodically. Turing-complete-ish little VMs are genuinely elegant:
one primitive to rule them all.

Our position, stated on the PR by one of the co-authors and worth
repeating here, is that **ERC-8211 is intentionally limited**. It
does exactly four things:

- Fetch values (static calls, balance queries, literals)
- Check constraints on those values
- Route values into call parameters
- Execute calls sequentially

That's it. No branching. No loops. No conditional batching. No
reentrancy tricks. No arbitrary storage writes from inside the
batch encoding itself.

This is not a limitation. It's the feature.
Declarative data with a small, fixed vocabulary is what lets
wallets, explorers, bundlers, auditors, and AI agents *parse* a
batch and show the user what it will do — before it runs. A
Turing-complete interpreter sitting between the signer and the
chain forces every one of those tools into full symbolic execution
to answer the same question. Worse, it makes the attack surface
genuinely harder to reason about: every extra opcode is an extra
place for a subtle bug.

From the practical experience of working with developers in this
space — DeFi teams, agent builders, protocol integrators — the
four primitives above cover 80%+ of what people actually need to
express in a multi-step flow. The remaining cases either (a) belong
in the target contract, not in the batch encoding, or (b) belong
in the signing layer (what ERC-7964 is doing), not in the execution
layer.

We've written this position up at more length elsewhere, including
a side-by-side comparison with Weiroll specifically — covering
readability, static analysis, gas tradeoffs, cross-chain, and the
account-abstraction story. If the "why declarative instead of
interpreter?" question is the one you care about, that's the
better place to go deep.

Short version: ERC-8211 is narrow by choice. Narrowness is what
buys readability, verifiability, and a viable path to native
account-abstraction transports. We think those are the properties
that matter most for the next several years of Ethereum execution,
and we're willing to trade off the flexibility of a general
interpreter to keep them.

---

## Voices from the developer side

GitHub is only half of the conversation. The other half has been in
the group chat where developers who are actually building on this
stuff have been trading notes since the proposal dropped.

A comment we keep coming back to is from **Arcyx**, a DeFi agent
developer:

> *"As an active DeFi Agent dev, I was actually planning to solve this
> 'dynamic output' by building a custom executor module for ZeroDev.
> It's fantastic to see a standardized approach, it's exactly what
> agentic workflows need to scale. Looking forward to seeing the
> SDKs and integrating this into my project."*

That's the exact pattern that motivated the ERC in the first place.
Every serious team building multi-step flows — human-initiated or
agent-initiated — eventually runs into the "signed-at-T0, executed-
at-T1, state-has-moved-in-between" problem. Today, the cost of
solving it is: deploy a custom executor, audit it, maintain it,
gate access to it, redeploy it per chain, and convince every wallet
stack to route through it.

If ERC-8211 lands well, that whole stack becomes "declare the
fetcher, declare the constraint, sign it, done." Arcyx's feedback
is useful precisely because it validates the shape of the problem
from the agent-workflow direction, which is where the pressure on
dynamic batches is growing fastest.

There has been plenty of other encouragement — from wallet devs,
protocol teams, researchers — that we won't quote line by line. The
relevant signal isn't "people like it." It's "people who were
already going to build this themselves recognise the primitive."
That's the crowd whose feedback gets the most weight over the next
revisions.

---

## Where the spec is, right now

Concretely, as of this writing, ERC-8211 (PR #1638) reflects the
following in-flight state:

**Already merged into the draft:**

- Merkle-tree authorization references removed.
- ERC-7964 added as a required companion for cross-chain
  authorization, with the updated diagram and inline prose.
- Frontmatter updated (`requires: 7964`).

**Queued for the next revision:**

- Explicit handling of dynamic return types in the storage/read
  section, with the unwrap utility described normatively.
- Signed-integer comparator semantics for `GTE` / `LTE`.
- A decision (one way or the other, with rationale) on whether
  OR composition warrants a first-class encoding slot or stays
  as a helper-contract pattern.

**Intentionally out of scope, and staying out:**

- Branching, looping, arbitrary storage writes, or any other step
  toward a general-purpose interpreter inside the encoding.
- Bundling authorization *semantics* into the execution layer —
  that belongs in ERC-7964 (cross-chain) or the account standard
  (ERC-4337 / ERC-7702 / native AA via EIP-8141), not here.

Nothing here is final. That's what "Draft" means.

---

## How to push back

If you've made it this far and you disagree with something — how
constraints compose, how dynamic return values are read, whether
signed comparators should be opcodes or flags, whether the account-
centric framing is right, whether the cross-chain story relies too
heavily on ERC-7964 maturing on its own — that's the feedback we
actually want.

There are three places to put it:

- **The PR itself** (`ethereum/ERCs` #1638) for line-level review
  and spec-text changes. This is where prior feedback has produced
  the most concrete improvements, because diffs are easy to
  evaluate and merge.
- **Ethereum Magicians** (`ERC-8211 — Smart Batching` thread) for
  design-level critique and comparisons with adjacent work. This is
  the right venue for "have you considered X instead?" or "this
  conflicts with Y" conversations.
- **The reference implementation and SDK repos**, if the concern
  is practical — ergonomics, gas, integration surface with a
  specific account standard.

We don't expect every reviewer to agree with every design choice.
We do expect the spec to end up meaningfully different from its
current shape by the time it leaves Draft — and the only way that
happens correctly is if the people who'd have to live with it push
back now, not after it's frozen.

Biconomy is one of the authors of ERC-8211, and we have our own
conviction about the shape it should take. But the ERC is not the
product. The standard is the product. And a standard that only one
team wanted is not a standard at all.

Thanks to everyone who has reviewed, commented, critiqued, or
shipped code against the draft so far. Keep it coming.

---

### Further reading

- [ERC-8211 pull request](https://github.com/ethereum/ERCs/pull/1638)
- [ERC-8211 discussion on Ethereum Magicians](https://ethereum-magicians.org/t/erc-8211-smart-batching/28135)
- [ERC-7964 (Cross-Chain EIP-712 Signatures)](https://github.com/ethereum/ERCs)
- [Weiroll vs ERC-8211, side-by-side](https://blog.biconomy.io/from-scripts-to-programs-how-smart-batching-evolves-on-chain-execution/)
