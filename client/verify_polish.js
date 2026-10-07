import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'

const SCREENSHOT_DIR = '/Users/vishnuvardhan_1685/.gemini/antigravity-ide/brain/c6f1066f-bacc-4ed0-b2a9-813527e9e49f/screenshots'
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
}

const WIDTHS = [320, 375, 768, 1440]
const BASE_URL = 'http://localhost:5173'

async function runVerification() {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  })
  const context = await browser.newContext()
  const page = await context.newPage()

  console.log('--- STARTING VERIFICATION PASSTHROUGH ---')

  // 1. Check Login / Register Page at all widths
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 800 })
    await page.goto(`${BASE_URL}/login`)
    await page.waitForLoadState('networkidle')

    // Check horizontal scroll
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
    console.log(`[LOGIN @ ${width}px] clientWidth=${clientWidth}, scrollWidth=${scrollWidth}`)

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, `login_${width}.png`) })
  }

  // 2. Perform Login to reach Dashboard
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`${BASE_URL}/login`)
  await page.fill('#login-email', 'testuser@example.com')
  await page.fill('#login-password', 'Password123!')
  
  // If user doesn't exist, try signup
  await page.click('#login-submit')
  await page.waitForTimeout(1000)

  if (page.url().includes('/login')) {
    // Navigate to signup
    await page.goto(`${BASE_URL}/signup`)
    await page.fill('input[placeholder="Name"]', 'Verification Tester')
    await page.fill('input[placeholder="Email"]', `test-${Date.now()}@example.com`)
    await page.fill('input[placeholder="Password"]', 'Password123!')
    await page.click('button[type="submit"]')
    await page.waitForNavigation()
  }

  console.log('Logged in successfully. Current URL:', page.url())

  // 3. Verify Dashboard Page at all widths
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 800 })
    await page.goto(`${BASE_URL}/dashboard`)
    await page.waitForLoadState('networkidle')

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
    console.log(`[DASHBOARD @ ${width}px] clientWidth=${clientWidth}, scrollWidth=${scrollWidth}`)

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, `dashboard_${width}.png`) })
  }

  // 4. Create a room to test Editor Page
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`${BASE_URL}/dashboard`)
  const testRoomName = `Test Room ${Date.now()}`
  await page.fill('#dashboard-create-room-input', testRoomName)
  await page.click('form button[type="submit"]')
  await page.waitForTimeout(1500)

  console.log('Entered room. Current URL:', page.url())

  // 5. Verify Editor Page at all widths
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 800 })
    await page.waitForTimeout(500)

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
    console.log(`[EDITOR @ ${width}px] clientWidth=${clientWidth}, scrollWidth=${scrollWidth}`)

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, `editor_${width}.png`) })
  }

  // 6. Verify 404 Page
  await page.goto(`${BASE_URL}/non-existent-route-xyz`)
  await page.waitForLoadState('networkidle')
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, `not_found_1440.png`) })

  await browser.close()
  console.log('--- VERIFICATION COMPLETE --- Screenshots saved to:', SCREENSHOT_DIR)
}

runVerification().catch((err) => {
  console.error('Verification failed:', err)
  process.exit(1)
})
