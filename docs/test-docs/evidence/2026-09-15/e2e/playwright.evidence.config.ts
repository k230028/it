// it-test-doc 실행기가 생성한 래퍼 설정. 원본은 it_frontend/playwright.config.ts이며 스크린샷만 항상 켠다.
import path from 'node:path';
import base from 'C:/it/it_frontend/playwright.config';

export default {
    ...base,
    testDir: 'C:/it/it_frontend/tests/e2e',
    outputDir: 'C:/it/docs/test-docs/evidence/2026-09-15/e2e/artifacts',
    reporter: [['list'], ['json', { outputFile: 'C:/it/docs/test-docs/evidence/2026-09-15/e2e/playwright-results.json' }]],
    use: { ...base.use, screenshot: 'on', trace: 'off', video: 'off' },
    webServer: { ...base.webServer, cwd: 'C:/it/it_frontend' },
};
