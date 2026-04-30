import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
export type ButtonSize    = 'xs' | 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:   ButtonVariant
  size?:      ButtonSize
  loading?:   boolean
  leftIcon?:  ReactNode
  rightIcon?: ReactNode
  fullWidth?: boolean
}

const BASE =
  'inline-flex items-center justify-center gap-2 font-medium rounded-lg ' +
  'transition-colors focus-visible:outline-none focus-visible:ring-2 ' +
  'focus-visible:ring-offset-2 focus-visible:ring-offset-surface ' +
  'disabled:pointer-events-none disabled:opacity-50'

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-700 ' +
    'focus-visible:ring-brand-500 ' +
    'dark:bg-brand-500 dark:hover:bg-brand-600',
  secondary:
    'bg-surface-3 text-content hover:bg-edge-2 active:bg-edge-2 ' +
    'focus-visible:ring-content-subtle',
  ghost:
    'text-content-2 hover:bg-surface-2 active:bg-surface-2 ' +
    'focus-visible:ring-content-subtle',
  outline:
    'border border-edge-2 text-content-2 bg-transparent hover:bg-surface-2 ' +
    'focus-visible:ring-content-subtle',
  danger:
    'bg-red-600 text-white hover:bg-red-700 active:bg-red-700 ' +
    'focus-visible:ring-red-500 ' +
    'dark:bg-red-500 dark:hover:bg-red-600',
}

const SIZES: Record<ButtonSize, string> = {
  xs: 'h-7  px-2.5 text-xs',
  sm: 'h-8  px-3   text-sm',
  md: 'h-9  px-4   text-sm',
  lg: 'h-11 px-5   text-base',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant  = 'primary',
      size     = 'md',
      loading  = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      children,
      disabled,
      className = '',
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={[
          BASE,
          VARIANTS[variant],
          SIZES[size],
          fullWidth ? 'w-full' : '',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...props}
      >
        {loading ? (
          <Loader2 size={14} className="animate-spin shrink-0" />
        ) : (
          leftIcon && <span className="shrink-0">{leftIcon}</span>
        )}

        {children}

        {!loading && rightIcon && (
          <span className="shrink-0">{rightIcon}</span>
        )}
      </button>
    )
  },
)

Button.displayName = 'Button'
