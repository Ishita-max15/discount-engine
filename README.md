# Opptra Discount Engine

A React-based discount engine developed as part of the Opptra Forward Deployed Engineer (FDE) internship assignment.

The application allows users to upload shopping carts and discount rules, calculate applicable discounts, generate discount rules using natural language, and extract cart information from PDF files.

## Features

### 1. Discount Calculation Engine
- Supports brand-level and platform-level discounts.
- Supports percentage-based and flat discounts.
- Selects the non-stackable discount offering the highest savings in rupees.
- Applies eligible stackable discounts after the winning non-stackable discount.
- Returns the original price when no offers match.

### 2. Cart-Level Discounts
- Supports cart-level percentage and flat discounts.
- Applies discounts when the cart subtotal meets the minimum purchase threshold.
- Calculates cart-level savings separately from item-level discounts.
- Supports stackable cart-level discounts.

### 3. CSV Upload
- Upload discount rules through CSV files.
- Upload shopping cart data through CSV files.
- Validates required fields and reports parsing errors.

### 4. Natural Language Discount Rule Generation
- Generate discount rules using natural language descriptions.
- Uses the Groq API to interpret user instructions.
- Supports percentage-based, flat, brand-level, platform-level and cart-level rules.
- Validates generated rules before allowing them to be added.
- Provides clarification when the requested rule is incomplete or ambiguous.

### 5. PDF Cart Upload
- Upload PDF files containing product and pricing information.
- Extracts product, brand, platform and base price information.
- Converts extracted information into cart items for discount calculation.
- Supports PDFs containing selectable text and structured tabular information.
- Scanned PDFs requiring OCR are not currently supported.

### 6. Automated Testing
- Uses Vitest for automated testing.
- Includes 10 test cases covering discount calculations, rule matching, discount stacking, cart processing and cart-level discount thresholds.

## Technology Stack

| Technology | Purpose |
|---|---|
| React | User interface |
| Vite | Development server and build tool |
| JavaScript | Application logic |
| PapaParse | CSV parsing |
| PDF.js | PDF text extraction |
| Groq API | Natural language rule generation |
| Vitest | Automated testing |
| Vercel | Deployment and API hosting |

## Project Structure

```text
discount-engine/
├── api/
│   └── parse-rule.js
├── public/
├── sample-data/
│   ├── cart.csv
│   └── rules.csv
├── src/
│   ├── components/
│   │   ├── CsvUploader.jsx
│   │   ├── DataTable.jsx
│   │   ├── ErrorBanner.jsx
│   │   ├── NaturalLanguageRule.jsx
│   │   └── PdfCartUploader.jsx
│   ├── engine/
│   │   ├── csvParser.js
│   │   ├── discountEngine.js
│   │   └── discountEngine.test.js
│   ├── App.jsx
│   ├── index.css
│   └── main.jsx
├── .env.local
├── .gitignore
├── package.json
├── package-lock.json
├── vite.config.js
└── README.md
```

## Installation and Setup

### Prerequisites
- Node.js
- npm
- Groq API key (required for natural language rule generation)

### 1. Clone the repository

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
cd discount-engine
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env.local` file in the project root:

```env
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=your_supported_groq_model
```

Replace the placeholder values with your actual Groq API credentials and supported model.

**Important:** Never commit `.env.local` or expose your API key in the frontend or public repository.

### 4. Start the application

For the frontend-only development server:

```bash
npm run dev
```

For the complete application, including the natural-language API endpoint, use:

```bash
npx vercel dev --listen 3011
```

Open:

```text
http://localhost:3011
```

The Vercel development server runs the frontend and the API endpoint together.

## How to Use

### CSV-based discount calculation

1. Upload `sample-data/rules.csv` as the discount rules input.
2. Upload `sample-data/cart.csv` as the shopping cart input.
3. Click **Calculate Discounts**.
4. Review the applied offers, savings and final cart total.

### Natural Language Rule Generation

1. Enter a discount instruction in natural language.
2. Submit the instruction for processing.
3. Review the generated rule.
4. Confirm and add the validated rule to the discount rules list.

### PDF Cart Upload

1. Upload a supported PDF containing product information.
2. Allow the application to extract the product details.
3. Review the extracted cart items.
4. Use the extracted cart for discount calculation.

## CSV Formats

### Discount Rules CSV

| Column | Description | Example |
|---|---|---|
| rule_id | Unique rule identifier | RULE-01 |
| scope | Discount scope | brand / platform / cart |
| applies_to | Brand or platform target; blank for cart rules | Amazon India |
| type | Discount type | percentage / flat |
| value | Discount value | 15 |
| stackable | Whether the rule can be combined with other eligible discounts | true / false |
| min_cart_value | Minimum cart subtotal required for cart-level rules | 4000 |

For item-level rules, `min_cart_value` is not applicable. Cart