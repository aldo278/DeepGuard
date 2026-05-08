# Contributing to TrustShield

Thank you for your interest in contributing to TrustShield! This document provides guidelines and instructions for contributing.

## Code of Conduct

Please be respectful and constructive in all interactions. We're building technology to combat misinformation and deepfakes - let's maintain a positive and collaborative environment.

## Getting Started

### Prerequisites

- Node.js 20+
- npm 9+
- Chrome browser (for testing)

### Setup

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/DeepGuard.git
   cd DeepGuard
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Create a branch for your changes:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Workflow

### Running the Development Server

```bash
npm run dev
```

### Building the Extension

```bash
npm run build
```

### Running Tests

```bash
npm run test
```

### Loading the Extension in Chrome

1. Build the extension: `npm run build`
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the `dist` folder

## Pull Request Process

1. Ensure your code passes all tests and type checks
2. Update documentation if needed
3. Follow the PR template when creating your pull request
4. Request review from maintainers

## Coding Standards

- Use TypeScript for all new code
- Follow existing code style and patterns
- Write meaningful commit messages
- Add tests for new functionality
- Keep PRs focused and reasonably sized

## Commit Message Format

We follow conventional commits:

```
type(scope): description

[optional body]

[optional footer]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Examples:
- `feat(deepguard): add real-time video analysis`
- `fix(misinfo): correct claim extraction logic`
- `docs(readme): update installation instructions`

## Questions?

Open an issue with the `question` label or reach out to the maintainers.
