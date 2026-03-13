import { useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  Container,
  Field,
  Input,
  VStack,
} from '@chakra-ui/react'
import { useForm } from 'react-hook-form'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

interface LoginForm {
  username: string
  password: string
}

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [submitting, setSubmitting] = useState(false)
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/'

  const [error, setError] = useState<string | null>(null)
  const { register, handleSubmit, formState } = useForm<LoginForm>({
    defaultValues: { username: '', password: '' },
  })

  const onSubmit = async (data: LoginForm) => {
    setError(null)
    setSubmitting(true)
    try {
      await login(data.username, data.password)
      navigate(from, { replace: true })
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: unknown } }).response?.data
          : null
      setError(typeof message === 'string' ? message : 'Login failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Container maxW="sm">
      <Card.Root p={6}>
        <Card.Header>
          <Card.Title>Log in</Card.Title>
        </Card.Header>
        <Card.Body>
          <form onSubmit={handleSubmit(onSubmit)}>
            <VStack gap={4} align="stretch">
              {error && (
                <Alert.Root status="error">
                  <Alert.Indicator />
                  <Alert.Title>Login failed</Alert.Title>
                  <Alert.Description>{error}</Alert.Description>
                </Alert.Root>
              )}
              <Field.Root invalid={!!formState.errors.username}>
                <Field.Label>Username or email</Field.Label>
                <Input
                  type="text"
                  autoComplete="username"
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
                  disabled={submitting}
                  loading={submitting as boolean}
                >
                  Log in
                </Button>
              </Box>
            </VStack>
          </form>
        </Card.Body>
      </Card.Root>
    </Container>
  )
}
