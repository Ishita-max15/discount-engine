/**
 * Pure discount calculation engine.
 *
 * Processing order:
 * 1. Apply the best eligible non-stackable item rule.
 * 2. Apply eligible stackable item rules.
 * 3. Calculate the discounted cart subtotal.
 * 4. Apply eligible cart-level rules separately.
 */

/**
 * Check whether an item-level rule matches an item.
 */
export function ruleMatchesItem(item, rule) {
  const normalise = (value) => value.trim().toLowerCase()

  if (rule.scope === 'brand') {
    return normalise(item.brand) === normalise(rule.appliesTo)
  }

  if (rule.scope === 'platform') {
    return normalise(item.platform) === normalise(rule.appliesTo)
  }

  return false
}

/**
 * Calculate a discount in rupees.
 */
export function calculateDiscountAmount(price, rule) {
  if (rule.type === 'percentage') {
    return Math.round((price * rule.value) / 100)
  }

  if (rule.type === 'flat') {
    return Math.round(rule.value)
  }

  return 0
}

/**
 * Build a readable explanation of an applied rule.
 */
function ruleToReasoning(rule) {
  const scopeLabels = {
    brand: 'Brand',
    platform: 'Platform',
    cart: 'Cart',
  }

  const scopeLabel = scopeLabels[rule.scope] || 'Discount'

  if (rule.type === 'percentage') {
    return `${scopeLabel} offer: ${rule.value}% off`
  }

  if (rule.type === 'flat') {
    return `${scopeLabel} offer: Rs.${rule.value} off`
  }

  return `${scopeLabel} offer applied`
}

/**
 * Apply item-level rules to one item.
 */
export function applyDiscounts(item, rules) {
  const matchingRules = rules.filter(
    (rule) =>
      rule.scope !== 'cart' &&
      ruleMatchesItem(item, rule)
  )

  if (matchingRules.length === 0) {
    return {
      itemId: item.itemId,
      product: item.product,
      brand: item.brand,
      platform: item.platform,
      basePrice: item.basePrice,
      finalPrice: item.basePrice,
      totalDiscount: 0,
      appliedRules: [],
      skippedRules: [],
      reasoning: 'No offers available',
    }
  }

  const nonStackable = matchingRules.filter((rule) => !rule.stackable)
  const stackable = matchingRules.filter((rule) => rule.stackable)

  let winner = null
  let skipped = []

  if (nonStackable.length > 0) {
    const sorted = [...nonStackable].sort(
      (a, b) =>
        calculateDiscountAmount(item.basePrice, b) -
        calculateDiscountAmount(item.basePrice, a)
    )

    winner = sorted[0]
    skipped = sorted.slice(1)
  }

  let price = item.basePrice
  const appliedRules = []
  const reasoningParts = []

  if (winner) {
    const discount = Math.min(
      price,
      calculateDiscountAmount(price, winner)
    )

    price -= discount
    appliedRules.push(winner.ruleId)
    reasoningParts.push(ruleToReasoning(winner))
  }

  for (const rule of stackable) {
    const discount = Math.min(
      price,
      calculateDiscountAmount(price, rule)
    )

    price -= discount
    appliedRules.push(rule.ruleId)
    reasoningParts.push(ruleToReasoning(rule))
  }

  const finalPrice = Math.max(0, Math.round(price))

  return {
    itemId: item.itemId,
    product: item.product,
    brand: item.brand,
    platform: item.platform,
    basePrice: item.basePrice,
    finalPrice,
    totalDiscount: item.basePrice - finalPrice,
    appliedRules,
    skippedRules: skipped.map((rule) => rule.ruleId),
    reasoning: reasoningParts.join(' + '),
  }
}

/**
 * Apply item-level discounts to the complete cart.
 */
export function processCart(cartItems, rules) {
  return cartItems.map((item) => applyDiscounts(item, rules))
}

/**
 * Sum final item prices.
 * This is the subtotal BEFORE cart-level discounts.
 */
export function cartTotal(results) {
  return results.reduce((sum, result) => sum + result.finalPrice, 0)
}

/**
 * Calculate cart-level discounts separately.
 *
 * Non-stackable cart rules:
 * - Choose the rule providing the largest saving.
 *
 * Stackable cart rules:
 * - Apply after the winning non-stackable cart rule.
 *
 * Eligibility:
 * - The item-discounted subtotal must meet minCartValue.
 */
export function calculateCartDiscount(subtotal, rules) {
  const eligibleRules = rules.filter(
    (rule) =>
      rule.scope === 'cart' &&
      subtotal >= rule.minCartValue
  )

  if (eligibleRules.length === 0) {
    return {
      subtotal,
      discount: 0,
      finalTotal: subtotal,
      appliedRules: [],
      skippedRules: [],
      reasoning: 'No cart offers available',
    }
  }

  const nonStackable = eligibleRules.filter((rule) => !rule.stackable)
  const stackable = eligibleRules.filter((rule) => rule.stackable)

  let winner = null
  let skipped = []

  if (nonStackable.length > 0) {
    const sorted = [...nonStackable].sort(
      (a, b) =>
        calculateDiscountAmount(subtotal, b) -
        calculateDiscountAmount(subtotal, a)
    )

    winner = sorted[0]
    skipped = sorted.slice(1)
  }

  let finalTotal = subtotal
  const appliedRules = []
  const reasoningParts = []

  if (winner) {
    const discount = Math.min(
      finalTotal,
      calculateDiscountAmount(finalTotal, winner)
    )

    finalTotal -= discount
    appliedRules.push(winner.ruleId)
    reasoningParts.push(ruleToReasoning(winner))
  }

  for (const rule of stackable) {
    const discount = Math.min(
      finalTotal,
      calculateDiscountAmount(finalTotal, rule)
    )

    finalTotal -= discount
    appliedRules.push(rule.ruleId)
    reasoningParts.push(ruleToReasoning(rule))
  }

  finalTotal = Math.max(0, Math.round(finalTotal))

  return {
    subtotal,
    discount: subtotal - finalTotal,
    finalTotal,
    appliedRules,
    skippedRules: skipped.map((rule) => rule.ruleId),
    reasoning: reasoningParts.join(' + ') || 'No cart offers available',
  }
}
