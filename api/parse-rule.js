
const RULE_SCHEMA = {
  type: "object",
  properties: {
    valid: { type: "boolean" },
    clarification: { type: "string" },
    scope: {
      type: "string",
      enum: ["brand", "platform", "cart", ""],
    },
    applies_to: { type: "string" },
    type: {
      type: "string",
      enum: ["percentage", "flat", ""],
    },
    value: { type: "number" },
    stackable: { type: "boolean" },
    min_cart_value: { type: "number" },
  },
  required: [
    "valid",
    "clarification",
    "scope",
    "applies_to",
    "type",
    "value",
    "stackable",
    "min_cart_value",
  ],
  additionalProperties: false,
};

function validateRule(rule) {
  if (!rule || typeof rule !== "object") {
    return "The AI returned an invalid rule.";
  }

  if (rule.valid !== true) {
    return (
      rule.clarification ||
      "The discount description is incomplete. Please clarify it."
    );
  }

  if (!["brand", "platform", "cart"].includes(rule.scope)) {
    return "Please specify whether this is a brand, platform, or cart discount.";
  }

  if (!["percentage", "flat"].includes(rule.type)) {
    return "Please specify a percentage or flat discount.";
  }

  if (
    typeof rule.value !== "number" ||
    !Number.isFinite(rule.value) ||
    rule.value <= 0
  ) {
    return "The discount value must be greater than zero.";
  }

  if (rule.type === "percentage" && rule.value > 100) {
    return "Percentage discounts cannot exceed 100%.";
  }

  if (typeof rule.stackable !== "boolean") {
    return "Please specify whether the discount is stackable.";
  }

  if (
    typeof rule.min_cart_value !== "number" ||
    !Number.isFinite(rule.min_cart_value) ||
    rule.min_cart_value < 0
  ) {
    return "The minimum cart value must be a valid non-negative number.";
  }

  if (rule.scope === "cart") {
    if (rule.applies_to !== "") {
      return "Cart discounts must apply to the entire cart.";
    }

    if (rule.min_cart_value <= 0) {
      return "Please specify a minimum cart value greater than zero.";
    }
  } else {
    if (
      typeof rule.applies_to !== "string" ||
      !rule.applies_to.trim()
    ) {
      return "Please specify the brand or platform this discount applies to.";
    }

    if (rule.min_cart_value !== 0) {
      return "Brand and platform discounts cannot have a minimum cart value.";
    }
  }

  return null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed. Use POST.",
    });
  }

  const apiKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL || "openai/gpt-oss-20b";

  if (!apiKey) {
    return res.status(500).json({
      error: "GROQ_API_KEY is not configured.",
    });
  }

  const description =
    req.body?.description ||
    req.body?.prompt ||
    req.body?.text;

  if (
    typeof description !== "string" ||
    !description.trim()
  ) {
    return res.status(400).json({
      error: "Please provide a discount description.",
    });
  }

  if (description.trim().length > 1000) {
    return res.status(400).json({
      error: "The description cannot exceed 1000 characters.",
    });
  }

  const systemPrompt = `
You are a discount rule extraction assistant for an e-commerce
discount engine.

Convert the user's description into exactly ONE discount rule.

Supported scopes:
- brand
- platform
- cart

Supported discount types:
- percentage
- flat

Important instructions:

1. Extract only information explicitly provided by the user.
2. Never invent discount values, brands, platforms, or thresholds.
3. Percentage discounts must be greater than 0 and at most 100.
4. Flat discounts must be greater than 0.
5. Brand rules must specify a brand.
6. Platform rules must specify a platform.
7. Cart rules must specify an exact minimum cart value greater than 0.
8. For cart rules, applies_to must be an empty string.
9. For non-cart rules, min_cart_value must be 0.
10. The user must explicitly specify whether the rule is stackable.
11. If essential information is missing or ambiguous, valid must be false.
12. Never guess missing information.
13. Do not create multiple rules from one description.

For invalid or ambiguous descriptions, return:
- valid: false
- clarification: a clear question explaining what is missing
- scope: ""
- applies_to: ""
- type: ""
- value: 0
- stackable: false
- min_cart_value: 0

For valid descriptions, return:
- valid: true
- clarification: ""
- all remaining fields populated correctly.

Return only JSON matching the required schema.
`;

  try {
    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content: systemPrompt,
            },
            {
              role: "user",
              content: description.trim(),
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "discount_rule",
              strict: true,
              schema: RULE_SCHEMA,
            },
          },
          temperature: 0.2,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Groq API error:", data);

      return res.status(502).json({
        error:
          data.error?.message ||
          "Groq API request failed.",
      });
    }

    const content =
      data.choices?.[0]?.message?.content;

    if (!content) {
      return res.status(502).json({
        error: "Groq returned an empty response.",
      });
    }

    let rule;

    try {
      rule = JSON.parse(content);
    } catch {
      return res.status(502).json({
        error: "Groq returned an invalid response. Please try again.",
      });
    }

    const validationError = validateRule(rule);

    if (validationError) {
      return res.status(422).json({
        error: validationError,
      });
    }

    return res.status(200).json({ rule });
  } catch (error) {
    console.error("Rule parsing error:", error);

    return res.status(500).json({
      error: "Failed to generate the discount rule.",
    });
  }
}
