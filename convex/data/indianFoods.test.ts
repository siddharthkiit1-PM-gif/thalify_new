import { describe, it, expect } from 'vitest'
import { INDIAN_FOODS } from './indianFoods'

describe('INDIAN_FOODS', () => {
  it('has at least 50 dishes', () => {
    expect(Object.keys(INDIAN_FOODS).length).toBeGreaterThanOrEqual(50)
  })
  it('dal has correct shape', () => {
    const dal = INDIAN_FOODS['dal']
    expect(dal).toBeDefined()
    expect(dal.cal).toBeGreaterThan(0)
    expect(dal.category).toBe('protein')
  })
  it('roti is a carb', () => {
    expect(INDIAN_FOODS['roti'].category).toBe('carb')
  })
})
