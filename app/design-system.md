# 🎨 Design System (Light Theme)

## 1. Color Palette

### Core Colors

    :root {
      /* Primary */
      --color-primary: #B41F3C;
      --color-primary-hover: #9E1B35;
      --color-primary-active: #7F162A;

      /* Background */
      --color-bg: #FFFFFF;
      --color-surface: #F5F5F5;
      --color-surface-alt: #E3E3E3;

      /* Text */
      --color-text-primary: #000000;
      --color-text-secondary: #555555;
      --color-text-muted: #888888;
      --color-text-inverse: #FFFFFF;

      /* Accent */
      --color-accent-light: #DD4C68;
      --color-accent-muted: #D6A6A7;
      --color-accent-dark: #B74E4E;

      /* Borders */
      --color-border: #E3E3E3;
      --color-border-strong: #C1C1C1;

      /* States */
      --color-success: #2E7D32;
      --color-warning: #ED6C02;
      --color-error: #D32F2F;
    }

---

## 2. Usage Guidelines

### Primary Color (#B41F3C)
- Use for CTAs, links, active states
- Keep usage under ~15%

### Neutral Colors
- Dominant (~80–90%)
- Keep UI clean and readable

### Accent Colors
- Use sparingly for highlights, tags, badges

---

## 3. Typography

### Font Stack

    --font-sans: "Inter", "SF Pro Display", "Segoe UI", Roboto, sans-serif;
    --font-mono: "JetBrains Mono", "Fira Code", monospace;

### Type Scale

    --text-xs: 12px;
    --text-sm: 14px;
    --text-md: 16px;
    --text-lg: 20px;
    --text-xl: 24px;
    --text-2xl: 32px;
    --text-3xl: 40px;

### Font Weights

    --weight-regular: 400;
    --weight-medium: 500;
    --weight-semibold: 600;
    --weight-bold: 700;

### Guidelines
- 500 for UI labels
- 600 for headings
- Line height ~1.5
- Avoid pure black for large text blocks

---

## 4. Spacing System

    --space-1: 4px;
    --space-2: 8px;
    --space-3: 16px;
    --space-4: 24px;
    --space-5: 32px;
    --space-6: 48px;
    --space-7: 64px;

### Rules
- Component padding: 16–24px
- Section spacing: 32–64px

---

## 5. Components

### Buttons

    .button-primary {
      background: var(--color-primary);
      color: var(--color-text-inverse);
      border-radius: 8px;
      padding: 12px 20px;
    }

    .button-primary:hover {
      background: var(--color-primary-hover);
    }

### Cards

    .card {
      background: var(--color-bg);
      border: 1px solid var(--color-border);
      border-radius: 12px;
      padding: 24px;
    }

### Inputs

    .input {
      border: 1px solid var(--color-border);
      padding: 12px;
      border-radius: 8px;
    }

    .input:focus {
      border-color: var(--color-primary);
      outline: none;
    }

---

## 6. Shadows

    --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
    --shadow-md: 0 4px 8px rgba(0,0,0,0.08);
    --shadow-lg: 0 10px 20px rgba(0,0,0,0.12);

---

## 7. Border Radius

    --radius-sm: 6px;
    --radius-md: 8px;
    --radius-lg: 12px;
    --radius-xl: 16px;

---

## 8. Design Principles

### Clarity First
- Every element must serve a purpose

### Strong Hierarchy
- Use size, weight, and color intentionally

### Consistency
- Reuse patterns

### Minimalism
- Use whitespace effectively

### Functional Color
- Primary = action
- Neutral = structure

### Accessibility
- Maintain contrast (WCAG AA)
- Don’t rely only on color

---

## 9. Visual Balance

- 80% neutral
- 15% structure
- 5% primary

---