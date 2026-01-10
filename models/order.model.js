import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
    },

    orderId: {
      type: String,
      required: [true, "Provide orderId"],
      unique: true,
    },

    productId: {
      type: mongoose.Schema.ObjectId,
      ref: "product",
    },

    product_details: {
      name: String,
      image: Array,
    },

    paymentId: {
      type: String,
      default: "",
    },

    payment_method: {
      type: String,
      default: "cod", // cod | online
    },

    payment_status: {
      type: String,
      default: "pending", // pending | paid | refunded
    },

    delivery_address: {
      type: mongoose.Schema.ObjectId,
      ref: "address",
    },

    subTotalAmt: {
      type: Number,
      default: 0,
    },

    totalAmt: {
      type: Number,
      default: 0,
    },

    order_status: {
      type: String,
      default: "placed", // placed | packed | shipped | out_for_delivery | delivered
    },

    tracking: {
      type: Array,
      default: () => [
        {
          status: "placed",
          time: new Date(),
        },
      ],
    },

    invoice_receipt: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

const OrderModel = mongoose.model("order", orderSchema);

export default OrderModel;
