#!/usr/bin/env node

// Quick test for HelixMind CLI
const { execSync } = require('child_process');
const path = require('path');

const helixmindPath = __dirname;

console.log('🧪 Testing HelixMind CLI...\n');

const tests = [
  { cmd: '--version', desc: 'Version check' },
  { cmd: '--help', desc: 'Help text' },
  { cmd: 'chat --help', desc: 'Chat command help' },
  { cmd: 'config --help', desc: 'Config command help' }
];

let passed = 0;
let failed = 0;

tests.forEach((test, i) => {
  process.stdout.write(`${i + 1}. ${test.desc}... `);
  
  try {
    const output = execSync(`node "${path.join(helixmindPath, 'dist', 'cli', 'index.js')}" ${test.cmd}`, {
      cwd: helixmindPath,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 10000
    });
    
    console.log('✅ OK');
    passed++;
    
    // Show first line of output for --help
    if (test.cmd.includes('--help')) {
      const firstLine = output.split('\n')[0];
      console.log(`   "${firstLine.slice(0, 60)}..."`);
    }
    
  } catch (error) {
    console.log('❌ FAILED');
    console.log(`   Error: ${error.message.slice(0, 50)}`);
    failed++;
  }
});

console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  console.log('\n💡 Troubleshooting:');
  console.log('   1. Run: npm run build');
  console.log('   2. Check: dist/cli/index.js exists');
  console.log('   3. Try: node src/cli/index.ts --help');
  process.exit(1);
}

console.log('\n🎉 All tests passed! CLI is working correctly.');
