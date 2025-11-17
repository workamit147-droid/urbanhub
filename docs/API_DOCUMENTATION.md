# Urban Hub Cart & Coupon System API Documentation

## Overview
This document describes the complete Cart and Coupon management system for Urban Hub, including both backend APIs and frontend implementation.

## Backend API Endpoints

### Cart API Endpoints

#### Base URL: `/cart`

#### 1. GET /cart
**Description:** Get current user's cart
**Authentication:** Optional (supports both logged-in users and guests)
**Headers:**
- `Authorization: Bearer <token>` (optional, for logged-in users)
- `x-session-id: <session_id>` (optional, for guest users)

**Response:**
```json
{
  "success": true,
  "cart": {
    "_id": "cart_id",
    "userId": "user_id", // null for guest carts
    "sessionId": "session_id", // for guest carts
    "items": [
      {
        "_id": "item_id",
        "productId": "product_id",
        "productSnapshot": {
          "title": "Product Name",
          "sku": "PRODUCT-SKU",
          "image": {
            "url": "image_url",
            "alt": "image_alt"
          },
          "attributes": {
            "size": "Medium",
            "color": "Green",
            "potType": "Ceramic",
            "indoorOutdoor": "Indoor"
          }
        },
        "quantity": 2,
        "priceAtAdd": 299,
        "currency": "INR"
      }
    ],
    "subtotal": 598,
    "coupon": {
      "code": "SAVE20",
      "discountType": "percentage",
      "discountValue": 20,
      "discountAmount": 120,
      "applicableProducts": ["product_id1", "product_id2"]
    },
    "totalDiscount": 120,
    "finalTotal": 478
  },
  "removedItems": [ // Items that were removed due to stock/availability issues
    {
      "title": "Product Name",
      "reason": "Out of stock"
    }
  ]
}
```

#### 2. POST /cart/add
**Description:** Add item to cart
**Authentication:** Optional

**Request Body:**
```json
{
  "productId": "product_id",
  "quantity": 1
}
```

**Response:**
```json
{
  "success": true,
  "message": "Item added to cart",
  "cart": { /* cart object */ }
}
```

**Error Response (Insufficient Stock):**
```json
{
  "success": false,
  "message": "Only 3 units available for Product Name. You already have 1 in cart.",
  "maxAllowed": 2
}
```

#### 3. PUT /cart/item/:itemId
**Description:** Update cart item quantity
**Authentication:** Optional

**Request Body:**
```json
{
  "quantity": 3
}
```

**Response:**
```json
{
  "success": true,
  "message": "Cart item updated",
  "cart": { /* cart object */ }
}
```

#### 4. DELETE /cart/item/:itemId
**Description:** Remove item from cart
**Authentication:** Optional

**Response:**
```json
{
  "success": true,
  "message": "Item removed from cart",
  "cart": { /* cart object */ }
}
```

#### 5. POST /cart/clear
**Description:** Clear entire cart
**Authentication:** Optional

**Response:**
```json
{
  "success": true,
  "message": "Cart cleared successfully",
  "cart": {
    "items": [],
    "subtotal": 0,
    "coupon": null,
    "totalDiscount": 0,
    "finalTotal": 0
  }
}
```

#### 6. POST /cart/merge
**Description:** Merge guest cart with user cart (when guest logs in)
**Authentication:** Required

**Request Body:**
```json
{
  "guestSessionId": "guest_session_id"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Carts merged successfully",
  "cart": { /* merged cart object */ }
}
```

#### 7. POST /cart/apply-coupon
**Description:** Apply coupon to cart
**Authentication:** Optional

**Request Body:**
```json
{
  "code": "SAVE20"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Coupon applied successfully",
  "cart": { /* cart object with applied coupon */ },
  "discount": {
    "code": "SAVE20",
    "discountAmount": 120,
    "applicableItems": 2
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "Coupon is not applicable to any products in your cart"
}
```

#### 8. POST /cart/remove-coupon
**Description:** Remove applied coupon from cart
**Authentication:** Optional

**Response:**
```json
{
  "success": true,
  "message": "Coupon SAVE20 removed successfully",
  "cart": { /* cart object without coupon */ }
}
```

### Admin Coupon API Endpoints

#### Base URL: `/admin/coupons`
#### Authentication: Required (Admin only)

#### 1. POST /admin/coupons
**Description:** Create new coupon

**Request Body:**
```json
{
  "code": "SAVE20",
  "discountType": "percentage",
  "discountValue": 20,
  "applicableProducts": ["product_id1", "product_id2"],
  "startDate": "2024-01-01",
  "endDate": "2024-12-31",
  "isActive": true,
  "maxUsage": 100
}
```

**Response:**
```json
{
  "success": true,
  "message": "Coupon created successfully",
  "coupon": { /* populated coupon object */ }
}
```

#### 2. GET /admin/coupons
**Description:** Get all coupons with filtering and pagination

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10)
- `search`: Search by coupon code
- `isActive`: Filter by active status (true/false)
- `sortBy`: Sort field (default: "createdAt")
- `sortOrder`: Sort order (asc/desc, default: "desc")

**Response:**
```json
{
  "success": true,
  "coupons": [
    {
      "_id": "coupon_id",
      "code": "SAVE20",
      "discountType": "percentage",
      "discountValue": 20,
      "applicableProducts": [ /* populated product objects */ ],
      "startDate": "2024-01-01T00:00:00.000Z",
      "endDate": "2024-12-31T23:59:59.000Z",
      "isActive": true,
      "usageCount": 15,
      "maxUsage": 100,
      "createdBy": { /* admin user object */ },
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "isDateValid": true,
      "isFullyValid": true,
      "applicableProductCount": 5
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 3,
    "totalCoupons": 25,
    "hasNext": true,
    "hasPrev": false
  }
}
```

#### 3. GET /admin/coupons/:id
**Description:** Get single coupon by ID

**Response:**
```json
{
  "success": true,
  "coupon": { /* populated coupon object */ }
}
```

#### 4. PUT /admin/coupons/:id
**Description:** Update coupon

**Request Body:**
```json
{
  "discountValue": 25,
  "isActive": false
}
```

**Response:**
```json
{
  "success": true,
  "message": "Coupon updated successfully",
  "coupon": { /* updated coupon object */ }
}
```

#### 5. DELETE /admin/coupons/:id
**Description:** Delete coupon

**Response:**
```json
{
  "success": true,
  "message": "Coupon deleted successfully"
}
```

#### 6. GET /admin/coupons/stats
**Description:** Get coupon statistics

**Response:**
```json
{
  "success": true,
  "stats": {
    "totalCoupons": 25,
    "activeCoupons": 15,
    "expiredCoupons": 5,
    "upcomingCoupons": 2,
    "inactiveCoupons": 10
  }
}
```

## Frontend Implementation

### Cart Context API

#### useCart Hook

```javascript
import { useCart } from '../contexts/CartContext';

const {
  cart,              // Current cart state
  loading,           // Loading state
  error,            // Error state
  
  // Cart operations
  fetchCart,        // () => Promise<void>
  addToCart,        // (productId, quantity) => Promise<boolean>
  updateCartItem,   // (itemId, quantity) => Promise<boolean>
  removeCartItem,   // (itemId) => Promise<boolean>
  clearCart,        // () => Promise<boolean>
  
  // Coupon operations
  applyCoupon,      // (code) => Promise<boolean>
  removeCoupon,     // () => Promise<boolean>
  
  // Helper functions
  getItemCount,     // () => number
  isInCart,         // (productId) => boolean
  getCartItem,      // (productId) => CartItem | undefined
} = useCart();
```

### Component Usage Examples

#### Adding to Cart
```javascript
import { useCart } from '../contexts/CartContext';

const ProductCard = ({ product }) => {
  const { addToCart, isInCart } = useCart();
  
  const handleAddToCart = async () => {
    const success = await addToCart(product._id, 1);
    if (success) {
      // Item added successfully
    }
  };
  
  return (
    <button onClick={handleAddToCart} disabled={isInCart(product._id)}>
      {isInCart(product._id) ? 'In Cart' : 'Add to Cart'}
    </button>
  );
};
```

#### Applying Coupon
```javascript
import { useCart } from '../contexts/CartContext';

const CouponInput = () => {
  const [code, setCode] = useState('');
  const { applyCoupon } = useCart();
  
  const handleApply = async (e) => {
    e.preventDefault();
    const success = await applyCoupon(code);
    if (success) {
      setCode('');
    }
  };
  
  return (
    <form onSubmit={handleApply}>
      <input value={code} onChange={(e) => setCode(e.target.value)} />
      <button type="submit">Apply Coupon</button>
    </form>
  );
};
```

## Guest Cart Implementation

### LocalStorage Management
- Guest users get a unique session ID stored in `localStorage`
- Session ID format: `guest_{timestamp}_{random_string}`
- Cart data is maintained server-side using session ID
- On login, guest cart is automatically merged with user cart

### Auto-merge Flow
1. Guest adds items to cart (stored with session ID)
2. Guest logs in
3. `CartContext` detects user login
4. Automatically calls merge API with guest session ID
5. Server merges guest cart with user cart
6. Guest session ID is cleared from localStorage

## Coupon System Rules

### Validation Rules
1. **Date Validation:** Coupon must be within start and end date
2. **Active Status:** Coupon must be active
3. **Usage Limit:** Must not exceed maxUsage (if set)
4. **Product Applicability:** Cart must contain at least one applicable product
5. **Code Uniqueness:** Coupon codes must be unique (case-insensitive)

### Discount Calculation
- Only percentage discounts are currently supported
- Discount applies only to applicable products in cart
- Discount amount = (applicable_subtotal × discount_percentage) / 100
- Final total = subtotal - discount_amount

### Auto-removal Rules
Coupons are automatically removed when:
- Coupon expires or becomes inactive
- All applicable products are removed from cart
- Cart becomes empty

## Error Handling

### Common Error Scenarios
1. **Insufficient Stock:** When adding/updating cart items exceeds available stock
2. **Invalid Coupon:** Expired, inactive, or non-existent coupons
3. **Product Unavailability:** Products removed or deactivated
4. **Authentication Errors:** Invalid tokens (graceful fallback to guest mode for cart)

### Error Response Format
```json
{
  "success": false,
  "message": "Human-readable error message",
  "error": "Technical error details" // Only in development
}
```

## Security Considerations

### Authentication
- Cart operations support both authenticated users and guests
- Admin coupon operations require admin role
- JWT tokens validated on each request
- Graceful fallback to guest mode for invalid tokens

### Data Validation
- All inputs sanitized and validated
- Product existence verified before cart operations
- Stock levels validated in real-time
- Coupon applicability checked on every cart change

### Rate Limiting
- Recommended: Implement rate limiting for cart operations
- Suggested: 100 requests per minute per IP/user

## Performance Considerations

### Database Indexing
- Indexed fields: `code`, `isActive`, `startDate`, `endDate`, `applicableProducts`
- Cart queries optimized with product population
- Pagination implemented for large coupon lists

### Frontend Optimization
- Cart state cached in React context
- Real-time stock validation
- Optimistic UI updates with error rollback
- Debounced coupon application

## Testing Scenarios

### Cart Testing
1. Add items to cart (logged-in and guest)
2. Update quantities with stock validation
3. Remove individual items
4. Clear entire cart
5. Guest cart merge on login
6. Cart persistence across sessions

### Coupon Testing
1. Apply valid coupons
2. Test expired/inactive coupons
3. Verify product-specific application
4. Test discount calculations
5. Auto-removal scenarios
6. Admin CRUD operations

### Edge Cases
1. Empty cart coupon application
2. Concurrent cart modifications
3. Product stock changes during checkout
4. Network failures and recovery
5. Invalid session/token handling