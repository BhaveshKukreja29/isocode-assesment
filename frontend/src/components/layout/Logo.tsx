export function Logo() {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontWeight: 700, letterSpacing: '-0.02em' }}>
      <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="8" fill="var(--accent)" />
        <path d="M9 22 16 9l7 13" fill="none" stroke="#121212" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>
        Company A
        <span className="logo-sub"> · Brand X</span>
      </span>
    </span>
  )
}
