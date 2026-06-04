# ACGC System: PHP API Endpoints Required

This document outlines the PHP API endpoints that need to be created to support the React frontend conversion.

## Overview

The React frontend communicates with your PHP backend through JSON API endpoints. Each endpoint should accept HTTP requests and return JSON responses.

## Authentication API Endpoints

### 1. Login Handler
**Endpoint**: `/Login/login_handler.php`  
**Method**: POST  
**Request**:
```json
{
  "email": "user@example.com",
  "password": "password",
  "remember_me": 0
}
```
**Response** (Success):
```json
{
  "success": true,
  "message": "Login successful",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "role": "customer"
  }
}
```
**Response** (Error):
```json
{
  "success": false,
  "message": "Invalid credentials"
}
```

### 2. Auth Check
**Endpoint**: `/IMPORTANT/auth_check.php`  
**Method**: GET  
**Description**: Check if user is authenticated and get session data  
**Response** (Authenticated):
```json
{
  "isAuthenticated": true,
  "user": {
    "id": 1,
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "role": "customer"
  },
  "role": "customer"
}
```
**Response** (Not Authenticated):
```json
{
  "isAuthenticated": false,
  "user": null,
  "role": "guest"
}
```

### 3. Logout
**Endpoint**: `/Login/Login.php?logout=true`  
**Method**: GET  
**Description**: Logout user and destroy session

---

## Products API Endpoints

### 1. Get Products
**Endpoint**: `/Products/products_api.php`  
**Method**: GET  
**Query Parameters**:
```
?category=Windows&active_only=1&limit=10&offset=0
```
**Response**:
```json
{
  "products": [
    {
      "id": 1,
      "name": "Sliding Window",
      "category": "Windows",
      "subcategory": "Sliding Window",
      "description": "High-quality sliding window",
      "image_url": "/images/product1.jpg",
      "price": 299.99,
      "is_active": true,
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  ],
  "total": 1
}
```

### 2. Get Single Product
**Endpoint**: `/Products/products_api.php?id=1`  
**Method**: GET  
**Response**:
```json
{
  "product": {
    "id": 1,
    "name": "Sliding Window",
    "category": "Windows",
    "subcategory": "Sliding Window",
    "description": "High-quality sliding window",
    "price": 299.99,
    "is_active": true,
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

### 3. Get Product Categories
**Endpoint**: `/Products/categories_api.php`  
**Method**: GET  
**Response**:
```json
{
  "categories": [
    {
      "name": "Windows",
      "subcategories": ["Sliding Window", "Awning Window", "Casement Window"]
    },
    {
      "name": "Doors",
      "subcategories": ["Single Door", "Double Door", "Sliding Door"]
    }
  ]
}
```

### 4. Get Product Add-ons
**Endpoint**: `/Products/addons_api.php?product_id=1`  
**Method**: GET  
**Response**:
```json
{
  "addons": [
    {
      "id": 1,
      "name": "Custom Color",
      "description": "Choose custom color",
      "price": 50.00,
      "category": "Customization",
      "is_enabled": true
    }
  ]
}
```

### 5. Get Product Pricing
**Endpoint**: `/Products/pricing_api.php?product_id=1`  
**Method**: GET  
**Response**:
```json
{
  "method": "per_unit",
  "rates": {
    "base": 299.99,
    "bulk_10": 250.00
  },
  "fees": {
    "installation": 50.00,
    "delivery": 100.00
  }
}
```

### 6. Create Product (Admin)
**Endpoint**: `/Products/products_api.php`  
**Method**: POST  
**Request**:
```json
{
  "name": "New Product",
  "category": "Windows",
  "subcategory": "Sliding Window",
  "description": "Product description",
  "price": 299.99
}
```
**Response**:
```json
{
  "success": true,
  "message": "Product created",
  "productId": 5
}
```

### 7. Update Product (Admin)
**Endpoint**: `/Products/products_api.php`  
**Method**: PUT  
**Request**:
```json
{
  "id": 1,
  "name": "Updated Product",
  "price": 349.99
}
```
**Response**:
```json
{
  "success": true,
  "message": "Product updated"
}
```

### 8. Delete Product (Admin)
**Endpoint**: `/Products/products_api.php?id=1`  
**Method**: DELETE  
**Response**:
```json
{
  "success": true,
  "message": "Product deleted"
}
```

---

## Cart API Endpoints

### 1. Get Cart
**Endpoint**: `/IMPORTANT/cart_api.php`  
**Method**: GET  
**Response**:
```json
{
  "items": [
    {
      "id": 1,
      "product_id": 5,
      "product_name": "Sliding Window",
      "quantity": 2,
      "unit_price": 299.99,
      "addons": [
        {
          "addon_id": 1,
          "addon_name": "Custom Color",
          "addon_price": 50.00
        }
      ],
      "subtotal": 699.98
    }
  ],
  "total": 699.98,
  "item_count": 1
}
```

### 2. Add to Cart
**Endpoint**: `/IMPORTANT/cart_api.php`  
**Method**: POST  
**Request**:
```json
{
  "action": "add",
  "product_id": 5,
  "quantity": 2,
  "addons": [1, 2]
}
```
**Response**:
```json
{
  "success": true,
  "message": "Item added to cart",
  "cart": { /* full cart object */ }
}
```

### 3. Remove from Cart
**Endpoint**: `/IMPORTANT/cart_api.php`  
**Method**: POST  
**Request**:
```json
{
  "action": "remove",
  "cart_item_id": 1
}
```
**Response**:
```json
{
  "success": true,
  "message": "Item removed from cart",
  "cart": { /* full cart object */ }
}
```

### 4. Update Cart Item
**Endpoint**: `/IMPORTANT/cart_api.php`  
**Method**: POST  
**Request**:
```json
{
  "action": "update",
  "cart_item_id": 1,
  "quantity": 5
}
```
**Response**:
```json
{
  "success": true,
  "message": "Cart updated",
  "cart": { /* full cart object */ }
}
```

### 5. Clear Cart
**Endpoint**: `/IMPORTANT/cart_api.php`  
**Method**: POST  
**Request**:
```json
{
  "action": "clear"
}
```
**Response**:
```json
{
  "success": true,
  "message": "Cart cleared"
}
```

---

## Orders API Endpoints

### 1. Create Order
**Endpoint**: `/IMPORTANT/order_api.php`  
**Method**: POST  
**Request**:
```json
{
  "action": "create",
  "delivery_date": "2024-03-15",
  "notes": "Please leave at gate",
  "delivery_address": "123 Main St"
}
```
**Response**:
```json
{
  "success": true,
  "message": "Order created successfully",
  "order": {
    "id": 10,
    "order_id": "ORD-20240215-001",
    "customer_id": 5,
    "status": "pending",
    "total_amount": 699.98,
    "created_at": "2024-02-15T00:00:00Z"
  }
}
```

### 2. Get Orders
**Endpoint**: `/IMPORTANT/order_api.php?status=pending&limit=10&offset=0`  
**Method**: GET  
**Response**:
```json
{
  "orders": [
    {
      "id": 10,
      "order_id": "ORD-20240215-001",
      "customer_id": 5,
      "customer_name": "John Doe",
      "customer_email": "john@example.com",
      "status": "pending",
      "total_amount": 699.98,
      "items": [ /* cart items */ ],
      "created_at": "2024-02-15T00:00:00Z",
      "delivery_date": "2024-03-15"
    }
  ],
  "total": 1
}
```

### 3. Get Single Order
**Endpoint**: `/IMPORTANT/order_api.php?order_id=ORD-20240215-001`  
**Method**: GET  
**Response**:
```json
{
  "order": {
    "id": 10,
    "order_id": "ORD-20240215-001",
    "customer_id": 5,
    "status": "pending",
    "total_amount": 699.98,
    "items": [ /* cart items */ ],
    "created_at": "2024-02-15T00:00:00Z"
  }
}
```

### 4. Cancel Order
**Endpoint**: `/IMPORTANT/cancel_order_api.php`  
**Method**: POST  
**Request**:
```json
{
  "order_id": "ORD-20240215-001"
}
```
**Response**:
```json
{
  "success": true,
  "message": "Order cancelled successfully"
}
```

---

## User Management API Endpoints

### 1. Get All Users (Admin)
**Endpoint**: `/IMPORTANT/users_api.php`  
**Method**: GET  
**Query Parameters**:
```
?role=customer&limit=20&offset=0
```
**Response**:
```json
{
  "users": [
    {
      "id": 1,
      "email": "john@example.com",
      "first_name": "John",
      "last_name": "Doe",
      "role": "customer",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ],
  "total": 1
}
```

### 2. Get Single User
**Endpoint**: `/IMPORTANT/users_api.php?id=1`  
**Method**: GET  
**Response**:
```json
{
  "user": {
    "id": 1,
    "email": "john@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "role": "customer",
    "phone": "555-1234",
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

### 3. Create User (Admin)
**Endpoint**: `/IMPORTANT/users_api.php`  
**Method**: POST  
**Request**:
```json
{
  "email": "newuser@example.com",
  "password": "securepassword",
  "first_name": "Jane",
  "last_name": "Smith",
  "role": "customer"
}
```
**Response**:
```json
{
  "success": true,
  "message": "User created",
  "userId": 5
}
```

### 4. Update User
**Endpoint**: `/IMPORTANT/users_api.php`  
**Method**: PUT  
**Request**:
```json
{
  "id": 1,
  "first_name": "John",
  "last_name": "Smith",
  "phone": "555-5678"
}
```
**Response**:
```json
{
  "success": true,
  "message": "User updated"
}
```

### 5. Delete User (Admin)
**Endpoint**: `/IMPORTANT/users_api.php?id=1`  
**Method**: DELETE  
**Response**:
```json
{
  "success": true,
  "message": "User deleted"
}
```

---

## Job Orders API Endpoints

### 1. Get Job Orders
**Endpoint**: `/JobOrders/job_orders_api.php`  
**Method**: GET  
**Query Parameters**:
```
?status=assigned&limit=10&offset=0
```
**Response**:
```json
{
  "job_orders": [
    {
      "id": 1,
      "order_id": "ORD-20240215-001",
      "worker_id": 3,
      "worker_name": "Mike Johnson",
      "status": "in_progress",
      "assigned_date": "2024-02-15T00:00:00Z",
      "deadline": "2024-02-20T00:00:00Z",
      "notes": "Installation in progress"
    }
  ],
  "total": 1
}
```

### 2. Update Job Order
**Endpoint**: `/JobOrders/job_orders_api.php`  
**Method**: PUT  
**Request**:
```json
{
  "id": 1,
  "status": "completed",
  "notes": "Installation completed successfully"
}
```
**Response**:
```json
{
  "success": true,
  "message": "Job order updated"
}
```

---

## Site Inspections API Endpoints

### 1. Get Inspections
**Endpoint**: `/SiteInspection/inspections_api.php`  
**Method**: GET  
**Query Parameters**:
```
?status=pending&limit=10&offset=0
```
**Response**:
```json
{
  "inspections": [
    {
      "id": 1,
      "order_id": "ORD-20240215-001",
      "inspector_id": 2,
      "inspector_name": "Sarah Smith",
      "status": "pending",
      "site_address": "123 Main St",
      "scheduled_date": "2024-02-18T10:00:00Z",
      "notes": "Initial site survey"
    }
  ],
  "total": 1
}
```

### 2. Update Inspection
**Endpoint**: `/SiteInspection/inspections_api.php`  
**Method**: PUT  
**Request**:
```json
{
  "id": 1,
  "status": "completed",
  "notes": "Site inspection completed",
  "photos": ["photo1.jpg", "photo2.jpg"]
}
```
**Response**:
```json
{
  "success": true,
  "message": "Inspection updated"
}
```

---

## Implementation Guidelines

### CORS Headers
Add to all API endpoints:
```php
<?php
header('Access-Control-Allow-Origin: ' . $_SERVER['HTTP_ORIGIN']);
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Credentials: true');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}
```

### Error Handling
```php
<?php
try {
    // API logic here
    echo json_encode([
        'success' => true,
        'message' => 'Operation successful'
    ]);
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}
```

### Authentication Check
```php
<?php
session_start();
if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit();
}
```

### Admin Check
```php
<?php
if ($_SESSION['user_role'] !== 'admin') {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Forbidden']);
    exit();
}
```

---

## Summary

Total endpoints needed: **24 API endpoints**

Priority order:
1. **Authentication** (2 endpoints) - Required for login
2. **Cart & Orders** (9 endpoints) - Core functionality
3. **Products** (8 endpoints) - Main features
4. **Users** (5 endpoints) - Admin management

---

**Last Updated**: June 2, 2026
