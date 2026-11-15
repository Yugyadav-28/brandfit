#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');

// Find a node binary that supports --experimental-strip-types (Node 22+)
function getNodeBinary() {
  const currentMajor = parseInt(process.versions.node.split('.')[0], 10);
  if (currentMajor >= 22) {
    return process.execPath;
  }

  // Look in nvm versions if available
  try {
    const homedir = os.homedir();
    const nvmDir = path.join(homedir, '.nvm', 'versions', 'node');
    if (fs.existsSync(nvmDir)) {
      const versions = fs.readdirSync(nvmDir).filter((v) => v.startsWith('v'));
      versions.sort((a, b) => {
        const parse = (v) => v.replace(/^v/, '').split('.').map(Number);
        const [aMaj = 0, aMin = 0, aPat = 0] = parse(a);
        const [bMaj = 0, bMin = 0, bPat = 0] = parse(b);
        if (bMaj !== aMaj) return bMaj - aMaj;
        if (bMin !== aMin) return bMin - aMin;
        return bPat - aPat;
      });

      for (const v of versions) {
        const major = parseInt(v.replace(/^v/, '').split('.')[0], 10);
        if (major >= 22) {
          const bin = path.join(nvmDir, v, 'bin', 'node');
          if (fs.existsSync(bin)) {
            return bin;
          }
        }
      }
    }
  } catch {
    // Ignore error and fall back
  }

  // Check common Homebrew / local paths
  const candidatePaths = ['/opt/homebrew/bin/node', '/usr/local/bin/node'];
  for (const p of candidatePaths) {
    try {
      if (fs.existsSync(p)) {
        const res = spawnSync(p, ['-v'], { encoding: 'utf8' });
        if (res.status === 0) {
          const major = parseInt(
            res.stdout.trim().replace(/^v/, '').split('.')[0],
            10
          );
          if (major >= 22) {
            return p;
          }
        }
      }
    } catch {
      // ignore
    }
  }

  return process.execPath;
}

const TESTS = [
  { name: 'test-insights', file: 'scripts/test-insights.ts' },
  { name: 'test-media', file: 'scripts/test-media.ts' },
  { name: 'test-color', file: 'scripts/test-color.ts' },
  { name: 'test-team-activity', file: 'scripts/test-team-activity.ts' },
  { name: 'test-safe-suggestion', file: 'scripts/test-safe-suggestion.ts' },
];

async function main() {
  const nodeBin = getNodeBinary();
  console.log(`Using node binary: ${nodeBin}`);
  console.log(`Running ${TESTS.length} tests (one after another)...\n`);

  const results = [];
  const suiteStartTime = Date.now();

  for (let i = 0; i < TESTS.length; i++) {
    const test = TESTS[i];
    const testHeader = `[${i + 1}/${TESTS.length}] Running ${test.name} (${test.file})`;
    console.log('='.repeat(70));
    console.log(testHeader);
    console.log('='.repeat(70));

    const startTime = Date.now();
    const run = spawnSync(
      nodeBin,
      ['--no-warnings', '--experimental-strip-types', test.file],
      {
        cwd: rootDir,
        stdio: 'inherit',
        env: { ...process.env },
      }
    );
    const duration = Date.now() - startTime;
    const passed = run.status === 0;

    results.push({
      ...test,
      passed,
      status: run.status,
      signal: run.signal,
      duration,
    });

    console.log(
      `\n>>> Result: ${test.name} -> ${passed ? 'PASSED ✅' : 'FAILED ❌'} (${duration}ms)\n`
    );
  }

  const totalDuration = Date.now() - suiteStartTime;
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.length - passedCount;

  console.log('\n' + '='.repeat(70));
  console.log('                        TEST RUN SUMMARY');
  console.log('='.repeat(70));

  for (const r of results) {
    const statusLabel = r.passed ? 'PASS ✅' : 'FAIL ❌';
    const durationLabel = `${r.duration}ms`.padStart(8);
    const nameLabel = r.name.padEnd(25);
    console.log(`  ${statusLabel}  ${nameLabel}  ${durationLabel}  (${r.file})`);
  }

  console.log('-'.repeat(70));
  console.log(
    `Total: ${results.length} | Passed: ${passedCount} | Failed: ${failedCount} | Total Duration: ${totalDuration}ms`
  );
  console.log('='.repeat(70));

  if (failedCount > 0) {
    console.error(`\n❌ Test suite failed: ${failedCount} test(s) failed.`);
    process.exit(1);
  } else {
    console.log(`\n✅ All ${passedCount} tests passed successfully!`);
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Test runner encountered an unexpected error:', err);
  process.exit(1);
});
