import { Box, Button, Container, Flex, Input, Text } from '@chakra-ui/react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { isAxiosError } from 'axios'
import { createRep, type CreateRepDto } from '../../api/admin'
import { showErrorToast, showSuccessToast } from '../../components/ui/toaster'
import { dark } from '../../theme/colors'

export function AdminDashboard() {
  const form = useForm<CreateRepDto>({
    defaultValues: { username: '', email: '', password: '' },
  })

  const onSubmit = async (data: CreateRepDto) => {
    try {
      await createRep({
        username: data.username.trim(),
        email: data.email.trim(),
        password: data.password,
      })
      showSuccessToast('Rep account created')
      form.reset()
    } catch (err) {
      if (isAxiosError(err) && err.response?.data) {
        const msg = typeof err.response.data === 'string' ? err.response.data : 'Failed to create rep.'
        showErrorToast('Error', msg)
      } else {
        showErrorToast('Error', 'Failed to create rep.')
      }
    }
  }

  return (
    <Container maxW="container.md" py={6}>
      <Text fontSize="2xl" fontWeight="bold" color="white" mb={6}>
        Admin Dashboard
      </Text>
      <Flex gap={4} mb={8}>
        <Button asChild size="sm" variant="outline" colorScheme="brand">
          <Link to="/admin/reports">View Reports</Link>
        </Button>
      </Flex>
      <Box
        p={6}
        bg={dark.cardBg}
        borderRadius="md"
        borderWidth="1px"
        borderColor={dark.borderSubtle}
      >
        <Text fontWeight="semibold" color="white" mb={4}>
          Create Rep
        </Text>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <Flex direction="column" gap={4}>
            <Box>
              <Text mb={2} color={dark.label} fontSize="sm">
                Username
              </Text>
              <Input
                {...form.register('username', { required: 'Username is required' })}
                placeholder="Username"
                bg={dark.inputBg}
                borderColor={dark.borderSubtle}
                color="white"
                _placeholder={{ color: dark.placeholder }}
              />
              {form.formState.errors.username && (
                <Text fontSize="sm" color="red.400" mt={1}>
                  {form.formState.errors.username.message}
                </Text>
              )}
            </Box>
            <Box>
              <Text mb={2} color={dark.label} fontSize="sm">
                Email
              </Text>
              <Input
                type="email"
                {...form.register('email', { required: 'Email is required' })}
                placeholder="Email"
                bg={dark.inputBg}
                borderColor={dark.borderSubtle}
                color="white"
                _placeholder={{ color: dark.placeholder }}
              />
              {form.formState.errors.email && (
                <Text fontSize="sm" color="red.400" mt={1}>
                  {form.formState.errors.email.message}
                </Text>
              )}
            </Box>
            <Box>
              <Text mb={2} color={dark.label} fontSize="sm">
                Password
              </Text>
              <Input
                type="password"
                {...form.register('password', { required: 'Password is required', minLength: { value: 6, message: 'At least 6 characters' } })}
                placeholder="Password"
                bg={dark.inputBg}
                borderColor={dark.borderSubtle}
                color="white"
                _placeholder={{ color: dark.placeholder }}
              />
              {form.formState.errors.password && (
                <Text fontSize="sm" color="red.400" mt={1}>
                  {form.formState.errors.password.message}
                </Text>
              )}
            </Box>
            <Button type="submit" colorScheme="brand" loading={form.formState.isSubmitting}>
              Create Rep
            </Button>
          </Flex>
        </form>
      </Box>
    </Container>
  )
}
