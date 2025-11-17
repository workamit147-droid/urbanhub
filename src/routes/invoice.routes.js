import express from "express";
import {
  generateInvoice,
  sendInvoiceEmail,
  getInvoice,
  getAllInvoices,
} from "../controllers/invoice.controller.js";
import authMiddleware from "../middlewares/auth.middleware.js";
import role from "../middlewares/role.middleware.js";

const router = express.Router();

// Apply auth and admin role middleware to all routes
router.use(authMiddleware);
router.use(role(["admin"]));

// Invoice list
router.get("/", getAllInvoices);

// Generate invoice from order
router.get("/generate/:orderId", generateInvoice);

// Get specific invoice
router.get("/:invoiceId", getInvoice);

// Send invoice via email
router.post("/:orderId/email", sendInvoiceEmail);

export default router;
