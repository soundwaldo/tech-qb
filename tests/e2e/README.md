# E2E Test Suite

Playwright end-to-end tests for GGuard critical user flows.

## Installation

Tests are already configured. Just install dependencies:

```bash
npm install
```

## Running Tests

### All Tests
```bash
npm test
```

### UI Mode (Interactive)
```bash
npm run test:ui
```

### Debug Mode
```bash
npm run test:debug
```

### View Report
```bash
npm run test:report
```

## Test Coverage

### Session Management (`session.spec.ts`)
- ✅ Session initialization on app load
- ✅ Session persistence across page navigation
- ✅ HttpOnly cookie validation
- ✅ SameSite protection

### Upload Form (`upload-form.spec.ts`)
- ✅ Step 1: Property information validation
- ✅ Zip code format validation
- ✅ Problem selection requirements
- ✅ Required field validation
- ✅ Responsive design

### API Authentication (`api-auth.spec.ts`)
- ✅ Session token initialization
- ✅ Reject requests without session
- ✅ Accept requests with valid cookies
- ✅ Malformed request handling
- ✅ CORS compliance

### File Upload (`file-upload.spec.ts`)
- ✅ File type validation
- ✅ Unsupported type error handling
- ✅ Retry mechanism
- ✅ File size constraints

### Checkout Flow (`checkout.spec.ts`)
- ✅ Checkout API authentication
- ✅ Email format validation
- ✅ Assessment ID validation
- ✅ Error handling
- ✅ Response headers

## Configuration

Tests are configured in `playwright.config.ts`:

- **Base URL**: `http://localhost:3000` (or `PLAYWRIGHT_TEST_BASE_URL`)
- **Browsers**: Chromium, Firefox, WebKit
- **Screenshot on failure**: Enabled
- **Trace on failure**: Enabled
- **Dev server**: Auto-starts on `npm run dev`

## CI/CD Integration

For GitHub Actions or other CI:

```bash
npm test
```

The test suite will:
1. Start the dev server automatically
2. Run all tests in a single worker (deterministic)
3. Retry failed tests up to 2 times
4. Generate HTML report in `playwright-report/`

## Key Features

- 🔒 **Session Security**: Validates HttpOnly cookies and CSRF protection
- 📁 **File Validation**: Tests magic number detection for malware prevention
- 💳 **Payment Flow**: Validates checkout API and Stripe integration
- 🔄 **Error Handling**: Tests graceful degradation and retry logic
- 📱 **Responsive**: Tests across desktop and mobile viewports

## Debugging

### Run Single Test
```bash
npx playwright test session.spec.ts
```

### Run Specific Test
```bash
npx playwright test session.spec.ts -g "should initialize session"
```

### Use Inspector
```bash
npm run test:debug
```

### View Trace
```bash
npx playwright show-trace test-results/trace.zip
```

## Troubleshooting

### Port 3000 already in use
```bash
lsof -i :3000  # Find process
kill -9 <PID>
```

### Tests timeout
- Increase timeout in playwright.config.ts
- Check if app is running: `npm run dev`
- Check network connectivity

### Browser not found
```bash
npx playwright install
```

## Next Steps

- Add visual regression tests with `expect.toHaveScreenshot()`
- Add performance benchmarks
- Add accessibility tests with `@axe-core/playwright`
- Add load testing with Artillery or k6
