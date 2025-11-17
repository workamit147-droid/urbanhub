# Urban Hub Cart & Coupon System Setup Guide

## Quick Start

This guide will help you set up the complete cart and coupon system for Urban Hub.

## Backend Setup

### 1. Dependencies
All required dependencies are already included in `package.json`. The cart and coupon system uses:
- `mongoose` - MongoDB ODM
- `express` - Web framework
- `jsonwebtoken` - JWT authentication
- `bcrypt` - Password hashing

### 2. Database Models
The following models have been added:
- `src/models/cart.model.js` - Cart schema with items and coupon support
- `src/models/coupon.model.js` - Coupon schema with product-specific validation

### 3. Controllers
- `src/controllers/cart.controller.js` - Cart operations (CRUD, coupon apply/remove)
- `src/controllers/coupon.controller.js` - Admin coupon management

### 4. Routes
- `src/routes/cart.routes.js` - Public cart API endpoints
- `src/routes/coupon.routes.js` - Admin coupon API endpoints

### 5. Updated Files
- `src/index.js` - Added new route imports

## Frontend Setup

### 1. Dependencies
The following dependencies were added to support the cart and coupon system:
```bash
# Already installed
npm install react-hot-toast  # Toast notifications
npm install axios           # HTTP client
npm install lucide-react     # Icons
```

### 2. Context
- `src/contexts/CartContext.jsx` - Cart state management with React Context

### 3. API Services
- `src/api/cart.js` - Cart API client functions
- `src/api/coupons.js` - Admin coupon API client functions

### 4. Components
- Updated `src/components/Navbar.jsx` - Added cart icon with item counter
- Updated `src/components/ProductCard.jsx` - Added cart functionality

### 5. Pages
- `src/pages/Cart.jsx` - User cart page with coupon application
- `src/pages/admin/AdminCoupons.jsx` - Admin coupon list page
- `src/pages/admin/AdminCouponForm.jsx` - Admin coupon create/edit page

### 6. Updated Files
- `src/App.jsx` - Added new routes
- `src/main.jsx` - Added CartProvider

## Installation Steps

### Backend
```bash
cd Urban-Hub_Backend

# Install dependencies (if needed)
npm install

# Start the development server
npm start
```

### Frontend
```bash
cd Urban-Hub_Frontend

# Install dependencies (if needed)
npm install

# Start the development server
npm run dev
```

## Configuration

### Environment Variables
Ensure these variables are set in your `.env` files:

**Backend (.env):**
```env
JWT_SECRET=your_jwt_secret
MONGODB_URI=your_mongodb_connection_string
```

**Frontend (.env):**
```env
VITE_API_URL=http://localhost:5000
```

## Database Indexes

The models automatically create the following indexes for optimal performance:

**Cart Model:**
- `{ userId: 1 }`
- `{ sessionId: 1 }`
- `{ "items.productId": 1 }`

**Coupon Model:**
- `{ code: 1 }`
- `{ isActive: 1 }`
- `{ startDate: 1, endDate: 1 }`
- `{ applicableProducts: 1 }`

## API Endpoints Summary

### Cart APIs (Public)
- `GET /cart` - Get current cart
- `POST /cart/add` - Add item to cart
- `PUT /cart/item/:itemId` - Update item quantity
- `DELETE /cart/item/:itemId` - Remove item
- `POST /cart/clear` - Clear cart
- `POST /cart/merge` - Merge guest cart (auth required)
- `POST /cart/apply-coupon` - Apply coupon
- `POST /cart/remove-coupon` - Remove coupon

### Admin Coupon APIs (Admin Only)
- `POST /admin/coupons` - Create coupon
- `GET /admin/coupons` - List coupons
- `GET /admin/coupons/stats` - Coupon statistics
- `GET /admin/coupons/:id` - Get single coupon
- `PUT /admin/coupons/:id` - Update coupon
- `DELETE /admin/coupons/:id` - Delete coupon

## Features Overview

### Cart System
✅ **Add to Cart** - Add products with quantity validation
✅ **Update Cart** - Change quantities with stock validation
✅ **Remove Items** - Individual item removal
✅ **View Cart** - Complete cart display with calculations
✅ **Clear Cart** - Remove all items
✅ **Guest Cart** - Support for non-logged-in users with localStorage
✅ **Merge Cart** - Automatic merge when guest logs in
✅ **Real-time Updates** - Stock validation and price updates

### Coupon System
✅ **Product-Specific** - Coupons apply only to selected products
✅ **Percentage Discounts** - Currently supports percentage-based discounts
✅ **Date Validation** - Start and end date enforcement
✅ **Usage Limits** - Optional maximum usage constraints
✅ **Auto-removal** - Invalid coupons automatically removed
✅ **Admin Management** - Full CRUD interface for admins

### Admin Features
✅ **Coupon Management** - Create, edit, delete, and list coupons
✅ **Product Selection** - Multi-select products for coupon applicability
✅ **Statistics Dashboard** - Coupon usage and status statistics
✅ **Search & Filter** - Find coupons by code, status, etc.
✅ **Validation** - Comprehensive form validation and error handling

### User Experience
✅ **Cart Counter** - Navbar shows current item count
✅ **Guest Support** - Full cart functionality without login
✅ **Toast Notifications** - Real-time feedback for all actions
✅ **Stock Warnings** - Clear messages when stock is insufficient
✅ **Coupon Feedback** - Success/error messages for coupon operations
✅ **Responsive Design** - Mobile-friendly interface

## Testing the System

### 1. Basic Cart Operations
1. Visit the products page
2. Click "Add to Cart" on any product
3. Check navbar cart counter updates
4. Visit `/cart` to see cart contents
5. Update quantities and remove items
6. Test cart persistence

### 2. Guest Cart Functionality
1. Use the site without logging in
2. Add items to cart
3. Log in to an existing account
4. Verify cart items are preserved/merged

### 3. Coupon System
1. Log in as admin
2. Visit `/admin-dashboard/coupons`
3. Create a new coupon with specific products
4. Add applicable products to cart
5. Apply the coupon code
6. Verify discount is calculated correctly

### 4. Admin Features
1. Access admin dashboard
2. Navigate to Coupons section
3. Test create, edit, and delete operations
4. Verify search and filtering work
5. Check statistics display

## Troubleshooting

### Common Issues

**Cart not loading:**
- Check network tab for API errors
- Verify backend server is running
- Check JWT token validity

**Coupon not applying:**
- Ensure cart has applicable products
- Check coupon is active and within date range
- Verify coupon code is correct (case-insensitive)

**Guest cart not merging:**
- Check localStorage for `guestSessionId`
- Verify merge API is called on login
- Check browser console for errors

**Admin features not accessible:**
- Ensure user has admin role
- Check JWT token and authentication
- Verify admin routes are protected

### Development Tips

1. **Use browser dev tools** to monitor network requests
2. **Check server logs** for detailed error information
3. **Test edge cases** like empty carts and invalid coupons
4. **Verify data persistence** across browser sessions
5. **Test responsive design** on different screen sizes

## Next Steps

### Potential Enhancements
1. **Fixed Amount Coupons** - Add support for fixed discount amounts
2. **Minimum Order Value** - Coupon applicability based on cart total
3. **User-Specific Coupons** - Personalized coupon codes
4. **Bulk Operations** - Admin bulk coupon management
5. **Analytics** - Detailed usage statistics and reports
6. **Email Integration** - Coupon distribution via email
7. **Mobile App** - React Native implementation
8. **Payment Integration** - Checkout process with applied discounts

### Performance Optimizations
1. **Redis Caching** - Cache frequently accessed cart data
2. **Database Sharding** - Scale for high cart volumes
3. **CDN Integration** - Optimize frontend asset delivery
4. **Real-time Updates** - WebSocket integration for live cart updates

## Support

For issues or questions:
1. Check the API documentation in `docs/API_DOCUMENTATION.md`
2. Review error messages in browser console and server logs
3. Verify all environment variables are correctly set
4. Ensure database connections are working properly

The cart and coupon system is now fully functional and ready for production use!