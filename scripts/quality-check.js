#!/usr/bin/env node

/**
 * Quality Assurance Script for LLM Interface
 * 
 * This script runs comprehensive quality checks including:
 * - Code linting and formatting
 * - Type safety verification
 * - Security vulnerability scanning
 * - Performance analysis
 * - Test coverage validation
 * - Bundle size analysis
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { createInterface } = require('readline');

class QualityChecker {
  constructor() {
    this.rootDir = path.resolve(__dirname, '..');
    this.checks = [];
    this.results = {
      passed: 0,
      failed: 0,
      warnings: 0,
      details: []
    };
  }

  async run() {
    console.log('🚀 Starting Quality Assurance Checks...\n');

    try {
      await this.checkPrerequisites();
      await this.runLinting();
      await this.runTypeChecking();
      await this.runSecurityAudit();
      await this.runTests();
      await this.checkCodeCoverage();
      await this.analyzeBundleSize();
      await this.checkPerformance();
      await this.validateDependencies();
      
      this.generateReport();
      
      if (this.results.failed > 0) {
        console.log('\n❌ Quality checks failed. Please fix the issues above.');
        process.exit(1);
      } else {
        console.log('\n✅ All quality checks passed!');
        process.exit(0);
      }
    } catch (error) {
      console.error('❌ Quality check script failed:', error.message);
      process.exit(1);
    }
  }

  async checkPrerequisites() {
    this.logStep('Checking Prerequisites');

    const requiredFiles = [
      'package.json',
      'tsconfig.json',
      '.eslintrc.js',
      'jest.config.js',
      'vite.config.ts'
    ];

    for (const file of requiredFiles) {
      const filePath = path.join(this.rootDir, file);
      if (!fs.existsSync(filePath)) {
        this.addFailure(`Required file missing: ${file}`);
      } else {
        this.addSuccess(`Found required file: ${file}`);
      }
    }

    // Check Node.js version
    try {
      const nodeVersion = execSync('node --version', { encoding: 'utf8' }).trim();
      const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
      
      if (majorVersion < 18) {
        this.addFailure(`Node.js version ${nodeVersion} is too old. Requires v18+`);
      } else {
        this.addSuccess(`Node.js version: ${nodeVersion}`);
      }
    } catch (error) {
      this.addFailure('Failed to check Node.js version');
    }
  }

  async runLinting() {
    this.logStep('Running Code Linting');

    try {
      // Frontend linting
      if (this.isDirectoryExists('frontend')) {
        const frontendResult = this.runCommand('cd frontend && npm run lint', 'Frontend ESLint');
        this.analyzeLintResults(frontendResult, 'Frontend');
      }

      // Backend linting
      if (this.isDirectoryExists('backend')) {
        const backendResult = this.runCommand('cd backend && npm run lint', 'Backend ESLint');
        this.analyzeLintResults(backendResult, 'Backend');
      }

      // Check prettier formatting
      if (fs.existsSync(path.join(this.rootDir, '.prettierrc'))) {
        const prettierResult = this.runCommand('npx prettier --check .', 'Prettier formatting');
        this.analyzeLintResults(prettierResult, 'Prettier');
      }
    } catch (error) {
      this.addFailure(`Linting failed: ${error.message}`);
    }
  }

  async runTypeChecking() {
    this.logStep('Running TypeScript Type Checking');

    // Frontend type checking
    if (this.isDirectoryExists('frontend')) {
      try {
        const frontendResult = this.runCommand('cd frontend && npm run type-check', 'Frontend TypeScript');
        if (frontendResult.includes('error')) {
          this.addFailure('Frontend TypeScript errors detected');
          this.addDetails('Frontend TypeScript', frontendResult);
        } else {
          this.addSuccess('Frontend TypeScript compilation successful');
        }
      } catch (error) {
        this.addFailure(`Frontend type checking failed: ${error.message}`);
      }
    }

    // Backend type checking
    if (this.isDirectoryExists('backend')) {
      try {
        const backendResult = this.runCommand('cd backend && npx tsc --noEmit', 'Backend TypeScript');
        this.addSuccess('Backend TypeScript compilation successful');
      } catch (error) {
        this.addFailure(`Backend type checking failed: ${error.message}`);
      }
    }
  }

  async runSecurityAudit() {
    this.logStep('Running Security Audit');

    try {
      // Frontend security audit
      if (this.isDirectoryExists('frontend')) {
        const frontendAudit = this.runCommand('cd frontend && npm audit --audit-level moderate', 'Frontend Security');
        this.analyzeSecurityAudit(frontendAudit, 'Frontend');
      }

      // Backend security audit
      if (this.isDirectoryExists('backend')) {
        const backendAudit = this.runCommand('cd backend && npm audit --audit-level moderate', 'Backend Security');
        this.analyzeSecurityAudit(backendAudit, 'Backend');
      }

      // Check for secrets
      this.checkForSecrets();
    } catch (error) {
      this.addFailure(`Security audit failed: ${error.message}`);
    }
  }

  async runTests() {
    this.logStep('Running Test Suite');

    // Frontend tests
    if (this.isDirectoryExists('frontend')) {
      try {
        const frontendTests = this.runCommand('cd frontend && npm test -- --run --reporter=json', 'Frontend Tests');
        this.analyzeTestResults(frontendTests, 'Frontend');
      } catch (error) {
        this.addFailure(`Frontend tests failed: ${error.message}`);
      }
    }

    // Backend tests
    if (this.isDirectoryExists('backend')) {
      try {
        const backendTests = this.runCommand('cd backend && npm test -- --coverage --coverageReporters=json', 'Backend Tests');
        this.analyzeTestResults(backendTests, 'Backend');
      } catch (error) {
        this.addFailure(`Backend tests failed: ${error.message}`);
      }
    }
  }

  async checkCodeCoverage() {
    this.logStep('Checking Code Coverage');

    const coverageThresholds = {
      statements: 80,
      branches: 80,
      functions: 80,
      lines: 80
    };

    if (this.isDirectoryExists('frontend')) {
      const frontendCoverage = path.join(this.rootDir, 'frontend', 'coverage', 'coverage-final.json');
      if (fs.existsSync(frontendCoverage)) {
        this.analyzeCoverageReport(frontendCoverage, 'Frontend', coverageThresholds);
      } else {
        this.addWarning('Frontend coverage report not found');
      }
    }

    if (this.isDirectoryExists('backend')) {
      const backendCoverage = path.join(this.rootDir, 'backend', 'coverage', 'coverage-final.json');
      if (fs.existsSync(backendCoverage)) {
        this.analyzeCoverageReport(backendCoverage, 'Backend', coverageThresholds);
      } else {
        this.addWarning('Backend coverage report not found');
      }
    }
  }

  async analyzeBundleSize() {
    this.logStep('Analyzing Bundle Size');

    if (this.isDirectoryExists('frontend')) {
      try {
        const buildResult = this.runCommand('cd frontend && npm run build', 'Frontend Build');
        
        const distDir = path.join(this.rootDir, 'frontend', 'dist');
        if (fs.existsSync(distDir)) {
          this.analyzeBuildSize(distDir);
        } else {
          this.addWarning('Frontend build directory not found');
        }
      } catch (error) {
        this.addFailure(`Bundle analysis failed: ${error.message}`);
      }
    }
  }

  async checkPerformance() {
    this.logStep('Checking Performance Metrics');

    // Check for performance anti-patterns
    this.checkPerformanceAntiPatterns();

    // Analyze bundle for performance
    if (this.isDirectoryExists('frontend')) {
      this.checkBundlePerformance();
    }
  }

  async validateDependencies() {
    this.logStep('Validating Dependencies');

    try {
      // Check for outdated dependencies
      if (this.isDirectoryExists('frontend')) {
        this.checkOutdatedDependencies('frontend');
      }

      if (this.isDirectoryExists('backend')) {
        this.checkOutdatedDependencies('backend');
      }

      // Check for unused dependencies
      this.checkUnusedDependencies();
    } catch (error) {
      this.addFailure(`Dependency validation failed: ${error.message}`);
    }
  }

  // Helper methods
  runCommand(command, description) {
    try {
      return execSync(command, { 
        encoding: 'utf8', 
        stdio: 'pipe',
        maxBuffer: 1024 * 1024 
      });
    } catch (error) {
      throw new Error(`Command failed: ${command}. ${error.message}`);
    }
  }

  isDirectoryExists(dir) {
    return fs.existsSync(path.join(this.rootDir, dir));
  }

  analyzeLintResults(result, context) {
    const lines = result.split('\n');
    const errors = lines.filter(line => line.includes('error') && !line.includes('npm'));
    const warnings = lines.filter(line => line.includes('warning') && !line.includes('npm'));

    if (errors.length > 0) {
      this.addFailure(`${context} has ${errors.length} linting errors`);
    } else {
      this.addSuccess(`${context} linting passed`);
    }

    if (warnings.length > 0) {
      this.addWarning(`${context} has ${warnings.length} linting warnings`);
    }
  }

  analyzeSecurityAudit(result, context) {
    if (result.includes('vulnerabilities found')) {
      const vulnerabilities = result.match(/(\d+)\s+vulnerabilities?/);
      if (vulnerabilities) {
        const count = parseInt(vulnerabilities[1]);
        if (count > 0) {
          this.addFailure(`${context} has ${count} security vulnerabilities`);
        }
      }
    } else {
      this.addSuccess(`${context} security audit passed`);
    }
  }

  analyzeTestResults(result, context) {
    try {
      const testOutput = JSON.parse(result);
      const passed = testOutput.numPassedTests || 0;
      const failed = testOutput.numFailedTests || 0;
      const total = testOutput.numTotalTests || 0;

      if (failed > 0) {
        this.addFailure(`${context} tests: ${failed}/${total} failed`);
      } else if (passed === 0) {
        this.addWarning(`${context} has no tests`);
      } else {
        this.addSuccess(`${context} tests: ${passed}/${total} passed`);
      }
    } catch (error) {
      // Fallback for non-JSON output
      if (result.includes('fail')) {
        this.addFailure(`${context} tests failed`);
      } else {
        this.addSuccess(`${context} tests passed`);
      }
    }
  }

  analyzeCoverageReport(coverageFile, context, thresholds) {
    try {
      const coverage = JSON.parse(fs.readFileSync(coverageFile, 'utf8'));
      const total = coverage.total;

      for (const [metric, value] of Object.entries(thresholds)) {
        const coverage = total[metric];
        const percentage = (coverage.pct || 0);

        if (percentage < value) {
          this.addFailure(`${context} ${metric} coverage: ${percentage.toFixed(1)}% < ${value}%`);
        } else {
          this.addSuccess(`${context} ${metric} coverage: ${percentage.toFixed(1)}%`);
        }
      }
    } catch (error) {
      this.addWarning(`Could not analyze ${context} coverage report`);
    }
  }

  analyzeBuildSize(distDir) {
    const totalSize = this.getDirectorySize(distDir);
    const sizeInMB = (totalSize / 1024 / 1024).toFixed(2);

    if (sizeInMB > 10) {
      this.addWarning(`Build size is large: ${sizeInMB}MB`);
    } else {
      this.addSuccess(`Build size acceptable: ${sizeInMB}MB`);
    }

    // Analyze individual files
    const files = this.getFilesBySize(distDir);
    const largestFiles = files.slice(0, 5);
    
    if (largestFiles.length > 0) {
      this.addDetails('Largest Files:', largestFiles.map(f => 
        `${path.basename(f.path)}: ${(f.size / 1024).toFixed(1)}KB`
      ));
    }
  }

  checkForSecrets() {
    const sensitivePatterns = [
      /password\s*=\s*['"]([^'"]+)['"]/i,
      /api_key\s*=\s*['"]([^'"]+)['"]/i,
      /secret\s*=\s*['"]([^'"]+)['"]/i,
      /token\s*=\s*['"]([^'"]+)['"]/i,
      /['"]AKIA[0-9A-Z]{16}['"]/, // AWS access key
      /['"][0-9a-f]{32}['"]/, // Potential API key
    ];

    const sensitiveFiles = [
      '**/.env*',
      '**/config/**/*.js',
      '**/config/**/*.ts',
      '**/*.env.example'
    ];

    for (const filePattern of sensitiveFiles) {
      const files = this.findFiles(filePattern);
      for (const file of files) {
        const content = fs.readFileSync(file, 'utf8');
        for (const pattern of sensitivePatterns) {
          if (pattern.test(content)) {
            this.addFailure(`Potential secret found in ${file}`);
          }
        }
      }
    }
  }

  checkPerformanceAntiPatterns() {
    // Check for common performance issues
    const patterns = [
      { pattern: /console\.log/, message: 'Console.log statements should be removed in production' },
      { pattern: /debugger/, message: 'Debugger statements should be removed' },
      { pattern: /setInterval.*\d+/, message: 'Potential unbounded setInterval' },
    ];

    const sourceFiles = this.findFiles('**/*.{ts,tsx,js,jsx}');

    for (const file of sourceFiles) {
      if (file.includes('node_modules') || file.includes('dist')) continue;
      
      const content = fs.readFileSync(file, 'utf8');
      for (const { pattern, message } of patterns) {
        if (pattern.test(content)) {
          this.addWarning(`${message}: ${file}`);
        }
      }
    }
  }

  checkBundlePerformance() {
    const packageJson = path.join(this.rootDir, 'frontend', 'package.json');
    if (fs.existsSync(packageJson)) {
      const pkg = JSON.parse(fs.readFileSync(packageJson, 'utf8'));
      
      // Check for performance-related packages
      const performancePackages = [
        'webpack-bundle-analyzer',
        'compression-webpack-plugin',
        '@vitejs/plugin-legacy'
      ];

      for (const pkgName of performancePackages) {
        if (pkg.devDependencies && pkg.devDependencies[pkgName]) {
          this.addSuccess(`Performance optimization package found: ${pkgName}`);
        }
      }
    }
  }

  checkOutdatedDependencies(context) {
    try {
      const result = this.runCommand(`cd ${context} && npm outdated --json`, 'Outdated Dependencies');
      
      if (result.trim()) {
        const outdated = JSON.parse(result);
        const count = Object.keys(outdated).length;
        
        if (count > 0) {
          this.addWarning(`${context} has ${count} outdated dependencies`);
          this.addDetails('Outdated packages', Object.keys(outdated));
        } else {
          this.addSuccess(`${context} dependencies are up to date`);
        }
      }
    } catch (error) {
      this.addWarning(`Could not check ${context} outdated dependencies`);
    }
  }

  checkUnusedDependencies() {
    // This would require additional tools like depcheck
    this.addWarning('Unused dependency check not implemented');
  }

  // Utility methods
  getDirectorySize(dirPath) {
    let totalSize = 0;
    const files = fs.readdirSync(dirPath);

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stats = fs.statSync(filePath);

      if (stats.isDirectory()) {
        totalSize += this.getDirectorySize(filePath);
      } else {
        totalSize += stats.size;
      }
    }

    return totalSize;
  }

  getFilesBySize(dirPath) {
    const files = [];
    
    const traverse = (currentPath) => {
      const items = fs.readdirSync(currentPath);
      
      for (const item of items) {
        const itemPath = path.join(currentPath, item);
        const stats = fs.statSync(itemPath);
        
        if (stats.isDirectory()) {
          traverse(itemPath);
        } else {
          files.push({ path: itemPath, size: stats.size });
        }
      }
    };

    traverse(dirPath);
    return files.sort((a, b) => b.size - a.size);
  }

  findFiles(pattern) {
    // Simple glob implementation
    const files = [];
    const parts = pattern.split('/**/');
    
    const traverse = (dir, remainingParts) => {
      if (remainingParts.length === 0) return;
      
      const [currentPart, ...rest] = remainingParts;
      
      try {
        const items = fs.readdirSync(dir);
        
        for (const item of items) {
          const itemPath = path.join(dir, item);
          const stats = fs.statSync(itemPath);
          
          if (stats.isDirectory() && pattern.includes('/**/')) {
            traverse(itemPath, remainingParts);
          } else if (this.matchesPattern(item, currentPart)) {
            if (rest.length === 0) {
              files.push(itemPath);
            }
          }
        }
      } catch (error) {
        // Directory doesn't exist or can't be read
      }
    };

    const rootDir = parts[0].replace('*', '');
    traverse(rootDir, parts);
    
    return files;
  }

  matchesPattern(filename, pattern) {
    const regex = new RegExp(
      '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
    );
    return regex.test(filename);
  }

  // Result tracking methods
  logStep(step) {
    console.log(`\n📋 ${step}`);
    console.log('─'.repeat(50));
  }

  addSuccess(message) {
    this.results.passed++;
    console.log(`✅ ${message}`);
  }

  addFailure(message) {
    this.results.failed++;
    console.log(`❌ ${message}`);
  }

  addWarning(message) {
    this.results.warnings++;
    console.log(`⚠️  ${message}`);
  }

  addDetails(title, details) {
    if (typeof details === 'string') {
      console.log(`   ${details}`);
    } else if (Array.isArray(details)) {
      console.log(`   ${title}:`);
      details.forEach(detail => console.log(`     - ${detail}`));
    }
  }

  generateReport() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 QUALITY CHECK SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Passed:  ${this.results.passed}`);
    console.log(`❌ Failed:  ${this.results.failed}`);
    console.log(`⚠️  Warnings: ${this.results.warnings}`);
    console.log('='.repeat(60));

    // Generate detailed report file
    const reportPath = path.join(this.rootDir, 'quality-report.json');
    const reportData = {
      timestamp: new Date().toISOString(),
      summary: {
        passed: this.results.passed,
        failed: this.results.failed,
        warnings: this.results.warnings,
        total: this.results.passed + this.results.failed + this.results.warnings
      },
      details: this.results.details
    };

    fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
    console.log(`📄 Detailed report saved to: ${reportPath}`);
  }
}

// Run the quality checker
if (require.main === module) {
  const checker = new QualityChecker();
  checker.run();
}

module.exports = QualityChecker;