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
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { isAxiosError } from 'axios'

interface RegisterForm {
  username: string
  email: string
  password: string
  confirmPassword: string
}

function getRegisterErrorMessage(err: unknown): string {
  if (isAxiosError(err)) {
    if (err.code === 'ERR_NETWORK') {
      return 'Could not reach the server. Check your connection and try again.'
    }
    const data = err.response?.data
    if (typeof data === 'string' && data.length > 0) return data
    if (err.response?.status === 400) {
      return typeof data === 'string' ? data : 'Username or email already in use, or invalid input.'
    }
  }
  return 'Registration failed. Please try again.'
}

export function RegisterPage() {
  const { register: registerUser } = useAuth()
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterForm>({
    defaultValues: {
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  })

  const password = watch('password')

  const onSubmit = async (data: RegisterForm) => {
    setError(null)
    setSubmitting(true)
    try {
      await registerUser(data.username, data.email, data.password)
      navigate('/', { replace: true })
    } catch (err: unknown) {
      setError(getRegisterErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Container maxW="sm">
      <Card.Root p={6}>
        <Card.Header>
          <Card.Title>Create account</Card.Title>
          {submitting && (
            <Text fontSize="sm" color="gray.600" _dark={{ color: 'gray.400' }} mt={1} display="flex" alignItems="center" gap={2}>
              <Spinner size="sm" /> Creating your account…
            </Text>
          )}
        </Card.Header>
        <Card.Body>
          <form onSubmit={handleSubmit(onSubmit)}>
            <VStack gap={4} align="stretch">
              {error && (
                <Alert.Root status="error" variant="solid">
                  <Alert.Indicator />
                  <Box flex={1}>
                    <Alert.Title>Registration failed</Alert.Title>
                    <Alert.Description>{error}</Alert.Description>
                  </Box>
                </Alert.Root>
              )}
              <Field.Root invalid={!!errors.username}>
                <Field.Label>Username</Field.Label>
                <Input
                  type="text"
                  autoComplete="username"
                  disabled={submitting}
                  {...register('username', { required: 'Username is required' })}
                />
                {errors.username && (
                  <Field.ErrorText>{errors.username.message}</Field.ErrorText>
                )}
              </Field.Root>
              <Field.Root invalid={!!errors.email}>
                <Field.Label>Email</Field.Label>
                <Input
                  type="email"
                  autoComplete="email"
                  disabled={submitting}
                  {...register('email', {
                    required: 'Email is required',
                    pattern: {
                      value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                      message: 'Enter a valid email address',
                    },
                  })}
                />
                {errors.email && <Field.ErrorText>{errors.email.message}</Field.ErrorText>}
              </Field.Root>
              <Field.Root invalid={!!errors.password}>
                <Field.Label>Password</Field.Label>
                <Input
                  type="password"
                  autoComplete="new-password"
                  disabled={submitting}
                  {...register('password', {
                    required: 'Password is required',
                    minLength: {
                      value: 6,
                      message: 'Password must be at least 6 characters',
                    },
                  })}
                />
                {errors.password && (
                  <Field.ErrorText>{errors.password.message}</Field.ErrorText>
                )}
              </Field.Root>
              <Field.Root invalid={!!errors.confirmPassword}>
                <Field.Label>Confirm password</Field.Label>
                <Input
                  type="password"
                  autoComplete="new-password"
                  disabled={submitting}
                  {...register('confirmPassword', {
                    required: 'Please confirm your password',
                    validate: (v) => v === password || 'Passwords do not match',
                  })}
                />
                {errors.confirmPassword && (
                  <Field.ErrorText>{errors.confirmPassword.message}</Field.ErrorText>
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
                  {submitting ? 'Creating account…' : 'Register'}
                </Button>
              </Box>
            </VStack>
          </form>
        </Card.Body>
      </Card.Root>
    </Container>
  )
}
