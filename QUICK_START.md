# ACGC System React/Vite - Quick Start Guide

## Installation & Setup (5 minutes)

### 1. Install Dependencies
```bash
cd C:\Users\Emely\OneDrive\Desktop\reactvite
npm install
```

### 2. Configure Backend URL
```bash
# Create .env.local from template
cp .env.example .env.local
```

Edit `.env.local`:
```
VITE_API_BASE_URL=http://localhost/acgc_system
```

### 3. Start Development Server
```bash
npm run dev
```

Open browser: `http://localhost:5173`

## Login Credentials

Use your existing ACGC system users:
- **Admin**: admin@acgc.com / password
- **Customer**: customer@acgc.com / password

## Converted Modules

### ✅ Authentication
- Login page with email/password
- Session management
- Role-based routing
- Logout functionality

### ✅ Admin Dashboard
- System overview with stats
- Quick links to management modules
- User metrics, order tracking, product management

### ✅ Customer Dashboard
- Recent orders display
- Cart status
- Quick action buttons
- Profile access

### ✅ Products Browsing
- Product listing with pagination
- Category filtering
- Product search
- Add to cart functionality

## Remaining Work

### Backend (PHP API Endpoints Needed)

These modules need JSON API endpoints created from your existing PHP:

1. **User Management** - `/IMPORTANT/users_api.php`
2. **Product Management** - `/Products/products_api.php`
3. **Order Management** - `/IMPORTANT/order_api.php`
4. **Cart Operations** - `/IMPORTANT/cart_api.php`
5. **Job Orders** - `/JobOrders/job_orders_api.php`
6. **Site Inspections** - `/SiteInspection/inspections_api.php`

### Frontend Pages to Build

Add these components to `src/pages/`:
- `AdminUsers.tsx` - User management
- `AdminProducts.tsx` - Product CRUD
- `AdminOrders.tsx` - Order management
- `Cart.tsx` - Shopping cart
- `Orders.tsx` - Order history
- `Profile.tsx` - User profile
- `WorkerDashboard.tsx` - Skilled worker dashboard

## File Structure

```
reactvite/
├── src/
│   ├── api/              ← API client services
│   │   ├── auth.ts       ← Login, logout, session
│   │   ├── products.ts   ← Product operations
│   │   └── orders.ts     ← Cart and orders
│   ├── components/       ← Reusable components
│   ├── contexts/         ← Auth state management
│   ├── pages/            ← Full page components
│   │   ├── Login.tsx
│   │   ├── AdminDashboard.tsx
│   │   ├── CustomerDashboard.tsx
│   │   └── Products.tsx
│   └── App.tsx           ← Main routing
├── .env.example          ← Environment template
└── CONVERSION_GUIDE.md   ← Full documentation
```

## Common Tasks

### Check If User Is Logged In
```typescript
import { useAuth } from '../contexts/AuthContext';

const MyComponent = () => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <p>Logged in</p> : <p>Not logged in</p>;
};
```

### Get Current User
```typescript
import { useAuth } from '../contexts/AuthContext';

const MyComponent = () => {
  const { user } = useAuth();
  return <p>Hello {user?.first_name}!</p>;
};
```

### Check User Role
```typescript
import { useRole } from '../contexts/AuthContext';

const AdminOnly = () => {
  const isAdmin = useRole('admin');
  return isAdmin ? <div>Admin content</div> : <p>Access denied</p>;
};
```

### Call API
```typescript
import { getProducts } from '../api/products';
import { useEffect, useState } from 'react';

const MyComponent = () => {
  const [products, setProducts] = useState([]);
  
  useEffect(() => {
    getProducts()
      .then(data => setProducts(data.products))
      .catch(err => console.error(err));
  }, []);
  
  return <div>{products.length} products</div>;
};
```

### Logout User
```typescript
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const MyComponent = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  
  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };
  
  return <button onClick={handleLogout}>Logout</button>;
};
```

## Environment Variables

Create `.env.local` with these values:

```bash
# Required - Point to your PHP backend
VITE_API_BASE_URL=http://localhost/acgc_system

# Optional
VITE_APP_NAME=ACGC System
VITE_ENABLE_DEBUG=false
VITE_SESSION_TIMEOUT=3600000
```

## Available Routes

After login:
- `/admin-dashboard` - Admin only
- `/customer-dashboard` - Customer only
- `/products` - Products listing
- `/login` - Login page
- `/` - Redirects to login

## API Base

All API calls are prefixed with `VITE_API_BASE_URL`:

```typescript
// If VITE_API_BASE_URL=http://localhost/acgc_system
// Then this call:
get('/Login/login_handler.php')

// Becomes:
http://localhost/acgc_system/Login/login_handler.php
```

## Key Dependencies

```json
{
  "react": "19.2.6",
  "react-router-dom": "7.16.0",
  "tailwindcss": "4.3.0",
  "shadcn/ui": "4.10.0",
  "typescript": "5.x",
  "vite": "8.0.16"
}
```

## Build for Production

```bash
# Create optimized build
npm run build

# Preview build
npm run preview
```

Output: `dist/` folder ready to deploy

## Troubleshooting

### Port 5173 Already in Use
```bash
npm run dev -- --port 3000
```

### PHP Backend Returns HTML Error
1. Check PHP error logs
2. Ensure endpoint returns `header('Content-Type: application/json')`
3. Review CONVERSION_GUIDE.md section on API endpoints

### Components Not Updating
1. Verify component is wrapped with `<AuthProvider>`
2. Check that hooks are called inside React components
3. Verify imports are correct

### Session Lost After Reload
1. Ensure PHP session persists
2. Check browser accepts cookies
3. Verify `credentials: 'include'` in fetch calls

## Next Steps

1. **Review CONVERSION_GUIDE.md** for detailed documentation
2. **Create PHP API endpoints** for remaining modules
3. **Build remaining React pages** for admin/user management
4. **Test thoroughly** with your PHP backend
5. **Deploy to production** when ready

## Support Resources

- Full Documentation: [CONVERSION_GUIDE.md](CONVERSION_GUIDE.md)
- React Docs: https://react.dev
- Vite Docs: https://vitejs.dev
- Tailwind CSS: https://tailwindcss.com
- shadcn/ui: https://ui.shadcn.com

---

**Version**: 1.0  
**Last Updated**: June 2, 2026
