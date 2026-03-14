import { Badge, Box, Text } from '@chakra-ui/react'
import type { CSSProperties } from 'react'
import type { BidHistoryItem } from '../api/auctions'
import { dark } from '../theme/colors'

const tableBg = '#1a1a1a'
const rowBorder = 'rgba(255, 255, 255, 0.08)'
const textColor = '#e0e0e0'

const tableStyles: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  background: tableBg,
  color: textColor,
}

const thBase: CSSProperties = {
  padding: '12px 16px',
  fontWeight: 600,
  fontSize: '0.875rem',
  color: textColor,
  background: tableBg,
  borderBottom: `1px solid ${rowBorder}`,
}

const tdStyles: CSSProperties = {
  padding: '12px 16px',
  borderBottom: `1px solid ${rowBorder}`,
  color: textColor,
  background: tableBg,
  fontSize: '0.875rem',
}

export interface BidHistoryProps {
  bids: BidHistoryItem[]
}

export function BidHistory({ bids }: BidHistoryProps) {
  if (bids.length === 0) {
    return (
      <Text color={dark.muted} fontSize="sm" py={2}>
        No bids yet.
      </Text>
    )
  }

  return (
    <Box overflowX="auto">
      <table style={tableStyles}>
        <thead>
          <tr>
            <th style={{ ...thBase, textAlign: 'left' }}>Bidder</th>
            <th style={{ ...thBase, textAlign: 'right' }}>Amount</th>
            <th style={{ ...thBase, textAlign: 'left' }}>Time</th>
          </tr>
        </thead>
        <tbody>
          {bids.map((bid, i) => {
            const isLast = i === bids.length - 1
            const cellStyle = isLast ? { ...tdStyles, borderBottom: 'none' } : tdStyles
            return (
              <tr key={i}>
                <td style={{ ...cellStyle, textAlign: 'left' }}>
                  <Box as="span">{bid.bidderUsername}</Box>
                  {bid.isAuto && (
                    <Badge ml={2} size="sm" colorPalette="blue" variant="subtle">
                      auto
                    </Badge>
                  )}
                </td>
                <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 500 }}>
                  ${bid.amount.toLocaleString()}
                </td>
                <td style={{ ...cellStyle, textAlign: 'left', color: dark.muted }}>
                  {new Date(bid.createdAt).toLocaleString()}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </Box>
  )
}
