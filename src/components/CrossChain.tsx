import { useState } from 'react';

const MONO = '"JetBrains Mono", monospace';
const BASE_COLOR = '#0052ff';
const ETH_COLOR = '#627eea';
const SUCCESS = '#16a34a';
const ACCENT = '#2563eb';

type StepKind = 'approve' | 'action' | 'assert';

type Step = {
  kind: StepKind;
  label: string;
  detail: string;
};

type ChainBatch = {
  chain: string;
  chainId: string;
  color: string;
  logo: React.ReactNode;
  predicateGate?: string;
  predicateDetail?: string;
  steps: Step[];
};

function BaseLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 111 111" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M54.921 110.034C85.359 110.034 110.034 85.402 110.034 55.017C110.034 24.6319 85.359 0 54.921 0C26.0432 0 2.35281 22.1714 0 50.3923H72.8467V59.6416H0C2.35281 87.8625 26.0432 110.034 54.921 110.034Z" fill="#0052FF"/>
    </svg>
  );
}

function EthereumLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 256 417" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M127.961 0l-2.795 9.5v275.668l2.795 2.79 127.962-75.638z" fill="#343434"/>
      <path d="M127.962 0L0 212.32l127.962 75.639V154.158z" fill="#8C8C8C"/>
      <path d="M127.961 312.187l-1.575 1.92v98.199l1.575 4.6L256 236.587z" fill="#3C3C3B"/>
      <path d="M127.962 416.905v-104.72L0 236.585z" fill="#8C8C8C"/>
      <path d="M127.961 287.958l127.96-75.637-127.96-58.162z" fill="#141414"/>
      <path d="M0 212.32l127.96 75.638V154.159z" fill="#393939"/>
    </svg>
  );
}

const BATCHES: ChainBatch[] = [
  {
    chain: 'Base',
    chainId: 'BASE',
    color: BASE_COLOR,
    logo: <BaseLogo size={20} />,
    steps: [
      { kind: 'approve', label: 'approve(mUSDC, morphoVault, bal)', detail: 'Approve Morpho vault to manage mUSDC shares' },
      { kind: 'action', label: 'morphoVault.withdraw(bal, self, self)', detail: 'Unwind — withdraw full USDC position from Morpho' },
      { kind: 'assert', label: 'BALANCE(USDC, self) ≥ 4,800e6', detail: 'Verify withdrawal returned at least 4,800 USDC' },
      { kind: 'approve', label: 'approve(USDC, uniswapRouter, bal)', detail: 'Approve Uniswap router to spend USDC' },
      { kind: 'action', label: 'router.exactInputSingle(USDC → WETH, bal)', detail: 'Swap full USDC balance to WETH' },
      { kind: 'assert', label: 'BALANCE(WETH, self) ≥ 2e18', detail: 'Verify swap output — at least 2 WETH received' },
      { kind: 'approve', label: 'approve(WETH, baseBridge, bal)', detail: 'Approve bridge contract to spend WETH' },
      { kind: 'action', label: 'bridge.send(WETH, ethereum, bal)', detail: 'Bridge full WETH balance from Base to Ethereum' },
    ],
  },
  {
    chain: 'Ethereum',
    chainId: 'L1',
    color: ETH_COLOR,
    logo: <EthereumLogo size={20} />,
    predicateGate: 'BALANCE(WETH, self) ≥ 1.9e18',
    predicateDetail: 'Predicate gate — relayer simulates via eth_call, submits only when bridged WETH has arrived. Bridge-agnostic: any mechanism that produces the balance works.',
    steps: [
      { kind: 'approve', label: 'approve(WETH, aavePool, bal)', detail: 'Approve Aave pool to spend WETH' },
      { kind: 'action', label: 'aavePool.supply(WETH, bal, self, 0)', detail: 'Supply full WETH balance to Aave v3' },
      { kind: 'assert', label: 'BALANCE(aWETH, self) ≥ 1.9e18', detail: 'Verify Aave credited the aWETH deposit token' },
    ],
  },
];

function StepBadge({ kind, index }: { kind: StepKind; index: number }) {
  if (kind === 'assert') {
    return (
      <span
        style={{
          flexShrink: 0,
          width: 24,
          height: 24,
          borderRadius: '50%',
          background: 'rgba(22,163,74,0.06)',
          color: SUCCESS,
          fontSize: 11,
          fontFamily: MONO,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }
  return (
    <span
      style={{
        flexShrink: 0,
        width: 24,
        height: 24,
        borderRadius: '50%',
        background: kind === 'approve' ? 'rgba(0,0,0,0.03)' : 'rgba(37,99,235,0.06)',
        color: kind === 'approve' ? '#8a8a8a' : ACCENT,
        fontSize: 11,
        fontFamily: MONO,
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {index}
    </span>
  );
}

function StepRow({ step, index, isLast }: { step: Step; index: number; isLast: boolean }) {
  const isAssert = step.kind === 'assert';
  const isApprove = step.kind === 'approve';

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 2 }}>
        <StepBadge kind={step.kind} index={index} />
        {!isLast && (
          <div style={{ width: 1, height: 20, background: '#e5e5e5', marginTop: 4 }} />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0, paddingBottom: isLast ? 0 : 8 }}>
        <code
          style={{
            fontFamily: MONO,
            fontSize: 13,
            color: isAssert ? SUCCESS : isApprove ? '#8a8a8a' : '#1a1a1a',
            fontWeight: isAssert ? 500 : isApprove ? 400 : 500,
            wordBreak: 'break-all',
            lineHeight: 1.4,
          }}
        >
          {isAssert && <span style={{ color: SUCCESS }}>assert{'\u00A0\u00A0'}</span>}
          {step.label}
        </code>
        <div style={{ fontSize: 12, color: '#8a8a8a', marginTop: 2, lineHeight: 1.4 }}>
          {step.detail}
        </div>
      </div>
    </div>
  );
}

export default function CrossChain() {
  const [expandedChain, setExpandedChain] = useState<number>(0);

  let globalStep = 0;

  return (
    <section id="cross-chain" className="py-14 sm:py-20" style={{ borderTop: '1px solid #ebebeb' }}>
      <div className="max-w-[960px] mx-auto px-4 sm:px-6">
        <h2
          className="text-3xl sm:text-4xl font-bold mb-4"
          style={{ fontFamily: '"Source Serif 4", Georgia, serif', color: '#111' }}
        >
          Cross-chain orchestration
        </h2>

        <div className="mb-10">
          <p style={{ color: '#555', lineHeight: '1.7', marginBottom: '1.25em' }}>
            Rebalance a lending position from <strong style={{ color: '#2a2a2a' }}>Morpho on Base</strong> to{' '}
            <strong style={{ color: '#2a2a2a' }}>Aave on Ethereum</strong> — eight steps across two chains,
            signed once. The Ethereum batch is{' '}
            <strong style={{ color: '#2a2a2a' }}>predicate-gated</strong>: a relayer simulates
            via <code style={{ fontFamily: MONO, fontSize: '0.875em' }}>eth_call</code> and
            submits only when the bridged WETH has arrived.
          </p>
        </div>

        {/* Signed root */}
        <div className="text-center mb-6">
          <div
            className="inline-block px-4 py-2 rounded-lg text-xs"
            style={{
              fontFamily: MONO,
              background: 'rgba(37,99,235,0.04)',
              border: '1px solid rgba(37,99,235,0.1)',
              color: '#2563eb',
            }}
          >
            User signs ONE Merkle root → covers both chains
          </div>
        </div>

        {/* Chain batches */}
        <div className="space-y-3 mb-8">
          {BATCHES.map((batch, batchIdx) => {
            const isExpanded = expandedChain === batchIdx;
            const batchStartStep = globalStep;

            const stepElements = batch.steps.map((step, sIdx) => {
              if (step.kind !== 'assert') globalStep++;
              const stepNum = step.kind === 'assert' ? 0 : globalStep;
              return (
                <StepRow
                  key={sIdx}
                  step={step}
                  index={stepNum}
                  isLast={sIdx === batch.steps.length - 1}
                />
              );
            });

            if (!isExpanded) {
              globalStep = batchStartStep;
              batch.steps.forEach((s) => { if (s.kind !== 'assert') globalStep++; });
            }

            return (
              <div key={batch.chainId}>
                <button
                  onClick={() => setExpandedChain(isExpanded ? -1 : batchIdx)}
                  className="w-full text-left rounded-[10px] p-4 transition-all duration-200"
                  style={{
                    background: isExpanded ? '#fff' : '#fafaf9',
                    border: `1px solid ${isExpanded ? batch.color + '30' : '#ebebeb'}`,
                    boxShadow: isExpanded ? `0 2px 12px ${batch.color}10` : 'none',
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center"
                      style={{
                        background: `${batch.color}10`,
                        border: `1px solid ${batch.color}20`,
                      }}
                    >
                      {batch.logo}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold" style={{ color: '#1a1a1a' }}>
                        {batch.chain}
                      </div>
                      <div className="text-xs" style={{ fontFamily: MONO, color: '#8a8a8a' }}>
                        {batch.steps.filter(s => s.kind !== 'assert').length} calls · {batch.steps.filter(s => s.kind === 'assert').length} assertions
                      </div>
                    </div>
                    <svg
                      className="w-4 h-4 transition-transform"
                      style={{ color: '#a3a3a3', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 pt-4" style={{ borderTop: '1px solid #ebebeb' }}>
                      {batch.predicateGate && (
                        <div
                          style={{
                            marginBottom: 16,
                            padding: '10px 14px',
                            borderRadius: 8,
                            background: 'rgba(22,163,74,0.03)',
                            border: '1.5px dashed rgba(22,163,74,0.25)',
                          }}
                        >
                          <code style={{ fontFamily: MONO, fontSize: 13, display: 'block' }}>
                            <span style={{ color: SUCCESS, fontWeight: 500 }}>predicate gate</span>
                            <span style={{ color: '#717171' }}>{'\u00A0\u00A0'}</span>
                            <span style={{ color: '#1a1a1a' }}>{batch.predicateGate}</span>
                          </code>
                          <div style={{ fontSize: 12, color: '#8a8a8a', marginTop: 6, lineHeight: 1.5 }}>
                            {batch.predicateDetail}
                          </div>
                        </div>
                      )}
                      {stepElements}
                    </div>
                  )}
                </button>

                {batchIdx < BATCHES.length - 1 && (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '6px 0' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div
                        style={{
                          width: 1.5,
                          height: 20,
                          background: 'linear-gradient(to bottom, #d4d4d4, rgba(37,99,235,0.3))',
                          borderRadius: 1,
                        }}
                      />
                      <svg width="8" height="6" viewBox="0 0 8 6" style={{ marginTop: -0.5 }}>
                        <path d="M4 6L0 0h8z" fill="rgba(37,99,235,0.3)" />
                      </svg>
                      <div
                        style={{
                          fontSize: 10,
                          fontFamily: MONO,
                          color: '#a3a3a3',
                          marginTop: 4,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                        }}
                      >
                        bridge
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div
          className="rounded-lg p-4 text-xs"
          style={{ background: '#f8f9fa', border: '1px solid #ebebeb', color: '#717171', lineHeight: '1.6' }}
        >
          <strong style={{ color: '#555' }}>Key property:</strong> Constraints observe <em>state</em>, not mechanism.
          The bridge could be any provider — native bridge, Across, ERC-7683, LayerZero —
          the Ethereum batch just waits for the WETH balance to appear. The predicate model is{' '}
          <strong style={{ color: '#555' }}>credibly neutral</strong> with respect to the interoperability layer.
        </div>
      </div>
    </section>
  );
}
