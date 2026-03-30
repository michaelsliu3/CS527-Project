import { Button, useDisclosure } from '@chakra-ui/react'
import { useAuth } from '../context/AuthContext'
import { dark } from '../theme/colors'
import { WalletModal } from './WalletModal'

const linkHover = '#ffffff'

const canUseEndUserFeatures = (role: string) =>
  role === 'end_user' || role === 'vip' || role === 'customer_rep' || role === 'admin'

function formatNavMoney(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function NavWallet() {
  const { user, refreshProfile } = useAuth()
  const dialog = useDisclosure()

  if (!user || !canUseEndUserFeatures(user.role)) {
    return null
  }

  const spendable = user.walletAvailableBalance ?? 0

  return (
    <>
      <Button
        aria-label={`Balance $${formatNavMoney(spendable)}, deposit or withdraw`}
        variant="outline"
        size="sm"
        borderColor={dark.borderSubtle}
        color="brand.400"
        fontWeight="bold"
        _hover={{ bg: 'whiteAlpha.100', color: linkHover }}
        onClick={dialog.onOpen}
        flexShrink={0}
      >
        ${formatNavMoney(spendable)}
      </Button>
      <WalletModal
        open={dialog.open}
        onClose={dialog.onClose}
        refreshProfile={refreshProfile}
        walletBalance={user.walletBalance ?? 0}
        walletAvailable={spendable}
      />
    </>
  )
}
