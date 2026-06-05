import Product from "../models/Product.js";

export const listProducts = async (req, res) => {
  try {
    const { search, category, adminOnly } = req.query;
    const filter = { is_active: true };

    if (adminOnly === "true") {
      filter.$or = [
        { created_by: { $exists: true, $ne: null } },
        { created_by: null },
      ];
    }

    if (category && category !== "all") {
      filter.category = category.toLowerCase();
    }

    if (search) {
      const regex = new RegExp(search, "i");
      filter.$or = [{ name: regex }, { sku: regex }, { description: regex }];
    }

    const products = await Product.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, products });
  } catch (error) {
    console.error("List products error:", error);
    res.status(500).json({ success: false, message: "Unable to list products", error: error.message });
  }
};

export const getProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }
    res.json({ success: true, product });
  } catch (error) {
    console.error("Get product error:", error);
    res.status(500).json({ success: false, message: "Unable to get product", error: error.message });
  }
};

export const createProduct = async (req, res) => {
  try {
    const {
      name,
      sku,
      category,
      description,
      unit_price,
      unit,
      stock_quantity,
      image_url,
      // ERP fields
      product_type,
      product_name,
      pricing_method,
      variant,
      base_price,
      price_per_sqft,
      price_per_blade,
      customization_fee,
      width,
      height,
      blade_count,
      estimated_area,
      estimated_price,
      images,
    } = req.body;

    if (!name || !category) {
      return res.status(400).json({ success: false, message: "Name and category are required" });
    }

    const normalizedCategory = category ? category.toLowerCase() : "other";
    const allowedCategories = [
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
    ];
    const categoryValue = allowedCategories.includes(normalizedCategory)
      ? normalizedCategory
      : "other";

    const product = new Product({
      name,
      sku: sku || "",
      category: categoryValue,
      description: description || "",
      unit_price: Number(unit_price) || 0,
      unit: unit || "per_piece",
      stock_quantity: Number(stock_quantity) || 0,
      image_url: image_url || "",
      created_by: req.user?.id || undefined,
      // ERP fields
      product_type: product_type || "",
      product_name: product_name || name || "",
      pricing_method: pricing_method || "",
      variant: variant || "",
      base_price: Number(base_price) || 0,
      price_per_sqft: Number(price_per_sqft) || 0,
      price_per_blade: Number(price_per_blade) || 0,
      customization_fee: Number(customization_fee) || 0,
      width: Number(width) || 0,
      height: Number(height) || 0,
      blade_count: Number(blade_count) || 0,
      estimated_area: Number(estimated_area) || 0,
      estimated_price: Number(estimated_price) || 0,
      images: images || {},
    });

    await product.save();
    res.status(201).json({ success: true, product });
  } catch (error) {
    console.error("Create product error:", error);
    res.status(500).json({ success: false, message: "Unable to create product", error: error.message });
  }
};

export const updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    const updates = {
      name: req.body.name ?? product.name,
      sku: req.body.sku ?? product.sku,
      category: (() => {
        const value = req.body.category ? req.body.category.toLowerCase() : product.category;
        const allowed = [
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
        ];
        return allowed.includes(value) ? value : "other";
      })(),
      description: req.body.description ?? product.description,
      unit_price: req.body.unit_price != null ? Number(req.body.unit_price) : product.unit_price,
      unit: req.body.unit ?? product.unit,
      stock_quantity: req.body.stock_quantity != null ? Number(req.body.stock_quantity) : product.stock_quantity,
      image_url: req.body.image_url ?? product.image_url,
      // ERP fields
      product_type: req.body.product_type ?? product.product_type,
      product_name: req.body.product_name ?? product.product_name,
      pricing_method: req.body.pricing_method ?? product.pricing_method,
      variant: req.body.variant ?? product.variant,
      base_price: req.body.base_price != null ? Number(req.body.base_price) : product.base_price,
      price_per_sqft: req.body.price_per_sqft != null ? Number(req.body.price_per_sqft) : product.price_per_sqft,
      price_per_blade: req.body.price_per_blade != null ? Number(req.body.price_per_blade) : product.price_per_blade,
      customization_fee: req.body.customization_fee != null ? Number(req.body.customization_fee) : product.customization_fee,
      width: req.body.width != null ? Number(req.body.width) : product.width,
      height: req.body.height != null ? Number(req.body.height) : product.height,
      blade_count: req.body.blade_count != null ? Number(req.body.blade_count) : product.blade_count,
      estimated_area: req.body.estimated_area != null ? Number(req.body.estimated_area) : product.estimated_area,
      estimated_price: req.body.estimated_price != null ? Number(req.body.estimated_price) : product.estimated_price,
      images: req.body.images ?? product.images,
    };

    Object.assign(product, updates);
    await product.save();
    res.json({ success: true, product });
  } catch (error) {
    console.error("Update product error:", error);
    res.status(500).json({ success: false, message: "Unable to update product", error: error.message });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    await product.deleteOne();
    res.json({ success: true, message: "Product deleted successfully" });
  } catch (error) {
    console.error("Delete product error:", error);
    res.status(500).json({ success: false, message: "Unable to delete product", error: error.message });
  }
};
