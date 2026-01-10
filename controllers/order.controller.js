import Stripe from "../config/stripe.js";
import CartProductModel from "../models/cartproduct.model.js";
import OrderModel from "../models/order.model.js";
import UserModel from "../models/user.model.js";
import mongoose from "mongoose";

// =====================================================
// 1. CASH ON DELIVERY CONTROLLER
// =====================================================
export async function CashOnDeliveryOrderController(request, response) {
  try {
    const userId = request.userId;
    const { list_items, totalAmt, addressId, subTotalAmt } = request.body;

    if (!Array.isArray(list_items) || !list_items.length) {
      return response.status(400).json({
        message: "No items provided",
        error: true,
        success: false,
      });
    }

    const payload = list_items.map((el) => ({
      userId,
      orderId: `ORD-${new mongoose.Types.ObjectId()}`,

      // Product refs
      productId: el.productId._id || el.productId,
      product_details: {
        name: el.productId.name,
        image: el.productId.image,
      },

      // Payment details
      paymentId: "",
      payment_method: "cod",
      payment_status: "pending",

      // Address + amounts
      delivery_address: addressId,  // <--- IMPORTANT
      subTotalAmt: subTotalAmt ?? 0,
      totalAmt: totalAmt ?? 0,

      // Order status
      order_status: "placed",
      tracking: [
        {
          status: "placed",
          time: new Date(),
        },
      ],
    }));

    const generatedOrder = await OrderModel.insertMany(payload);

    // Clear cart
    await CartProductModel.deleteMany({ userId });
    await UserModel.updateOne({ _id: userId }, { shopping_cart: [] });

    return response.json({
      message: "Order successfully placed",
      error: false,
      success: true,
      data: generatedOrder,
    });
  } catch (error) {
    return response.status(500).json({
      message: error.message || error,
      error: true,
      success: false,
    });
  }
}

// =====================================================
// 2. PRICE WITH DISCOUNT
// =====================================================
export const pricewithDiscount = (price, dis = 1) => {
  const discountAmout = Math.ceil((Number(price) * Number(dis)) / 100);
  return Number(price) - Number(discountAmout);
};

// =====================================================
// 3. STRIPE PAYMENT CONTROLLER
// =====================================================
export async function paymentController(request, response) {
  try {
    const userId = request.userId;
    const { list_items, totalAmt, addressId, subTotalAmt } = request.body;

    const user = await UserModel.findById(userId);
    if (!user) {
      return response.status(400).json({ message: "User not found" });
    }

    const line_items = list_items.map((item) => ({
      price_data: {
        currency: "inr",
        product_data: {
          name: item.productId.name,
          images: item.productId.image,
          metadata: {
            productId: String(item.productId._id || item.productId),
          },
        },
        unit_amount:
          pricewithDiscount(item.productId.price, item.productId.discount) *
          100,
      },
      adjustable_quantity: {
        enabled: true,
        minimum: 1,
      },
      quantity: item.quantity,
    }));

    const session = await Stripe.checkout.sessions.create({
      submit_type: "pay",
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: user.email,
      metadata: {
        userId,
        addressId,
      },
      line_items,
      success_url: `${process.env.FRONTEND_URL}/success`,
      cancel_url: `${process.env.FRONTEND_URL}/cancel`,
    });

    return response.status(200).json(session);
  } catch (error) {
    return response.status(500).json({
      message: error.message || error,
      error: true,
      success: false,
    });
  }
}

// =====================================================
// 4. CREATE ORDER AFTER STRIPE PAYMENT
// =====================================================
const getOrderProductItems = async ({
  lineItems,
  userId,
  addressId,
  paymentId,
  payment_status,
}) => {
  const productList = [];

  if (lineItems?.data?.length) {
    for (const item of lineItems.data) {
      const product = await Stripe.products.retrieve(item.price.product);

      productList.push({
        userId,
        orderId: `ORD-${new mongoose.Types.ObjectId()}`,
        productId: product.metadata.productId,
        product_details: {
          name: product.name,
          image: product.images,
        },
        paymentId: paymentId || "",
        payment_method: "online",
        payment_status: payment_status || "paid",
        delivery_address: addressId,   // <--- IMPORTANT
        subTotalAmt: Number(item.amount_total / 100),
        totalAmt: Number(item.amount_total / 100),
        order_status: "placed",
        tracking: [
          {
            status: "placed",
            time: new Date(),
          },
        ],
      });
    }
  }

  return productList;
};

// =====================================================
// 5. STRIPE WEBHOOK
// =====================================================
export async function webhookStripe(request, response) {
  const event = request.body;

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;

        const lineItems = await Stripe.checkout.sessions.listLineItems(
          session.id
        );

        const orderProduct = await getOrderProductItems({
          lineItems,
          userId: session.metadata.userId,
          addressId: session.metadata.addressId,
          paymentId: session.payment_intent,
          payment_status: session.payment_status,
        });

        // Save orders
        const order = await OrderModel.insertMany(orderProduct);

        if (order && order.length) {
          await UserModel.findByIdAndUpdate(session.metadata.userId, {
            shopping_cart: [],
          });
          await CartProductModel.deleteMany({
            userId: session.metadata.userId,
          });
        }
        break;
      }
      default:
        break;
    }

    return response.json({ received: true });
  } catch (error) {
    return response.status(500).json({ received: false, error: error.message });
  }
}

// =====================================================
// 6. GET ORDER DETAILS (USER)
// =====================================================
export async function getOrderDetailsController(request, response) {
  try {
    const userId = request.userId;

    const orderlist = await OrderModel.find({ userId })
      .sort({ createdAt: -1 })
      .populate("productId")
      .populate("delivery_address");

    return response.json({
      message: "order list",
      data: orderlist,
      error: false,
      success: true,
    });
  } catch (error) {
    return response.status(500).json({
      message: error.message || error,
      error: true,
      success: false,
    });
  }
}

// =====================================================
// 7. UPDATE ORDER STATUS (ADMIN)
// =====================================================
export async function updateOrderStatusController(req, res) {
  try {
    const { status } = req.body;
    const orderId = req.params.id;

    const updatedOrder = await OrderModel.findByIdAndUpdate(
      orderId,
      {
        order_status: status,
        $push: {
          tracking: { status, time: new Date() },
        },
      },
      { new: true }
    );

    return res.json({
      success: true,
      message: "Order status updated",
      data: updatedOrder,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: true,
      message: error.message || error,
    });
  }
}

// =====================================================
// 8. GET ALL ORDERS (ADMIN)
// =====================================================
export const getAllOrdersController = async (req, res) => {
  try {
    const orders = await OrderModel.find({})
      .populate("userId", "name email")
      .populate("productId")
      .populate("delivery_address")
      .sort({ createdAt: -1 });

    // Rename userId to user
    const formattedOrders = orders.map((order) => ({
      ...order._doc,
      user: order.userId,
    }));

    res.set("Cache-Control", "no-store");

    return res.json({
      success: true,
      data: formattedOrders,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || error,
    });
  }
};
