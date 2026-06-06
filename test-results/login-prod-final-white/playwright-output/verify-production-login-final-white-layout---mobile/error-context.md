# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: verify.spec.js >> production login final white layout - mobile
- Location: ../../../../private/tmp/carfact-login-prod-verify/verify.spec.js:13:3

# Error details

```
Error: expect(locator).toHaveCSS(expected) failed

Locator: locator('section[aria-label="로그인"]')
Expected: "rgb(255, 255, 255)"
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toHaveCSS" with timeout 5000ms
  - waiting for locator('section[aria-label="로그인"]')

```

```yaml
- link "Skip to content":
  - /url: "#geist-skip-nav"
- banner:
  - link "Vercel logo":
    - /url: /home
    - button "Vercel Logo":
      - img "Vercel Logo"
  - navigation:
    - navigation:
      - link "Sign Up":
        - /url: /signup?next=%2Fsso-api%3Furl%3Dhttps%253A%252F%252Fcarfact-7acqsztzu-carfact-s-projects.vercel.app%252Flogin%26nonce%3Dc9d46d4499b1b3ed4b55cc5bc14cb7180407744602be1024f5ec20e03237798e
        - paragraph: Sign Up
- main:
  - heading "Log in to Vercel" [level=1]
  - textbox "Email Address"
  - button "Continue with Email"
  - button "Continue with Google":
    - img
    - text: Continue with Google
  - button "Continue with GitHub":
    - img
    - text: Continue with GitHub
  - button "Continue with Apple":
    - img
    - text: Continue with Apple
  - button "Continue with SAML SSO":
    - img
    - text: Continue with SAML SSO
  - button "Continue with Passkey":
    - img
    - text: Continue with Passkey
  - button "Show other options"
  - paragraph:
    - text: Don't have an account?
    - link "Sign Up":
      - /url: /signup?next=%2Fsso-api%3Furl%3Dhttps%253A%252F%252Fcarfact-7acqsztzu-carfact-s-projects.vercel.app%252Flogin%26nonce%3Dc9d46d4499b1b3ed4b55cc5bc14cb7180407744602be1024f5ec20e03237798e
  - link "Terms":
    - /url: /legal/terms
  - link "Privacy Policy":
    - /url: /legal/privacy-policy
- alert
- img
```

# Test source

```ts
  1  | const { test, expect } = require('@playwright/test');
  2  | const fs = require('fs');
  3  | const path = require('path');
  4  | 
  5  | const artifactDir = '/Users/sin/carfact/carfact-web/test-results/login-prod-final-white';
  6  | const prodUrl = process.env.PROD_URL;
  7  | const viewports = [
  8  |   { name: 'mobile', width: 390, height: 844 },
  9  |   { name: 'desktop', width: 1440, height: 1000 },
  10 | ];
  11 | 
  12 | for (const viewport of viewports) {
  13 |   test(`production login final white layout - ${viewport.name}`, async ({ page }) => {
  14 |     await page.setViewportSize({ width: viewport.width, height: viewport.height });
  15 |     await page.goto(prodUrl, { waitUntil: 'networkidle' });
  16 | 
  17 |     const section = page.locator('section[aria-label="로그인"]');
  18 |     const logo = page.locator('img[alt="CARFACT 로고"]');
  19 |     const kakao = page.getByRole('button', { name: '카카오 로그인' });
  20 |     const google = page.getByRole('button', { name: 'Google 로그인' });
  21 | 
> 22 |     await expect(section).toHaveCSS('background-color', 'rgb(255, 255, 255)');
     |                           ^ Error: expect(locator).toHaveCSS(expected) failed
  23 |     await expect(section).toHaveCSS('color', 'rgb(17, 17, 17)');
  24 |     await expect(page.locator('body')).not.toContainText('CARFACT');
  25 |     await expect(logo).toHaveCSS('object-fit', 'contain');
  26 |     await expect(kakao).toHaveCSS('height', '72px');
  27 |     await expect(google).toHaveCSS('height', '72px');
  28 |     await expect(google).toHaveCSS('background-color', 'rgb(243, 243, 243)');
  29 | 
  30 |     const metrics = await page.evaluate(() => {
  31 |       const img = document.querySelector('img[alt="CARFACT 로고"]');
  32 |       const buttons = [...document.querySelectorAll('button')];
  33 |       const [kakao, google] = buttons;
  34 |       const kakaoSvg = kakao?.querySelector('svg');
  35 |       const googleSvg = google?.querySelector('svg');
  36 |       const logoRect = img.getBoundingClientRect();
  37 |       const kakaoRect = kakao.getBoundingClientRect();
  38 |       const googleRect = google.getBoundingClientRect();
  39 | 
  40 |       return {
  41 |         url: location.href,
  42 |         viewport: { width: window.innerWidth, height: window.innerHeight },
  43 |         bodyText: document.body.innerText,
  44 |         logo: {
  45 |           src: img.getAttribute('src'),
  46 |           width: Math.round(logoRect.width),
  47 |           height: Math.round(logoRect.height),
  48 |           objectFit: getComputedStyle(img).objectFit,
  49 |         },
  50 |         kakao: {
  51 |           height: Math.round(kakaoRect.height),
  52 |           fontSize: getComputedStyle(kakao).fontSize,
  53 |           iconWidth: getComputedStyle(kakaoSvg).width,
  54 |           iconHeight: getComputedStyle(kakaoSvg).height,
  55 |           background: getComputedStyle(kakao).backgroundColor,
  56 |         },
  57 |         google: {
  58 |           height: Math.round(googleRect.height),
  59 |           fontSize: getComputedStyle(google).fontSize,
  60 |           iconWidth: getComputedStyle(googleSvg).width,
  61 |           iconHeight: getComputedStyle(googleSvg).height,
  62 |           background: getComputedStyle(google).backgroundColor,
  63 |         },
  64 |         horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  65 |       };
  66 |     });
  67 | 
  68 |     expect(metrics.horizontalOverflow).toBe(false);
  69 |     fs.mkdirSync(artifactDir, { recursive: true });
  70 |     fs.writeFileSync(path.join(artifactDir, `${viewport.name}-metrics.json`), JSON.stringify(metrics, null, 2));
  71 |     await page.screenshot({ path: path.join(artifactDir, `${viewport.name}.png`), fullPage: true });
  72 |   });
  73 | }
  74 | 
```