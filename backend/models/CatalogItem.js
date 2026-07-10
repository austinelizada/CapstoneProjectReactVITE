import mongoose from "mongoose";

const CatalogItemSchema = new mongoose.Schema(
  {
    kind: { type: String, required: true, enum: ["type", "name", "category", "variant", "template"] },
    name: { type: String, required: true },
    meta: { type: mongoose.Schema.Types.Mixed },
    created_by: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model("CatalogItem", CatalogItemSchema);
