.PHONY: build clean run dev

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
	rm -f unified-id unified-id.exe

# Run in development mode (hot reload for frontend, backend restart)
dev:
	@echo "Starting development..."
	@echo "Run 'cd web && npm run dev' in another terminal for frontend"
	@echo "Run 'go run .' in another terminal for backend"

# Production build and run
run: build
	./unified-id

# Install dependencies
deps:
	@echo "Installing frontend dependencies..."
	cd web && npm install
	@echo "Installing Go dependencies..."
	go mod tidy

# Vercel local test (simulate Vercel build)
vercel-build:
	@echo "Simulating Vercel build..."
	rm -rf static
	cd web && npm run build
	go build -o unified-id .
