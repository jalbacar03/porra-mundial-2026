import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import EmptyState from '../components/EmptyState'

describe('EmptyState', () => {
  it('renders title and subtitle', () => {
    render(<EmptyState title="Sin datos" subtitle="Vuelve más tarde" />)
    expect(screen.getByText('Sin datos')).toBeInTheDocument()
    expect(screen.getByText('Vuelve más tarde')).toBeInTheDocument()
  })

  it('renders custom icon', () => {
    render(<EmptyState icon="🏆" title="Test" />)
    expect(screen.getByText('🏆')).toBeInTheDocument()
  })

  it('renders action button when provided', () => {
    const action = { label: 'Reintentar', onClick: () => {} }
    render(<EmptyState title="Error" action={action} />)
    expect(screen.getByText('Reintentar')).toBeInTheDocument()
  })

  it('does not render action button when not provided', () => {
    render(<EmptyState title="Vacío" />)
    expect(screen.queryByRole('button')).toBeNull()
  })
})
