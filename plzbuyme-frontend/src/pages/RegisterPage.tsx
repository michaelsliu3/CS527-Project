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
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

interface RegisterForm {
  username: string
  email: string
  password: string
  confirmPassword: string
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
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: unknown } }).response?.data
          : null
      setError(typeof message === 'string' ? message : 'Registration failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Container maxW="sm">
      <Card.Root p={6}>
        <Card.Header>
          <Card.Title>Create account</Card.Title>
        </Card.Header>
        <Card.Body>
          <form onSubmit={handleSubmit(onSubmit)}>
            <VStack gap={4} align="stretch">
              {error && (
                <Alert.Root status="error">
                  <Alert.Indicator />
                  <Alert.Title>Registration failed</Alert.Title>
                  <Alert.Description>{error}</Alert.Description>
                </Alert.Root>
              )}
              <Field.Root invalid={!!errors.username}>
                <Field.Label>Username</Field.Label>
                <Input
                  type="text"
                  autoComplete="username"
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
                  Register
                </Button>
              </Box>
            </VStack>
          </form>
        </Card.Body>
      </Card.Root>
    </Container>
  )
}
