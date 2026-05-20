# Tests

This directory contains all tests for the Neo ID project.

## Structure

- `unit/` - Unit tests for individual functions and services
- `integration/` - Integration tests for API endpoints and database operations
- `e2e/` - End-to-end tests for complete user flows
- `controllers/` - Black-box controller tests through exported handlers

## Running Tests

### All tests
```bash
go test ./tests/...
```

### Unit tests only
```bash
go test ./tests/unit/...
```

### Integration tests only
```bash
go test ./tests/integration/...
```

### E2E tests only
```bash
go test ./tests/e2e/...
```

### With coverage
```bash
go test -cover ./tests/...
```

### Verbose output
```bash
go test -v ./tests/...
```

## Writing Tests

### Unit Tests
Place unit tests in `tests/unit/`. These should test individual functions without external dependencies.

Example:
```go
package unit

import "testing"

func TestMyFunction(t *testing.T) {
    result := MyFunction()
    if result != expected {
        t.Errorf("Expected %v, got %v", expected, result)
    }
}
```

### Integration Tests
Place integration tests in `tests/integration/`. These test API endpoints and database operations.
Current bootstrap file: `tests/integration/passkey_api_test.go`.

### Controller Tests
Place controller smoke tests in `tests/controllers/` using `package controllers_test`.
Controller internals that must be validated are exposed via `controllers/TestHook*` wrappers.

### E2E Tests
Place end-to-end tests in `tests/e2e/`. These test complete user flows from start to finish.
Current bootstrap file: `tests/e2e/passkey_flow_test.go`.
