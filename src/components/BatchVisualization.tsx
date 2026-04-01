import { useState, Fragment } from 'react';

const MONO = '"JetBrains Mono", monospace';
const ACCENT = '#2563eb';
const SUCCESS = '#16a34a';
const CODE_SIZE = 15;

/* ── Data types ───────────────────────────────────────────────── */

type StaticParam = { type: 'token' | 'value' | 'dim'; value: string };
type RuntimeParam = {
  type: 'runtime';
  resolved: string;
  fetcherType: string;
  balanceToken: string;
  returnsRaw: string;
  returnsHuman: string;
  constraint: string;
};
type Param = StaticParam | RuntimeParam;

type CallStep = {
  contract: string;
  fn: string;
  params: Param[];
};

type PredicateStep = {
  predicate: true;
  fetcherType: string;
  balanceToken?: string;
  assertLabel?: string;
  resolveCall?: string;
  constraintOp: string;
  constraintRef: string;
  constraintRefHuman: string;
  resolvedRaw: string;
  resolvedHuman: string;
};

type Step = CallStep | PredicateStep;

function isPredicate(step: Step): step is PredicateStep {
  return 'predicate' in step;
}

type Example = {
  id: string;
  tab: string;
  subtitle: string;
  contextNote?: string;
  steps: Step[];
};

/* ── Examples ─────────────────────────────────────────────────── */

const EXAMPLES: Example[] = [
  {
    id: 'swap-supply',
    tab: 'Swap \u2192 Supply',
    subtitle:
      'Swap USDC \u2192 USDT on Uniswap, then supply to Aave. The swap output is variable \u2014 smart batching resolves the exact amount at execution time.',
    steps: [
      {
        contract: 'SwapRouter',
        fn: 'exactInputSingle',
        params: [
          { type: 'token', value: 'USDC' },
          { type: 'token', value: 'USDT' },
          { type: 'value', value: '500' },
          { type: 'value', value: '1000e6' },
          { type: 'dim', value: '0' },
        ],
      },
      {
        contract: 'AavePool',
        fn: 'supply',
        params: [
          { type: 'token', value: 'USDT' },
          {
            type: 'runtime',
            resolved: '997_420_000',
            fetcherType: 'BALANCE',
            balanceToken: 'USDT',
            returnsRaw: '997_420_000',
            returnsHuman: '997.42 USDT',
            constraint: 'GTE(1)',
          },
          { type: 'dim', value: 'self' },
          { type: 'dim', value: '0' },
        ],
      },
    ],
  },
  {
    id: 'withdraw-swap-supply',
    tab: 'Withdraw \u2192 Swap \u2192 Supply',
    subtitle:
      'Withdraw from Aave where interest accrues block\u2011by\u2011block \u2014 the exact redemption is unknown until execution. Swap the proceeds and supply to Compound.',
    steps: [
      {
        contract: 'AavePool',
        fn: 'withdraw',
        params: [
          { type: 'token', value: 'USDC' },
          { type: 'value', value: 'type(uint256).max' },
          { type: 'dim', value: 'self' },
        ],
      },
      {
        contract: 'SwapRouter',
        fn: 'exactInputSingle',
        params: [
          { type: 'token', value: 'USDC' },
          { type: 'token', value: 'USDT' },
          { type: 'value', value: '100' },
          {
            type: 'runtime',
            resolved: '5_032_871_403',
            fetcherType: 'BALANCE',
            balanceToken: 'USDC',
            returnsRaw: '5_032_871_403',
            returnsHuman: '5,032.87 USDC',
            constraint: 'GTE(1)',
          },
          { type: 'dim', value: '0' },
        ],
      },
      {
        contract: 'CometUSDT',
        fn: 'supply',
        params: [
          { type: 'token', value: 'USDT' },
          {
            type: 'runtime',
            resolved: '5_028_834_219',
            fetcherType: 'BALANCE',
            balanceToken: 'USDT',
            returnsRaw: '5_028_834_219',
            returnsHuman: '5,028.83 USDT',
            constraint: 'GTE(1)',
          },
        ],
      },
    ],
  },
  {
    id: 'dustless-4337',
    tab: 'ERC\u20114337 dustless send',
    subtitle:
      'Send your entire USDC balance when gas is also paid in USDC via a paymaster. The gas fee is deducted before your batch executes \u2014 smart batching reads whatever remains, leaving zero dust.',
    contextNote:
      'ERC\u20114337 validation phase: paymaster deducts ~1.83 USDC for gas from account',
    steps: [
      {
        contract: 'USDC',
        fn: 'transfer',
        params: [
          { type: 'dim', value: '0xb0b\u202642' },
          {
            type: 'runtime',
            resolved: '498_170_000',
            fetcherType: 'BALANCE',
            balanceToken: 'USDC',
            returnsRaw: '498_170_000',
            returnsHuman: '498.17 USDC',
            constraint: 'GTE(1)',
          },
        ],
      },
    ],
  },
  {
    id: 'slippage-protection',
    tab: 'Slippage protection',
    subtitle:
      'Swap WETH \u2192 USDC, then assert a minimum output via a predicate entry \u2014 a batch step with no call target that purely checks on\u2011chain state. If slippage pushes the balance below the threshold, the entire batch reverts.',
    steps: [
      {
        contract: 'SwapRouter',
        fn: 'exactInputSingle',
        params: [
          { type: 'token', value: 'WETH' },
          { type: 'token', value: 'USDC' },
          { type: 'value', value: '3000' },
          { type: 'value', value: '1e18' },
          { type: 'dim', value: '0' },
        ],
      },
      {
        predicate: true,
        fetcherType: 'BALANCE',
        balanceToken: 'USDC',
        constraintOp: 'GTE',
        constraintRef: '2500e6',
        constraintRefHuman: '2,500.00 USDC',
        resolvedRaw: '2_847_310_000',
        resolvedHuman: '2,847.31 USDC',
      },
    ],
  },
  {
    id: 'leverage-loop',
    tab: 'Leverage loop',
    subtitle:
      'Build a leveraged lending position in a single signed batch \u2014 no custom looper contract. Supply collateral, borrow against it, swap back, and re\u2011supply. Today this requires deploying and auditing a bespoke contract per strategy.',
    steps: [
      {
        contract: 'AavePool',
        fn: 'supply',
        params: [
          { type: 'token', value: 'USDC' },
          { type: 'value', value: '10_000e6' },
          { type: 'dim', value: 'self' },
          { type: 'dim', value: '0' },
        ],
      },
      {
        contract: 'AavePool',
        fn: 'borrow',
        params: [
          { type: 'token', value: 'USDT' },
          { type: 'value', value: '8_000e6' },
          { type: 'dim', value: '2' },
          { type: 'dim', value: '0' },
          { type: 'dim', value: 'self' },
        ],
      },
      {
        contract: 'SwapRouter',
        fn: 'exactInputSingle',
        params: [
          { type: 'token', value: 'USDT' },
          { type: 'token', value: 'USDC' },
          { type: 'value', value: '100' },
          {
            type: 'runtime',
            resolved: '8_000_000_000',
            fetcherType: 'BALANCE',
            balanceToken: 'USDT',
            returnsRaw: '8_000_000_000',
            returnsHuman: '8,000.00 USDT',
            constraint: 'GTE(1)',
          },
          { type: 'dim', value: '0' },
        ],
      },
      {
        contract: 'AavePool',
        fn: 'supply',
        params: [
          { type: 'token', value: 'USDC' },
          {
            type: 'runtime',
            resolved: '7_996_410_000',
            fetcherType: 'BALANCE',
            balanceToken: 'USDC',
            returnsRaw: '7_996_410_000',
            returnsHuman: '7,996.41 USDC',
            constraint: 'GTE(1)',
          },
          { type: 'dim', value: 'self' },
          { type: 'dim', value: '0' },
        ],
      },
      {
        predicate: true,
        fetcherType: 'STATIC_CALL',
        assertLabel: 'healthFactor(self)',
        resolveCall: 'AavePool.getUserAccountData(self)',
        constraintOp: 'GTE',
        constraintRef: '1.15e18',
        constraintRefHuman: '1.15',
        resolvedRaw: '1_247_893_112_840_091_200',
        resolvedHuman: '1.248',
      },
    ],
  },
];

/* ── Inline style helpers ─────────────────────────────────────── */

function ContractName({ children }: { children: React.ReactNode }) {
  return <span style={{ color: '#8a8a8a' }}>{children}</span>;
}

function FnName({ children }: { children: React.ReactNode }) {
  return <span style={{ color: '#1a1a1a', fontWeight: 500 }}>{children}</span>;
}

function Punc({ children }: { children: React.ReactNode }) {
  return <span style={{ color: '#717171' }}>{children}</span>;
}

const badgeStyle: React.CSSProperties = {
  flexShrink: 0,
  width: 28,
  height: 28,
  borderRadius: '50%',
  background: 'rgba(37,99,235,0.06)',
  color: ACCENT,
  fontSize: 13,
  fontFamily: MONO,
  fontWeight: 600,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const predicateBadgeStyle: React.CSSProperties = {
  ...badgeStyle,
  background: 'rgba(22,163,74,0.06)',
  color: SUCCESS,
};

/* ── Param rendering ──────────────────────────────────────────── */

function StaticParamSpan({ param }: { param: StaticParam }) {
  const color = param.type === 'dim' ? '#a3a3a3' : '#1a1a1a';
  return <span style={{ color }}>{param.value}</span>;
}

function RuntimeParamSpan({
  param,
  paramKey,
  hoveredParam,
  setHoveredParam,
}: {
  param: RuntimeParam;
  paramKey: string;
  hoveredParam: string | null;
  setHoveredParam: (k: string | null) => void;
}) {
  const active = hoveredParam === paramKey;

  return (
    <span
      onMouseEnter={() => setHoveredParam(paramKey)}
      onMouseLeave={() => setHoveredParam(null)}
      onClick={() => setHoveredParam(active ? null : paramKey)}
      style={{ cursor: 'pointer', position: 'relative' }}
    >
      <span
        style={{
          fontFamily: MONO,
          fontSize: CODE_SIZE,
          background: active ? 'rgba(37,99,235,0.10)' : 'rgba(37,99,235,0.05)',
          border: `1.5px dashed ${active ? ACCENT : 'rgba(37,99,235,0.25)'}`,
          borderRadius: 5,
          padding: '4px 12px',
          color: ACCENT,
          transition: 'all 0.2s ease',
          boxShadow: active ? '0 0 0 4px rgba(37,99,235,0.06)' : 'none',
          whiteSpace: 'nowrap',
        }}
      >
        {active ? param.resolved : 'runtime injected'}
      </span>

      <ResolverTooltip active={active}>
        <TipRow label="Fetcher type">
          <FetcherBadge>{param.fetcherType}</FetcherBadge>
        </TipRow>
        <TipRow label="Resolves via">
          <code style={{ fontFamily: MONO, fontSize: 12, color: '#1a1a1a' }}>
            IERC20({param.balanceToken}).balanceOf(
            <span style={{ color: '#8a8a8a' }}>self</span>)
          </code>
        </TipRow>
        <TipRow label="Returns">
          <code style={{ fontFamily: MONO, fontSize: 12, color: SUCCESS, fontWeight: 500 }}>
            {param.returnsRaw}
          </code>
          <span style={{ fontSize: 11, color: '#8a8a8a', marginLeft: 6 }}>
            ({param.returnsHuman})
          </span>
        </TipRow>
        <TipRow label="Constraint" last>
          <code style={{ fontFamily: MONO, fontSize: 12 }}>
            <span style={{ color: '#1a1a1a' }}>{param.constraint}</span>
            <span style={{ color: SUCCESS, marginLeft: 4 }}>✓ pass</span>
          </code>
        </TipRow>
      </ResolverTooltip>
    </span>
  );
}

/* ── Shared tooltip shell ─────────────────────────────────────── */

function ResolverTooltip({
  active,
  header,
  children,
}: {
  active: boolean;
  header?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 'calc(100% + 14px)',
        left: '50%',
        transform: 'translateX(-50%)',
        opacity: active ? 1 : 0,
        pointerEvents: active ? 'auto' : 'none',
        transition: 'opacity 0.2s ease',
        zIndex: 10,
      }}
    >
      <div
        style={{
          background: '#fff',
          border: '1px solid #ebebeb',
          borderRadius: 10,
          padding: '18px 22px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)',
          width: 340,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontFamily: MONO,
            color: '#8a8a8a',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#8a8a8a"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {header || 'Resolved at execution time'}
        </div>

        <div style={{ borderLeft: '2px solid #ebebeb', paddingLeft: 14, marginLeft: 2 }}>
          {children}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', marginTop: -1 }}>
        <svg width="16" height="8" viewBox="0 0 16 8">
          <path d="M0 0h16L8 8z" fill="#fff" />
          <path d="M0 0h16L8 8z" fill="none" stroke="#ebebeb" strokeWidth="1" />
          <path d="M1 0h14L8 7z" fill="#fff" />
        </svg>
      </div>
    </div>
  );
}

function FetcherBadge({ children }: { children: React.ReactNode }) {
  return (
    <code
      style={{
        fontFamily: MONO,
        fontSize: 12,
        color: ACCENT,
        background: 'rgba(37,99,235,0.06)',
        padding: '2px 6px',
        borderRadius: 3,
      }}
    >
      {children}
    </code>
  );
}

/* ── Step rows ────────────────────────────────────────────────── */

function CallStepRow({
  step,
  stepIdx,
  hoveredParam,
  setHoveredParam,
}: {
  step: CallStep;
  stepIdx: number;
  hoveredParam: string | null;
  setHoveredParam: (k: string | null) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <span style={badgeStyle}>{stepIdx + 1}</span>
      <code style={{ fontFamily: MONO, fontSize: CODE_SIZE, whiteSpace: 'nowrap' }}>
        <ContractName>{step.contract}</ContractName>
        <Punc>.</Punc>
        <FnName>{step.fn}</FnName>
        <Punc>(</Punc>
        {step.params.map((param, pIdx) => (
          <Fragment key={pIdx}>
            {pIdx > 0 && <Punc>, </Punc>}
            {param.type === 'runtime' ? (
              <RuntimeParamSpan
                param={param}
                paramKey={`${stepIdx}-${pIdx}`}
                hoveredParam={hoveredParam}
                setHoveredParam={setHoveredParam}
              />
            ) : (
              <StaticParamSpan param={param} />
            )}
          </Fragment>
        ))}
        <Punc>)</Punc>
      </code>
    </div>
  );
}

const OP_SYMBOLS: Record<string, string> = { GTE: '\u2265', LTE: '\u2264', EQ: '=' };

function PredicateStepRow({
  step,
  stepIdx,
  hoveredParam,
  setHoveredParam,
}: {
  step: PredicateStep;
  stepIdx: number;
  hoveredParam: string | null;
  setHoveredParam: (k: string | null) => void;
}) {
  const paramKey = `pred-${stepIdx}`;
  const active = hoveredParam === paramKey;
  const opSymbol = OP_SYMBOLS[step.constraintOp] || step.constraintOp;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <span style={predicateBadgeStyle}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span
        onMouseEnter={() => setHoveredParam(paramKey)}
        onMouseLeave={() => setHoveredParam(null)}
        onClick={() => setHoveredParam(active ? null : paramKey)}
        style={{ cursor: 'pointer', position: 'relative' }}
      >
        <code
          style={{
            fontFamily: MONO,
            fontSize: CODE_SIZE,
            whiteSpace: 'nowrap',
            padding: '6px 14px',
            borderRadius: 6,
            background: active ? 'rgba(22,163,74,0.08)' : 'rgba(22,163,74,0.03)',
            border: `1.5px dashed ${active ? SUCCESS : 'rgba(22,163,74,0.25)'}`,
            transition: 'all 0.2s ease',
            boxShadow: active ? '0 0 0 4px rgba(22,163,74,0.06)' : 'none',
          }}
        >
          <span style={{ color: SUCCESS, fontWeight: 500 }}>assert</span>
          <span style={{ color: '#717171' }}>{'\u00A0\u00A0'}</span>
          <span style={{ color: '#1a1a1a' }}>
            {step.assertLabel || (
              <>BALANCE({step.balanceToken}, <span style={{ color: '#a3a3a3' }}>self</span>)</>
            )}
          </span>
          <span style={{ color: '#717171' }}> {opSymbol} </span>
          <span style={{ color: '#1a1a1a' }}>{step.constraintRef}</span>
        </code>

        <ResolverTooltip active={active} header="Predicate entry \u2014 no call executed">
          <TipRow label="Fetcher type">
            <FetcherBadge>{step.fetcherType}</FetcherBadge>
          </TipRow>
          <TipRow label="Resolves via">
            <code style={{ fontFamily: MONO, fontSize: 12, color: '#1a1a1a' }}>
              {step.resolveCall || (
                <>IERC20({step.balanceToken}).balanceOf(
                <span style={{ color: '#8a8a8a' }}>self</span>)</>
              )}
            </code>
          </TipRow>
          <TipRow label="Returns">
            <code style={{ fontFamily: MONO, fontSize: 12, color: SUCCESS, fontWeight: 500 }}>
              {step.resolvedRaw}
            </code>
            <span style={{ fontSize: 11, color: '#8a8a8a', marginLeft: 6 }}>
              ({step.resolvedHuman})
            </span>
          </TipRow>
          <TipRow label="Constraint" last>
            <code style={{ fontFamily: MONO, fontSize: 12 }}>
              <span style={{ color: '#1a1a1a' }}>
                {step.constraintOp}({step.constraintRef})
              </span>
            </code>
            <div style={{ fontSize: 11, color: '#8a8a8a', marginTop: 4 }}>
              {step.resolvedHuman.split(' ')[0]} {opSymbol} {step.constraintRefHuman.split(' ')[0]}
              <span style={{ color: SUCCESS, marginLeft: 6, fontWeight: 500 }}>✓ pass</span>
            </div>
          </TipRow>
        </ResolverTooltip>
      </span>
    </div>
  );
}

/* ── Connector arrow ──────────────────────────────────────────── */

function Connector() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '8px 0',
      }}
    >
      <div
        style={{
          width: 1.5,
          height: 32,
          background: 'linear-gradient(to bottom, #d4d4d4, rgba(37,99,235,0.3))',
          borderRadius: 1,
        }}
      />
      <svg width="8" height="6" viewBox="0 0 8 6" style={{ marginTop: -0.5 }}>
        <path d="M4 6L0 0h8z" fill="rgba(37,99,235,0.3)" />
      </svg>
    </div>
  );
}

/* ── Tooltip row ──────────────────────────────────────────────── */

function TipRow({
  label,
  children,
  last,
}: {
  label: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div style={{ marginBottom: last ? 0 : 10 }}>
      <div style={{ fontSize: 11, color: '#a3a3a3', marginBottom: 2 }}>{label}</div>
      {children}
    </div>
  );
}

/* ── Main component ───────────────────────────────────────────── */

export default function BatchVisualization() {
  const [activeTab, setActiveTab] = useState(0);
  const [hoveredParam, setHoveredParam] = useState<string | null>(null);

  const example = EXAMPLES[activeTab];

  return (
    <section id="solution" className="py-20 border-t border-ink-100">
      <div className="mx-auto px-6" style={{ maxWidth: 1060 }}>
        <h2
          className="text-3xl sm:text-4xl font-bold mb-4"
          style={{ fontFamily: '"Source Serif 4", Georgia, serif', color: '#111' }}
        >
          Runtime parameter injection
        </h2>

        {/* Tabs */}
        <div
          style={{
            display: 'flex',
            gap: 0,
            marginBottom: 20,
            overflowX: 'auto',
          }}
        >
          {EXAMPLES.map((ex, i) => {
            const isActive = activeTab === i;
            return (
              <button
                key={ex.id}
                onClick={() => {
                  setActiveTab(i);
                  setHoveredParam(null);
                }}
                style={{
                  padding: '10px 20px',
                  fontSize: 13,
                  fontFamily: MONO,
                  background: 'none',
                  border: 'none',
                  borderBottom: `2px solid ${isActive ? ACCENT : 'transparent'}`,
                  color: isActive ? ACCENT : '#8a8a8a',
                  cursor: 'pointer',
                  transition: 'color 0.15s ease, border-color 0.15s ease',
                  whiteSpace: 'nowrap',
                }}
              >
                {ex.tab}
              </button>
            );
          })}
        </div>

        {/* Per-example subtitle */}
        <p style={{ color: '#555', lineHeight: 1.7, marginBottom: '1.5rem', maxWidth: 580 }}>
          {example.subtitle}
        </p>

        {/* Card */}
        <div
          style={{
            background: '#fff',
            border: '1px solid #ebebeb',
            borderRadius: 10,
            padding: '2.5rem 2rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            overflow: 'visible',
          }}
        >
          {example.contextNote && (
            <>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 16px',
                  borderRadius: 8,
                  background: 'rgba(0,0,0,0.02)',
                  border: '1px solid #ebebeb',
                  fontSize: 12,
                  fontFamily: MONO,
                  color: '#8a8a8a',
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#a3a3a3"
                  strokeWidth="2"
                >
                  <path
                    d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path d="M12 6v6l4 2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {example.contextNote}
              </div>
              <Connector />
            </>
          )}

          {example.steps.map((step, stepIdx) => (
            <Fragment key={`${example.id}-${stepIdx}`}>
              {stepIdx > 0 && <Connector />}
              {isPredicate(step) ? (
                <PredicateStepRow
                  step={step}
                  stepIdx={stepIdx}
                  hoveredParam={hoveredParam}
                  setHoveredParam={setHoveredParam}
                />
              ) : (
                <CallStepRow
                  step={step}
                  stepIdx={stepIdx}
                  hoveredParam={hoveredParam}
                  setHoveredParam={setHoveredParam}
                />
              )}
            </Fragment>
          ))}

          {/* Hint */}
          <div
            style={{
              fontSize: 12,
              color: '#a3a3a3',
              marginTop: 16,
              fontStyle: 'italic',
              opacity: hoveredParam ? 0 : 1,
              transition: 'opacity 0.15s ease',
            }}
          >
            Hover an interactive parameter to see how it resolves
          </div>
        </div>
      </div>
    </section>
  );
}
