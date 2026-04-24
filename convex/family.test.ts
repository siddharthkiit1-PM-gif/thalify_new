import { describe, it, expect } from 'vitest'
import { INDIAN_FOODS } from './data/indianFoods'

type Goal = 'lose' | 'maintain' | 'diabetes' | 'gain'
type Action = 'keep' | 'reduce' | 'skip' | 'add'

function optimizePlate(
  dishes: string[],
  goal: Goal,
  _calorieGoal: number,
): { name: string; action: Action; recommendation: string; cal: number }[] {
  const result: { name: string; action: Action; recommendation: string; cal: number }[] = []
  let totalProtein = 0
  let carbCount = 0

  for (const dish of dishes) {
    const food = INDIAN_FOODS[dish.toLowerCase().replace(/ /g, '_')]
    if (!food) {
      result.push({ name: dish, action: 'keep', recommendation: "We don't recognise this dish yet — keeping as-is.", cal: 0 })
      continue
    }
    if (food.category === 'carb') carbCount++
    totalProtein += food.protein
  }

  for (const dish of dishes) {
    const key = dish.toLowerCase().replace(/ /g, '_')
    const food = INDIAN_FOODS[key]
    if (!food) continue

    let action: Action = 'keep'
    let recommendation = 'Good choice — keep this.'

    if ((goal === 'lose' || goal === 'diabetes') && food.category === 'carb' && carbCount > 1) {
      action = 'reduce'
      recommendation = 'Reduce to half portion to stay within carb limit.'
    } else if (food.category === 'fat' && goal === 'lose') {
      action = 'reduce'
      recommendation = 'Use sparingly — 1 tsp max.'
    }

    result.push({ name: dish, action, recommendation, cal: food.cal })
  }

  if (totalProtein < 20) {
    result.push({ name: 'Cucumber Raita', action: 'add', recommendation: 'Add raita for protein and probiotics.', cal: INDIAN_FOODS['raita'].cal })
  }

  return result
}

describe('optimizePlate', () => {
  it('marks second carb as reduce for lose goal', () => {
    const result = optimizePlate(['roti', 'rice', 'dal'], 'lose', 1600)
    const riceEntry = result.find(r => r.name === 'rice')
    expect(riceEntry?.action).toBe('reduce')
  })

  it('adds raita when protein is low', () => {
    const result = optimizePlate(['roti', 'aloo_gobi'], 'maintain', 1900)
    expect(result.find(r => r.name === 'Cucumber Raita')).toBeDefined()
  })

  it('keeps all dishes for gain goal', () => {
    const result = optimizePlate(['roti', 'rice', 'chicken'], 'gain', 2300)
    const rotiEntry = result.find(r => r.name === 'roti')
    expect(rotiEntry?.action).toBe('keep')
  })
})
