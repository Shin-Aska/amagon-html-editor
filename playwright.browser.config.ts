import {defineConfig} from '@playwright/test'

export default defineConfig({
    testDir: './tests/browser',
    workers: 1,
    timeout: 90_000,
    expect: {timeout: 10_000},
    outputDir: '.omo/evidence/browser-tests',
    reporter: 'list',
    use: {
        baseURL: 'http://127.0.0.1:5174',
        channel: 'chromium',
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure'
    },
    webServer: {
        command: 'npm run dev:web -- --host 127.0.0.1 --port 5174 --strictPort',
        url: 'http://127.0.0.1:5174',
        reuseExistingServer: !process.env.CI
    }
})
