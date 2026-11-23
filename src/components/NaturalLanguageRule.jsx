
import { useState } from 'react'

function validateRule(rule) {
  if (!rule || rule.valid !== true) {
    return rule?.clarification || 'The generated rule is invalid.'
  }

  if (!['brand', 'platform', 'cart'].includes(rule.scope)) {
    return 'Invalid discount scope.'
  }

  if (!['percentage', 'flat'].includes(rule.type)) {
    return 'Invalid discount type.'
  }

  if (
    typeof rule.value !== 'number' ||
    !Number.isFinite(rule.value) ||
    rule.value <= 0
  ) {
    return 'The discount value must be greater than zero.'
  }

  if (rule.type === 'percentage' && rule.value > 100) {
    return 'Percentage discounts cannot exceed 100%.'
  }

  if (typeof rule.stackable !== 'boolean') {
    return 'Please specify whether the discount is stackable.'
  }

  if (
    typeof rule.min_cart_value !== 'number' ||
    !Number.isFinite(rule.min_cart_value) ||
    rule.min_cart_value < 0
  ) {
    return 'Invalid minimum cart value.'
  }

  if (rule.scope === 'cart') {
    if (rule.applies_to !== '') {
      return 'Cart discounts must apply to the entire cart.'
    }

    if (rule.min_cart_value <= 0) {
      return 'Please specify a minimum cart value greater than zero.'
    }
  } else {
    if (
      typeof rule.applies_to !== 'string' ||
      !rule.applies_to.trim()
    ) {
      return 'Please specify the brand or platform this discount applies to.'
    }

    if (rule.min_cart_value !== 0) {
      return 'Brand and platform discounts cannot have a minimum cart value.'
    }
  }

  return null
}

export default function NaturalLanguageRule({ onAddRule }) {
  const [description, setDescription] = useState('')
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleGenerate(event) {
    event.preventDefault()

    setError('')
    setPreview(null)

    if (!description.trim()) {
      setError('Please describe the discount rule first.')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/parse-rule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ description }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Could not generate the rule.')
      }

      const validationError = validateRule(data.rule)

      if (validationError) {
        throw new Error(validationError)
      }

      setPreview(data.rule)
    } catch (err) {
      setError(err.message || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  function handleConfirm() {
    if (!preview) return

    const validationError = validateRule(preview)

    if (validationError) {
      setError(validationError)
      setPreview(null)
      return
    }

    const newRule = {
      ruleId: `AI-${Date.now()}`,
      scope: preview.scope,
      appliesTo: preview.scope === 'cart' ? '' : preview.applies_to.trim(),
      type: preview.type,
      value: preview.value,
      stackable: preview.stackable,
      minCartValue:
        preview.scope === 'cart' ? preview.min_cart_value : null,
    }

    onAddRule(newRule)

    setPreview(null)
    setDescription('')
    setError('')
  }

  const inputStyle = {
    width: '100%',
    padding: '0.75rem',
    border: '1px solid #CECECE',
    borderRadius: 4,
    fontSize: 13,
    fontFamily: 'Arial, sans-serif',
    boxSizing: 'border-box',
    resize: 'vertical',
  }

  const buttonStyle = {
    background: '#131A48',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    padding: '0.65rem 1.2rem',
    fontSize: 12,
    fontWeight: 700,
    cursor: loading ? 'wait' : 'pointer',
  }

  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #CECECE',
        borderRadius: 6,
        padding: '1.2rem 1.4rem',
        marginBottom: '1.2rem',
      }}
    >
      <div
        style={{
          fontFamily: 'Georgia, serif',
          fontWeight: 700,
          fontSize: 14,
          color: '#131A48',
          marginBottom: '0.7rem',
          paddingBottom: 6,
          borderBottom: '2px solid #FF5800',
          display: 'inline-block',
        }}
      >
        Create Rule Using Natural Language
      </div>

      <form onSubmit={handleGenerate}>
        <label
          htmlFor="discount-description"
          style={{
            display: 'block',
            fontSize: 12,
            color: '#555',
            marginBottom: 6,
          }}
        >
          Describe the discount you want to create
        </label>

        <textarea
          id="discount-description"
          rows={3}
          value={description}
          onChange={(event) => {
            setDescription(event.target.value)
            setError('')
            setPreview(null)
          }}
          placeholder="Example: Give 15% discount on all products from Amazon India. This discount should not be stackable."
          style={inputStyle}
          maxLength={1000}
        />

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 8,
          }}
        >
          <span style={{ fontSize: 10, color: '#888' }}>
            {description.length}/1000 characters
          </span>

          <button
            type="submit"
            disabled={loading}
            style={{
              ...buttonStyle,
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? 'Generating...' : 'Generate Rule'}
          </button>
        </div>
      </form>

      {error && (
        <div
          style={{
            marginTop: 12,
            padding: 10,
            background: '#fff1f0',
            border: '1px solid #ffccc7',
            borderRadius: 4,
            color: '#b42318',
            fontSize: 12,
          }}
        >
          {error}
        </div>
      )}

      {preview && (
        <div
          style={{
            marginTop: 16,
            padding: 14,
            background: '#f7f7f9',
            border: '1px solid #ddd',
            borderRadius: 4,
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: '#131A48',
              marginBottom: 10,
            }}
          >
            Review Generated Rule
          </div>

          <div style={{ fontSize: 12, lineHeight: 2, color: '#333' }}>
            <div><strong>Scope:</strong> {preview.scope}</div>

            <div>
              <strong>Applies to:</strong>{' '}
              {preview.scope === 'cart'
                ? 'Entire cart'
                : preview.applies_to}
            </div>

            <div>
              <strong>Discount:</strong>{' '}
              {preview.type === 'percentage'
                ? `${preview.value}%`
                : `Rs.${preview.value}`}
            </div>

            <div>
              <strong>Stackable:</strong>{' '}
              {preview.stackable ? 'Yes' : 'No'}
            </div>

            {preview.scope === 'cart' && (
              <div>
                <strong>Minimum cart value:</strong>{' '}
                Rs.{preview.min_cart_value.toLocaleString('en-IN')}
              </div>
            )}
          </div>

          <div
            style={{
              display: 'flex',
              gap: 8,
              marginTop: 14,
              flexWrap: 'wrap',
            }}
          >
            <button
              type="button"
              onClick={handleConfirm}
              style={{
                ...buttonStyle,
                background: '#18733c',
              }}
            >
              Confirm and Add Rule
            </button>

            <button
              type="button"
              onClick={() => setPreview(null)}
              style={{
                ...buttonStyle,
                background: '#777',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
