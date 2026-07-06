export const selectors = {
  appRoot: '[data-testid="app-root"]',
  loginForm: 'form[action*="login"], form:has(input[type="password"])',
  dashboardRoot: '[data-testid="dashboard"], main',
  primaryContent: 'main, [role="main"]',
} as const;
