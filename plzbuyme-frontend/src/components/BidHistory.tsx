import { Badge, Table } from '@chakra-ui/react'
import type { BidHistoryItem } from '../api/auctions'
import { dark } from '../theme/colors'

export interface BidHistoryProps {
  bids: BidHistoryItem[]
}

export function BidHistory({ bids }: BidHistoryProps) {
  if (bids.length === 0) {
    return null
  }

  return (
    <Table.Root size="sm">
      <Table.Header>
        <Table.Row borderColor={dark.borderSubtle}>
          <Table.ColumnHeader color={dark.muted}>Bidder</Table.ColumnHeader>
          <Table.ColumnHeader color={dark.muted}>Amount</Table.ColumnHeader>
          <Table.ColumnHeader color={dark.muted}>Time</Table.ColumnHeader>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {bids.map((bid, i) => (
          <Table.Row key={i} borderColor={dark.borderSubtle}>
            <Table.Cell color="white">
              {bid.bidderUsername}
              {bid.isAuto && (
                <Badge ml={2} size="sm" colorPalette="blue" variant="subtle">
                  auto
                </Badge>
              )}
            </Table.Cell>
            <Table.Cell color="white">${bid.amount.toLocaleString()}</Table.Cell>
            <Table.Cell color={dark.muted}>
              {new Date(bid.createdAt).toLocaleString()}
            </Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table.Root>
  )
}
