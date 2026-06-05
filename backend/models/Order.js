import mongoose from "mongoose";

const OrderItemSchema = new mongoose.Schema(
  {
    product_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    unit_price: {
      type: Number,
      required: true,
      default: 0,
    },
    quantity: {
      type: Number,
      required: true,
      default: 1,
    },
    unit: {
      type: String,
      default: "piece",
    },
    width: {
      type: Number,
      default: 0,
      min: 0,
    },
    height: {
      type: Number,
      default: 0,
      min: 0,
    },
    area: {
      type: Number,
      default: 0,
      min: 0,
    },
    estimated_price: {
      type: Number,
      default: 0,
      min: 0,
    },
    notes: {
      type: String,
      trim: true,
      default: "",
    },
    is_estimate: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

const OrderSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    customer_name: {
      type: String,
      trim: true,
      default: "",
    },
    customer_phone: {
      type: String,
      trim: true,
      default: "",
    },
    items: {
      type: [OrderItemSchema],
      default: [],
    },
    payment_terms: {
      type: String,
      trim: true,
      default: "",
    },
    attachments: {
      type: [String],
      default: [],
    },
    total_amount: {
      type: Number,
      required: true,
      default: 0,
    },
    status: {
      type: String,
      enum: [
        "order_submitted",
        "admin_review",
        "site_inspection",
        "contract_sent",
        "contract_accepted",
        "contract_declined",
        "processing",
        "completed",
        "cancelled",
      ],
      default: "order_submitted",
    },
    order_type: {
      type: String,
      enum: ["online_order", "walk_in_customer"],
      default: "online_order",
    },
    contract_status: {
      type: String,
      enum: ["pending", "sent", "accepted", "declined"],
      default: "pending",
    },
    payment_status: {
      type: String,
      enum: ["not_paid", "paid"],
      default: "not_paid",
    },
    tracking: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    customer_email: {
      type: String,
      trim: true,
      default: "",
    },
    shipping_address: {
      type: String,
      default: "",
    },
    inspection_status: {
      type: String,
      enum: ["pending", "scheduled", "completed", "failed"],
      default: "pending",
    },
    inspection_date: {
      type: Date,
      default: null,
    },
    inspection_notes: {
      type: String,
      trim: true,
      default: "",
    },
    issues_found: {
      type: Boolean,
      default: false,
    },
    contract_terms: {
      type: String,
      trim: true,
      default: "",
    },
    contract_amount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Order", OrderSchema);
