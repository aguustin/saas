import {
  forwardRef,
  type SelectHTMLAttributes,
} from 'react'
import { ChevronDown } from 'lucide-react'

export interface SelectOption {
  value:     string
  label:     string
  disabled?: boolean
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?:       string
  error?:       string
  hint?:        string
  options:      SelectOption[]
  placeholder?: string
  fullWidth?:   boolean
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      error,
      hint,
      options,
      placeholder,
      fullWidth = true,
      disabled,
      id,
      className = '',
      ...props
    },
    ref,
  ) => {
    const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className={fullWidth ? 'w-full' : ''}>
        {label && (
          <label
            htmlFor={selectId}
            className="block text-sm font-medium text-content-2 mb-1"
          >
            {label}
          </label>
        )}

        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            disabled={disabled}
            className={[
              'w-full h-9 pl-3 pr-8 text-sm rounded-lg border appearance-none',
              'bg-surface-2 text-content transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500',
              'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-surface',
              error
                ? 'border-red-400'
                : 'border-edge-2 hover:border-content-subtle',
              className,
            ]
              .filter(Boolean)
              .join(' ')}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map(opt => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </option>
            ))}
          </select>

          <ChevronDown
            size={14}
            className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-content-subtle"
          />
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

Select.displayName = 'Select'
