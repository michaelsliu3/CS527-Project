import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChakraProvider } from '@chakra-ui/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { RepDashboard } from '../../pages/rep/RepDashboard'
import { AuthProvider } from '../../context/AuthContext'
import { system } from '../../theme'
import * as repApi from '../../api/rep'
import * as questionsApi from '../../api/questions'
import * as auctionsApi from '../../api/auctions'

vi.mock('../../api/rep', () => ({
  getRepUsers: vi.fn(),
  editRepUser: vi.fn(),
  deleteRepUser: vi.fn(),
  resetRepUserPassword: vi.fn(),
  deleteRepBid: vi.fn(),
  deleteRepAuction: vi.fn(),
}))

vi.mock('../../api/questions', () => ({
  listQuestions: vi.fn(),
  replyToQuestion: vi.fn(),
}))

vi.mock('../../api/auctions', () => ({
  browseAuctions: vi.fn(),
  getAuction: vi.fn(),
}))

const repToken = `header.${btoa(JSON.stringify({ sub: '1', unique_name: 'rep1', role: 'customer_rep', exp: 9999999999 }))}.sig`
const adminToken = `header.${btoa(JSON.stringify({ sub: '99', unique_name: 'admin1', role: 'admin', exp: 9999999999 }))}.sig`

function renderRepDashboard() {
  return render(
    <ChakraProvider value={system}>
      <MemoryRouter initialEntries={['/rep']}>
        <AuthProvider>
          <Routes>
            <Route path="/rep/*" element={<RepDashboard />} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </ChakraProvider>
  )
}

describe('RepDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    localStorage.setItem('token', repToken)
    vi.mocked(repApi.getRepUsers).mockResolvedValue({
      data: {
        items: [
          { id: 1, username: 'jane', email: 'jane@test.com', role: 'end_user', isActive: true, createdAt: '2024-01-01T00:00:00Z' },
          { id: 2, username: 'bob', email: 'bob@test.com', role: 'end_user', isActive: false, createdAt: '2024-01-02T00:00:00Z' },
        ],
        totalCount: 2,
        page: 1,
        pageSize: 10,
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as never)
    vi.mocked(questionsApi.listQuestions).mockResolvedValue({
      data: [],
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as never)
    vi.mocked(auctionsApi.browseAuctions).mockResolvedValue({
      data: { items: [], totalCount: 0, page: 1, pageSize: 10 },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as never)
  })

  it('user table renders and supports edit/delete actions', async () => {
    renderRepDashboard()
    await waitFor(() => {
      expect(repApi.getRepUsers).toHaveBeenCalled()
    })
    expect(screen.getByText('Rep Dashboard')).toBeInTheDocument()
    expect(screen.getByText('jane')).toBeInTheDocument()
    expect(screen.getByText('bob')).toBeInTheDocument()
    expect(screen.getByText('jane@test.com')).toBeInTheDocument()
    const editButtons = screen.getAllByRole('button', { name: /Edit/i })
    const deleteButtons = screen.getAllByRole('button', { name: /Delete/i })
    expect(editButtons.length).toBeGreaterThanOrEqual(1)
    expect(deleteButtons.length).toBeGreaterThanOrEqual(1)
  })

  it('Edit opens modal and submit calls editRepUser', async () => {
    const user = userEvent.setup()
    vi.mocked(repApi.editRepUser).mockResolvedValue({
      data: undefined,
      status: 204,
      statusText: 'No Content',
      headers: {},
      config: {},
    } as never)
    renderRepDashboard()
    await waitFor(() => {
      expect(screen.getByText('jane')).toBeInTheDocument()
    })
    const editButtons = screen.getAllByRole('button', { name: /Edit/i })
    await user.click(editButtons[0])
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('Edit User')).toBeInTheDocument()
    })
    const saveButton = screen.getByRole('button', { name: 'Save' })
    await user.click(saveButton)
    await waitFor(() => {
      expect(repApi.editRepUser).toHaveBeenCalledWith(1, expect.objectContaining({ username: 'jane', email: 'jane@test.com' }))
    })
  })

  it('rep edit modal does not show role dropdown', async () => {
    const user = userEvent.setup()
    renderRepDashboard()

    await waitFor(() => {
      expect(screen.getByText('jane')).toBeInTheDocument()
    })

    const editButtons = screen.getAllByRole('button', { name: /Edit/i })
    await user.click(editButtons[0])

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('admin sees role dropdown and submits role update', async () => {
    const user = userEvent.setup()
    localStorage.setItem('token', adminToken)
    vi.mocked(repApi.editRepUser).mockResolvedValue({
      data: undefined,
      status: 204,
      statusText: 'No Content',
      headers: {},
      config: {},
    } as never)

    renderRepDashboard()
    await waitFor(() => {
      expect(screen.getByText('jane')).toBeInTheDocument()
    })

    const editButtons = screen.getAllByRole('button', { name: /Edit/i })
    await user.click(editButtons[0])

    const dialog = await screen.findByRole('dialog')
    const roleSelect = within(dialog).getByRole('combobox')
    await user.selectOptions(roleSelect, 'Admin')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(repApi.editRepUser).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ username: 'jane', email: 'jane@test.com', role: 'Admin' })
      )
    })
  })

  it('Delete opens confirmation modal', async () => {
    const user = userEvent.setup()
    vi.mocked(repApi.deleteRepUser).mockResolvedValue({
      data: undefined,
      status: 204,
      statusText: 'No Content',
      headers: {},
      config: {},
    } as never)
    renderRepDashboard()
    await waitFor(() => {
      expect(screen.getByText('jane')).toBeInTheDocument()
    })
    const deleteButtons = screen.getAllByRole('button', { name: /Delete/i })
    await user.click(deleteButtons[0])
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText(/Delete user?/)).toBeInTheDocument()
      expect(screen.getByText(/Soft-delete user "jane"/)).toBeInTheDocument()
    })
    const confirmDelete = screen.getByRole('button', { name: 'Delete' })
    await user.click(confirmDelete)
    await waitFor(() => {
      expect(repApi.deleteRepUser).toHaveBeenCalledWith(1)
    })
  })
})
