
import { describe, it, expect } from 'vitest'

import {
  ruleMatchesItem,
  calculateDiscountAmount,
  applyDiscounts,
  processCart,
  cartTotal,
  calculateCartDiscount,
} from './discountEngine.js'

const item = {
  itemId: 'TEST-001',
  product: 'Wireless Earbuds',
  brand: 'Boat',
  platform: 'Flipkart',
  basePrice: 1000,
}

describe('Discount Engine', () => {

  // TEST 1: Brand and platform matching
  it('matches brand and platform without case sensitivity', () => {
    expect(
      ruleMatchesItem(item, {
        scope: 'brand',
        appliesTo: 'boat',
      })
    ).toBe(true)

    expect(
      ruleMatchesItem(item, {
        scope: 'platform',
        appliesTo: 'FLIPKART',
      })
    ).toBe(true)
  })

  // TEST 2: Percentage and flat discount calculations
  it('calculates percentage and flat discounts correctly', () => {
    expect(
      calculateDiscountAmount(1000, {
        type: 'percentage',
        value: 10,
      })
    ).toBe(100)

    expect(
      calculateDiscountAmount(1000, {
        type: 'flat',
        value: 300,
      })
    ).toBe(300)
  })

  // TEST 3: No matching offer
  it('returns the original price when no offer matches', () => {
    const result = applyDiscounts(item, [])

    expect(result.finalPrice).toBe(1000)
    expect(result.totalDiscount).toBe(0)
    expect(result.appliedRules).toEqual([])
    expect(result.reasoning).toBe('No offers available')
  })

  // TEST 4: Highest rupee savings wins
  it('selects the non-stackable offer with the highest rupee savings', () => {
    const rules = [
      {
        ruleId: 'RULE-15',
        scope: 'platform',
        appliesTo: 'Flipkart',
        type: 'percentage',
        value: 15,
        stackable: false,
      },
      {
        ruleId: 'RULE-300',
        scope: 'brand',
        appliesTo: 'Boat',
        type: 'flat',
        value: 300,
        stackable: false,
      },
    ]

    const result = applyDiscounts(item, rules)

    expect(result.finalPrice).toBe(700)
    expect(result.appliedRules).toEqual(['RULE-300'])
    expect(result.skippedRules).toEqual(['RULE-15'])
  })

  // TEST 5: Stackable offer without a non-stackable offer
  it('applies a stackable offer even without a non-stackable offer', () => {
    const rules = [
      {
        ruleId: 'RULE-STACK',
        scope: 'platform',
        appliesTo: 'Flipkart',
        type: 'percentage',
        value: 10,
        stackable: true,
      },
    ]

    const result = applyDiscounts(item, rules)

    expect(result.finalPrice).toBe(900)
    expect(result.totalDiscount).toBe(100)
    expect(result.appliedRules).toEqual(['RULE-STACK'])
  })

  // TEST 6: Non-stackable followed by stackable discount
  it('applies stackable discounts after the winning non-stackable discount', () => {
    const rules = [
      {
        ruleId: 'RULE-BRAND',
        scope: 'brand',
        appliesTo: 'Boat',
        type: 'flat',
        value: 200,
        stackable: false,
      },
      {
        ruleId: 'RULE-PLATFORM',
        scope: 'platform',
        appliesTo: 'Flipkart',
        type: 'percentage',
        value: 10,
        stackable: true,
      },
    ]

    const result = applyDiscounts(item, rules)

    expect(result.finalPrice).toBe(720)
    expect(result.totalDiscount).toBe(280)
    expect(result.appliedRules).toEqual([
      'RULE-BRAND',
      'RULE-PLATFORM',
    ])
  })

  // TEST 7: Multiple cart items and subtotal
  it('processes multiple cart items and calculates their subtotal', () => {
    const cart = [
      item,
      {
        ...item,
        itemId: 'TEST-002',
        basePrice: 500,
      },
    ]

    const results = processCart(cart, [])

    expect(results).toHaveLength(2)
    expect(cartTotal(results)).toBe(1500)
  })

  // TEST 8: Cart offer below minimum threshold
  it('does not apply a cart offer below its minimum threshold', () => {
    const rules = [
      {
        ruleId: 'CART-10',
        scope: 'cart',
        type: 'percentage',
        value: 10,
        minCartValue: 4000,
        stackable: false,
      },
    ]

    const result = calculateCartDiscount(3999, rules)

    expect(result.discount).toBe(0)
    expect(result.finalTotal).toBe(3999)
    expect(result.appliedRules).toEqual([])
  })

  // TEST 9: Cart offer exactly at minimum threshold
  it('applies a cart offer when the subtotal exactly meets its threshold', () => {
    const rules = [
      {
        ruleId: 'CART-10',
        scope: 'cart',
        type: 'percentage',
        value: 10,
        minCartValue: 4000,
        stackable: false,
      },
    ]

    const result = calculateCartDiscount(4000, rules)

    expect(result.discount).toBe(400)
    expect(result.finalTotal).toBe(3600)
    expect(result.appliedRules).toEqual(['CART-10'])
  })

  // TEST 10: Stackable cart-level discounts
  it('applies stackable cart discounts after the winning cart discount', () => {
    const rules = [
      {
        ruleId: 'CART-10',
        scope: 'cart',
        type: 'percentage',
        value: 10,
        minCartValue: 4000,
        stackable: false,
      },
      {
        ruleId: 'CART-5',
        scope: 'cart',
        type: 'percentage',
        value: 5,
        minCartValue: 4000,
        stackable: true,
      },
    ]

    const result = calculateCartDiscount(4000, rules)

    // 10% of 4000 = 400; then 5% of 3600 = 180.
    expect(result.discount).toBe(580)
    expect(result.finalTotal).toBe(3420)
    expect(result.appliedRules).toEqual(['CART-10', 'CART-5'])
  })

})
