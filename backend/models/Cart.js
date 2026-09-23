import mongoose from "mongoose";

const CartSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    items: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
      validate: {
        validator: (items) => items.length <= 100,
        message: "A cart cannot contain more than 100 items.",
      },
    },
  },
  { timestamps: true }
);

export default mongoose.model("Cart", CartSchema);