import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  Box,
  Button,
  CloseButton,
  Dialog,
  Field,
  Flex,
  Heading,
  Input,
  Tabs,
  Text,
} from '@chakra-ui/react'
import { HiOutlineCreditCard, HiOutlineCurrencyDollar, HiOutlineGlobe } from 'react-icons/hi'
import { getApiErrorMessage } from '../api/apiErrorMessage'
import { depositWallet, withdrawWallet } from '../api/wallet'
import { showErrorToast, showSuccessToast } from './ui/toaster'
import { dark } from '../theme/colors'

const DEPOSIT_PRESETS = [25, 50, 100, 250, 500] as const
const MAX_DEPOSIT = 1_000_000

function formatMoney(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

type PayMethodId = 'card' | 'crypto' | 'bank'

const PAY_OPTIONS: { id: PayMethodId; title: string; subtitle: string; icon: ReactNode }[] = [
  {
    id: 'card',
    title: 'Credit / debit card',
    subtitle: 'Visa, Mastercard, AmEx',
    icon: <HiOutlineCreditCard size={28} />,
  },
  {
    id: 'crypto',
    title: 'Crypto',
    subtitle: 'USDC, USDP',
    icon: <HiOutlineCurrencyDollar size={28} />,
  },
  {
    id: 'bank',
    title: 'Bank transfer',
    subtitle: 'ACH and regional options',
    icon: <HiOutlineGlobe size={28} />,
  },
]

function parseAmount(raw: string): number | null {
  const t = raw.replace(/,/g, '').trim()
  if (!t) return null
  const n = Number.parseFloat(t)
  if (!Number.isFinite(n) || n <= 0) return null
  return n
}

function VerticalStepper({ step, labels }: { step: number; labels: string[] }) {
  return (
    <Flex flexDirection="column" gap={0} minW="140px" flexShrink={0}>
      {labels.map((label, i) => {
        const n = i + 1
        const active = step === n
        const done = step > n
        const isLast = n === labels.length
        return (
          <Flex key={n} gap={3} align="flex-start">
            <Flex flexDirection="column" alignItems="center" w="40px" flexShrink={0}>
              <Box
                w="40px"
                h="40px"
                borderRadius="full"
                display="flex"
                alignItems="center"
                justifyContent="center"
                fontWeight="bold"
                fontSize="sm"
                bg={done ? 'brand.500' : active ? 'brand.500' : 'whiteAlpha.100'}
                color="white"
                borderWidth="2px"
                borderColor={active || done ? 'brand.400' : 'whiteAlpha.200'}
              >
                {done ? '✓' : n}
              </Box>
              {!isLast && <Box w="2px" flex={1} minH="28px" bg="whiteAlpha.200" my={1} borderRadius="1px" />}
            </Flex>
            <Box pt={2} pb={isLast ? 0 : 2}>
              <Text
                fontSize="sm"
                fontWeight={active ? 'semibold' : 'normal'}
                color={active ? 'white' : dark.placeholder}
                lineHeight="short"
              >
                {label}
              </Text>
            </Box>
          </Flex>
        )
      })}
    </Flex>
  )
}

export interface WalletModalProps {
  open: boolean
  onClose: () => void
  refreshProfile: () => Promise<unknown>
  walletBalance: number
  walletAvailable: number
}

export function WalletModal({ open, onClose, refreshProfile, walletBalance, walletAvailable }: WalletModalProps) {
  const [tab, setTab] = useState<'deposit' | 'withdraw'>('deposit')
  const [depositStep, setDepositStep] = useState(1)
  const [depositAmountStr, setDepositAmountStr] = useState('0.00')
  const [payMethod, setPayMethod] = useState<PayMethodId | null>(null)
  const [withdrawStr, setWithdrawStr] = useState('')
  const [busy, setBusy] = useState(false)

  const depositAmount = useMemo(() => parseAmount(depositAmountStr), [depositAmountStr])

  useEffect(() => {
    if (!open) {
      setTab('deposit')
      setDepositStep(1)
      setDepositAmountStr('0.00')
      setPayMethod(null)
      setWithdrawStr('')
      setBusy(false)
    }
  }, [open])

  const handleDepositNext = () => {
    if (depositStep === 1) {
      const a = depositAmount
      if (a == null || a > MAX_DEPOSIT) {
        showErrorToast('Invalid amount', `Enter an amount between 0.01 and ${MAX_DEPOSIT.toLocaleString()}.`)
        return
      }
      setDepositStep(2)
      return
    }
    if (depositStep === 2) {
      if (!payMethod) {
        showErrorToast('Choose a method', 'Select a payment method to continue.')
        return
      }
      setDepositStep(3)
    }
  }

  const handleDepositBack = () => {
    if (depositStep > 1) setDepositStep((s) => s - 1)
  }

  const confirmDeposit = async () => {
    const a = depositAmount
    if (a == null) return
    setBusy(true)
    try {
      await depositWallet({ amount: a })
      await refreshProfile()
      showSuccessToast('Deposit complete', 'Your balance has been updated.')
      onClose()
    } catch (e) {
      showErrorToast('Deposit failed', getApiErrorMessage(e) ?? 'Could not complete deposit.')
    } finally {
      setBusy(false)
    }
  }

  const withdrawAmount = useMemo(() => parseAmount(withdrawStr), [withdrawStr])

  const confirmWithdraw = async () => {
    const a = withdrawAmount
    if (a == null) {
      showErrorToast('Invalid amount', 'Enter a positive amount to withdraw.')
      return
    }
    const toMoney = (x: number) => Math.round(x * 100) / 100
    const spendable = toMoney(walletAvailable)
    const amt = toMoney(a)
    if (amt > spendable) {
      showErrorToast('Too much', 'You can only withdraw up to your spendable balance (not held in active bids).')
      return
    }
    setBusy(true)
    try {
      await withdrawWallet(amt)
      await refreshProfile()
      showSuccessToast('Withdrawal complete', 'Your balance has been updated.')
      onClose()
    } catch (e) {
      showErrorToast('Withdrawal failed', getApiErrorMessage(e) ?? 'Could not complete withdrawal.')
    } finally {
      setBusy(false)
    }
  }

  const setWithdrawFraction = (f: number) => {
    const v = Math.floor(walletAvailable * f * 100) / 100
    setWithdrawStr(v > 0 ? String(v) : '')
  }

  const depositLabels = ['Enter amount', 'Payment method', 'Checkout']

  return (
    <Dialog.Root
      open={open}
      onOpenChange={({ open: isOpen }) => {
        if (!isOpen) onClose()
      }}
      size="xl"
    >
      <Dialog.Backdrop bg="blackAlpha.700" />
      <Dialog.Positioner
        display="flex"
        alignItems="center"
        justifyContent="center"
        minH="100dvh"
        w="100%"
        p={{ base: 4, md: 6 }}
      >
        <Dialog.Content
          bg="#0c0c0e"
          borderWidth="1px"
          borderColor={dark.borderSubtle}
          borderRadius="xl"
          maxW="640px"
          w="100%"
        >
          <Dialog.Header display="flex" alignItems="flex-start" justifyContent="space-between" pb={2}>
            <Flex align="flex-start" gap={3}>
              <Flex
                w="44px"
                h="44px"
                borderRadius="lg"
                bg="brand.600"
                alignItems="center"
                justifyContent="center"
                color="white"
                flexShrink={0}
              >
                <HiOutlineCurrencyDollar size={26} />
              </Flex>
              <Box>
                <Heading size="lg" color="white" fontWeight="bold">
                  Wallet
                </Heading>
                <Text fontSize="sm" color={dark.placeholder} mt={1}>
                  Add funds or withdraw from your balance on plzbuy.me
                </Text>
              </Box>
            </Flex>
            <Dialog.CloseTrigger asChild>
              <CloseButton color={dark.muted} _hover={{ bg: 'whiteAlpha.100', color: 'white' }} />
            </Dialog.CloseTrigger>
          </Dialog.Header>

          <Dialog.Body pt={0}>
            <Flex
              borderBottomWidth="1px"
              borderColor={dark.borderSubtle}
              mb={4}
              pb={3}
              gap={2}
              alignItems="baseline"
              flexWrap="wrap"
              fontSize="sm"
              color={dark.muted}
            >
              <Text>
                Total{' '}
                <Text as="span" color="white" fontWeight="bold">
                  ${formatMoney(walletBalance)}
                </Text>
              </Text>
              <Text>·</Text>
              <Text>
                Spendable{' '}
                <Text as="span" color="brand.400" fontWeight="bold">
                  ${formatMoney(walletAvailable)}
                </Text>
              </Text>
            </Flex>

            <Tabs.Root
              value={tab}
              onValueChange={(d) => setTab(d.value as 'deposit' | 'withdraw')}
              variant="line"
              colorPalette="brand"
            >
              <Tabs.List borderColor={dark.borderSubtle} gap={4} mb={4}>
                <Tabs.Trigger value="deposit" color="white" _selected={{ color: 'brand.400', borderColor: 'brand.400' }}>
                  Deposit
                </Tabs.Trigger>
                <Tabs.Trigger value="withdraw" color="white" _selected={{ color: 'brand.400', borderColor: 'brand.400' }}>
                  Withdraw
                </Tabs.Trigger>
              </Tabs.List>

              <Tabs.Content value="deposit">
                <Flex gap={{ base: 4, md: 8 }} align="flex-start" flexDir={{ base: 'column', md: 'row' }}>
                  <VerticalStepper step={depositStep} labels={depositLabels} />
                  <Box flex={1} minW={0}>
                    {depositStep === 1 && (
                      <Box>
                        <Text fontWeight="semibold" color="white" mb={3}>
                          How much would you like to add?
                        </Text>
                        <Flex
                          align="center"
                          borderWidth="1px"
                          borderColor={dark.borderSubtle}
                          borderRadius="md"
                          bg={dark.inputBg}
                          px={3}
                          mb={4}
                        >
                          <Text color={dark.muted} fontWeight="medium" mr={2}>
                            $
                          </Text>
                          <Input
                            type="text"
                            inputMode="decimal"
                            value={depositAmountStr}
                            onChange={(e) => setDepositAmountStr(e.target.value)}
                            border="none"
                            _focus={{ boxShadow: 'none' }}
                            color="white"
                            placeholder="0.00"
                          />
                        </Flex>
                        <Text fontSize="xs" color={dark.placeholder} mb={2}>
                          Quick amounts
                        </Text>
                        <Flex gap={2} flexWrap="wrap">
                          {DEPOSIT_PRESETS.map((amt) => (
                            <Button
                              key={amt}
                              size="sm"
                              bg="brand.500"
                              color="white"
                              _hover={{ bg: 'brand.400' }}
                              onClick={() => setDepositAmountStr(amt.toFixed(2))}
                            >
                              ${formatMoney(amt)}
                            </Button>
                          ))}
                        </Flex>
                      </Box>
                    )}

                    {depositStep === 2 && (
                      <Box>
                        <Text fontWeight="semibold" color="white" mb={1}>
                          Select a payment method
                        </Text>
                        <Text fontSize="sm" color={dark.placeholder} mb={4}>
                          Choose how you would like to fund your wallet.
                        </Text>
                        <Flex direction="column" gap={3}>
                          {PAY_OPTIONS.map((opt) => {
                            const selected = payMethod === opt.id
                            return (
                              <Button
                                key={opt.id}
                                variant="outline"
                                justifyContent="flex-start"
                                h="auto"
                                py={4}
                                px={4}
                                borderWidth="2px"
                                borderColor={selected ? 'brand.400' : dark.borderSubtle}
                                bg={selected ? 'whiteAlpha.50' : 'transparent'}
                                _hover={{ bg: 'whiteAlpha.80', borderColor: 'brand.500' }}
                                onClick={() => setPayMethod(opt.id)}
                              >
                                <Flex align="center" gap={4} w="100%" textAlign="left">
                                  <Box color="brand.400" flexShrink={0}>
                                    {opt.icon}
                                  </Box>
                                  <Box>
                                    <Text color="white" fontWeight="semibold">
                                      {opt.title}
                                    </Text>
                                    <Text fontSize="sm" color={dark.placeholder}>
                                      {opt.subtitle}
                                    </Text>
                                  </Box>
                                </Flex>
                              </Button>
                            )
                          })}
                        </Flex>
                      </Box>
                    )}

                    {depositStep === 3 && (
                      <Box>
                        <Text fontWeight="semibold" color="white" mb={2}>
                          Checkout
                        </Text>
                        <Box
                          bg={dark.cardBg}
                          borderWidth="1px"
                          borderColor={dark.borderSubtle}
                          borderRadius="md"
                          p={4}
                          mb={4}
                        >
                          <Text color={dark.muted} fontSize="sm">
                            Deposit amount
                          </Text>
                          <Text color="white" fontSize="2xl" fontWeight="bold">
                            ${depositAmount != null ? formatMoney(depositAmount) : '—'}
                          </Text>
                          <Text fontSize="sm" color={dark.placeholder} mt={2}>
                            Method:{' '}
                            {PAY_OPTIONS.find((p) => p.id === payMethod)?.title ?? '—'}
                          </Text>
                        </Box>
                        <Text fontSize="xs" color={dark.placeholder}>
                          By confirming, you authorize this deposit to your plzbuy.me wallet.
                        </Text>
                      </Box>
                    )}

                    <Flex gap={2} justify="flex-end" mt={6} flexWrap="wrap">
                      {depositStep > 1 && (
                        <Button
                          variant="outline"
                          borderColor={dark.borderSubtle}
                          color="white"
                          _hover={{ bg: 'whiteAlpha.100' }}
                          onClick={handleDepositBack}
                          disabled={busy}
                        >
                          Back
                        </Button>
                      )}
                      {depositStep < 3 ? (
                        <Button
                          bg="brand.500"
                          color="white"
                          _hover={{ bg: 'brand.400' }}
                          onClick={handleDepositNext}
                          disabled={busy}
                        >
                          Continue
                        </Button>
                      ) : (
                        <Button
                          bg="brand.500"
                          color="white"
                          _hover={{ bg: 'brand.400' }}
                          loading={busy}
                          onClick={() => void confirmDeposit()}
                        >
                          Confirm deposit
                        </Button>
                      )}
                    </Flex>
                  </Box>
                </Flex>
              </Tabs.Content>

              <Tabs.Content value="withdraw">
                <Text fontWeight="semibold" color="white" mb={1}>
                  Withdraw funds
                </Text>
                <Text fontSize="sm" color={dark.placeholder} mb={4}>
                  Reduces your wallet by up to your spendable balance. Held amounts for active high bids cannot be
                  withdrawn.
                </Text>
                <Field.Root mb={4}>
                  <Field.Label color={dark.label}>Amount</Field.Label>
                  <Flex
                    align="center"
                    borderWidth="1px"
                    borderColor={dark.borderSubtle}
                    borderRadius="md"
                    bg={dark.inputBg}
                    px={3}
                  >
                    <Text color={dark.muted} fontWeight="medium" mr={2}>
                      $
                    </Text>
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={withdrawStr}
                      onChange={(e) => setWithdrawStr(e.target.value)}
                      border="none"
                      _focus={{ boxShadow: 'none' }}
                      color="white"
                      placeholder="0.00"
                    />
                  </Flex>
                </Field.Root>
                <Text fontSize="xs" color={dark.placeholder} mb={2}>
                  Quick fill (% of spendable)
                </Text>
                <Flex gap={2} flexWrap="wrap" mb={6}>
                  <Button
                    size="sm"
                    variant="outline"
                    borderColor={dark.borderSubtle}
                    color="white"
                    _hover={{ bg: 'whiteAlpha.100' }}
                    onClick={() => setWithdrawFraction(0.25)}
                  >
                    25%
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    borderColor={dark.borderSubtle}
                    color="white"
                    _hover={{ bg: 'whiteAlpha.100' }}
                    onClick={() => setWithdrawFraction(0.5)}
                  >
                    50%
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    borderColor={dark.borderSubtle}
                    color="white"
                    _hover={{ bg: 'whiteAlpha.100' }}
                    onClick={() => setWithdrawFraction(1)}
                  >
                    Max
                  </Button>
                </Flex>
                <Button
                  bg="brand.500"
                  color="white"
                  _hover={{ bg: 'brand.400' }}
                  loading={busy}
                  onClick={() => void confirmWithdraw()}
                >
                  Confirm withdrawal
                </Button>
              </Tabs.Content>
            </Tabs.Root>
          </Dialog.Body>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  )
}
