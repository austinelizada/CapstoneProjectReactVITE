import mongoose from "mongoose";
import CatalogItem from "../models/CatalogItem.js";
import Product from "../models/Product.js";

const findCatalogItem = async (identifier, kind) => {
  if (!identifier) return null;
  if (mongoose.Types.ObjectId.isValid(identifier)) {
    const byId = await CatalogItem.findById(identifier);
    if (byId) return byId;
  }
  const filter = { kind, name: identifier };
  const byName = await CatalogItem.findOne(filter);
  return byName;
};

const mapNamesByType = (items) => {
  const map = {};
  items.forEach((it) => {
    const t = it.meta?.product_type || it.meta?.type || it.meta?.productType || it.meta?.category || "";
    if (!map[t]) map[t] = [];
    map[t].push({ id: it._id, name: it.name, product_type: t });
  });
  return map;
};

const mapVariantsByName = (items) => {
  const map = {};
  items.forEach((it) => {
    const n = it.meta?.product_name || it.meta?.name || "";
    if (!map[n]) map[n] = [];
    map[n].push({ id: it._id, name: it.name, product_name: n });
  });
  return map;
};

export const getTypes = async (req, res) => {
  try {
    const types = await CatalogItem.find({ kind: "type" }).sort({ name: 1 });
    res.json(types.map((t) => ({ id: t._id, name: t.name })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Unable to fetch types" });
  }
};

export const createType = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ success: false, message: "Name is required" });
    const exists = await CatalogItem.findOne({ kind: "type", name });
    if (exists) return res.status(409).json({ success: false, message: "Type already exists" });
    const item = new CatalogItem({ kind: "type", name, created_by: req.user?.id });
    await item.save();
    res.status(201).json({ success: true, item });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Unable to create type" });
  }
};

export const updateType = async (req, res) => {
  try {
    const item = await findCatalogItem(req.params.id, "type");
    if (!item) return res.status(404).json({ success: false, message: "Not found" });
    item.name = req.body.name || item.name;
    await item.save();
    res.json({ success: true, item });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Unable to update type" });
  }
};

export const deleteType = async (req, res) => {
  try {
    const item = await findCatalogItem(req.params.id, "type");
    if (!item) return res.status(404).json({ success: false, message: "Not found" });
    const count = await Product.countDocuments({ $or: [{ product_type: item.name }, { category: { $regex: new RegExp(item.name, "i") } }] });
    if (count > 0) return res.status(400).json({ success: false, message: "Item in use", count });
    await item.deleteOne();
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Unable to delete type" });
  }
};

export const getNames = async (req, res) => {
  try {
    const names = await CatalogItem.find({ kind: "name" }).sort({ name: 1 });
    const map = mapNamesByType(names);
    res.json(map);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Unable to fetch names" });
  }
};

export const createName = async (req, res) => {
  try {
    const { name, product_type } = req.body;
    if (!name) return res.status(400).json({ success: false, message: "Name is required" });
    const exists = await CatalogItem.findOne({ kind: "name", name, "meta.product_type": product_type });
    if (exists) return res.status(409).json({ success: false, message: "Name already exists for this type" });
    const item = new CatalogItem({ kind: "name", name, meta: { product_type }, created_by: req.user?.id });
    await item.save();
    res.status(201).json({ success: true, item });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Unable to create name" });
  }
};

export const updateName = async (req, res) => {
  try {
    const item = await findCatalogItem(req.params.id, "name");
    if (!item) return res.status(404).json({ success: false, message: "Not found" });
    item.name = req.body.name || item.name;
    if (req.body.product_type) item.meta = { ...item.meta, product_type: req.body.product_type };
    await item.save();
    res.json({ success: true, item });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Unable to update name" });
  }
};

export const deleteName = async (req, res) => {
  try {
    const item = await findCatalogItem(req.params.id, "name");
    if (!item) return res.status(404).json({ success: false, message: "Not found" });
    const count = await Product.countDocuments({ product_name: item.name });
    if (count > 0) return res.status(400).json({ success: false, message: "Item in use", count });
    await item.deleteOne();
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Unable to delete name" });
  }
};

export const getVariants = async (req, res) => {
  try {
    const variants = await CatalogItem.find({ kind: "variant" }).sort({ name: 1 });
    const map = mapVariantsByName(variants);
    res.json(map);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Unable to fetch variants" });
  }
};

export const createVariant = async (req, res) => {
  try {
    const { name, product_name } = req.body;
    if (!name || !product_name) return res.status(400).json({ success: false, message: "Name and product_name are required" });
    const exists = await CatalogItem.findOne({ kind: "variant", name, "meta.product_name": product_name });
    if (exists) return res.status(409).json({ success: false, message: "Variant already exists for this product name" });
    const item = new CatalogItem({ kind: "variant", name, meta: { product_name }, created_by: req.user?.id });
    await item.save();
    res.status(201).json({ success: true, item });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Unable to create variant" });
  }
};

export const updateVariant = async (req, res) => {
  try {
    const item = await findCatalogItem(req.params.id, "variant");
    if (!item) return res.status(404).json({ success: false, message: "Not found" });
    item.name = req.body.name || item.name;
    if (req.body.product_name) item.meta = { ...item.meta, product_name: req.body.product_name };
    await item.save();
    res.json({ success: true, item });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Unable to update variant" });
  }
};

export const deleteVariant = async (req, res) => {
  try {
    const item = await findCatalogItem(req.params.id, "variant");
    if (!item) return res.status(404).json({ success: false, message: "Not found" });
    const count = await Product.countDocuments({ variant: item.name });
    if (count > 0) return res.status(400).json({ success: false, message: "Item in use", count });
    await item.deleteOne();
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Unable to delete variant" });
  }
};

export const getCategories = async (req, res) => {
  try {
    const categories = await CatalogItem.find({ kind: "category" }).sort({ name: 1 });
    res.json(categories.map((c) => ({ id: c._id, name: c.name })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Unable to fetch categories" });
  }
};

export const createCategory = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ success: false, message: "Name is required" });
    const exists = await CatalogItem.findOne({ kind: "category", name });
    if (exists) return res.status(409).json({ success: false, message: "Category already exists" });
    const item = new CatalogItem({ kind: "category", name, created_by: req.user?.id });
    await item.save();
    res.status(201).json({ success: true, item });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Unable to create category" });
  }
};

export const updateCategory = async (req, res) => {
  try {
    const item = await findCatalogItem(req.params.id, "category");
    if (!item) return res.status(404).json({ success: false, message: "Not found" });
    item.name = req.body.name || item.name;
    await item.save();
    res.json({ success: true, item });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Unable to update category" });
  }
};

export const deleteCategory = async (req, res) => {
  try {
    const item = await findCatalogItem(req.params.id, "category");
    if (!item) return res.status(404).json({ success: false, message: "Not found" });
    const count = await Product.countDocuments({ category: item.name });
    if (count > 0) return res.status(400).json({ success: false, message: "Item in use", count });
    await item.deleteOne();
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Unable to delete category" });
  }
};

export const checkUsage = async (req, res) => {
  try {
    const { kind, id } = req.params;
    const item = await CatalogItem.findById(id);
    if (!item) return res.status(404).json({ success: false, message: "Not found" });
    let count = 0;
    if (kind === "types" || item.kind === "type") {
      count = await Product.countDocuments({ $or: [{ product_type: item.name }, { category: { $regex: new RegExp(item.name, "i") } }] });
    } else if (kind === "names" || item.kind === "name") {
      count = await Product.countDocuments({ product_name: item.name });
    } else if (kind === "variants" || item.kind === "variant") {
      count = await Product.countDocuments({ variant: item.name });
    } else {
      count = 0;
    }
    res.json({ success: true, count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Unable to check usage" });
  }
};
