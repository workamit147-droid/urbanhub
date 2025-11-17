import Cart from "../models/cart.model.js";
import Product from "../models/product.model.js";
import Coupon from "../models/coupon.model.js";
import mongoose from "mongoose";

// Helper function to get or create cart
const getOrCreateCart = async (userId, sessionId) => {
  let cart;

  if (userId) {
    cart = await Cart.findOne({ userId }).populate({
      path: "items.productId",
      select: "title sku stock isActive price",
    });

    if (!cart) {
      cart = new Cart({ userId });
    }
  } else if (sessionId) {
    cart = await Cart.findOne({ sessionId }).populate({
      path: "items.productId",
      select: "title sku stock isActive price",
    });

    if (!cart) {
      cart = new Cart({ sessionId });
    }
  } else {
    throw new Error("Either userId or sessionId is required");
  }

  return cart;
};

// Helper function to validate stock
const validateStock = (product, requestedQuantity, existingQuantity = 0) => {
  if (!product.isActive) {
    throw new Error(`Product ${product.title} is not available`);
  }

  const totalQuantity = existingQuantity + requestedQuantity;
  if (totalQuantity > product.stock) {
    return {
      valid: false,
      maxAllowed: Math.max(0, product.stock - existingQuantity),
      message: `Only ${product.stock} units available for ${product.title}. You already have ${existingQuantity} in cart.`,
    };
  }

  return { valid: true };
};

// ADD TO CART
export const addToCart = async (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body;
    const userId = req.user?.id;
    const sessionId = req.headers["x-session-id"];

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "Product ID is required",
      });
    }

    if (!mongoose.isValidObjectId(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    if (quantity < 1) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be at least 1",
      });
    }

    // Get product
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Get or create cart
    const cart = await getOrCreateCart(userId, sessionId);

    // Check existing quantity in cart
    const existingItem = cart.items.find(
      (item) => item.productId.toString() === productId
    );
    const existingQuantity = existingItem ? existingItem.quantity : 0;

    // Validate stock
    const stockValidation = validateStock(product, quantity, existingQuantity);
    if (!stockValidation.valid) {
      return res.status(400).json({
        success: false,
        message: stockValidation.message,
        maxAllowed: stockValidation.maxAllowed,
      });
    }

    // Add item to cart
    cart.addItem(product, quantity, product.price);

    // Revalidate coupon if applied
    if (cart.coupon) {
      const coupon = await Coupon.findOne({ code: cart.coupon.code });
      if (
        !coupon ||
        !coupon.isValid() ||
        !coupon.isApplicableToProducts([productId])
      ) {
        cart.removeCoupon();
      } else {
        // Recalculate discount
        const discountCalculation = coupon.calculateDiscount(cart.items);
        cart.applyCoupon(coupon, discountCalculation);
      }
    }

    await cart.save();

    // Populate the cart for response
    const populatedCart = await Cart.findById(cart._id).populate({
      path: "items.productId",
      select: "title sku stock isActive price images",
    });

    res.json({
      success: true,
      message: existingItem
        ? "Cart item quantity updated"
        : "Item added to cart",
      cart: populatedCart,
    });
  } catch (error) {
    console.error("Add to cart error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add item to cart",
      error: error.message,
    });
  }
};

// GET CART
export const getCart = async (req, res) => {
  try {
    const userId = req.user?.id;
    const sessionId = req.headers["x-session-id"];

    const cart = await getOrCreateCart(userId, sessionId);

    // Validate all items are still active and in stock
    const validItems = [];
    const removedItems = [];

    for (const item of cart.items) {
      const product = await Product.findById(item.productId);

      if (!product || !product.isActive) {
        removedItems.push({
          title: item.productSnapshot.title,
          reason: "Product no longer available",
        });
        continue;
      }

      if (item.quantity > product.stock) {
        if (product.stock > 0) {
          // Adjust quantity to available stock
          item.quantity = product.stock;
          validItems.push(item);
          removedItems.push({
            title: item.productSnapshot.title,
            reason: `Quantity reduced to ${product.stock} (available stock)`,
          });
        } else {
          removedItems.push({
            title: item.productSnapshot.title,
            reason: "Out of stock",
          });
        }
      } else {
        validItems.push(item);
      }
    }

    // Update cart with valid items
    cart.items = validItems;

    // Revalidate coupon
    if (cart.coupon && cart.items.length > 0) {
      const coupon = await Coupon.findOne({ code: cart.coupon.code });
      if (!coupon || !coupon.isValid()) {
        cart.removeCoupon();
        removedItems.push({
          title: "Coupon",
          reason: "Coupon expired or invalid",
        });
      } else {
        const discountCalculation = coupon.calculateDiscount(cart.items);
        if (discountCalculation.discountAmount === 0) {
          cart.removeCoupon();
          removedItems.push({
            title: "Coupon",
            reason: "No applicable products in cart",
          });
        } else {
          cart.applyCoupon(coupon, discountCalculation);
        }
      }
    }

    cart.calculateFinalTotal();
    await cart.save();

    const populatedCart = await Cart.findById(cart._id).populate({
      path: "items.productId",
      select: "title sku stock isActive price images",
    });

    res.json({
      success: true,
      cart: populatedCart,
      removedItems: removedItems.length > 0 ? removedItems : undefined,
    });
  } catch (error) {
    console.error("Get cart error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch cart",
      error: error.message,
    });
  }
};

// UPDATE CART ITEM
export const updateCartItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { quantity } = req.body;
    const userId = req.user?.id;
    const sessionId = req.headers["x-session-id"];

    if (!mongoose.isValidObjectId(itemId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid item ID",
      });
    }

    if (quantity < 0) {
      return res.status(400).json({
        success: false,
        message: "Quantity cannot be negative",
      });
    }

    const cart = await getOrCreateCart(userId, sessionId);
    const item = cart.items.id(itemId);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Cart item not found",
      });
    }

    if (quantity === 0) {
      // Remove item
      cart.removeItem(itemId);
    } else {
      // Validate stock for new quantity
      const product = await Product.findById(item.productId);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: "Product not found",
        });
      }

      const stockValidation = validateStock(product, 0, quantity);
      if (!stockValidation.valid) {
        return res.status(400).json({
          success: false,
          message: stockValidation.message,
          maxAllowed: stockValidation.maxAllowed,
        });
      }

      cart.updateItemQuantity(itemId, Math.min(quantity, product.stock));
    }

    // Revalidate coupon
    if (cart.coupon && cart.items.length > 0) {
      const coupon = await Coupon.findOne({ code: cart.coupon.code });
      if (coupon && coupon.isValid()) {
        const discountCalculation = coupon.calculateDiscount(cart.items);
        if (discountCalculation.discountAmount > 0) {
          cart.applyCoupon(coupon, discountCalculation);
        } else {
          cart.removeCoupon();
        }
      } else {
        cart.removeCoupon();
      }
    }

    await cart.save();

    const populatedCart = await Cart.findById(cart._id).populate({
      path: "items.productId",
      select: "title sku stock isActive price images",
    });

    res.json({
      success: true,
      message: quantity === 0 ? "Item removed from cart" : "Cart item updated",
      cart: populatedCart,
    });
  } catch (error) {
    console.error("Update cart item error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update cart item",
      error: error.message,
    });
  }
};

// REMOVE CART ITEM
export const removeCartItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const userId = req.user?.id;
    const sessionId = req.headers["x-session-id"];

    if (!mongoose.isValidObjectId(itemId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid item ID",
      });
    }

    const cart = await getOrCreateCart(userId, sessionId);

    if (!cart.items.id(itemId)) {
      return res.status(404).json({
        success: false,
        message: "Cart item not found",
      });
    }

    cart.removeItem(itemId);
    await cart.save();

    const populatedCart = await Cart.findById(cart._id).populate({
      path: "items.productId",
      select: "title sku stock isActive price images",
    });

    res.json({
      success: true,
      message: "Item removed from cart",
      cart: populatedCart,
    });
  } catch (error) {
    console.error("Remove cart item error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to remove cart item",
      error: error.message,
    });
  }
};

// CLEAR CART
export const clearCart = async (req, res) => {
  try {
    const userId = req.user?.id;
    const sessionId = req.headers["x-session-id"];

    const cart = await getOrCreateCart(userId, sessionId);

    cart.clearCart();
    await cart.save();

    res.json({
      success: true,
      message: "Cart cleared successfully",
      cart: {
        items: [],
        subtotal: 0,
        coupon: null,
        totalDiscount: 0,
        finalTotal: 0,
      },
    });
  } catch (error) {
    console.error("Clear cart error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to clear cart",
      error: error.message,
    });
  }
};

// MERGE CART (for when guest logs in)
export const mergeCart = async (req, res) => {
  try {
    const { guestSessionId } = req.body;
    const userId = req.user.id;

    if (!guestSessionId) {
      return res.status(400).json({
        success: false,
        message: "Guest session ID is required",
      });
    }

    // Get guest cart
    const guestCart = await Cart.findOne({ sessionId: guestSessionId });
    if (!guestCart || guestCart.items.length === 0) {
      return res.json({
        success: true,
        message: "No guest cart to merge",
        cart: await getOrCreateCart(userId, null),
      });
    }

    // Get or create user cart
    const userCart = await getOrCreateCart(userId, null);

    // Validate guest cart items stock before merging
    const validGuestItems = [];
    for (const item of guestCart.items) {
      const product = await Product.findById(item.productId);
      if (product && product.isActive && product.stock > 0) {
        // Adjust quantity if exceeds stock
        item.quantity = Math.min(item.quantity, product.stock);
        validGuestItems.push(item);
      }
    }

    // Update guest cart with valid items only
    guestCart.items = validGuestItems;

    // Merge carts
    userCart.mergeWith(guestCart);

    // Cap quantities by stock
    for (const item of userCart.items) {
      const product = await Product.findById(item.productId);
      if (product) {
        item.quantity = Math.min(item.quantity, product.stock);
      }
    }

    await userCart.save();

    // Delete guest cart
    await Cart.findByIdAndDelete(guestCart._id);

    const populatedCart = await Cart.findById(userCart._id).populate({
      path: "items.productId",
      select: "title sku stock isActive price images",
    });

    res.json({
      success: true,
      message: "Carts merged successfully",
      cart: populatedCart,
    });
  } catch (error) {
    console.error("Merge cart error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to merge carts",
      error: error.message,
    });
  }
};

// APPLY COUPON
export const applyCoupon = async (req, res) => {
  try {
    const { code } = req.body;
    const userId = req.user?.id;
    const sessionId = req.headers["x-session-id"];

    if (!code) {
      return res.status(400).json({
        success: false,
        message: "Coupon code is required",
      });
    }

    const cart = await getOrCreateCart(userId, sessionId);

    if (cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot apply coupon to empty cart",
      });
    }

    // Find coupon
    const coupon = await Coupon.findOne({ code: code.toUpperCase() });
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Invalid coupon code",
      });
    }

    // Validate coupon
    if (!coupon.isValid()) {
      return res.status(400).json({
        success: false,
        message: "Coupon is expired or inactive",
      });
    }

    // Check if cart has applicable products
    const cartProductIds = cart.items.map((item) => item.productId);
    if (!coupon.isApplicableToProducts(cartProductIds)) {
      return res.status(400).json({
        success: false,
        message: "Coupon is not applicable to any products in your cart",
      });
    }

    // Calculate discount
    const discountCalculation = coupon.calculateDiscount(cart.items);
    if (discountCalculation.discountAmount === 0) {
      return res.status(400).json({
        success: false,
        message: "Coupon cannot be applied to current cart items",
      });
    }

    // Apply coupon
    cart.applyCoupon(coupon, discountCalculation);
    await cart.save();

    const populatedCart = await Cart.findById(cart._id).populate({
      path: "items.productId",
      select: "title sku stock isActive price images",
    });

    res.json({
      success: true,
      message: "Coupon applied successfully",
      cart: populatedCart,
      discount: {
        code: coupon.code,
        discountAmount: discountCalculation.discountAmount,
        applicableItems: discountCalculation.applicableItems.length,
      },
    });
  } catch (error) {
    console.error("Apply coupon error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to apply coupon",
      error: error.message,
    });
  }
};

// REMOVE COUPON
export const removeCoupon = async (req, res) => {
  try {
    const userId = req.user?.id;
    const sessionId = req.headers["x-session-id"];

    const cart = await getOrCreateCart(userId, sessionId);

    if (!cart.coupon) {
      return res.status(400).json({
        success: false,
        message: "No coupon applied to cart",
      });
    }

    const removedCouponCode = cart.coupon.code;
    cart.removeCoupon();
    await cart.save();

    const populatedCart = await Cart.findById(cart._id).populate({
      path: "items.productId",
      select: "title sku stock isActive price images",
    });

    res.json({
      success: true,
      message: `Coupon ${removedCouponCode} removed successfully`,
      cart: populatedCart,
    });
  } catch (error) {
    console.error("Remove coupon error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to remove coupon",
      error: error.message,
    });
  }
};
