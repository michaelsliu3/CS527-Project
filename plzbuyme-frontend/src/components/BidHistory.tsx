import { Badge, Box, Text } from '@chakra-ui/react'
import type { BidHistoryItem } from '../api/auctions'
import { dark } from '../theme/colors'
import { tableStyles, thBase, tdBase } from '../theme/tableStyles'
import { UserParticipationHoverCard } from './UserParticipationHoverCard'

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
            const cellStyle = isLast ? { ...tdBase, borderBottom: 'none' } : tdBase
            const rowKey = bid.id != null ? bid.id : i
            return (
              <tr key={rowKey}>
                <td style={{ ...cellStyle, textAlign: 'left' }}>
                  <Box display="inline-flex" alignItems="center" gap={2}>
                    <UserParticipationHoverCard
                      userId={bid.bidderId}
                      username={bid.bidderUsername}
                      revealUsername={bid.bidderRevealUsername}
                      avatarUrl={bid.bidderAvatarUrl}
                      displayNameColor={bid.bidderDisplayNameColor}
                      fallbackColor="white"
                      avatarSize="20px"
                    />
                  </Box>
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
