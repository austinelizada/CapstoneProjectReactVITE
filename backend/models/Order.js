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
    measurement_unit: {
      type: String,
      default: "in",
    },
    area: {
      type: Number,
      default: 0,
      min: 0,
    },
    estimation_mode: {
      type: String,
      enum: ["auto", "manual"],
      default: "auto",
    },
    manual_estimated_total: {
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
        "approved",
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
    // Progress tracking
    progress: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    progress_stages: {
      type: [
        new mongoose.Schema(
          {
            key: { type: String, trim: true, default: "" },
            name: { type: String, trim: true, default: "" },
            status: {
              type: String,
              enum: ["pending", "in_progress", "done", "delayed", "on_hold"],
              default: "pending",
            },
            completed: { type: Boolean, default: false },
            date: { type: Date, default: null },
            delayReason: { type: String, trim: true, default: "" },
            delayExpectedResolution: { type: Date, default: null },
            delayNotes: { type: String, trim: true, default: "" },
            delayReportedAt: { type: Date, default: null },
            delayReportedBy: { type: String, trim: true, default: "" },
            proposedInstallationDate: { type: Date, default: null },
            proposedInstallationTime: { type: String, trim: true, default: "" },
            customerResponse: {
              type: String,
              enum: ["pending", "accepted", "declined", "reschedule_requested"],
              default: "pending",
            },
            customerResponseAt: { type: Date, default: null },
            customerDeclineReason: { type: String, trim: true, default: "" },
            customerPreferredInstallationDate: { type: Date, default: null },
            customerPreferredInstallationTime: { type: String, trim: true, default: "" },
            customerRescheduleNotes: { type: String, trim: true, default: "" },
            delayHistory: {
              type: [
                new mongoose.Schema(
                  {
                    reason: { type: String, trim: true, default: "" },
                    expectedResolution: { type: Date, default: null },
                    notes: { type: String, trim: true, default: "" },
                    reportedAt: { type: Date, default: null },
                    reportedBy: { type: String, trim: true, default: "" },
                    status: { type: String, trim: true, default: "delayed" },
                    resolvedAt: { type: Date, default: null },
                  },
                  { _id: false }
                ),
              ],
              default: [],
            },
            images: { type: [String], default: [] },
            subStages: {
              type: [
                new mongoose.Schema(
                  {
                    name: { type: String, trim: true, default: "" },
                    description: { type: String, trim: true, default: "" },
                    status: {
                      type: String,
                      enum: ["pending", "in_progress", "done", "delayed", "on_hold"],
                      default: "pending",
                    },
                    completed: { type: Boolean, default: false },
                    date: { type: Date, default: null },
                    images: { type: [String], default: [] },
                  },
                  { _id: false }
                ),
              ],
              default: [],
            },
          },
          { _id: false }
        ),
      ],
      default: [],
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
    warranty_period: {
      type: String,
      trim: true,
      default: "",
    },
    warranty_start_date: {
      type: Date,
      default: null,
    },
    warranty_expiry_date: {
      type: Date,
      default: null,
    },
    warranty_status: {
      type: String,
      trim: true,
      default: "",
    },
    warranty_terms: {
      type: String,
      trim: true,
      default: "",
    },
    review: {
      rating: {
        type: Number,
        min: 1,
        max: 5,
        default: null,
      },
      title: {
        type: String,
        trim: true,
        default: "",
      },
      comment: {
        type: String,
        trim: true,
        default: "",
      },
      photos: {
        type: [String],
        default: [],
      },
      submittedAt: {
        type: Date,
        default: null,
      },
      updatedAt: {
        type: Date,
        default: null,
      },
    },
    // Walk-in customer specific fields
    acceptance_method: {
      type: String,
      enum: ["online", "walk_in_signed_contract"],
      default: "online",
    },
    signed_contract_url: {
      type: String,
      trim: true,
      default: "",
    },
    contract_number: {
      type: String,
      trim: true,
      default: "",
    },
    contract_signed_date: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Order", OrderSchema);
