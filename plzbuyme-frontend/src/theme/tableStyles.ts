import type { CSSProperties } from 'react'

export const tableBg = '#1a1a1a'
export const rowBorder = 'rgba(255, 255, 255, 0.08)'
export const tableTextColor = '#e0e0e0'

export const tableStyles: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  background: tableBg,
  color: tableTextColor,
}

export const thBase: CSSProperties = {
  padding: '12px 16px',
  fontWeight: 600,
  fontSize: '0.875rem',
  color: tableTextColor,
  background: tableBg,
  borderBottom: `1px solid ${rowBorder}`,
}

export const tdBase: CSSProperties = {
  padding: '12px 16px',
  borderBottom: `1px solid ${rowBorder}`,
  color: tableTextColor,
  background: tableBg,
  fontSize: '0.875rem',
}

export function tdStyle(isLast: boolean): CSSProperties {
  return isLast ? { ...tdBase, borderBottom: 'none' } : tdBase
}
