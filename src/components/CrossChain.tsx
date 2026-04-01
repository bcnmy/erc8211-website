import { useState } from 'react';

const CHAINS = [
  { name: 'Ethereum L1', id: 'L1', action: 'Bridge 100 USDC to Optimism', predicate: null, color: '#627eea' },
  { name: 'Optimism', id: 'OP', action: 'swap → lend', predicate: 'BALANCE(USDC) ≥ 100', color: '#ff0420' },
  { name: 'Arbitrum', id: 'ARB', action: 'claim → LP', predicate: 'nonce > N', color: '#28a0f0' },
  { name: 'Base', id: 'BASE', action: 'unwrap → send', predicate: 'timestamp > T', color: '#0052ff' },
];

export default function CrossChain() {
  const [activeChain, setActiveChain] = useState<number | null>(null);

  return (
    <section id="cross-chain" className="py-20" style={{ borderTop: '1px solid #ebebeb' }}>
      <div className="max-w-[960px] mx-auto px-6">
        <h2
          className="text-3xl sm:text-4xl font-bold mb-4"
          style={{ fontFamily: '"Source Serif 4", Georgia, serif', color: '#111' }}
        >
          Cross-chain orchestration
        </h2>

        <div className="mb-10">
          <p style={{ color: '#555', lineHeight: '1.7', marginBottom: '1.25em' }}>
            A batch entry with no call target becomes a <strong style={{ color: '#2a2a2a' }}>predicate entry</strong> — a
            pure boolean gate on chain state. Relayers simulate batches
            via <code style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.875em' }}>eth_call</code> and
            submit when predicates are met. Multi-chain flows execute as a single signed program.
          </p>
          <p style={{ color: '#555', lineHeight: '1.7' }}>
            Click any chain below to see how its predicate gates execution.
          </p>
        </div>

        {/* Merkle root */}
        <div className="text-center mb-6">
          <div
            className="inline-block px-4 py-2 rounded-lg text-xs"
            style={{
              fontFamily: '"JetBrains Mono", monospace',
              background: 'rgba(37,99,235,0.04)',
              border: '1px solid rgba(37,99,235,0.1)',
              color: '#2563eb',
            }}
          >
            User signs ONE Merkle root → covers all 4 chains
          </div>
        </div>

        {/* Chain cards */}
        <div className="space-y-3 mb-8">
          {CHAINS.map((chain, i) => {
            const isActive = activeChain === i;
            return (
              <button
                key={chain.id}
                onClick={() => setActiveChain(isActive ? null : i)}
                className="w-full text-left rounded-[10px] p-4 transition-all duration-200"
                style={{
                  background: isActive ? '#fff' : '#fafaf9',
                  border: `1px solid ${isActive ? chain.color + '30' : '#ebebeb'}`,
                  boxShadow: isActive ? `0 2px 12px ${chain.color}10` : 'none',
                }}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold"
                    style={{
                      fontFamily: '"JetBrains Mono", monospace',
                      background: `${chain.color}10`,
                      color: chain.color,
                      border: `1px solid ${chain.color}20`,
                    }}
                  >
                    {chain.id}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold" style={{ color: '#1a1a1a' }}>{chain.name}</div>
                    <div className="text-xs" style={{ fontFamily: '"JetBrains Mono", monospace', color: '#8a8a8a' }}>
                      {chain.action}
                    </div>
                  </div>
                  <svg
                    className="w-4 h-4 transition-transform"
                    style={{ color: '#a3a3a3', transform: isActive ? 'rotate(180deg)' : 'rotate(0deg)' }}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </div>

                {isActive && (
                  <div className="mt-3 pt-3" style={{ borderTop: '1px solid #ebebeb' }}>
                    {chain.predicate ? (
                      <div className="flex items-start gap-2">
                        <span className="text-xs font-medium" style={{ color: '#8a8a8a', minWidth: '60px' }}>Predicate</span>
                        <div>
                          <code
                            className="text-xs"
                            style={{ fontFamily: '"JetBrains Mono", monospace', color: '#2563eb' }}
                          >
                            {chain.predicate}
                          </code>
                          <p className="text-xs mt-1.5" style={{ color: '#8a8a8a', lineHeight: '1.5' }}>
                            {i === 1 && 'Relayer waits until bridged USDC arrives on Optimism. The constraint is bridge-agnostic — any mechanism that produces the balance works.'}
                            {i === 2 && 'Relayer waits until a prior transaction confirms on Arbitrum before executing this batch.'}
                            {i === 3 && 'Time-gated execution — the relayer waits until a target timestamp is reached before submitting.'}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs" style={{ color: '#8a8a8a' }}>
                        No predicate — this is the first step, executed immediately by the relayer.
                      </div>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className="rounded-lg p-4 text-xs" style={{ background: '#f8f9fa', border: '1px solid #ebebeb', color: '#717171', lineHeight: '1.6' }}>
          <strong style={{ color: '#555' }}>Key property:</strong> Constraints observe <em>state</em>, not mechanism.
          The bridge could be any provider — native bridge, Across, ERC-7683, LayerZero —
          the constraint just waits for the balance to appear. The predicate model is <strong style={{ color: '#555' }}>credibly neutral</strong> with
          respect to the interoperability layer.
        </div>
      </div>
    </section>
  );
}
