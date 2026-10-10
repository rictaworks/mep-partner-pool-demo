import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
import process from 'node:process';
import { resolve } from 'node:path';
export default defineConfig({
    testDir: '.', testMatch: '*.e2e.ts', timeout: 60000, expect: { timeout: 10000 }, workers: 1, fullyParallel: false,
    outputDir: '../../WORK/9/browser-results', reporter: [['list'], ['json', { outputFile: resolve('WORK/9/browser-results/results.json') }]],
    use: { baseURL: 'http://127.0.0.1:5173', headless: true, trace: 'retain-on-failure', screenshot: 'only-on-failure', launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? (!process.env.CI && existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined) } },
    projects: [{ name: 'desktop', use: { viewport: { width: 1280, height: 900 } } }, { name: 'mobile', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } }],
    webServer: [
        { command: 'npm run dev:api', url: 'http://127.0.0.1:8787/api/health', reuseExistingServer: !process.env.CI, timeout: 60000, env: { WRANGLER_SEND_METRICS: 'false', XDG_CONFIG_HOME: '/tmp/mep-wrangler-config', WRANGLER_LOG_PATH: '/tmp/mep-wrangler-logs' } },
        { command: 'npm run dev', url: 'http://127.0.0.1:5173', reuseExistingServer: !process.env.CI, timeout: 60000 },
    ],
});
