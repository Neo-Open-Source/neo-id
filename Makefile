.PHONY: build clean run dev test test-unit test-integration lint fmt help

# Build frontend and backend
build:
	@echo "Building frontend..."
	cd web && npm run build
	@echo "Building backend..."
	go build -o unified-id .

# Clean build artifacts
clean:
	@echo "Cleaning..."
	rm -rf static
	rm -rf web/dist
	rm -f unified-id unified-id.exe
	rm -rf tests/testdata

# Run in development mode (hot reload for frontend, backend restart)
dev:
	@echo "Starting development..."
	@echo "Run 'cd web && npm run dev' in another terminal for frontend"
	@echo "Run 'FRONTEND_DEV_URL=http://localhost:5173 go run .' in another terminal for backend"

# Production build and run
run: build
	./unified-id

# Install dependencies
deps:
	@echo "Installing frontend dependencies..."
	cd web && pnpm install
	@echo "Installing Go dependencies..."
	go mod tidy

# Run all tests
test:
	@echo "Running all tests..."
	go test -v ./tests/...

# Run unit tests only
test-unit:
	@echo "Running unit tests..."
	go test -v ./tests/unit/...

# Run integration tests only
test-integration:
	@echo "Running integration tests..."
	go test -v ./tests/integration/...

# Run tests with coverage
test-coverage:
	@echo "Running tests with coverage..."
	go test -cover -coverprofile=coverage.out ./tests/...
	go tool cover -html=coverage.out -o coverage.html
	@echo "Coverage report generated: coverage.html"

# Lint code
lint:
	@echo "Linting Go code..."
	go vet ./...
	@echo "Linting frontend code..."
	cd web && npm run lint

# Format code
fmt:
	@echo "Formatting Go code..."
	go fmt ./...
	@echo "Formatting frontend code..."
	cd web && npm run format

# Vercel local test (simulate Vercel build)
vercel-build:
	@echo "Simulating Vercel build..."
	rm -rf static
	cd web && npm run build
	go build -o unified-id .

# Show help
help:
	@echo "Available commands:"
	@echo "  make build            - Build frontend and backend"
	@echo "  make clean            - Clean build artifacts"
	@echo "  make dev              - Start development mode"
	@echo "  make run              - Build and run production"
	@echo "  make deps             - Install dependencies"
	@echo "  make test             - Run all tests"
	@echo "  make test-unit        - Run unit tests"
	@echo "  make test-integration - Run integration tests"
	@echo "  make test-coverage    - Run tests with coverage"
	@echo "  make lint             - Lint code"
	@echo "  make fmt              - Format code"
	@echo "  make vercel-build     - Simulate Vercel build"
	@echo "  make help             - Show this help"
