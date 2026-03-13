import { useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  Container,
  Field,
  Input,
  Spinner,
  Text,
  VStack,
} from '@chakra-ui/react'
import { useForm } from 'react-hook-form'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { isAxiosError } from 'axios'

interface LoginForm {
  username: string
  password: string
}

/** Auth error shape returned by the API (AuthErrorDto) */
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

  return (
    <Container maxW="sm">
      <Card.Root p={6}>
        <Card.Header>
          <Card.Title>Log in</Card.Title>
          {submitting && (
            <Text fontSize="sm" color="gray.600" _dark={{ color: 'gray.400' }} mt={1} display="flex" alignItems="center" gap={2}>
              <Spinner size="sm" /> Logging you in…
            </Text>
          )}
        </Card.Header>
        <Card.Body>
          <form onSubmit={handleSubmit(onSubmit)}>
            <VStack gap={4} align="stretch">
              {successUsername && (
                <Alert.Root status="success" variant="solid">
                  <Alert.Indicator />
                  <Box flex={1}>
                    <Alert.Title>Welcome back!</Alert.Title>
                    <Alert.Description>
                      You’re logged in as <strong>{successUsername}</strong>. Redirecting…
                    </Alert.Description>
                  </Box>
                </Alert.Root>
              )}
              {error && (
                <Alert.Root status="error" variant="solid">
                  <Alert.Indicator />
                  <Box flex={1}>
                    <Alert.Title>Login failed</Alert.Title>
                    <Alert.Description>{error}</Alert.Description>
                  </Box>
                </Alert.Root>
              )}
              <Field.Root invalid={!!formState.errors.username}>
                <Field.Label>Username or email</Field.Label>
                <Input
                  type="text"
                  autoComplete="username"
                  disabled={submitting || !!successUsername}
                  {...register('username', { required: 'Username or email is required' })}
                />
                {formState.errors.username && (
                  <Field.ErrorText>{formState.errors.username.message}</Field.ErrorText>
                )}
              </Field.Root>
              <Field.Root invalid={!!formState.errors.password}>
                <Field.Label>Password</Field.Label>
                <Input
                  type="password"
                  autoComplete="current-password"
                  disabled={submitting || !!successUsername}
                  {...register('password', { required: 'Password is required' })}
                />
                {formState.errors.password && (
                  <Field.ErrorText>{formState.errors.password.message}</Field.ErrorText>
                )}
              </Field.Root>
              <Box pt={2}>
                <Button
                  type="submit"
                  colorPalette="brand"
                  width="full"
                  disabled={submitting || !!successUsername}
                  loading={submitting as boolean}
                >
                  {successUsername ? 'Redirecting…' : submitting ? 'Logging in…' : 'Log in'}
                </Button>
              </Box>
            </VStack>
          </form>
        </Card.Body>
      </Card.Root>
    </Container>
  )
}
