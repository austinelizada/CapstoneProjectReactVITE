import mongoose from "mongoose";

const ProductSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    sku: {
      type: String,
      trim: true,
      default: "",
    },
    category: {
      type: String,
      required: true,
      enum: [
        "glass",
        "aluminum",
        "accessories",
        "hardware",
        "sealant",
        "other",
        "windows",
        "doors",
        "cabinets",
        "shower enclosures",
      ],
      default: "glass",
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    unit_price: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    // ERP fields
    product_type: {
      type: String,
      trim: true,
      default: "",
    },
    product_name: {
      type: String,
      trim: true,
      default: "",
    },
    pricing_method: {
      type: String,
      trim: true,
      enum: ["sqft", "blade", "fixed", "per_piece", ""],
      default: "",
    },
    variant: {
      type: String,
      trim: true,
      default: "",
    },
    base_price: {
      type: Number,
      default: 0,
      min: 0,
    },
    price_per_sqft: {
      type: Number,
      default: 0,
      min: 0,
    },
    price_per_blade: {
      type: Number,
      default: 0,
      min: 0,
    },
    customization_fee: {
      type: Number,
      default: 0,
      min: 0,
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
    blade_count: {
      type: Number,
      default: 0,
      min: 0,
    },
    estimated_area: {
      type: Number,
      default: 0,
      min: 0,
    },
    estimated_price: {
      type: Number,
      default: 0,
      min: 0,
    },
    images: {
      type: Object,
      default: {},
    },
    unit: {
      type: String,
      required: true,
      enum: ["per_sqft", "per_piece", "per_meter", "per_set"],
      default: "per_piece",
    },
    stock_quantity: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    image_url: {
      type: String,
      trim: true,
      default: "",
    },
    is_active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Product", ProductSchema);
