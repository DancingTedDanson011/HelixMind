import { describe, it, expect } from 'vitest';
import { classifyTask, type TaskClassification } from '../../../src/cli/validation/classifier.js';

describe('Task Classifier', () => {
  // ── Category Detection ──

  it('should classify UI component requests', () => {
    const result = classifyTask('Build a navbar component with dark theme');
    expect(result.category).toBe('ui_component');
  });

  it('should classify API endpoint requests', () => {
    const result = classifyTask('Create a REST API endpoint for /api/users');
    expect(result.category).toBe('api_endpoint');
  });

  it('should classify bug fix requests', () => {
    const result = classifyTask('Fix the bug where login button crashes');
    expect(result.category).toBe('bug_fix');
  });

  it('should classify German bug fix requests', () => {
    const result = classifyTask('Es funktioniert nicht, Fehler beim Login');
    expect(result.category).toBe('bug_fix');
  });

  it('should classify refactoring requests', () => {
    const result = classifyTask('Refactor the user service to decouple from database');
    expect(result.category).toBe('refactoring');
  });

  it('should classify testing requests', () => {
    const result = classifyTask('Write unit tests for the auth module with vitest');
    expect(result.category).toBe('testing');
  });

  it('should classify configuration requests', () => {
    const result = classifyTask('Setup tsconfig config for deploy docker ESM modules');
    expect(result.category).toBe('configuration');
  });

  it('should classify documentation requests', () => {
    const result = classifyTask('Write a README with installation guide');
    expect(result.category).toBe('documentation');
  });

  it('should classify architecture requests', () => {
    const result = classifyTask('Design the architecture with module dependency structure and layers separation');
    expect(result.category).toBe('architecture');
  });

  it('should classify data processing requests', () => {
    const result = classifyTask('Parse the CSV file and transform to JSON');
    expect(result.category).toBe('data_processing');
  });

  it('should classify general code requests', () => {
    const result = classifyTask('Implement a function to calculate Fibonacci');
    expect(result.category).toBe('general_code');
  });

  // ── Chat Only Detection ──

  it('should detect chat-only questions', () => {
    const result = classifyTask('Was ist TypeScript?');
    expect(result.category).toBe('chat_only');
    expect(result.complexity).toBe('trivial');
    expect(result.outputType).toBe('text');
  });

  it('should detect English questions as chat-only', () => {
    const result = classifyTask('What is the difference between let and const?');
    expect(result.category).toBe('chat_only');
  });

  it('should detect greetings as chat-only', () => {
    const result = classifyTask('Danke, das war hilfreich');
    expect(result.category).toBe('chat_only');
  });

  it('should detect short questions as chat-only', () => {
    const result = classifyTask('Why?');
    expect(result.category).toBe('chat_only');
  });

  // ── Complexity Estimation ──

  it('should rate short simple requests as trivial', () => {
    const result = classifyTask('Fix the typo');
    expect(result.complexity).toBe('trivial');
  });

  it('should rate medium-length requests as simple or medium', () => {
    const result = classifyTask('Create a button component with hover effects and click handler');
    expect(['simple', 'medium']).toContain(result.complexity);
  });

  it('should rate complex multi-part requests as complex', () => {
    const result = classifyTask(
      'Build a complex authentication system with multiple providers, ' +
      'integrate OAuth2 for Google and GitHub, add migration scripts for the database, ' +
      'setup Kubernetes deployment configs, and write several integration tests.',
    );
    expect(result.complexity).toBe('complex');
  });

  // ── Output Type Inference ──

  it('should infer code output type for component requests', () => {
    const result = classifyTask('Create a React button component');
    expect(result.outputType).toBe('code');
  });

  it('should infer text output type for docs', () => {
    const result = classifyTask('Write documentation and readme guide');
    expect(result.outputType).toBe('text');
  });

  it('should infer multi_file for module requests', () => {
    const result = classifyTask('Create a new module with multiple files for auth');
    expect(result.outputType).toBe('multi_file');
  });

  it('should infer file for config requests', () => {
    const result = classifyTask('Setup tsconfig config docker deploy');
    expect(result.outputType).toBe('file');
  });

  it('should infer mixed for bug fixes', () => {
    const result = classifyTask('Fix the null pointer error in the parser');
    expect(result.outputType).toBe('mixed');
  });
});
