import express from "express";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Admin from "../models/Admin.js";
import { authMiddleware, roleMiddleware } from "../middleware/auth.js";

const normalizeAddress = (value) => {
  if (!value) return "";
  const cleaned = value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[,;]+/g, ",")
    .replace(/\s*[.,]\s*/g, ", ")
    .replace(/\s*,\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const canonical = (text) =>
    text
      .toLowerCase()
      .replace(/[^a-z0-9 ]+/g, " ")
      .replace(/\b(city|province|zip|code|street|st|road|rd)\b/g, "")
      .replace(/\s+/g, " ")
      .trim();

  const parts = cleaned
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  const normalizedParts = [];
  const seen = [];

  for (const part of parts) {
    const key = canonical(part);
    if (!key) {
      normalizedParts.push(part);
      continue;
    }
    const isDuplicate = seen.some(
      (existing) => existing === key || existing.includes(key) || key.includes(existing)
    );
    if (!isDuplicate) {
      seen.push(key);
      normalizedParts.push(part);
    }
  }

  return normalizedParts.join(", ");
};

const buildAddressFromRequest = (reqBody) => {
  if (!reqBody) return "";
  const address = reqBody.address || reqBody.street_address || "";
  const parts = [address];

  if (reqBody.city) parts.push(reqBody.city);
  if (reqBody.province) parts.push(reqBody.province);
  if (reqBody.zip_code) parts.push(reqBody.zip_code);

  return normalizeAddress(parts.filter(Boolean).join(", "));
};

const router = express.Router();

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post("/register", async (req, res) => {
  try {
    const {
      email,
      username,
      password,
      first_name,
      last_name,
      phone,
      street_address,
      city,
      province,
      zip_code,
      role,
    } = req.body;

    if (!email || !username || !password || !first_name || !last_name) {
      return res.status(400).json({
        success: false,
        message: "Email, username, password, first_name, and last_name are required",
      });
    }

    const existingUser = await User.findOne({
      $or: [{ email: email.toLowerCase().trim() }, { username: username.toLowerCase().trim() }],
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "A user already exists with that email or username",
      });
    }

    const adminExists =
      (await Admin.exists({})) ||
      (await User.exists({ role: "admin" }));
    if (!adminExists) {
      return res.status(403).json({
        success: false,
        message:
          "An admin account must be created first. Please create the admin account before registering customers.",
      });
    }

    const user = new User({
      email,
      username,
      password,
      first_name,
      last_name,
      phone: phone || "",
      street_address: street_address || "",
      city: city || "",
      province: province || "",
      zip_code: zip_code || "",
      role: "customer",
    });

    await user.save();

    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET || "your-secret-key",
      { expiresIn: "7d" }
    );

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      token,
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({
      success: false,
      message: "Error registering user",
      error: error.message,
    });
  }
});

/**
 * GET /api/auth/admin-exists
 * Check whether an admin user exists in the system
 */
router.get("/admin-exists", async (req, res) => {
  try {
    const adminCount = await Admin.countDocuments({});
    const legacyAdminCount = await User.countDocuments({ role: "admin" });
    res.json({ exists: adminCount + legacyAdminCount > 0 });
  } catch (error) {
    console.error("Admin exists check error:", error);
    res.status(500).json({
      success: false,
      message: "Error checking admin status",
      error: error.message,
    });
  }
});

router.get("/customers", authMiddleware, roleMiddleware("admin"), async (req, res) => {
  try {
    const { search } = req.query;
    if (!search || !search.trim()) {
      return res.json({ success: true, customers: [] });
    }

    const queryText = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(queryText, "i");

    const customers = await User.find({
      role: "customer",
      $or: [
        { first_name: regex },
        { last_name: regex },
        { email: regex },
        { username: regex },
        { phone: regex },
      ],
    })
      .select("first_name last_name email phone street_address city province zip_code")
      .limit(10)
      .lean();

    res.json({ success: true, customers });
  } catch (error) {
    console.error("Customer search error:", error);
    res.status(500).json({ success: false, message: "Unable to search customers", error: error.message });
  }
});

/**
 * POST /api/auth/create-admin
 * Create the first admin user if none exists
 */
router.post("/create-admin", async (req, res) => {
  try {
    const {
      email,
      username,
      password,
      first_name,
      last_name,
      phone,
      street_address,
      city,
      province,
      zip_code,
    } = req.body;

    if (!email || !username || !password || !first_name || !last_name) {
      return res.status(400).json({
        success: false,
        message:
          "Email, username, password, first_name, and last_name are required to create the admin account",
      });
    }

    const adminExists =
      (await Admin.exists({})) ||
      (await User.exists({ role: "admin" }));
    if (adminExists) {
      return res.status(403).json({
        success: false,
        message: "An admin account already exists.",
      });
    }

    const existingUser = await User.findOne({
      $or: [
        { email: email.toLowerCase().trim() },
        { username: username.toLowerCase().trim() },
      ],
    });

    const existingAdmin = await Admin.findOne({
      $or: [
        { email: email.toLowerCase().trim() },
        { username: username.toLowerCase().trim() },
      ],
    });

    const legacyAdmin = await User.findOne({
      $or: [
        { email: email.toLowerCase().trim() },
        { username: username.toLowerCase().trim() },
      ],
      role: "admin",
    });

    if (existingUser || existingAdmin || legacyAdmin) {
      return res.status(400).json({
        success: false,
        message: "A user already exists with that email or username",
      });
    }

    const admin = new Admin({
      email,
      username,
      password,
      first_name,
      last_name,
      phone: phone || "",
      street_address: street_address || "",
      city: city || "",
      province: province || "",
      zip_code: zip_code || "",
    });

    await admin.save();

    const token = jwt.sign(
      { id: admin._id, email: admin.email, role: "admin" },
      process.env.JWT_SECRET || "your-secret-key",
      { expiresIn: "7d" }
    );

    res.status(201).json({
      success: true,
      message: "Admin account created successfully",
      token,
      user: {
        id: admin._id,
        email: admin.email,
        username: admin.username,
        first_name: admin.first_name,
        last_name: admin.last_name,
        role: "admin",
      },
    });
  } catch (error) {
    console.error("Create admin error:", error);
    res.status(500).json({
      success: false,
      message: "Error creating admin user",
      error: error.message,
    });
  }
});

/**
 * POST /api/auth/login
 * Login user
 */
router.post("/login", async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: "Email/username and password are required",
      });
    }

    const query = identifier.includes("@")
      ? { email: identifier.toLowerCase().trim() }
      : { username: identifier.toLowerCase().trim() };

    let user = await Admin.findOne(query);
    let source = "admin";

    if (!user) {
      user = await User.findOne(query);
      source = "user";
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: "Your account has been deactivated",
      });
    }

    const role = source === "admin" ? "admin" : user.role;
    const token = jwt.sign(
      { id: user._id, email: user.email, role },
      process.env.JWT_SECRET || "your-secret-key",
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name,
        role,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Error logging in",
      error: error.message,
    });
  }
});

/**
 * GET /api/auth/me
 * Get current user session
 */
router.get("/me", authMiddleware, async (req, res) => {
  try {
    let user = null;
    let role = req.user.role;

    if (role === "admin") {
      user = await Admin.findById(req.user.id);
      if (!user) {
        user = await User.findOne({ _id: req.user.id, role: "admin" });
      }
    } else {
      user = await User.findById(req.user.id);
      if (!user) {
        user = await Admin.findById(req.user.id);
        role = user ? "admin" : role;
      }
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired session",
      });
    }

    res.json({
      isAuthenticated: true,
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name,
        role,
        phone: user.phone,
        street_address: user.street_address,
        city: user.city,
        province: user.province,
        zip_code: user.zip_code,
        created_at: user.createdAt,
        updated_at: user.updatedAt,
      },
      role,
    });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching user",
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout user (client-side, just clear token)
 */
router.post("/logout", authMiddleware, (req, res) => {
  res.json({
    success: true,
    message: "Logged out successfully",
  });
});

/**
 * PUT /api/auth/profile
 * Update user profile
 */
router.put("/profile", authMiddleware, async (req, res) => {
  try {
    const {
      first_name,
      last_name,
      phone,
      address,
      street_address,
      city,
      province,
      zip_code,
      current_password,
      new_password,
    } = req.body;

    let user = null;
    let role = req.user.role;

    if (role === "admin") {
      user = await Admin.findById(req.user.id);
      if (!user) {
        user = await User.findOne({ _id: req.user.id, role: "admin" });
      }
    } else {
      user = await User.findById(req.user.id);
      if (!user) {
        user = await Admin.findById(req.user.id);
        role = user ? "admin" : role;
      }
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired session",
      });
    }

    // Always validate current password since frontend requires it for any profile change
    if (current_password) {
      const isCurrentPasswordValid = await user.comparePassword(current_password);
      if (!isCurrentPasswordValid) {
        return res.status(401).json({
          success: false,
          message: "Current password is incorrect",
        });
      }
    }

    if (new_password) {
      if (new_password.length < 8) {
        return res.status(400).json({
          success: false,
          message: "New password must be at least 8 characters long",
        });
      }

      user.password = new_password;
    }

    if (first_name) user.first_name = first_name;
    if (last_name) user.last_name = last_name;
    if (phone) user.phone = phone;
    const normalizedAddress = buildAddressFromRequest({ address, street_address, city, province, zip_code });
    if (normalizedAddress) user.street_address = normalizedAddress;
    if (city) user.city = city;
    if (province) user.province = province;
    if (zip_code) user.zip_code = zip_code;

    await user.save();

    res.json({
      success: true,
      message: "Profile updated successfully",
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name,
        role: role,
        phone: user.phone,
        street_address: user.street_address,
        city: user.city,
        province: user.province,
        zip_code: user.zip_code,
      },
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error updating profile",
    });
  }
});

export default router;
