import { describe, it, expect } from 'vitest'
import { classifyError, isApiError, getStockDetails, API_CODES } from './errors'
import type { ApiError } from '@/shared/types'

function makeError(overrides: Partial<ApiError>): ApiError {
  return { statusCode: 500, code: 'INTERNAL_ERROR', message: 'Error', ...overrides }
}

describe('isApiError', () => {
  it('returns true for valid ApiError shape', () => {
    expect(isApiError({ statusCode: 400, code: 'X', message: 'msg' })).toBe(true)
  })

  it('returns false for null', () => {
    expect(isApiError(null)).toBe(false)
  })

  it('returns false for strings', () => {
    expect(isApiError('error string')).toBe(false)
  })

  it('returns false when statusCode missing', () => {
    expect(isApiError({ code: 'X', message: 'msg' })).toBe(false)
  })

  it('returns false when code missing', () => {
    expect(isApiError({ statusCode: 400, message: 'msg' })).toBe(false)
  })
})

describe('classifyError', () => {
  it('returns logout for 401', () => {
    expect(classifyError(makeError({ statusCode: 401 }))).toEqual({ type: 'logout' })
  })

  it('redirects to /suspended when message includes "suspended"', () => {
    const result = classifyError(makeError({ statusCode: 403, message: 'Tenant suspended' }))
    expect(result).toEqual({ type: 'redirect', to: '/suspended' })
  })

  it('redirects to /expired when message includes "expired"', () => {
    const result = classifyError(makeError({ statusCode: 403, message: 'Subscription expired' }))
    expect(result).toEqual({ type: 'redirect', to: '/expired' })
  })

  it('redirects to /expired when message includes "subscription"', () => {
    const result = classifyError(makeError({ statusCode: 403, message: 'subscription ended' }))
    expect(result).toEqual({ type: 'redirect', to: '/expired' })
  })

  it('returns modal for 403 PLAN_LIMIT_REACHED', () => {
    const result = classifyError(makeError({
      statusCode: 403,
      code:       API_CODES.PLAN_LIMIT_REACHED,
      message:    'Limit reached',
    }))
    expect(result).toMatchObject({ type: 'modal', code: API_CODES.PLAN_LIMIT_REACHED })
  })

  it('returns toast for generic 403', () => {
    const result = classifyError(makeError({ statusCode: 403, message: 'Forbidden' }))
    expect(result).toMatchObject({ type: 'toast', severity: 'error', title: 'Acceso denegado' })
  })

  it('returns modal for 422 INSUFFICIENT_STOCK with details', () => {
    const details = [{ product_id: 'p1', product_name: 'Prod', available: 1, requested: 5 }]
    const result = classifyError(makeError({
      statusCode: 422,
      code:       API_CODES.INSUFFICIENT_STOCK,
      message:    'Stock insuficiente',
      details,
    }))
    expect(result).toMatchObject({ type: 'modal', code: API_CODES.INSUFFICIENT_STOCK, details })
  })

  it('returns retry for 422 STOCK_RACE_CONDITION', () => {
    expect(classifyError(makeError({ statusCode: 422, code: API_CODES.STOCK_RACE_CONDITION }))).toEqual({ type: 'retry' })
  })

  it('returns inline for 409 DUPLICATE', () => {
    const result = classifyError(makeError({ statusCode: 409, code: API_CODES.DUPLICATE, message: 'Ya existe' }))
    expect(result).toEqual({ type: 'inline', message: 'Ya existe' })
  })

  it('returns inline for 404', () => {
    expect(classifyError(makeError({ statusCode: 404 }))).toEqual({ type: 'inline', message: 'No encontrado.' })
  })

  it('returns inline for 400 VALIDATION_ERROR', () => {
    const result = classifyError(makeError({ statusCode: 400, code: API_CODES.VALIDATION_ERROR, message: 'Campo requerido' }))
    expect(result).toEqual({ type: 'inline', message: 'Campo requerido' })
  })

  it('returns toast for 400 FOREIGN_KEY_VIOLATION', () => {
    const result = classifyError(makeError({ statusCode: 400, code: API_CODES.FOREIGN_KEY_VIOLATION, message: 'FK error' }))
    expect(result).toMatchObject({ type: 'toast', severity: 'error', title: 'Referencia inválida' })
  })

  it('returns timeout toast for statusCode 0 TIMEOUT', () => {
    const result = classifyError(makeError({ statusCode: 0, code: API_CODES.TIMEOUT }))
    expect(result).toMatchObject({ type: 'toast', severity: 'warning', title: 'La solicitud tardó demasiado' })
  })

  it('returns network toast for statusCode 0 non-timeout', () => {
    const result = classifyError(makeError({ statusCode: 0, code: API_CODES.NETWORK_ERROR }))
    expect(result).toMatchObject({ type: 'toast', severity: 'warning', title: 'Sin conexión' })
  })

  it('returns error toast for 500', () => {
    const result = classifyError(makeError({ statusCode: 500 }))
    expect(result).toMatchObject({ type: 'toast', severity: 'error', title: 'Error del servidor' })
  })

  it('returns error toast as generic fallback', () => {
    const result = classifyError(makeError({ statusCode: 418, message: 'Teapot' }))
    expect(result).toMatchObject({ type: 'toast', severity: 'error', description: 'Teapot' })
  })
})

describe('getStockDetails', () => {
  it('returns empty array for non-INSUFFICIENT_STOCK codes', () => {
    expect(getStockDetails(makeError({ code: 'OTHER_CODE' }))).toEqual([])
  })

  it('returns empty array when details is null', () => {
    expect(getStockDetails(makeError({ code: API_CODES.INSUFFICIENT_STOCK, details: null }))).toEqual([])
  })

  it('returns empty array when details is not an array', () => {
    expect(getStockDetails(makeError({ code: API_CODES.INSUFFICIENT_STOCK, details: {} }))).toEqual([])
  })

  it('returns details array for INSUFFICIENT_STOCK', () => {
    const details = [{ product_id: 'p1', product_name: 'X', available: 0, requested: 1 }]
    expect(getStockDetails(makeError({ code: API_CODES.INSUFFICIENT_STOCK, details }))).toEqual(details)
  })
})
