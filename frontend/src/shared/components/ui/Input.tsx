import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react'

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  label?:     string
  error?:     string
  hint?:      string
  prefix?:    ReactNode
  suffix?:    ReactNode
  fullWidth?: boolean
}

const BASE_INPUT =
  'flex-1 min-w-0 bg-transparent text-sm text-content placeholder-content-subtle ' +
  'focus:outline-none'

const WRAPPER_BASE =
  'flex items-center gap-2 w-full rounded-lg border px-3 h-9 ' +
  'transition-colors bg-surface-2 ' +
  'focus-within:ring-2 focus-within:ring-brand-500 focus-within:border-brand-500'

const WRAPPER_NORMAL =
  'border-edge-2 hover:border-content-subtle'

const WRAPPER_ERROR =
  'border-red-400 focus-within:ring-red-400 focus-within:border-red-400'

const WRAPPER_DISABLED =
  'opacity-50 cursor-not-allowed bg-surface'

const ADORNMENT =
  'shrink-0 text-content-subtle text-sm select-none'

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      hint,
      prefix,
      suffix,
      fullWidth = true,
      disabled,
      id,
      className = '',
      ...props
    },
    ref,
  ) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className={fullWidth ? 'w-full' : ''}>
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-content-2 mb-1"
          >
            {label}
          </label>
        )}

        <div
          className={[
            WRAPPER_BASE,
            error    ? WRAPPER_ERROR    : WRAPPER_NORMAL,
            disabled ? WRAPPER_DISABLED : '',
            className,
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {prefix && <span className={ADORNMENT}>{prefix}</span>}

          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            className={BASE_INPUT}
            {...props}
          />

          {suffix && <span className={ADORNMENT}>{suffix}</span>}
        </div>

        {error && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
        )}
        {!error && hint && (
          <p className="mt-1 text-xs text-content-muted">{hint}</p>
        )}
      </div>
    )
  },
)

Input.displayName = 'Input'
