# ACGC System: PHP to React/Vite Conversion Guide

## Overview

This guide covers the conversion of your ACGC system from PHP templates to a modern React/Vite frontend while maintaining your existing PHP backend.

## Architecture

### Frontend (React/Vite)
- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite 8
- **Routing**: React Router v7
- **Styling**: Tailwind CSS with shadcn/ui components
- **Animations**: Framer Motion
- **State Management**: React Context API for auth, custom hooks for data fetching

### Backend (Unchanged)
- **Language**: PHP
- **Database**: MySQL
- **API Style**: RESTful endpoints (your existing PHP files become API endpoints)

## Directory Structure

```
reactvite/
├── src/
│   ├── api/               # API client utilities
│   │   ├── client.ts      # Base HTTP client
│   │   ├── auth.ts        # Authentication API
│   │   ├── products.ts    # Products API
│   │   └── orders.ts      # Orders & Cart API
│   ├── components/        # Reusable React components
│   │   ├── ProtectedRoute.tsx
│   │   └── ui/           # shadcn/ui components
│   ├── contexts/          # React Context providers
│   │   └── AuthContext.tsx
│   ├── pages/            # Page components
│   │   ├── Login.tsx
│   │   ├── AdminDashboard.tsx
│   │   ├── CustomerDashboard.tsx
│   │   └── Products.tsx
│   ├── App.tsx           # Main app with routing
│   └── main.tsx          # Entry point
├── .env.example          # Environment variables template
├── vite.config.ts        # Vite configuration
├── tailwind.config.ts    # Tailwind CSS config
└── package.json          # Dependencies
```

## Setup Instructions

### 1. Install Dependencies

```bash
cd C:\Users\Emely\OneDrive\Desktop\reactvite
npm install
```

### 2. Configure Environment

1. Create `.env.local` from `.env.example`:
```bash
cp .env.example .env.local
```

2. Update the `VITE_API_BASE_URL` to point to your PHP backend:
```
VITE_API_BASE_URL=http://localhost/acgc_system
```

### 3. Start Development Server

```bash
npm run dev
```

This will start the Vite dev server at `http://localhost:5173` (or next available port).

## API Integration

### How the Frontend Calls PHP Backend

The React frontend communicates with your PHP backend through HTTP requests. Each API module (auth, products, orders) has corresponding PHP files:

```typescript
// React Frontend (src/api/auth.ts)
export async function login(credentials: LoginRequest): Promise<LoginResponse> {
  return await post('/Login/login_handler.php', {
    email: credentials.email,
    password: credentials.password,
  });
}
```

This calls: `http://localhost/acgc_system/Login/login_handler.php`

### Creating PHP API Endpoints

Your existing PHP files need to be adapted to return JSON instead of HTML. Example:

#### Old PHP (returns HTML):
```php
<?php
// Login/Login.php
// ... form processing logic
// Redirects to dashboard
?>
```

#### New PHP API (returns JSON):
```php
<?php
// Login/login_handler.php
header('Content-Type: application/json');

// ... authentication logic

echo json_encode([
    'success' => true,
    'message' => 'Login successful',
    'user' => [
        'id' => $userId,
        'email' => $userEmail,
        'role' => $userRole
    ]
]);
```

### CORS Configuration

If your React app and PHP backend are on different origins, configure CORS in PHP:

```php
<?php
header('Access-Control-Allow-Origin: http://localhost:5173');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Credentials: true');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}
?>
```

## Module Conversion Status

### Completed Conversions

#### 1. **Authentication Module** ✅
- **Files**: 
  - `src/api/auth.ts` - Authentication API client
  - `src/contexts/AuthContext.tsx` - Auth state management
  - `src/pages/Login.tsx` - Login page
- **Features**:
  - Login with email/password
  - Session management
  - Role-based access control
  - Logout functionality

#### 2. **Admin Dashboard** ✅
- **File**: `src/pages/AdminDashboard.tsx`
- **Features**:
  - Dashboard overview with stats
  - Links to user, product, order, and inspection management
  - Admin-only access protection

#### 3. **Customer Dashboard** ✅
- **File**: `src/pages/CustomerDashboard.tsx`
- **Features**:
  - Recent orders display
  - Quick action buttons
  - Cart indicator with item count
  - Customer-only access protection

#### 4. **Products Management** ✅
- **Files**:
  - `src/api/products.ts` - Products API client
  - `src/pages/Products.tsx` - Products listing page
- **Features**:
  - Browse all products
  - Category filtering
  - Product search
  - Add to cart functionality

#### 5. **Cart & Orders** ✅
- **File**: `src/api/orders.ts` - Cart and orders API client
- **Features**:
  - Get/update/clear cart
  - Create orders
  - View customer orders
  - Order management for admin

### Modules Requiring PHP API Endpoints

These modules need PHP files to return JSON data:

1. **User Management** 
   - `IMPORTANT/users_api.php` - Get, create, update, delete users
   - `AdminDashboard/manage_users.php` → `AdminDashboard/users_api.php`

2. **Product Management**
   - `Products/products_api.php` - CRUD operations
   - `Products/categories_api.php` - Get product categories
   - `Products/pricing_api.php` - Get product pricing

3. **Order Management**
   - `IMPORTANT/order_api.php` - Create, retrieve, update orders
   - `IMPORTANT/cart_api.php` - Cart operations

4. **Job Orders**
   - `JobOrders/job_orders_api.php` - Get, update job orders

5. **Site Inspections**
   - `SiteInspection/inspections_api.php` - Inspection management

## Authentication Flow

```
1. User enters credentials on Login page
2. React calls POST /Login/login_handler.php
3. PHP validates credentials against `users` table
4. PHP returns success/error JSON
5. React stores session and updates AuthContext
6. User redirected to appropriate dashboard based on role
7. All subsequent requests include session cookie (credentials: 'include')
```

## Protected Routes

The `ProtectedRoute` component checks authentication and role:

```typescript
<Route
  path="/admin-dashboard"
  element={
    <ProtectedRoute requiredRole="admin">
      <AdminDashboard />
    </ProtectedRoute>
  }
/>
```

## Available Hooks

### useAuth()
Get full auth context including user, isAuthenticated, role

```typescript
const { user, isAuthenticated, logout } = useAuth();
```

### useRole(requiredRole)
Check if user has specific role

```typescript
const isAdmin = useRole('admin');
const isAdminOrCustomer = useRole(['admin', 'customer']);
```

### useIsAuthenticated()
Simple boolean check for authentication

```typescript
const isLoggedIn = useIsAuthenticated();
```

## Development Workflow

### 1. Add New Page
```typescript
// 1. Create page component
// src/pages/MyPage.tsx
import React from 'react';
import { useAuth } from '../contexts/AuthContext';

const MyPage: React.FC = () => {
  const { user } = useAuth();
  return <div>Hello {user?.first_name}</div>;
};

export default MyPage;

// 2. Add route in App.tsx
<Route
  path="/my-page"
  element={
    <ProtectedRoute>
      <MyPage />
    </ProtectedRoute>
  }
/>
```

### 2. Call PHP API
```typescript
// 1. Add function to api service (e.g., src/api/products.ts)
export async function getMyData() {
  return await get('/MyPath/my_api.php');
}

// 2. Use in component
import { getMyData } from '../api/products';

const MyComponent = () => {
  const [data, setData] = useState(null);
  
  useEffect(() => {
    getMyData().then(setData);
  }, []);
};
```

### 3. Add UI Component
```typescript
// Use shadcn/ui components
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';

<Button onClick={() => alert('Clicked!')}>
  Click Me
</Button>
```

## Building for Production

```bash
npm run build
```

This creates an optimized build in `dist/` folder.

To preview the build:
```bash
npm run preview
```

## Common Tasks

### Get Current User
```typescript
import { useAuth } from '../contexts/AuthContext';

const MyComponent = () => {
  const { user } = useAuth();
  return <p>Hello {user?.first_name}</p>;
};
```

### Check Authorization
```typescript
import { useRole } from '../contexts/AuthContext';

const AdminComponent = () => {
  const isAdmin = useRole('admin');
  
  if (!isAdmin) return <p>Access denied</p>;
  return <div>Admin content</div>;
};
```

### Make API Request
```typescript
import { getProducts } from '../api/products';

const MyComponent = () => {
  const [products, setProducts] = useState([]);
  
  useEffect(() => {
    getProducts().then(data => {
      setProducts(data.products);
    });
  }, []);
};
```

### Show Loading State
```typescript
import { Loader2 } from 'lucide-react';

const MyComponent = () => {
  const [isLoading, setIsLoading] = useState(false);
  
  return (
    <div>
      {isLoading ? (
        <Loader2 className="animate-spin" />
      ) : (
        <div>Content</div>
      )}
    </div>
  );
};
```

## Troubleshooting

### CORS Errors
**Problem**: Browser shows CORS error when calling PHP backend

**Solution**:
1. Add CORS headers to your PHP files
2. Or configure proxy in `vite.config.ts`:
```typescript
export default defineConfig({
  server: {
    proxy: {
      '/acgc_system': {
        target: 'http://localhost',
        changeOrigin: true,
      }
    }
  }
});
```

### Session Not Persisting
**Problem**: User gets logged out or session lost

**Solution**:
- Ensure `credentials: 'include'` is set in fetch requests (already done in `src/api/client.ts`)
- Check PHP session configuration
- Verify session cookie domain matches

### Components Not Rendering
**Problem**: Component doesn't display or throws error

**Solution**:
1. Check browser console for errors
2. Verify component is exported: `export default MyComponent`
3. Check route is defined in App.tsx
4. Verify required props are passed

### API Returns HTML Instead of JSON
**Problem**: API calls receive HTML error pages

**Solution**:
1. Ensure PHP file returns `header('Content-Type: application/json')`
2. Check PHP error logs for actual errors
3. Add error handling in PHP before JSON response

## Next Steps

### To Complete the Conversion:

1. **Create PHP API Endpoints**
   - Convert existing PHP pages to return JSON
   - Implement CRUD endpoints for each module

2. **Build Remaining Pages**
   - User Management page
   - Product Management (CRUD) page
   - Order Management page
   - Site Inspection pages
   - Worker Dashboard

3. **Add Features**
   - File uploads for inspection photos
   - Real-time notifications
   - Advanced reporting
   - Email integration

4. **Polish**
   - Add error boundaries
   - Implement retry logic for failed API calls
   - Add loading skeletons
   - Improve accessibility
   - Add form validation

5. **Testing**
   - Write unit tests for API services
   - Write component tests for pages
   - End-to-end testing

## Resources

- [React Documentation](https://react.dev)
- [Vite Documentation](https://vitejs.dev)
- [React Router Documentation](https://reactrouter.com)
- [Tailwind CSS Documentation](https://tailwindcss.com)
- [shadcn/ui Components](https://ui.shadcn.com)
- [TypeScript Documentation](https://www.typescriptlang.org)

## Support

For questions or issues:
1. Check the troubleshooting section above
2. Review React/Vite documentation
3. Check browser console for errors
4. Review PHP error logs

---

**Last Updated**: June 2, 2026
**Conversion Version**: 1.0
