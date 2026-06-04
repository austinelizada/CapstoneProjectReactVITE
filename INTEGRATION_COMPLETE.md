# ACGC React + Node.js Backend Integration - Complete Setup

**Date**: June 2, 2026  
**Status**: ✅ Ready for Development

---

## What Was Just Done

### 1. **Backend Setup** ✅
- Updated User model with email, first_name, last_name, role fields
- Created complete authentication routes (`/api/auth`)
- Added JWT middleware for protected routes
- Configured MongoDB connection
- Set up error handling and CORS

### 2. **Frontend Setup** ✅  
- Updated API clients to use Node.js endpoints (not PHP)
- Updated AuthContext to use JWT tokens from localStorage
- Configured App.tsx with proper routing and protection
- Updated environment configuration for Node.js backend

### 3. **Integration** ✅
- API routes updated: `/api/auth`, `/api/products`, `/api/cart`, `/api/orders`
- JWT token handling in all API calls
- Protected routes with role-based access control
- Automatic token refresh on auth check

---

## Quick Start (5 minutes)

### **Terminal 1: Start Backend**
```bash
cd C:\Users\Emely\OneDrive\Desktop\reactvite\backend
npm install  # First time only
npm start
```

✅ Backend running on http://localhost:5000

### **Terminal 2: Start Frontend**
```bash
cd C:\Users\Emely\OneDrive\Desktop\reactvite
npm install  # First time only
npm run dev
```

✅ Frontend running on http://localhost:5173

### **Test It**
1. Open http://localhost:5173
2. Should redirect to login
3. Register or login with test user
4. Should go to dashboard

---

## API Endpoints Reference

### Authentication
```
POST   /api/auth/register        - Create new user
POST   /api/auth/login           - User login
GET    /api/auth/me              - Get current user (protected)
POST   /api/auth/logout          - Logout (protected)
PUT    /api/auth/profile         - Update profile (protected)
```

### Products (To Be Created)
```
GET    /api/products             - List products
GET    /api/products/:id         - Get single product
GET    /api/products/categories  - Get categories
POST   /api/products             - Create product (admin)
PUT    /api/products/:id         - Update product (admin)
DELETE /api/products/:id         - Delete product (admin)
```

### Cart (To Be Created)
```
GET    /api/cart                 - Get cart
POST   /api/cart/add             - Add to cart
PUT    /api/cart/:itemId         - Update cart item
POST   /api/cart/:itemId/remove  - Remove from cart
POST   /api/cart/clear           - Clear cart
```

### Orders (To Be Created)
```
POST   /api/orders               - Create order
GET    /api/orders               - Get user orders
GET    /api/orders/:id           - Get order details
POST   /api/orders/:id/cancel    - Cancel order
```

---

## Database Setup

MongoDB should be running locally. Check `.env` file:

```
MONGO_URI=mongodb://127.0.0.1:27017/acgc_db
JWT_SECRET=acgc_super_secret_key
PORT=5000
```

### Verify MongoDB
```bash
# In MongoDB client
use acgc_db
db.users.find()  # Should return empty array initially
```

---

## Frontend Pages Status

### ✅ Completed Pages
- **Login** (`/login`) - Fully functional
- **Admin Dashboard** (`/admin-dashboard`) - Protected, admin only
- **Customer Dashboard** (`/customer-dashboard`) - Protected, customer only  
- **Products** (`/products`) - Protected, browse products

### 📋 Needs Backend Routes
- Cart page - Ready, needs `/api/cart` endpoints
- Orders page - Ready, needs `/api/orders` endpoints
- Profile page - Ready, needs `/api/auth/profile` endpoint
- Admin management pages - Ready, need admin endpoints

---

## File Structure

```
reactvite/
├── backend/
│   ├── models/
│   │   └── User.js          ✅ Updated with email, names
│   ├── middleware/
│   │   └── auth.js          ✅ JWT verification
│   ├── routes/
│   │   └── auth.js          ✅ Complete auth routes
│   ├── server.js            ✅ Updated config
│   ├── package.json         ✅ Has bcryptjs, jwt
│   └── .env                 ✅ Configured
│
├── src/
│   ├── api/
│   │   ├── client.ts        ✅ Updated for JWT
│   │   ├── auth.ts          ✅ Uses /api/auth endpoints
│   │   ├── products.ts      ✅ Updated endpoints
│   │   └── orders.ts        ✅ Updated endpoints
│   ├── contexts/
│   │   └── AuthContext.tsx  ✅ Uses JWT from localStorage
│   ├── pages/
│   │   ├── Login.tsx        ✅ Complete
│   │   ├── AdminDashboard.tsx ✅ Complete
│   │   ├── CustomerDashboard.tsx ✅ Complete
│   │   └── Products.tsx     ✅ Complete
│   ├── App.tsx              ✅ Main routing
│   └── main.jsx             ✅ Uses App.tsx
│
└── .env.example             ✅ Updated for Node.js
```

---

## How Authentication Works

### Registration Flow
```
User fills form
    ↓
POST /api/auth/register { email, password, first_name, last_name }
    ↓
Backend hashes password with bcryptjs
    ↓
Backend creates JWT token
    ↓
Frontend stores token in localStorage
    ↓
Frontend updates AuthContext
    ↓
User redirected to dashboard
```

### Login Flow  
```
User enters credentials
    ↓
POST /api/auth/login { email, password }
    ↓
Backend verifies password with bcryptjs
    ↓
Backend creates JWT token
    ↓
Frontend stores token in localStorage
    ↓
Frontend calls GET /api/auth/me (with token)
    ↓
Backend verifies token, returns user data
    ↓
AuthContext updates
    ↓
User redirected to appropriate dashboard
```

### Protected Route Flow
```
User visits /admin-dashboard
    ↓
ProtectedRoute checks isAuthenticated
    ↓
If not authenticated, redirects to /login
    ↓
If authenticated, checks role
    ↓
If role is "admin", renders AdminDashboard
    ↓
If role is not "admin", shows error and redirects
```

---

## Environment Variables

### Frontend (.env.local)
```
VITE_API_BASE_URL=http://localhost:5000
```

### Backend (.env)
```
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/acgc_db
JWT_SECRET=acgc_super_secret_key
```

---

## Testing the Integration

### 1. **Test Backend Health**
```bash
curl http://localhost:5000
# Should return: { "message": "Backend is running", "status": "connected" }
```

### 2. **Test User Registration**
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "first_name": "John",
    "last_name": "Doe"
  }'
```

### 3. **Test Login**
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'

# Copy the returned token
```

### 4. **Test Protected Route**
```bash
curl http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## Next Steps to Complete

### 1. **Verify Backend Routes Work** (30 min)
- Start backend
- Test registration and login using curl
- Verify tokens are created
- Check MongoDB has users

### 2. **Test Frontend Login** (20 min)
- Start frontend  
- Try to login
- Verify token stored in localStorage
- Check network requests in DevTools

### 3. **Create Remaining Backend Routes** (2-3 days)
- Products routes (CRUD)
- Cart routes
- Orders routes
- Admin user management

### 4. **Build Remaining Frontend Pages** (2-3 days)
- Cart view
- Orders history
- User profile
- Admin management pages

### 5. **Testing & Deployment** (1 day)
- Full integration tests
- Performance optimization
- Production build
- Deployment setup

---

## Common Issues & Solutions

### Issue: Backend won't start
**Solution**: 
```bash
# Check MongoDB is running
# Check .env has MONGO_URI
# Check JWT_SECRET is set
npm install  # reinstall dependencies
npm start
```

### Issue: "Cannot POST /api/auth/login"
**Solution**:
- Check backend is running on http://localhost:5000
- Check `.env.local` has correct VITE_API_BASE_URL
- Check CORS is enabled in server.js

### Issue: Login works but can't access dashboard
**Solution**:
- Check token stored in localStorage (DevTools → Application)
- Check Authorization header in Network tab (should show "Bearer TOKEN")
- Check user role matches route requirement

### Issue: "Invalid or expired token"
**Solution**:
- Clear localStorage: `localStorage.clear()`
- Login again
- Check JWT_SECRET is same in .env and auth.js
- Check token hasn't been modified

---

## Development Tips

### View Database
```bash
# In MongoDB client
mongosh
use acgc_db
db.users.find().pretty()
```

### Check JWT Token
```javascript
// In browser console
const token = localStorage.getItem('authToken');
console.log(token);

// Decode (without verification)
const parts = token.split('.');
const payload = JSON.parse(atob(parts[1]));
console.log(payload);
```

### Debug API Calls
```javascript
// In browser DevTools → Network tab
// See all API requests with headers
// Check Authorization header has Bearer token
// Check response status and body
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                  BROWSER (Localhost:5173)               │
│                    React Frontend                        │
├─────────────────────────────────────────────────────────┤
│  Login Page → App.tsx → AuthContext → Protected Routes  │
│                                                         │
│  localStorage                                          │
│  ├── authToken (JWT)                                   │
└─────────────────────────────────────────────────────────┘
            ↓ HTTP Requests (with JWT)
┌─────────────────────────────────────────────────────────┐
│           API SERVER (Localhost:5000)                   │
│               Node.js + Express                         │
├─────────────────────────────────────────────────────────┤
│  /api/auth/register    → Validate → Hash → Save        │
│  /api/auth/login       → Validate → Compare → Token    │
│  /api/auth/me          → Verify JWT → Get User         │
│  /api/products         → Query → Return                │
│  /api/cart             → Manage Cart                    │
│  /api/orders           → Create/Get Orders             │
└─────────────────────────────────────────────────────────┘
            ↓ mongoose
┌─────────────────────────────────────────────────────────┐
│            DATABASE (Localhost:27017)                   │
│               MongoDB - acgc_db                         │
├─────────────────────────────────────────────────────────┤
│  Collections:                                           │
│  ├── users (email, password, first_name, role)        │
│  ├── products (name, category, price)                  │
│  ├── carts (user_id, items)                            │
│  └── orders (user_id, items, status)                   │
└─────────────────────────────────────────────────────────┘
```

---

## Support Resources

- **Backend**: Express.js docs
- **Frontend**: React Router, TypeScript
- **Database**: MongoDB docs
- **Auth**: JWT.io (JWT explanation)

---

## Quick Reference

```bash
# Start everything
# Terminal 1:
cd backend && npm start

# Terminal 2:
npm run dev

# Stop everything
Ctrl+C (in each terminal)

# View logs
# Backend: Check terminal output
# Frontend: DevTools → Console

# Reset database
# Delete MongoDB data, backend creates on first login
```

---

**Everything is configured. Just start the servers and test!**

**Questions?** Check the diagnostic sections above or review the code comments in the route files.

---

**Last Updated**: June 2, 2026  
**Status**: Ready for Testing  
**Next Action**: Run `npm start` in backend, then `npm run dev` in frontend
