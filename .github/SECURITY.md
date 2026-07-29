# Security Policy

## Supported Versions

| Version | Supported          |
|---------|-------------------|
| 2.x     | Full support       |
| 1.x     | Security patches only |
| < 1.0   | Not supported      |

## Reporting a Vulnerability

We take security vulnerabilities seriously. Please report them responsibly.

### How to Report

1. **Email**: Send details to the project maintainers via GitHub's security advisory system
2. **Do NOT** open a public issue for security vulnerabilities
3. Include as much information as possible:
   - Type of vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### What to Expect

- **Acknowledgement** within 48 hours
- **Initial assessment** within 5 business days
- **Fix timeline** communicated based on severity:
  - Critical: 7 days
  - High: 14 days
  - Medium: 30 days
  - Low: Next major release

### Responsible Disclosure

We ask that you allow us reasonable time to fix and disclose the vulnerability before making any information public. We will credit you in the advisory and changelog.

### Scope

- COS Graph Engine packages (@cos/*)
- WASM modules in packages/wasm/
- CLI tools
- CI/CD pipelines

### Out of Scope

- Third-party services used in development
- Deployed infrastructure (report to cloud provider)
