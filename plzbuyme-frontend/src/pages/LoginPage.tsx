import { useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Container,
  Field,
  Flex,
  Heading,
  IconButton,
  Input,
  Spinner,
  Stack,
  Text,
} from '@chakra-ui/react'
import { useForm } from 'react-hook-form'
import { useNavigate, useLocation, Link as RouterLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { isAxiosError } from 'axios'
import { HiEye, HiEyeOff } from 'react-icons/hi'
import { dark } from '../theme/colors'
import { APP_PAGE_PX } from '../theme/layout'

interface LoginForm {
  username: string
  password: string
}

interface AuthErrorResponse {
  code?: string
  message?: string
}

function getLoginErrorMessage(err: unknown): string {
  if (isAxiosError(err)) {
    if (err.code === 'ERR_NETWORK') {
      return 'Could not reach the server. Check your connection and try again.'
    }
    const data = err.response?.data as AuthErrorResponse | string | undefined
    if (data && typeof data === 'object' && typeof data.message === 'string' && data.message.length > 0) {
      return data.message
    }
    if (typeof data === 'string' && data.length > 0) return data
    if (err.response?.status === 401 || err.response?.status === 400) {
      return 'Invalid request. Please check your input and try again.'
    }
  }
  return 'Login failed. Please try again.'
}

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [submitting, setSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/'

  const [error, setError] = useState<string | null>(null)
  const [successUsername, setSuccessUsername] = useState<string | null>(null)
  const { register, handleSubmit, formState } = useForm<LoginForm>({
    defaultValues: { username: '', password: '' },
  })

  const onSubmit = async (data: LoginForm) => {
    setError(null)
    setSuccessUsername(null)
    setSubmitting(true)
    try {
      const { username } = await login(data.username, data.password)
      setSubmitting(false)
      setSuccessUsername(username)
      setTimeout(() => navigate(from, { replace: true }), 1500)
    } catch (err: unknown) {
      setError(getLoginErrorMessage(err))
      setSubmitting(false)
    }
  }

  const inputStyles = {
    size: 'lg' as const,
    bg: dark.inputBg,
    borderColor: dark.border,
    color: 'white',
    _hover: { borderColor: dark.hoverBorder },
    _focus: { borderColor: 'brand.400', boxShadow: '0 0 0 1px var(--chakra-colors-brand-400)' },
    _placeholder: { color: dark.placeholder },
    css: { '&:-webkit-autofill': { WebkitTextFillColor: 'white', WebkitBoxShadow: `0 0 0 1000px ${dark.inputBg} inset` } },
  }

  return (
    <Flex className="dark" minH="100vh" align="center" justify="center" bg={dark.bg} px={3} py={10}>
      <Container maxW="md" p={0} px={APP_PAGE_PX}>
        <Stack gap={8} align="center">
          <Heading size="lg" fontWeight="bold" color="brand.400">
            plzbuy.me
          </Heading>

          <Stack gap={1} textAlign="center">
            <Heading size="2xl" fontWeight="bold" color="white">
              Welcome back
            </Heading>
            <Text color={dark.muted} fontSize="md">
              Sign in to your account to continue
            </Text>
            {submitting && (
              <Text fontSize="sm" color={dark.muted} mt={1} display="flex" alignItems="center" justifyContent="center" gap={2}>
                <Spinner size="sm" color="brand.400" /> Signing you in…
              </Text>
            )}
          </Stack>

          {successUsername && (
            <Alert.Root status="success" borderRadius="lg" bg="green.900" color="green.200">
              <Alert.Indicator />
              <Box flex={1}>
                <Alert.Title>Welcome back!</Alert.Title>
                <Alert.Description>
                  You're logged in as <strong>{successUsername}</strong>. Redirecting…
                </Alert.Description>
              </Box>
            </Alert.Root>
          )}

          {error && (
            <Alert.Root status="error" borderRadius="lg" bg="red.900" color="red.200">
              <Alert.Indicator />
              <Box flex={1}>
                <Alert.Title>Sign in failed</Alert.Title>
                <Alert.Description>{error}</Alert.Description>
              </Box>
            </Alert.Root>
          )}

          <Box w="full">
            <form onSubmit={handleSubmit(onSubmit)}>
              <Stack gap={5}>
                <Field.Root invalid={!!formState.errors.username}>
                  <Field.Label color={dark.label} fontWeight="medium" fontSize="sm">
                    Email or username
                  </Field.Label>
                  <Input
                    type="text"
                    disabled={submitting || !!successUsername}
                    {...inputStyles}
                    {...register('username', { required: 'Email or username is required' })}
                  />
                  {formState.errors.username && (
                    <Field.ErrorText>{formState.errors.username.message}</Field.ErrorText>
                  )}
                </Field.Root>

                <Field.Root invalid={!!formState.errors.password}>
                  <Field.Label color={dark.label} fontWeight="medium" fontSize="sm">
                    Password
                  </Field.Label>
                  <Box position="relative" w="full">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      pr="3rem"
                      disabled={submitting || !!successUsername}
                      {...inputStyles}
                      {...register('password', { required: 'Password is required' })}
                    />
                    <IconButton
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      variant="ghost"
                      size="sm"
                      position="absolute"
                      right="2"
                      top="50%"
                      transform="translateY(-50%)"
                      zIndex={2}
                      color={dark.muted}
                      _hover={{ color: 'white', bg: 'transparent' }}
                      onClick={() => setShowPassword((v) => !v)}
                    >
                      {showPassword ? <HiEyeOff /> : <HiEye />}
                    </IconButton>
                  </Box>
                  {formState.errors.password && (
                    <Field.ErrorText>{formState.errors.password.message}</Field.ErrorText>
                  )}
                </Field.Root>

                <Button
                  type="submit"
                  bg="brand.500"
                  color="white"
                  _hover={{ bg: 'brand.400' }}
                  size="lg"
                  width="full"
                  fontWeight="semibold"
                  borderRadius="lg"
                  disabled={submitting || !!successUsername}
                  loading={submitting as boolean}
                >
                  {successUsername ? 'Redirecting…' : 'Sign in'}
                </Button>
              </Stack>
            </form>
          </Box>

          <Text textAlign="center" fontSize="sm" color={dark.muted}>
            Don't have an account?{' '}
            <RouterLink
              to="/register"
              style={{ color: 'var(--chakra-colors-brand-400)', fontWeight: 600 }}
            >
              Sign up
            </RouterLink>
          </Text>
        </Stack>
      </Container>
    </Flex>
  )
}
