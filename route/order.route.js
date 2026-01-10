import { Router } from "express";
import auth from "../middleware/auth.js";
import adminAuth from "../middleware/Admin.js";

import {
  CashOnDeliveryOrderController,
  getOrderDetailsController,
  getAllOrdersController,
  paymentController,
  webhookStripe,
  updateOrderStatusController,
} from "../controllers/order.controller.js";

const orderRouter = Router();

// ======================= USER ORDER ROUTES =========================

// Create COD order
orderRouter.post("/cash-on-delivery", auth, CashOnDeliveryOrderController);

// Stripe checkout
orderRouter.post("/checkout", auth, paymentController);

// Webhook for stripe (no auth)
orderRouter.post("/webhook", webhookStripe);

// Get orders of the logged-in user
orderRouter.get("/order-list", auth, getOrderDetailsController);

// ======================= ADMIN ORDER ROUTES =========================

// Disable cache for admin orders route to avoid 304 cached responses
orderRouter.use("/admin-orders", (req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

// Get all orders (ADMIN ONLY)
orderRouter.get("/admin-orders", auth, adminAuth, getAllOrdersController);

// Update order status (ADMIN ONLY)
orderRouter.put("/update-status/:id", auth, adminAuth, updateOrderStatusController);

export default orderRouter;
