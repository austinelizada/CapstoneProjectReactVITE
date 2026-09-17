export const normalizeUserProfile = (user = {}) => {
  const profile = {
    id: user.id || user._id || "",
    email: user.email || "",
    username: user.username || "",
    first_name: user.first_name || "",
    last_name: user.last_name || "",
    role: String(user.role || "customer").trim().toLowerCase(),
    phone: user.phone || "",
    street_address: user.street_address || "",
    city: user.city || "",
    province: user.province || "",
    zip_code: user.zip_code || "",
    is_active: user.is_active !== false,
    access_permissions: user.access_permissions || {},
    created_at: user.created_at || user.createdAt || null,
    updated_at: user.updated_at || user.updatedAt || null,
  };

  return profile;
};
