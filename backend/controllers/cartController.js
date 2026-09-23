import Cart from "../models/Cart.js";

const normalizeCartItems = (items) => {
  if (!Array.isArray(items)) return null;

  return items.map((item) => ({
    ...item,
    cartId: String(item.cartId || item._id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    quantity: Math.max(1, Number(item.quantity) || 1),
    selected: item.selected !== false,
  }));
};

export const getCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ customer: req.user.id }).lean();
    return res.json({ success: true, items: cart?.items || [] });
  } catch (error) {
    console.error("Get cart error:", error);
    return res.status(500).json({ success: false, message: "Unable to load cart." });
  }
};

export const saveCart = async (req, res) => {
  try {
    const items = normalizeCartItems(req.body?.items);
    if (!items) {
      return res.status(400).json({ success: false, message: "Cart items must be an array." });
    }

    const cart = await Cart.findOneAndUpdate(
      { customer: req.user.id },
      { $set: { items } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    ).lean();

    return res.json({ success: true, items: cart.items });
  } catch (error) {
    console.error("Save cart error:", error);
    return res.status(500).json({ success: false, message: "Unable to save cart." });
  }
};