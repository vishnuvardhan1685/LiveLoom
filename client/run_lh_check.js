import { chromium } from 'playwright'

async function checkMetrics() {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  })
  const context = await browser.newContext()
  const page = await context.newPage()

  await page.goto('http://localhost:5173/dashboard')
  await page.waitForLoadState('networkidle')

  const accessibilityIssues = await page.evaluate(() => {
    const issues = []
    // Check buttons without aria-label or text
    document.querySelectorAll('button').forEach((b) => {
      if (!b.innerText.trim() && !b.getAttribute('aria-label') && !b.getAttribute('title')) {
        issues.push(`Button missing label: ${b.outerHTML}`)
      }
    })
    // Check inputs without label or aria-label
    document.querySelectorAll('input').forEach((i) => {
      if (!i.getAttribute('aria-label') && !i.getAttribute('placeholder') && !i.id) {
        issues.push(`Input missing label/id: ${i.outerHTML}`)
      }
    })
    return issues
  })

  console.log('Dashboard Accessibility Audit Issues count:', accessibilityIssues.length)
  if (accessibilityIssues.length > 0) {
    console.log(accessibilityIssues)
  }

  await browser.close()
}

checkMetrics().catch(console.error)
