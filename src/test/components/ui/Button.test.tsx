// Button Component Tests

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Button } from '../../../components/ui/button'

describe('Button', () => {
  it('should render button with text', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button')).toHaveTextContent('Click me')
  })

  it('should handle click events', () => {
    const handleClick = vi.fn()
    render(<Button onClick={handleClick}>Click me</Button>)
    
    fireEvent.click(screen.getByRole('button'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('should apply variant styles', () => {
    render(<Button variant="destructive">Delete</Button>)
    const button = screen.getByRole('button')
    
    expect(button).toHaveClass('bg-destructive')
  })

  it('should apply size styles', () => {
    render(<Button size="lg">Large Button</Button>)
    const button = screen.getByRole('button')
    
    expect(button).toHaveClass('h-11')
  })

  it('should be disabled when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>)
    const button = screen.getByRole('button')
    
    expect(button).toBeDisabled()
  })

  it('should render as child when asChild is true', () => {
    render(
      <Button asChild>
        <a href="https://example.com">Link Button</a>
      </Button>
    )
    
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', 'https://example.com')
    expect(link).toHaveTextContent('Link Button')
  })

  it('should apply custom className', () => {
    render(<Button className="custom-class">Custom</Button>)
    const button = screen.getByRole('button')
    
    expect(button).toHaveClass('custom-class')
  })

  it('should forward ref correctly', () => {
    const ref = { current: null }
    render(<Button ref={ref}>Ref Button</Button>)
    
    expect(ref.current).toBeInstanceOf(HTMLButtonElement)
  })
})
