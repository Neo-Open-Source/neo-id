# Contributing to Neo ID

Thank you for your interest in contributing to Neo ID! This document provides guidelines and instructions for contributing.

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Focus on what is best for the community
- Show empathy towards other community members

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/neo-id.git`
3. Create a branch: `git checkout -b feature/your-feature-name`
4. Make your changes
5. Test your changes
6. Commit and push
7. Create a Pull Request

## Development Setup

See the [README.md](README.md) for detailed setup instructions.

Quick start:
```bash
make deps
FRONTEND_DEV_URL=http://localhost:5173 go run .
cd web && pnpm dev
```

## Code Style

### Go

- Follow [Effective Go](https://golang.org/doc/effective_go.html)
- Use `gofmt` for formatting: `make fmt`
- Run `go vet`: `make lint`
- Write tests for new features
- Keep functions small and focused
- Use meaningful variable names

Example:
```go
// Good
func GetUserByID(id string) (*User, error) {
    if id == "" {
        return nil, errors.New("user ID is required")
    }
    // Implementation
}

// Bad
func get(i string) (*User, error) {
    // Implementation
}
```

### TypeScript/React

- Use TypeScript for type safety
- Follow React best practices
- Use functional components with hooks
- Keep components small and reusable
- Use meaningful prop names

Example:
```tsx
// Good
interface UserCardProps {
  user: User
  onUpdate: (user: User) => void
}

export const UserCard = ({ user, onUpdate }: UserCardProps) => {
  // Implementation
}

// Bad
export const Card = (props: any) => {
  // Implementation
}
```

## Testing

### Writing Tests

- Write tests for all new features
- Aim for high code coverage
- Use descriptive test names
- Test edge cases and error conditions

### Running Tests

```bash
# All tests
make test

# Unit tests
make test-unit

# Integration tests
make test-integration

# With coverage
make test-coverage
```

### Test Structure

```go
func TestUserService_CreateUser(t *testing.T) {
    // Arrange
    service := NewUserService()
    user := &User{Email: "test@example.com"}
    
    // Act
    result, err := service.CreateUser(user)
    
    // Assert
    if err != nil {
        t.Fatalf("Expected no error, got %v", err)
    }
    if result.Email != user.Email {
        t.Errorf("Expected email %s, got %s", user.Email, result.Email)
    }
}
```

## Pull Request Process

1. **Update documentation** - Update README.md, API.md, or other docs if needed
2. **Add tests** - Ensure your changes are tested
3. **Run tests** - Make sure all tests pass: `make test`
4. **Format code** - Run `make fmt` and `make lint`
5. **Write clear commit messages** - Use conventional commits format
6. **Create PR** - Provide a clear description of your changes

### Commit Message Format

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

Examples:
```
feat(auth): add TOTP authentication support

Implements TOTP-based two-factor authentication using the
standard TOTP algorithm.

Closes #123
```

```
fix(api): handle null values in user profile endpoint

Previously, null values in optional fields would cause
the endpoint to return 500 errors.

Fixes #456
```

## Project Structure

```
neo-id/
├── controllers/     # Legacy controllers (being refactored)
├── internal/        # Internal packages
│   ├── handlers/    # HTTP handlers
│   ├── middleware/  # HTTP middleware
│   ├── services/    # Business logic
│   └── utils/       # Utility functions
├── models/          # Database models
├── pkg/             # Public packages
│   ├── config/      # Configuration
│   └── logger/      # Logging
├── routers/         # Route definitions
├── tests/           # All tests
│   ├── unit/        # Unit tests
│   ├── integration/ # Integration tests
│   └── e2e/         # End-to-end tests
└── web/             # Frontend application
```

## Adding New Features

### Backend Feature

1. Create service in `internal/services/`
2. Create handler in `internal/handlers/`
3. Add route in `routers/routes.go`
4. Write tests in `tests/unit/` and `tests/integration/`
5. Update API documentation in `API.md`

### Frontend Feature

1. Create component in `web/src/components/`
2. Add types in `web/src/types/`
3. Create API endpoint in `web/src/api/endpoints.ts`
4. Add route if needed in `web/src/App.tsx`
5. Write tests

## Documentation

- Update README.md for major changes
- Update API.md for API changes
- Add JSDoc/GoDoc comments for public functions
- Include examples in documentation

## Questions?

- Open an issue for bugs or feature requests
- Start a discussion for questions or ideas
- Check existing issues and discussions first

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
