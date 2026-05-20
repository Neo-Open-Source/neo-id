# Neo ID Web Frontend

Modern React-based frontend for Neo ID authentication service.

## Tech Stack

- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **React Router** - Client-side routing
- **@neo-open-source/ui-web** - UI component library

## Project Structure

```
src/
├── api/              # API client and endpoints
├── app/              # App-level components and context
├── auth/             # Authentication utilities
├── components/       # Reusable UI components
│   └── sections/     # Page sections
├── constants/        # App constants and config
├── hooks/            # Custom React hooks
├── pages/            # Page components
├── services/         # Business logic services
├── types/            # TypeScript type definitions
└── utils/            # Utility functions
```

## Development

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm

### Setup

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm dev
```

The dev server will start on `http://localhost:5173`

### Environment Variables

Create a `.env` file in the `web/` directory:

```env
VITE_API_URL=http://localhost:8080/api
```

### Building

```bash
# Build for production
pnpm build

# Preview production build
pnpm preview
```

## Code Style

### Components

- Use functional components with hooks
- Keep components small and focused
- Extract reusable logic into custom hooks
- Use TypeScript for type safety

Example:
```tsx
import { useState } from 'react'
import { User } from '../types'

interface Props {
  user: User
  onUpdate: (user: User) => void
}

export const UserCard = ({ user, onUpdate }: Props) => {
  const [editing, setEditing] = useState(false)
  
  return (
    <div>
      {/* Component content */}
    </div>
  )
}
```

### Hooks

- Prefix custom hooks with `use`
- Keep hooks focused on a single responsibility
- Document complex hooks

Example:
```tsx
export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null)
  
  // Hook logic
  
  return { user, login, logout }
}
```

### API Calls

- Use the API client from `src/api/client.ts`
- Define endpoints in `src/api/endpoints.ts`
- Handle errors consistently

Example:
```tsx
import { apiClient } from '../api/client'

export const getUser = async (id: string) => {
  const response = await apiClient.get(`/users/${id}`)
  return response.data
}
```

## Testing

```bash
# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage
```

## Common Tasks

### Adding a New Page

1. Create component in `src/pages/`
2. Add route in `src/App.tsx`
3. Add route constant in `src/constants/index.ts`

### Adding a New Component

1. Create component in `src/components/`
2. Export from component file
3. Import where needed

### Adding a New API Endpoint

1. Add endpoint function in `src/api/endpoints.ts`
2. Use TypeScript types from `src/types/`
3. Handle errors appropriately

## Performance

- Use React.lazy() for code splitting
- Optimize images and assets
- Use memo() for expensive computations
- Avoid unnecessary re-renders

## Accessibility

- Use semantic HTML
- Add ARIA labels where needed
- Ensure keyboard navigation works
- Test with screen readers

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Troubleshooting

### Dev server not starting

1. Clear node_modules: `rm -rf node_modules`
2. Clear cache: `rm -rf .vite`
3. Reinstall: `pnpm install`

### Build errors

1. Check TypeScript errors: `pnpm tsc --noEmit`
2. Clear build cache: `rm -rf dist`
3. Rebuild: `pnpm build`

## Contributing

1. Follow the existing code style
2. Write tests for new features
3. Update documentation
4. Create meaningful commit messages
