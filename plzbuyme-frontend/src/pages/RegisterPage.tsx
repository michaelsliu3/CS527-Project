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
import { useNavigate, Link as RouterLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { isAxiosError } from 'axios'
import { HiEye, HiEyeOff } from 'react-icons/hi'
import { dark } from '../theme/colors'
import { APP_PAGE_PX } from '../theme/layout'

interface RegisterForm {
  username: string
  email: string
  password: string
  confirmPassword: string
}

interface AuthErrorResponse {
  code?: string
  message?: string
}

function getRegisterErrorMessage(err: unknown): string {
  if (isAxiosError(err)) {
    if (err.code === 'ERR_NETWORK') {
      return 'Could not reach the server. Check your connection and try again.'
    }
    const data = err.response?.data as AuthErrorResponse | string | undefined
    if (data && typeof data === 'object' && typeof data.message === 'string' && data.message.length > 0) {
      return data.message
    }
    if (typeof data === 'string' && data.length > 0) return data
    if (err.response?.status === 400) {
      return 'Registration failed. Please check your input and try again.'
    }
  }
  return 'Registration failed. Please try again.'
}

export function RegisterPage() {
  const { register: registerUser } = useAuth()
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successUsername, setSuccessUsername] = useState<string | null>(null)

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
    setSuccessUsername(null)
    setSubmitting(true)
    try {
      const { username } = await registerUser(data.username, data.email, data.password)
      setSubmitting(false)
      setSuccessUsername(username)
      setTimeout(() => navigate('/', { replace: true }), 1500)
    } catch (err: unknown) {
      setError(getRegisterErrorMessage(err))
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
              Create your account
            </Heading>
            <Text color={dark.muted} fontSize="md">
              Get started with plzbuy.me
            </Text>
            {submitting && (
              <Text fontSize="sm" color={dark.muted} mt={1} display="flex" alignItems="center" justifyContent="center" gap={2}>
                <Spinner size="sm" color="brand.400" /> Creating your account…
              </Text>
            )}
          </Stack>

          {successUsername && (
            <Alert.Root status="success" borderRadius="lg" bg="green.900" color="green.200">
              <Alert.Indicator />
              <Box flex={1}>
                <Alert.Title>Account created</Alert.Title>
                <Alert.Description>
                  Welcome, <strong>{successUsername}</strong>! You're logged in. Redirecting…
                </Alert.Description>
              </Box>
            </Alert.Root>
          )}

          {error && (
            <Alert.Root status="error" borderRadius="lg" bg="red.900" color="red.200">
              <Alert.Indicator />
              <Box flex={1}>
                <Alert.Title>Registration failed</Alert.Title>
                <Alert.Description>{error}</Alert.Description>
              </Box>
            </Alert.Root>
          )}

          <Box w="full">
            <form onSubmit={handleSubmit(onSubmit)}>
              <Stack gap={5}>
                <Field.Root invalid={!!errors.username}>
                  <Field.Label color={dark.label} fontWeight="medium" fontSize="sm">
                    Username
                  </Field.Label>
                  <Input
                    type="text"
                    disabled={submitting || !!successUsername}
                    {...inputStyles}
                    {...register('username', { required: 'Username is required' })}
                  />
                  {errors.username && (
                    <Field.ErrorText>{errors.username.message}</Field.ErrorText>
                  )}
                </Field.Root>

                <Field.Root invalid={!!errors.email}>
                  <Field.Label color={dark.label} fontWeight="medium" fontSize="sm">
                    Email
                  </Field.Label>
                  <Input
                    type="email"
                    disabled={submitting || !!successUsername}
                    {...inputStyles}
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
                  <Field.Label color={dark.label} fontWeight="medium" fontSize="sm">
                    Password
                  </Field.Label>
                  <Box position="relative" w="full">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      pr="3rem"
                      disabled={submitting || !!successUsername}
                      {...inputStyles}
                      {...register('password', {
                        required: 'Password is required',
                        minLength: {
                          value: 6,
                          message: 'Password must be at least 6 characters',
                        },
                      })}
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
                  {errors.password && (
                    <Field.ErrorText>{errors.password.message}</Field.ErrorText>
                  )}
                </Field.Root>

                <Field.Root invalid={!!errors.confirmPassword}>
                  <Field.Label color={dark.label} fontWeight="medium" fontSize="sm">
                    Confirm password
                  </Field.Label>
                  <Box position="relative" w="full">
                    <Input
                      type={showConfirm ? 'text' : 'password'}
                      pr="3rem"
                      disabled={submitting || !!successUsername}
                      {...inputStyles}
                      {...register('confirmPassword', {
                        required: 'Please confirm your password',
                        validate: (v) => v === password || 'Passwords do not match',
                      })}
                    />
                    <IconButton
                      aria-label={showConfirm ? 'Hide password' : 'Show password'}
                      variant="ghost"
                      size="sm"
                      position="absolute"
                      right="2"
                      top="50%"
                      transform="translateY(-50%)"
                      zIndex={2}
                      color={dark.muted}
                      _hover={{ color: 'white', bg: 'transparent' }}
                      onClick={() => setShowConfirm((v) => !v)}
                    >
                      {showConfirm ? <HiEyeOff /> : <HiEye />}
                    </IconButton>
                  </Box>
                  {errors.confirmPassword && (
                    <Field.ErrorText>{errors.confirmPassword.message}</Field.ErrorText>
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
                  {successUsername ? 'Redirecting…' : 'Create account'}
                </Button>
              </Stack>
            </form>
          </Box>

          <Text textAlign="center" fontSize="sm" color={dark.muted}>
            Already have an account?{' '}
            <RouterLink
              to="/login"
              style={{ color: 'var(--chakra-colors-brand-400)', fontWeight: 600 }}
            >
              Sign in
            </RouterLink>
          </Text>
        </Stack>
      </Container>
    </Flex>
  )
}
