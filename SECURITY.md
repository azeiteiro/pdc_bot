# Security Policy

## Supported Versions

We release security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability in Burro dos Concertos Bot, please report it responsibly:

### How to Report

**Preferred:** Use [GitHub Security Advisories](https://github.com/azeiteiro/burro_dos_concertos/security/advisories/new) to report vulnerabilities privately.

**Alternative:** Email the maintainers directly (check GitHub profiles for contact info).

### What to Include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### Response Timeline

- **Initial response:** Within 48-72 hours
- **Status update:** Within 7 days
- **Fix timeline:** Depends on severity
  - Critical: As soon as possible
  - High: Within 2 weeks
  - Medium/Low: Next release cycle

## Security Scope

### In Scope

- Authentication and authorization vulnerabilities
- Data exposure or leakage
- Command injection or code execution
- Database security issues
- Telegram bot API misuse
- Dependencies with known vulnerabilities

### Out of Scope

- Social engineering attacks
- Telegram platform vulnerabilities
- Issues in third-party services (Fly.io, PostgreSQL)
- Denial of service attacks

## Security Best Practices

We follow these practices:

- Environment variables for all secrets (never committed)
- Role-based access control (User, Moderator, Admin, SuperAdmin)
- Database queries via Prisma ORM (SQL injection protection)
- Regular dependency updates
- CI/CD with automated testing

## Disclosure Policy

- We request a 90-day disclosure window
- We will credit reporters (unless anonymity is requested)
- Fixes will be released before public disclosure
