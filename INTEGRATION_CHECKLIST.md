# Integration Checklist: PHP Backend to React Frontend

Use this checklist to verify each component is working correctly.

---

## Pre-Integration Setup

- [ ] Navigate to `C:\Users\Emely\OneDrive\Desktop\reactvite`
- [ ] Run `npm install` (if not already done)
- [ ] Create `.env.local` from `.env.example`
- [ ] Update `VITE_API_BASE_URL` in `.env.local`
- [ ] PHP backend is running (localhost/acgc_system accessible)
- [ ] MySQL database is running
- [ ] No port conflicts (5173 available for Vite)

---

## Frontend Verification

### 1. Development Server
- [ ] Run `npm run dev`
- [ ] Dev server starts without errors
- [ ] Console shows no fatal errors
- [ ] Browser opens to `http://localhost:5173`
- [ ] Page loads without JavaScript errors

### 2. Login Page
- [ ] Login page renders correctly
- [ ] Email input field is visible
- [ ] Password input field is visible
- [ ] "Remember me" checkbox is visible
- [ ] "Sign In" button is clickable
- [ ] Links to signup/forgot password visible
- [ ] Form styling looks professional

### 3. Component Rendering
- [ ] No console errors on load
- [ ] No missing component warnings
- [ ] Images/icons load correctly
- [ ] Responsive design works on mobile (Ctrl+Shift+I → mobile)
- [ ] All buttons are clickable

---

## Backend Integration Testing

### Phase 1: Setup Endpoints

First, create these PHP endpoints with JSON responses:

- [ ] `/Login/login_handler.php` - POST returns login response
- [ ] `/IMPORTANT/auth_check.php` - GET returns session data
- [ ] `/Login/logout.php` - GET/POST clears session

See `API_ENDPOINTS.md` for exact response formats.

### Phase 2: Test Each Endpoint

#### 1. Login Flow
- [ ] Create test user in database if not exists
- [ ] Test login with correct credentials
  - [ ] Visit http://localhost:5173/login
  - [ ] Enter test email
  - [ ] Enter test password
  - [ ] Click "Sign In"
  - [ ] Check browser console for API call
  - [ ] Verify PHP endpoint receives request
  - [ ] Verify PHP returns valid JSON
  - [ ] Verify login succeeds or fails appropriately
  
- [ ] Test login with incorrect credentials
  - [ ] Error message displays
  - [ ] User not redirected
  - [ ] Doesn't break subsequent attempts

- [ ] Test session validation
  - [ ] Manually call `/IMPORTANT/auth_check.php` in browser
  - [ ] Verify response includes `isAuthenticated: true`
  - [ ] Verify user data is present
  - [ ] Verify role is correct

#### 2. Protected Routes
- [ ] After login, redirected to appropriate dashboard
  - [ ] Admin → `/admin-dashboard`
  - [ ] Customer → `/customer-dashboard`
  - [ ] Worker → (when implemented)
  
- [ ] Cannot access protected routes without login
  - [ ] Try accessing `/admin-dashboard` without login
  - [ ] Should redirect to `/login`
  
- [ ] Role-based access control
  - [ ] Admin can access admin dashboard
  - [ ] Customer cannot access admin dashboard
  - [ ] Appropriate error message shown

#### 3. Logout
- [ ] Logout button visible in dashboard
- [ ] Click logout
- [ ] Session cleared on backend
- [ ] Redirected to login page
- [ ] Cannot access dashboard after logout

---

## API Endpoint Testing

### Products Endpoints

- [ ] `/Products/products_api.php` returns products list
  - [ ] Test GET request
  - [ ] Verify JSON response format
  - [ ] Test with category filter
  - [ ] Test pagination
  
- [ ] `/Products/categories_api.php` returns categories
  - [ ] Test GET request
  - [ ] Verify correct categories returned
  
- [ ] Add remaining product endpoints

### Cart Endpoints

- [ ] `/IMPORTANT/cart_api.php` returns empty cart
  - [ ] Create new session
  - [ ] Call GET request
  - [ ] Verify empty cart response
  
- [ ] Add to cart functionality
  - [ ] Call POST with add action
  - [ ] Verify item added to cart
  - [ ] Verify cart count increases

### Order Endpoints

- [ ] `/IMPORTANT/order_api.php` creates orders
  - [ ] Call POST with create action
  - [ ] Verify order created in database
  - [ ] Verify order ID returned
  
- [ ] Retrieve orders
  - [ ] Call GET with filters
  - [ ] Verify correct orders returned

---

## CORS Testing

- [ ] API calls work from React frontend
  - [ ] No CORS errors in console
  - [ ] Requests complete successfully
  - [ ] Response data received correctly
  
- [ ] PHP CORS headers set
  - [ ] Check Network tab in DevTools
  - [ ] Verify `Access-Control-Allow-*` headers present
  
- [ ] Credentials included in requests
  - [ ] Verify `Cookie` header in requests
  - [ ] Session cookies being sent

---

## Error Handling

### API Errors
- [ ] Invalid credentials show error message
- [ ] Network errors display gracefully
- [ ] 401 Unauthorized errors handled
- [ ] 403 Forbidden errors handled
- [ ] 500 Server errors handled

### Form Validation
- [ ] Empty email shows error
- [ ] Empty password shows error
- [ ] Invalid email format shows error
- [ ] Loading state shows while processing

---

## Performance Checks

- [ ] Page loads in < 2 seconds
- [ ] API calls complete in < 500ms
- [ ] No console warnings
- [ ] No memory leaks (DevTools → Memory)
- [ ] Lighthouse score > 80

---

## Browser Compatibility

- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest, if available)
- [ ] Edge (latest)
- [ ] Mobile browsers (iOS Safari, Chrome Mobile)

---

## Data Flow Verification

### Complete Login Flow
1. [ ] User enters credentials
2. [ ] React sends POST to PHP
3. [ ] PHP validates credentials
4. [ ] PHP returns JSON response
5. [ ] React stores session
6. [ ] AuthContext updates
7. [ ] User redirected to dashboard
8. [ ] Dashboard loads user data

### Protected Route Flow
1. [ ] User accesses protected route
2. [ ] ProtectedRoute component checks auth
3. [ ] If not authenticated, redirects to login
4. [ ] If authenticated but wrong role, shows error
5. [ ] If authorized, renders component

---

## Database Verification

- [ ] `users` table exists with:
  - [ ] `id` (primary key)
  - [ ] `email` (unique)
  - [ ] `password` (hashed)
  - [ ] `first_name`
  - [ ] `last_name`
  - [ ] `role` (admin/customer/worker)
  
- [ ] Test users exist:
  - [ ] Admin user: role = 'admin'
  - [ ] Customer user: role = 'customer'
  
- [ ] Sessions stored:
  - [ ] Sessions created on login
  - [ ] Sessions cleared on logout
  - [ ] Sessions expire appropriately

---

## Development Tools

### VS Code Extensions Installed
- [ ] ES7+ React/Redux/React-Native snippets
- [ ] Tailwind CSS IntelliSense
- [ ] TypeScript Vue Plugin
- [ ] ESLint
- [ ] Thunder Client or Postman (for API testing)

### Helpful VS Code Shortcuts
- [ ] Ctrl+K Ctrl+C - Comment code
- [ ] Ctrl+K Ctrl+U - Uncomment code
- [ ] Ctrl+Shift+L - Select all occurrences
- [ ] Alt+Shift+Down - Copy line down
- [ ] Ctrl+X - Cut line

### Testing Tools
- [ ] Thunder Client (VS Code) for API testing
- [ ] Chrome DevTools → Network tab for monitoring requests
- [ ] Chrome DevTools → Console for error messages
- [ ] Chrome DevTools → Application tab for cookies/storage

---

## Documentation Review

- [ ] Read QUICK_START.md (5 minutes)
- [ ] Review CONVERSION_GUIDE.md sections as needed
- [ ] Bookmark API_ENDPOINTS.md for reference
- [ ] Review available hooks in AuthContext
- [ ] Review API client functions

---

## Common Issues & Solutions

### Issue: CORS Error
- [ ] Verify PHP file has CORS headers
- [ ] Check `Access-Control-Allow-Origin` header
- [ ] Verify domain matches in header
- [ ] Check `credentials: 'include'` in fetch

**Resolution**: See CONVERSION_GUIDE.md → Troubleshooting

### Issue: 404 Not Found
- [ ] Verify endpoint path is correct
- [ ] Check PHP file exists in correct location
- [ ] Verify `VITE_API_BASE_URL` in `.env.local`
- [ ] Check server is running

**Resolution**: Verify file path matches exactly

### Issue: Session Not Persisting
- [ ] Verify `credentials: 'include'` in client.ts
- [ ] Check PHP session.save_path is writable
- [ ] Verify cookies are enabled
- [ ] Check cookie domain in browser

**Resolution**: See CONVERSION_GUIDE.md → Session Not Persisting

### Issue: Components Not Rendering
- [ ] Check browser console for errors
- [ ] Verify component export syntax
- [ ] Check route definition in App.tsx
- [ ] Verify required props passed

**Resolution**: Look at browser console error message

---

## Testing Scenarios

### Scenario 1: New User Login
- [ ] Click "Sign up" link from login page
- [ ] (When implemented) Fill signup form
- [ ] (When implemented) Create new account
- [ ] Login with new account
- [ ] Verify correct dashboard shown

### Scenario 2: Admin Workflow
- [ ] Login as admin
- [ ] Verify admin dashboard shows
- [ ] Click "Manage Users" button
- [ ] (When implemented) Verify users page loads
- [ ] Verify only admin can access

### Scenario 3: Customer Workflow
- [ ] Login as customer
- [ ] Verify customer dashboard shows
- [ ] Click "Browse Products" button
- [ ] Verify products page loads
- [ ] Test adding product to cart
- [ ] Test cart count updates

### Scenario 4: Session Timeout
- [ ] Login to application
- [ ] Wait for session timeout
- [ ] Try to access dashboard
- [ ] Verify redirected to login
- [ ] (When implemented) Show timeout warning

---

## Final Sign-Off

- [ ] All API endpoints created and tested
- [ ] All CORS issues resolved
- [ ] Authentication working end-to-end
- [ ] Protected routes functioning correctly
- [ ] Dashboard pages rendering properly
- [ ] No console errors or warnings
- [ ] Performance acceptable
- [ ] Browser compatibility verified
- [ ] Ready for additional feature development

---

## Next Steps After Verification

1. Create remaining PHP API endpoints (24 total)
2. Build additional React pages (Cart, Orders, Profile, etc.)
3. Implement file uploads for inspections
4. Add real-time notifications
5. Set up automated testing
6. Prepare for production deployment

---

## Support

If any items fail:

1. **Check console** (F12 → Console tab)
2. **Review error message** - read it carefully
3. **Check relevant documentation**:
   - QUICK_START.md
   - CONVERSION_GUIDE.md
   - API_ENDPOINTS.md
4. **Search Google** for the error message
5. **Check browser Network tab** (F12 → Network) for failed requests

---

**Checklist Version**: 1.0  
**Last Updated**: June 2, 2026  
**Status**: Ready for integration testing
