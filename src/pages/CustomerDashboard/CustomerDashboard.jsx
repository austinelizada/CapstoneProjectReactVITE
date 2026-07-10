import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import toast, { Toaster } from "react-hot-toast";
import {
  Truck,
  ShoppingCart,
  Info,
  User,
  LogOut,
  Search,
  Mail,
  Phone,
  Camera,
  Save,
  ShieldCheck,
  Ruler,
  Package,
  CheckCircle,
  ArrowRight,
  Plus,
  Minus,
  FileText,
  Bell,
  Star,
} from "lucide-react";
import logo from "../../assets/images/ACGCLOGO1.png";
import { useAuth } from "@/contexts/AuthContext";
import { getProducts } from "@/api/products";
import { API_BASE } from "@/api/client";
import { createOrder, getOrders, trackOrder, acceptContract, declineContract, submitOrderReview, getProductReviews } from "@/api/orders";
import { uploadFiles } from "@/api/uploads";
import ContractModal from "../../components/ContractModal";
import OrderTimeline from "@/components/OrderTimeline";
import { calculateEstimate } from "@/lib/estimator";
import { buildOrderTimelineStages } from "@/lib/orderTimeline";
import { getProgressColor } from "@/lib/utils";

const PRODUCT_IMAGE_PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='400' viewBox='0 0 600 400'%3E%3Crect width='600' height='400' fill='%23e2e8f0'/%3E%3Cpath d='M248 148h104a28 28 0 0 1 28 28v48a28 28 0 0 1-28 28H248a28 28 0 0 1-28-28v-48a28 28 0 0 1 28-28Zm0 20a8 8 0 0 0-8 8v48a8 8 0 0 0 8 8h104a8 8 0 0 0 8-8v-48a8 8 0 0 0-8-8H248Zm18 22a16 16 0 1 1 0 32 16 16 0 0 1 0-32Zm50 35 17-21 31 40H244l34-42 25 30 13-7Z' fill='%2394a3b8'/%3E%3Ctext x='300' y='292' text-anchor='middle' font-family='Arial, sans-serif' font-size='24' font-weight='700' fill='%23475569'%3EProduct image%3C/text%3E%3C/svg%3E";

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

const buildFullAddress = (user) => {
  if (!user) return "";
  const addressParts = [user.street_address, user.city, user.province, user.zip_code].filter(Boolean);
  return normalizeAddress(addressParts.join(", "));
};

function CustomerDashboard() {
  const API_HOST = (function getApiHost() {
    try {
      return (API_BASE || "").replace(/\/api$/, "");
    } catch (e) {
      return "";
    }
  })();

  const isLocalBlobOrFile = (url) => typeof url === "string" && (url.startsWith("blob:") || url.startsWith("file:"));

  const ensureAbsoluteUrl = (url) => {
    if (!url) return PRODUCT_IMAGE_PLACEHOLDER;
    if (isLocalBlobOrFile(url)) return PRODUCT_IMAGE_PLACEHOLDER;
    if (/^https?:\/\//i.test(url)) return url;
    if (url.startsWith("/")) return API_HOST ? `${API_HOST}${url}` : url;
    if (url.startsWith("uploads/")) return API_HOST ? `${API_HOST}/${url}` : `/${url}`;
    return API_HOST ? `${API_HOST}/${url}` : url;
  };
  const { user, loading, updateProfile, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [activeTab, setActiveTab] = useState("products");
  const [products, setProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [productError, setProductError] = useState("");

  const [cartItems, setCartItems] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showAboutProduct, setShowAboutProduct] = useState(false);
  const [showCartDecisionModal, setShowCartDecisionModal] = useState(false);
  const [cartDecisionStep, setCartDecisionStep] = useState("choice");
  const [cartDecisionProduct, setCartDecisionProduct] = useState(null);
  const [estimateForm, setEstimateForm] = useState({
    unit: "in",
    width: "",
    height: "",
    quantity: 1,
    notes: "",
  });
  const [estimateFormErrors, setEstimateFormErrors] = useState({});
  const [cartActionError, setCartActionError] = useState("");

  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [productReviews, setProductReviews] = useState([]);
  const [productReviewsLoading, setProductReviewsLoading] = useState(false);

  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutMessage, setCheckoutMessage] = useState("");
  const [checkoutError, setCheckoutError] = useState("");
  const [orderRequestMessage, setOrderRequestMessage] = useState("");
  const [orderRequestLoading, setOrderRequestLoading] = useState(false);
  const [contractActionLoading, setContractActionLoading] = useState(false);
  const [contractActionError, setContractActionError] = useState("");
  const [contractActionMessage, setContractActionMessage] = useState("");
  const [contractActionOrderId, setContractActionOrderId] = useState(null);
  const [showContractModal, setShowContractModal] = useState(false);
  const [contractPreviewOrder, setContractPreviewOrder] = useState(null);
  const [contractConfirmModal, setContractConfirmModal] = useState({
    open: false,
    action: null,
    orderId: null,
  });
  const [showOrderReviewModal, setShowOrderReviewModal] = useState(false);
  const [showCustomerReviewModal, setShowCustomerReviewModal] = useState(false);
  const [showProductReviewModal, setShowProductReviewModal] = useState(false);
  const [reviewOrderMode, setReviewOrderMode] = useState("estimate");
  const [orderReviewForm, setOrderReviewForm] = useState({
    rating: 0,
    title: "",
    comment: "",
    photos: [],
    photoPreviews: [],
  });
  const [reviewFormError, setReviewFormError] = useState("");
  const [reviewFormLoading, setReviewFormLoading] = useState(false);
  const [selectedReviewOrder, setSelectedReviewOrder] = useState(null);
  const [estimateFlowType, setEstimateFlowType] = useState(null);
  const [showDeliveryConfirmModal, setShowDeliveryConfirmModal] = useState(false);
  const [deliveryConfirmMode, setDeliveryConfirmMode] = useState("estimate");
  const [deliveryConfirmForm, setDeliveryConfirmForm] = useState({
    phone: "",
    street_address: "",
    city: "",
    province: "",
    zip_code: "",
  });
  const [deliveryConfirmError, setDeliveryConfirmError] = useState("");
  const [showOrderNowModal, setShowOrderNowModal] = useState(false);
  const [orderNowProduct, setOrderNowProduct] = useState(null);
  const [orderNowQuantity, setOrderNowQuantity] = useState(1);
  const [showOrderSuccessModal, setShowOrderSuccessModal] = useState(false);
  const [orderSuccessData, setOrderSuccessData] = useState(null);
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [orderFilter, setOrderFilter] = useState("all");
  const [orderViewMode, setOrderViewMode] = useState("view2");
  const [selectedOrderForModal, setSelectedOrderForModal] = useState(null);
  const [contractSummaryExpanded, setContractSummaryExpanded] = useState(true);
  const [contractHistoryTab, setContractHistoryTab] = useState("accepted");
  const [warrantyHistoryTab, setWarrantyHistoryTab] = useState(null);

  const acceptedContracts = orders.filter(
    (order) =>
      order.status === "contract_accepted" ||
      order.contract_status?.toString().toLowerCase() === "accepted"
  );
  const rejectedContracts = orders.filter(
    (order) =>
      order.status === "contract_declined" ||
      order.contract_status?.toString().toLowerCase() === "declined"
  );
  const contractsInTab = contractHistoryTab === "rejected" ? rejectedContracts : acceptedContracts;

  // Warranty filtering logic
  const activeWarranties = orders.filter((order) => {
    if (!order.warranty_expiry_date) return false;
    const expiryDate = new Date(order.warranty_expiry_date);
    const today = new Date();
    return expiryDate > today && (order.warranty_status?.toLowerCase() === "active" || !order.warranty_status);
  });
  const expiredWarranties = orders.filter((order) => {
    if (!order.warranty_expiry_date) return false;
    const expiryDate = new Date(order.warranty_expiry_date);
    const today = new Date();
    return expiryDate <= today || order.warranty_status?.toLowerCase() === "expired";
  });
  const warrantiesInTab = warrantyHistoryTab === "expired" ? expiredWarranties : activeWarranties;

  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingResult, setTrackingResult] = useState(null);

  const [profileForm, setProfileForm] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    email: "",
    street_address: "",
    city: "",
    province: "",
    zip_code: "",
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileTab, setProfileTab] = useState("profile");
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordModalError, setPasswordModalError] = useState("");

  const handleLogoutConfirm = () => {
    logout();
    setConfirmOpen(false);
    navigate("/login");
  };

  useEffect(() => {
    if (user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProfileForm({
        first_name: user.first_name || "",
        last_name: user.last_name || "",
        phone: user.phone || "",
        email: user.email || "",
        street_address: user.street_address || "",
        city: user.city || "",
        province: user.province || "",
        zip_code: user.zip_code || "",
        current_password: "",
        new_password: "",
        confirm_password: "",
      });
      setDeliveryConfirmForm({
        phone: user.phone || "",
        street_address: user.street_address || "",
        city: user.city || "",
        province: user.province || "",
        zip_code: user.zip_code || "",
      });
    }
  }, [user]);

  useEffect(() => {
    if (!loading && user && user.role !== "customer") {
      navigate("/dashboard", { replace: true });
    }
  }, [loading, user, navigate]);

  useEffect(() => {
    const storedCart = localStorage.getItem("customerCart");
    if (storedCart) {
      try {
        const cart = JSON.parse(storedCart);
        setCartItems(
          Array.isArray(cart)
            ? cart.map((item) => ({ ...item, selected: item.selected !== false }))
            : []
        );
      } catch (error) {
        console.warn("Unable to parse saved cart", error);
      }
    }
  }, []);

  useEffect(() => {
    const activeTabFromState = location.state?.activeTab;
    const activeTabFromQuery = new URLSearchParams(location.search).get("tab");
    const tab = activeTabFromState || activeTabFromQuery;

    if (tab) {
      setActiveTab(tab);
      if (activeTabFromState) {
        navigate(location.pathname, { replace: true, state: {} });
      }
    }
  }, [location, navigate]);

  useEffect(() => {
    localStorage.setItem("customerCart", JSON.stringify(cartItems));
  }, [cartItems]);

  const selectedCartItems = cartItems.filter((item) => item.selected);
  const selectedItemCount = selectedCartItems.length;
  const selectedQuantityTotal = selectedCartItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const selectedSubtotal = selectedCartItems.reduce((sum, item) => {
    const itemPrice = item.is_estimate ? Number(item.estimated_price || 0) : Number(item.unit_price || 0) * (Number(item.quantity) || 0);
    return sum + itemPrice;
  }, 0);
  const allSelected = cartItems.length > 0 && selectedItemCount === cartItems.length;

  const productReviewAverageRating = productReviews.length
    ? (productReviews.reduce((sum, review) => sum + (review.rating || 0), 0) / productReviews.length).toFixed(1)
    : null;

  useEffect(() => {
    if (selectedOrderForModal) {
      const contractStatus = selectedOrderForModal.contract_status?.toLowerCase();
      if (contractStatus === "accepted" || contractStatus === "declined") {
        setContractSummaryExpanded(false);
      } else {
        setContractSummaryExpanded(true);
      }
    }
  }, [selectedOrderForModal]);

  const selectedOrderContractStatus = selectedOrderForModal?.contract_status?.toString().toLowerCase() || "";
  const selectedOrderStatus = selectedOrderForModal?.status?.toString().toLowerCase() || "";
  const selectedOrderHasContractSummary =
    Boolean(selectedOrderForModal?.contract_terms) ||
    selectedOrderStatus === "contract_sent" ||
    selectedOrderContractStatus === "sent";
  const selectedOrderCanRespondToContract =
    (selectedOrderStatus === "contract_sent" || selectedOrderContractStatus === "sent") &&
    !["accepted", "declined"].includes(selectedOrderContractStatus) &&
    !["contract_accepted", "contract_declined", "cancelled"].includes(selectedOrderStatus);

  const isOrderCompletedAndReviewable = (order) => {
    if (!order) return false;
    const completed = order.status === "completed" && Number(order.progress) >= 100;
    if (!completed) return false;
    const lastStage = Array.isArray(order.progress_stages) ? order.progress_stages[order.progress_stages.length - 1] : null;
    if (!lastStage) return true;
    return Boolean(lastStage.completed || lastStage.status === "done" || lastStage.status === "completed");
  };

  const isOrderReviewEditable = (order) => {
    if (!order?.review?.submittedAt) return false;
    const submittedAt = new Date(order.review.submittedAt);
    const editDeadline = new Date(submittedAt.getTime() + 7 * 24 * 60 * 60 * 1000);
    return new Date() <= editDeadline;
  };

  const hasOrderReview = (order) => Boolean(order?.review?.submittedAt);

  const openCustomerReviewModal = (order) => {
    const existingReview = order?.review || {};
    setSelectedReviewOrder(order);
    setOrderReviewForm({
      rating: existingReview.rating || 0,
      title: existingReview.title || "",
      comment: existingReview.comment || "",
      photos: existingReview.photos || [],
      photoPreviews: existingReview.photos || [],
    });
    setReviewFormError("");
    setShowCustomerReviewModal(true);
  };

  const closeCustomerReviewModal = () => {
    setSelectedReviewOrder(null);
    setShowCustomerReviewModal(false);
    setReviewFormError("");
    setOrderReviewForm({ rating: 0, title: "", comment: "", photos: [], photoPreviews: [] });
  };

  const openProductReviewModal = () => {
    setShowProductReviewModal(true);
  };

  const closeProductReviewModal = () => {
    setShowProductReviewModal(false);
  };

  const handleOrderReviewChange = (field, value) => {
    setOrderReviewForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleOrderReviewPhotoChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const existingCount = orderReviewForm.photos.length;
    if (existingCount + files.length > 5) {
      setReviewFormError("You may upload up to 5 photos.");
      return;
    }
    const uploads = await uploadFiles(files);
    if (!uploads.success) {
      setReviewFormError(uploads.message || "Unable to upload photos.");
      return;
    }
    setOrderReviewForm((prev) => ({
      ...prev,
      photos: [...prev.photos, ...(uploads.files || []).map((f) => f.url)],
      photoPreviews: [...prev.photoPreviews, ...(uploads.files || []).map((f) => f.url)],
    }));
  };

  const handleRemoveReviewPhoto = (index) => {
    setOrderReviewForm((prev) => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index),
      photoPreviews: prev.photoPreviews.filter((_, i) => i !== index),
    }));
  };

  const submitCustomerReview = async () => {
    if (!selectedReviewOrder) return;
    if (!orderReviewForm.rating || orderReviewForm.rating < 1 || orderReviewForm.rating > 5) {
      setReviewFormError("Please select a rating from 1 to 5.");
      return;
    }
    if (!orderReviewForm.comment || orderReviewForm.comment.trim().length < 10) {
      setReviewFormError("Comment must be at least 10 characters.");
      return;
    }
    if (orderReviewForm.comment.trim().length > 500) {
      setReviewFormError("Comment cannot exceed 500 characters.");
      return;
    }

    setReviewFormLoading(true);
    setReviewFormError("");

    try {
      const payload = {
        rating: orderReviewForm.rating,
        title: orderReviewForm.title.trim(),
        comment: orderReviewForm.comment.trim(),
        photos: orderReviewForm.photos.slice(0, 5),
      };
      const response = await submitOrderReview(selectedReviewOrder._id || selectedReviewOrder.id, payload);
      if (response.order) {
        setOrders((prev) => prev.map((order) => (order._id === response.order._id ? response.order : order)));
        if (selectedOrderForModal && (selectedOrderForModal._id || selectedOrderForModal.id) === response.order._id) {
          setSelectedOrderForModal(response.order);
        }
        setSelectedReviewOrder(response.order);
        toast.success("Thank you for your feedback. Your review has been submitted.");
        closeCustomerReviewModal();
      }
    } catch (error) {
      setReviewFormError(error.data?.message || error.message || "Unable to submit review.");
    } finally {
      setReviewFormLoading(false);
    }
  };

  useEffect(() => {
    let active = true;

    const fetchProducts = async () => {
      setIsLoadingProducts(true);
      setProductError("");

      try {
        const response = await getProducts({
          search: searchQuery,
          category: categoryFilter && categoryFilter !== "All" ? categoryFilter : undefined,
        });
        if (!active) return;
        setProducts(response.products || []);
      } catch (error) {
        if (!active) return;
        setProductError(error.data?.message || error.message || "Unable to load products.");
      } finally {
        if (active) setIsLoadingProducts(false);
      }
    };

    fetchProducts();

    return () => {
      active = false;
    };
  }, [searchQuery, categoryFilter]);

  useEffect(() => {
    if (!user) return;
    let active = true;

    const fetchOrders = async () => {
      setOrdersLoading(true);

      try {
        const response = await getOrders();
        if (!active) return;
        setOrders(response.orders || []);
      } catch {
        if (!active) return;
      } finally {
        if (active) setOrdersLoading(false);
      }
    };

    fetchOrders();

    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    if (!selectedProduct?._id) {
      setProductReviews([]);
      return;
    }

    let active = true;
    const fetchProductReviews = async () => {
      setProductReviewsLoading(true);
      try {
        const response = await getProductReviews(selectedProduct._id);
        if (!active) return;
        setProductReviews(response.reviews || []);
      } catch {
        if (!active) return;
        setProductReviews([]);
      } finally {
        if (active) setProductReviewsLoading(false);
      }
    };

    fetchProductReviews();

    return () => {
      active = false;
    };
  }, [selectedProduct]);

  const generateCartId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  const handleAddToCart = (product) => {
    setCartItems((prev) => {
      const existing = prev.find((p) => !p.is_estimate && (p._id === product._id || p.name === product.name));
      if (existing) {
        return prev.map((p) =>
          p.cartId === existing.cartId ? { ...p, quantity: p.quantity + 1, selected: true } : p
        );
      }
      return [...prev, { ...product, quantity: 1, cartId: generateCartId(), selected: true }];
    });
  };

  const handleAddEstimateToCart = ({ product, width, height, quantity, notes, measurementUnit }) => {
    const parsedWidth = Number(width) || 0;
    const parsedHeight = Number(height) || 0;
    const parsedQuantity = Number(quantity) || 1;
    
    // Use comprehensive calculateEstimate like admin does
    const estimationResult = calculateEstimate({
      productName: product.product_name || product.name,
      categoryKey: product.product_type || product.category,
      variantName: product.variant,
      width: parsedWidth,
      height: parsedHeight,
      measurementUnit,
      quantity: parsedQuantity,
      blade_count: product.blade_count || 0,
      base_price: product.base_price || undefined,
      overrideRate: product.price_per_sqft || (product.unit_price ? Number(product.unit_price) / 144 : undefined),
      customization: product.customization || false,
      customization_fee: product.customization_fee || 0,
    });
    
    const area = estimationResult.estimated_area || 0;
    const estimated_price = estimationResult.estimated_price || 0;

    setCartItems((prev) => [
      ...prev,
      {
        ...product,
        cartId: generateCartId(),
        quantity: parsedQuantity,
        width: parsedWidth,
        height: parsedHeight,
        measurementUnit,
        unit: measurementUnit,
        area,
        notes: notes || "",
        estimated_price,
        is_estimate: true,
        selected: true,
      },
    ]);
  };

  const openCartDecisionModal = (product, step = "choice") => {
    setCartDecisionProduct(product);
    setCartDecisionStep(step);
    setShowCartDecisionModal(true);
    setEstimateForm({ unit: "in", width: "", height: "", quantity: 1, notes: "" });
    setEstimateFormErrors({});
    setCartActionError("");
    setEstimateFlowType(step === "estimate" ? "estimate_product" : null);
  };

  const closeCartDecisionModal = () => {
    setShowCartDecisionModal(false);
    setCartDecisionProduct(null);
    setCartDecisionStep("choice");
    setCartActionError("");
    setEstimateFlowType(null);
  };

  const handleCartDecisionNoAdd = () => {
    if (!cartDecisionProduct) return;
    handleAddToCart(cartDecisionProduct);
    closeCartDecisionModal();
  };

  const handleCartDecisionEstimate = () => {
    setCartDecisionStep("estimate");
    setEstimateFlowType("add_to_cart_estimate");
  };

  const handleEstimateFormChange = (e) => {
    const { name, value } = e.target;
    setEstimateForm((prev) => ({ ...prev, [name]: value }));

    if (name === 'width' || name === 'height') {
      const numeric = Number(value);
      setEstimateFormErrors((prev) => ({
        ...prev,
        [name]: numeric <= 0 || Number.isNaN(numeric) ? `${name === 'width' ? 'Width' : 'Height'} must be greater than 0.` : undefined,
      }));
    }
  };

  const handleEstimateAddToCart = () => {
    if (!cartDecisionProduct) return;
    if (!estimateForm.width || !estimateForm.height) {
      setCartActionError("Please enter width and height to estimate.");
      return;
    }
    if (Number(estimateForm.width) <= 0 || Number(estimateForm.height) <= 0) {
      setCartActionError("Width and height must be greater than 0.");
      return;
    }
    if (estimateForm.quantity < 1) {
      setCartActionError("Quantity must be at least 1.");
      return;
    }

    handleAddEstimateToCart({
      product: cartDecisionProduct,
      width: estimateForm.width,
      height: estimateForm.height,
      quantity: estimateForm.quantity,
      notes: estimateForm.notes,
      measurementUnit: estimateForm.unit,
    });
    closeCartDecisionModal();
  };

  const openOrderReviewModal = () => {
    if (!cartDecisionProduct) return;
    if (!estimateForm.width || !estimateForm.height) {
      setCartActionError("Please enter width and height to estimate.");
      return;
    }
    if (Number(estimateForm.quantity) < 1) {
      setCartActionError("Quantity must be at least 1.");
      return;
    }

    setCartActionError("");
    setOrderReviewAgreed(false);
    setShowOrderReviewModal(true);
  };

  const handleEstimateAfterEstimation = () => {
    if (estimateFlowType === "add_to_cart_estimate") {
      handleEstimateAddToCart();
    } else {
      setDeliveryConfirmMode("estimate");
      setDeliveryConfirmForm({
        phone: profileForm.phone || "",
        street_address: profileForm.street_address || "",
        city: profileForm.city || "",
        province: profileForm.province || "",
        zip_code: profileForm.zip_code || "",
      });
      setDeliveryConfirmError("");
      setShowDeliveryConfirmModal(true);
      setShowCartDecisionModal(false);
    }
  };

  const saveProfileDeliveryInfo = async () => {
    try {
      const payload = {
        phone: deliveryConfirmForm.phone || profileForm.phone || "",
        street_address: deliveryConfirmForm.street_address || profileForm.street_address || "",
        city: deliveryConfirmForm.city || profileForm.city || "",
        province: deliveryConfirmForm.province || profileForm.province || "",
        zip_code: deliveryConfirmForm.zip_code || profileForm.zip_code || "",
      };

      await updateProfile(payload);
      setProfileForm((prev) => ({ ...prev, ...payload }));
    } catch (error) {
      console.error("Failed to update profile delivery info", error);
    }
  };

  const validateDeliveryConfirmForm = () => {
    if (!deliveryConfirmForm.street_address.trim() || !deliveryConfirmForm.phone.trim() || !deliveryConfirmForm.city.trim() || !deliveryConfirmForm.province.trim()) {
      setDeliveryConfirmError("Please complete your delivery information before proceeding.");
      return false;
    }
    setDeliveryConfirmError("");
    return true;
  };

  const handleConfirmAndContinue = async () => {
    if (!validateDeliveryConfirmForm()) return;
    setOrderRequestLoading(true);

    try {
      await saveProfileDeliveryInfo();
      setShowDeliveryConfirmModal(false);
      setReviewOrderMode(deliveryConfirmMode);
      setOrderReviewAgreed(false);
      setShowOrderReviewModal(true);
    } catch (error) {
      setDeliveryConfirmError("Unable to save delivery information. Please try again.");
    } finally {
      setOrderRequestLoading(false);
    }
  };

  const handleSubmitOrderRequest = async () => {
    if (!orderReviewAgreed) {
      setCartActionError("Please confirm the payment policy before submitting.");
      return;
    }

    setCartActionError("");
    setOrderRequestLoading(true);

    try {
      if (reviewOrderMode === "orderNow") {
        await handleSubmitOrderNow();
      } else {
        if (!cartDecisionProduct) return;

        const parsedWidth = Number(estimateForm.width) || 0;
        const parsedHeight = Number(estimateForm.height) || 0;
        const parsedQuantity = Number(estimateForm.quantity) || 1;

        const estimationResult = calculateEstimate({
          productName: cartDecisionProduct.product_name || cartDecisionProduct.name,
          categoryKey: cartDecisionProduct.product_type || cartDecisionProduct.category,
          variantName: cartDecisionProduct.variant,
          width: parsedWidth,
          height: parsedHeight,
          measurementUnit: estimateForm.unit,
          quantity: parsedQuantity,
          blade_count: cartDecisionProduct.blade_count || 0,
          base_price: cartDecisionProduct.base_price || undefined,
          overrideRate: cartDecisionProduct.price_per_sqft || (cartDecisionProduct.unit_price ? Number(cartDecisionProduct.unit_price) / 144 : undefined),
          customization: cartDecisionProduct.customization || false,
          customization_fee: cartDecisionProduct.customization_fee || 0,
        });

        const item = {
          _id: cartDecisionProduct._id,
          name: cartDecisionProduct.name,
          quantity: parsedQuantity,
          unit_price: Number(cartDecisionProduct.unit_price) || 0,
          unit: cartDecisionProduct.unit || "piece",
          width: parsedWidth,
          height: parsedHeight,
          measurementUnit: estimateForm.unit,
          area: estimationResult.estimated_area || 0,
          estimated_price: estimationResult.estimated_price || 0,
          notes: estimateForm.notes || "",
          is_estimate: true,
        };

        const response = await createOrder({
          items: [item],
          shipping_address: normalizeAddress(
            [deliveryConfirmForm.street_address, deliveryConfirmForm.city, deliveryConfirmForm.province, deliveryConfirmForm.zip_code]
              .filter(Boolean)
              .join(", ") || buildFullAddress(user)
          ),
          order_type: "online_order",
        });

        setOrderRequestMessage(`Order requested successfully. Tracking ID: ${response.order.tracking}`);
        setOrders((prev) => [response.order, ...(prev || [])]);
        setOrderSuccessData(response.order);
      }

      setShowOrderReviewModal(false);
      setShowOrderNowModal(false);
      setShowOrderSuccessModal(true);
      closeCartDecisionModal();
    } catch (error) {
      setCartActionError(error.data?.message || error.message || "Unable to request order.");
    } finally {
      setOrderRequestLoading(false);
    }
  };

  const updateLocalOrder = (updatedOrder) => {
    const updatedOrderId = updatedOrder?._id || updatedOrder?.id;
    if (!updatedOrderId) return;

    setOrders((prev) =>
      prev.map((order) =>
        (order._id || order.id) === updatedOrderId ? updatedOrder : order
      )
    );
    if ((selectedOrderForModal?._id || selectedOrderForModal?.id) === updatedOrderId) {
      setSelectedOrderForModal(updatedOrder);
    }
    if ((contractPreviewOrder?._id || contractPreviewOrder?.id) === updatedOrderId) {
      setContractPreviewOrder(updatedOrder);
    }
  };

  const handleOrderUpdate = (updatedOrder) => {
    updateLocalOrder(updatedOrder);
    if ((selectedOrderForModal?._id || selectedOrderForModal?.id) === (updatedOrder?._id || updatedOrder?.id)) {
      setSelectedOrderForModal(updatedOrder);
    }
  };

  const handleAcceptContract = async (orderId) => {
    if (!orderId || contractActionLoading) return;

    setContractActionError("");
    setContractActionMessage("");
    setContractActionOrderId(orderId);
    setContractActionLoading(true);
    try {
      const response = await acceptContract(orderId);
      updateLocalOrder(response.order);
      setContractActionMessage("Contract accepted successfully.");
      toast.success("Contract accepted successfully.");
      setContractActionOrderId(response.order._id);
      setContractConfirmModal({ open: false, action: null, orderId: null });
      setShowContractModal(false);
    } catch (error) {
      const message = error.data?.message || error.message || "Unable to accept contract.";
      setContractActionError(message);
      toast.error(message);
      setContractActionMessage("");
    } finally {
      setContractActionLoading(false);
    }
  };

  const handleDeclineContract = async (orderId) => {
    if (!orderId || contractActionLoading) return;

    setContractActionError("");
    setContractActionMessage("");
    setContractActionOrderId(orderId);
    setContractActionLoading(true);
    try {
      const response = await declineContract(orderId);
      updateLocalOrder(response.order);
      if (selectedOrderForModal?._id === orderId) {
        setSelectedOrderForModal(response.order);
      }
      setContractActionMessage("Contract declined and order cancelled.");
      toast.success("Contract declined successfully.");
      setContractActionOrderId(response.order._id);
      setContractConfirmModal({ open: false, action: null, orderId: null });
      setShowContractModal(false);
    } catch (error) {
      const message = error.data?.message || error.message || "Unable to decline contract.";
      setContractActionError(message);
      toast.error(message);
      setContractActionMessage("");
    } finally {
      setContractActionLoading(false);
    }
  };

  const openContractConfirmModal = (action, orderId) => {
    setContractConfirmModal({
      open: true,
      action,
      orderId,
    });
  };

  const closeContractConfirmModal = () => {
    setContractConfirmModal({ open: false, action: null, orderId: null });
  };

  const handleConfirmContractAction = async () => {
    if (!contractConfirmModal.orderId || !contractConfirmModal.action) return;

    const orderId = contractConfirmModal.orderId;
    const action = contractConfirmModal.action;

    closeContractConfirmModal();

    if (action === "accept") {
      await handleAcceptContract(orderId);
    } else if (action === "decline") {
      await handleDeclineContract(orderId);
    }
  };

  const handleRemoveFromCart = (cartId) => {
    setCartItems((prev) => prev.filter((item) => item.cartId !== cartId));
  };

  const handleToggleCartItem = (cartId) => {
    setCartItems((prev) =>
      prev.map((item) =>
        item.cartId === cartId ? { ...item, selected: !item.selected } : item
      )
    );
  };

  const handleSelectAllCartItems = (selected) => {
    setCartItems((prev) => prev.map((item) => ({ ...item, selected })));
  };

  const handleUpdateCartQuantity = (cartId, delta) => {
    setCartItems((prev) =>
      prev
        .map((item) =>
          item.cartId === cartId
            ? { ...item, quantity: Math.max(1, item.quantity + delta) }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const handleClearCart = () => {
    setCartItems([]);
  };

  const handleViewProduct = (product) => {
    setSelectedProduct(product);
    setShowAboutProduct(false);
  };

  const closeProductModal = () => {
    setSelectedProduct(null);
    setShowAboutProduct(false);
  };

  const openOrderNowModal = (product) => {
    setOrderNowProduct(product);
    setOrderNowQuantity(1);
    setShowOrderNowModal(true);
    setCartActionError("");
  };

  const closeOrderNowModal = () => {
    setShowOrderNowModal(false);
    setOrderNowProduct(null);
    setOrderNowQuantity(1);
    setCartActionError("");
  };

  const handleOrderNowQuantityChange = (delta) => {
    setOrderNowQuantity((prev) => Math.max(1, prev + delta));
  };

  const openOrderNowReviewModal = () => {
    if (!orderNowProduct) return;
    setDeliveryConfirmMode("orderNow");
    setDeliveryConfirmForm({
      phone: profileForm.phone || "",
      street_address: profileForm.street_address || "",
      city: profileForm.city || "",
      province: profileForm.province || "",
      zip_code: profileForm.zip_code || "",
    });
    setDeliveryConfirmError("");
    setShowDeliveryConfirmModal(true);
    setShowOrderNowModal(false);
  };

  const handleSubmitOrderNow = async () => {
    if (!orderNowProduct) return;

    const quantity = Math.max(1, Number(orderNowQuantity) || 1);
    const unit_price = Number(orderNowProduct.unit_price || orderNowProduct.price_per_sqft || 0);

    const item = {
      _id: orderNowProduct._id,
      name: orderNowProduct.name,
      quantity,
      unit_price,
      unit: orderNowProduct.unit || "piece",
      width: 0,
      height: 0,
      area: 0,
      estimated_price: 0,
      notes: "",
      is_estimate: false,
    };

    const response = await createOrder({
      items: [item],
      shipping_address: normalizeAddress(
        [deliveryConfirmForm.street_address, deliveryConfirmForm.city, deliveryConfirmForm.province, deliveryConfirmForm.zip_code]
          .filter(Boolean)
          .join(", ") || buildFullAddress(user)
      ),
      order_type: "online_order",
    });

    setOrderRequestMessage(`Order requested successfully. Tracking ID: ${response.order.tracking}`);
    setOrders((prev) => [response.order, ...(prev || [])]);
    setOrderSuccessData(response.order);
    setShowOrderSuccessModal(true);
  };

  const handleOrderNow = (product) => {
    openOrderNowModal(product);
  };

  const handleDeliveryConfirmChange = (e) => {
    const { name, value } = e.target;
    setDeliveryConfirmForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCancelDeliveryConfirm = () => {
    setDeliveryConfirmError("");
    setShowDeliveryConfirmModal(false);
    if (deliveryConfirmMode === "orderNow") {
      setShowOrderNowModal(true);
    } else if (deliveryConfirmMode === "estimate") {
      setShowCartDecisionModal(true);
    }
  };

  const handleTrackingSubmit = async () => {
    if (!trackingNumber.trim()) {
      setTrackingResult({ error: "Please enter a tracking number." });
      return;
    }

    try {
      const response = await trackOrder(trackingNumber.trim());
      setTrackingResult({ ...response.order, message: `Showing order: ${response.order.tracking}` });
    } catch (error) {
      setTrackingResult({ error: error.data?.message || error.message || "No order found with that tracking number." });
    }
  };

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfileForm((prev) => ({ ...prev, [name]: value }));
  };

  const profileHasChanges = () => {
    if (!user) return false;

    const currentAddress = buildFullAddress(user);
    const profileAddress = normalizeAddress(
      [profileForm.street_address, profileForm.city, profileForm.province, profileForm.zip_code]
        .filter(Boolean)
        .join(", ") || ""
    );

    return (
      profileForm.first_name.trim() !== (user.first_name || "") ||
      profileForm.last_name.trim() !== (user.last_name || "") ||
      profileForm.phone !== (user.phone || "") ||
      profileAddress !== currentAddress ||
      Boolean(profileForm.new_password) ||
      Boolean(profileForm.confirm_password)
    );
  };

  const performProfileSave = async () => {
    if (!profileForm.current_password) {
      setProfileError("Please enter your current password to save profile changes.");
      return false;
    }

    if (!profileForm.first_name.trim() || !profileForm.last_name.trim()) {
      setProfileError("Please enter both first name and last name.");
      return false;
    }

    if (profileForm.new_password || profileForm.confirm_password) {
      if (!profileForm.new_password) {
        setProfileError("Please enter a new password.");
        return false;
      }

      if (profileForm.new_password.length < 8) {
        setProfileError("New password must be at least 8 characters long.");
        return false;
      }

      if (profileForm.new_password !== profileForm.confirm_password) {
        setProfileError("New password and confirmation do not match.");
        return false;
      }
    }

    setProfileSaving(true);
    try {
      const payload = {
        first_name: profileForm.first_name,
        last_name: profileForm.last_name,
        phone: profileForm.phone,
        street_address: profileForm.street_address,
        city: profileForm.city,
        province: profileForm.province,
        zip_code: profileForm.zip_code,
        current_password: profileForm.current_password,
      };

      if (profileForm.new_password) {
        payload.new_password = profileForm.new_password;
      }

      payload.street_address = normalizeAddress(profileForm.street_address || "");
      const response = await updateProfile(payload);

      setProfileMessage("Profile updated successfully.");
      setProfileForm((prev) => ({
        ...prev,
        email: response.user.email || prev.email,
        current_password: "",
        new_password: "",
        confirm_password: "",
      }));
      return true;
    } catch (error) {
      setProfileError(error.data?.message || error.message || "Failed to update profile.");
      return false;
    } finally {
      setProfileSaving(false);
    }
  };

  const handleProfileSave = async () => {
    setProfileError("");
    setPasswordModalError("");
    setProfileMessage("");

    if (!profileHasChanges()) {
      setProfileMessage("No changes to save.");
      return;
    }

    if (!profileForm.current_password) {
      setShowPasswordModal(true);
      return;
    }

    await performProfileSave();
  };

  const handleCheckout = async () => {
    if (cartItems.length === 0) {
      setCheckoutError("Your cart is empty.");
      return;
    }

    if (selectedItemCount === 0) {
      setCheckoutError("Please select at least one product before proceeding to checkout.");
      return;
    }

    setCheckoutError("");
    setCheckoutMessage("");
    setCheckoutLoading(true);
    try {
      const response = await createOrder({
        items: selectedCartItems.map((item) => ({
          _id: item._id,
          name: item.name,
          quantity: item.quantity,
          unit_price: Number(item.unit_price) || 0,
          unit: item.unit || "piece",
          measurement_unit: item.measurementUnit || item.unit || "in",
          is_estimate: item.is_estimate || false,
          width: item.width || null,
          height: item.height || null,
          area: item.area || null,
          estimated_price: item.estimated_price || null,
          notes: item.notes || "",
        })),
        shipping_address: normalizeAddress(
          [profileForm.street_address, profileForm.city, profileForm.province, profileForm.zip_code]
            .filter(Boolean)
            .join(", ") || buildFullAddress(user)
        ),
      });

      setCheckoutMessage(`Order placed successfully. Tracking ID: ${response.order.tracking}`);
      setCartItems((prev) => prev.filter((item) => !item.selected));
      setOrders((prev) => [response.order, ...prev]);
    } catch (error) {
      setCheckoutError(error.data?.message || error.message || "Failed to place order.");
    } finally {
      setCheckoutLoading(false);
    }
  };

  const getProductPrice = (product) => (product.unit_price != null ? `₱${Number(product.unit_price).toLocaleString()}` : "Contact us");

  const getProductUnitRate = (product) => {
    const pricePerSqft = Number(product.price_per_sqft) || 0;
    const pricePerBlade = Number(product.price_per_blade) || 0;
    const unitPrice = Number(product.unit_price) || 0;
    const unitKey = product.unit || product.pricing_method || "unit";
    const unitLabels = {
      per_sqft: "sq ft",
      sqft: "sq ft",
      per_blade: "blade",
      blade: "blade",
      per_piece: "piece",
      piece: "piece",
      per_meter: "meter",
      meter: "meter",
      per_set: "set",
      set: "set",
    };
    const label = unitLabels[unitKey] || unitKey;

    if (product.pricing_method === "sqft" && pricePerSqft > 0) {
      return `₱${pricePerSqft.toLocaleString()} / ${label}`;
    }
    if (product.pricing_method === "blade" && pricePerBlade > 0) {
      return `₱${pricePerBlade.toLocaleString()} / ${label}`;
    }
    if (pricePerSqft > 0 && label === "sq ft") {
      return `₱${pricePerSqft.toLocaleString()} / ${label}`;
    }
    if (pricePerBlade > 0 && label === "blade") {
      return `₱${pricePerBlade.toLocaleString()} / ${label}`;
    }
    if (unitPrice > 0) {
      return `₱${unitPrice.toLocaleString()} / ${label}`;
    }
    return "Contact us";
  };

  const getProductImage = (product) => {
    let candidate = null;
    if (product?.image_url) candidate = product.image_url;
    if (!candidate && product?.image) candidate = product.image;
    if (!candidate && Array.isArray(product?.images) && product.images.length > 0) {
      candidate = product.images[0];
    }
    if (!candidate && product?.images && typeof product.images === "object") {
      const images = Object.values(product.images).flat().filter(Boolean);
      if (images.length > 0) candidate = images[0];
    }
    return ensureAbsoluteUrl(candidate);
  };

  const getOrderItemImage = (item) => {
    if (!item) return PRODUCT_IMAGE_PLACEHOLDER;
    let candidate = null;
    if (item.image_url) candidate = item.image_url;
    if (!candidate && item.image) candidate = item.image;
    const product = item.product_id || item.product;
    if (!candidate && product) candidate = getProductImage(product);
    return ensureAbsoluteUrl(candidate);
  };

  const formatCurrency = (amount) => {
    return `₱${Number(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const buildContractDataFromOrder = (order) => {
    if (!order) return null;

    const amount = Number(order.contract_amount || order.total_amount || 0);
    const downPayment = Math.round((amount * 0.5) * 100) / 100;
    const items = (order.items || []).map((item) => ({
      name: item.name || "Item",
      category: item.category || item.product_type || "General",
      quantity: item.quantity || 0,
      width: item.width || "—",
      height: item.height || "—",
      area: item.area || 0,
      unitPrice: Number(item.unit_price || 0),
      amount: Number(item.is_estimate ? item.estimated_price || 0 : (item.quantity || 0) * Number(item.unit_price || 0)),
    }));

    const contractStatus = order.contract_status?.replace(/_/g, " ") || order.status?.replace(/_/g, " ") || "Pending";
    const accepted = (order.contract_status || order.status || "").toString().toLowerCase() === "accepted" || order.status === "contract_accepted";

    return {
      orderNumber: order.tracking || order._id || "N/A",
      contractDate: order.updatedAt ? new Date(order.updatedAt).toLocaleDateString() : new Date(order.createdAt).toLocaleDateString(),
      orderDate: order.createdAt ? new Date(order.createdAt).toLocaleDateString() : "N/A",
      status: order.status?.replace(/_/g, " ") || "Pending",
      orderStatus: order.status || "",
      rawContractStatus: order.contract_status || "",
      contractStatus,
      customerName: order.customer?.first_name || order.customer_name || "Customer",
      customerEmail: order.customer?.email || order.customer_email || "N/A",
      customerPhone: order.customer?.phone || order.customer_phone || "N/A",
      projectLocation: order.shipping_address || "N/A",
      siteInspectionDate: order.inspection_date ? new Date(order.inspection_date).toLocaleDateString() : "TBD",
      paymentTerms: order.payment_terms || "Standard payment terms apply.",
      contractTerms: order.contract_terms || "",
      subtotal: amount,
      totalProjectCost: amount,
      downPayment,
      items,
      accepted,
      acceptanceMethod: accepted ? "Online Acceptance" : null,
      acceptanceDate: accepted && order.updatedAt ? new Date(order.updatedAt).toLocaleString() : null,
      acceptedBy: order.customer?.first_name || order.customer_name || "Customer",
      contractId: order.tracking || order._id || "N/A",
      customerAccountId: order.customer?._id || order.customer || "N/A",
    };
  };

  const openContractModal = (order) => {
    if (!order) return;
    setContractPreviewOrder(order);
    setShowContractModal(true);
  };

  const closeContractModal = () => {
    setShowContractModal(false);
    setContractPreviewOrder(null);
  };

  const contractPreviewData = contractPreviewOrder ? buildContractDataFromOrder(contractPreviewOrder) : null;

  const getOrderStatusLabel = (status) => {
    switch (status) {
      case "order_submitted":
        return "Order Submitted";
      case "admin_review":
        return "Admin Review";
      case "site_inspection":
        return "Site Inspection";
      case "contract_sent":
        return "Contract Sent";
      case "contract_accepted":
        return "Contract Accepted";
      case "contract_declined":
        return "Contract Declined";
      case "Cutting":
        return "Cutting";
      case "Fabrication":
        return "Fabrication";
      case "Installation":
        return "Installation";
      case "completed":
        return "Completed";
      case "cancelled":
        return "Cancelled";
      default:
        return status?.replace(/_/g, " ") || "Unknown";
    }
  };

  const getOrderStatusClasses = (status) => {
    switch (status) {
      case "completed":
        return "bg-emerald-100 text-emerald-700";
      case "contract_declined":
      case "cancelled":
        return "bg-red-100 text-red-700";
      case "order_submitted":
      case "admin_review":
      case "site_inspection":
      case "contract_sent":
      case "contract_accepted":
      case "Cutting":
      case "Fabrication":
      case "Installation":
        return "bg-amber-100 text-amber-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getOrderProgressSteps = (order) => {
    const steps = [
      { key: "order_submitted", label: "Order Submitted" },
      { key: "admin_review", label: "Admin Review" },
      { key: "site_inspection", label: "Site Inspection" },
      { key: "contract_created", label: "Contract Created" },
      { key: "contract_accepted", label: "Contract Acceptance" },
      { key: "cutting", label: "Cutting" },
      { key: "fabrication", label: "Fabrication" },
      { key: "installation", label: "Installation" },
      { key: "completed", label: "Completed" },
    ];

    const stepMap = {
      contract_sent: "contract_created",
      contract_accepted: "contract_accepted",
      contract_declined: "contract_created",
      Cutting: "fabrication",
      Fabrication: "fabrication",
      Installation: "installation",
    };

    const normalizedStatus = stepMap[order.status] || order.status;
    let activeIndex = steps.findIndex((step) => step.key === normalizedStatus);
    const inspectionIsScheduled = order.status === "site_inspection" && order.inspection_status === "scheduled";
    if (inspectionIsScheduled) {
      activeIndex = steps.findIndex((step) => step.key === "contract_created");
    }

    if (order.status === "cancelled") {
      activeIndex = -1;
    }

    if (activeIndex === -1 && order.status !== "cancelled") {
      activeIndex = 0;
    }

    return steps.map((step, index) => ({
      ...step,
      done: order.status !== "cancelled" && index < activeIndex,
      active: order.status !== "cancelled" && index === activeIndex,
      future: index > activeIndex,
    }));
  };

  const getOrderProgressPercent = (order) => {
    if (!order || order.status === "cancelled") return 0;

    const steps = buildOrderTimelineStages(order).filter((step) => step.key !== "installation_agreement");
    const completedCount = steps.filter((step) => step.status === "completed").length;
    const totalCount = steps.length || 1;
    const percent = Math.round((completedCount / totalCount) * 100);

    const installationStep = steps.find((step) => step.key === "installation");
    const installationIncomplete = installationStep && installationStep.status !== "completed";

    return installationIncomplete ? Math.min(percent, 90) : percent;
  };

  const activeOrdersCount = orders.filter((order) => order.status !== "completed" && order.status !== "cancelled").length;
  const pendingContractsCount = orders.filter((order) => ["contract_sent", "contract_accepted"].includes(order.status)).length;
  const completedProjectsCount = orders.filter((order) => order.status === "completed").length;
  const cancelledProjectsCount = orders.filter((order) => order.status === "cancelled").length;

  const filteredOrders = orders.filter((order) => {
    // If tracking number is entered, filter by tracking ID only
    if (trackingNumber.trim()) {
      return order.tracking.toUpperCase().includes(trackingNumber.trim().toUpperCase());
    }

    // Otherwise, apply status filter
    if (orderFilter === "all") return true;
    if (orderFilter === "order") return !["installation", "completed", "cancelled"].includes(order.status);
    if (orderFilter === "review") return isOrderCompletedAndReviewable(order) && !hasOrderReview(order);
    if (orderFilter === "installation") return order.status === "installation" || order.status === "site_inspection";
    if (orderFilter === "completed") return order.status === "completed";
    if (orderFilter === "cancel") return order.status === "cancelled";
    return true;
  });

  const orderViewClass = orderViewMode === "view2"
    ? "grid gap-5 sm:grid-cols-2 xl:grid-cols-3"
    : orderViewMode === "view3"
      ? "grid gap-5 lg:grid-cols-3"
      : "space-y-6";

  const estimateWidth = Number(estimateForm.width) || 0;
  const estimateHeight = Number(estimateForm.height) || 0;
  const estimateQuantity = Math.max(1, Number(estimateForm.quantity) || 1);
  const selectedUnitLabel = estimateForm.unit === 'in' ? 'in' : estimateForm.unit === 'ft' ? 'ft' : estimateForm.unit === 'cm' ? 'cm' : 'm';
  const selectedAreaUnitLabel = estimateForm.unit === 'in' ? 'in²' : estimateForm.unit === 'ft' ? 'ft²' : estimateForm.unit === 'cm' ? 'cm²' : 'm²';
  const estimateAreaSelectedUnit = estimateWidth && estimateHeight ? estimateWidth * estimateHeight : 0;
  const estimateTotalAreaSelectedUnit = estimateAreaSelectedUnit * estimateQuantity;
  
  // Use comprehensive calculateEstimate like admin does
  const estimateResult = cartDecisionProduct ? calculateEstimate({
    productName: cartDecisionProduct.product_name || cartDecisionProduct.name,
    categoryKey: cartDecisionProduct.product_type || cartDecisionProduct.category,
    variantName: cartDecisionProduct.variant,
    width: estimateWidth,
    height: estimateHeight,
    measurementUnit: estimateForm.unit,
    quantity: estimateQuantity,
    blade_count: cartDecisionProduct.blade_count || 0,
    base_price: cartDecisionProduct.base_price || undefined,
    overrideRate: cartDecisionProduct.price_per_sqft || (cartDecisionProduct.unit_price ? Number(cartDecisionProduct.unit_price) / 144 : undefined),
    customization: cartDecisionProduct.customization || false,
    customization_fee: cartDecisionProduct.customization_fee || 0,
  }) : { estimated_area: 0, estimated_price: 0, rate: 0, areaDisplay: '—', rateNote: '' };

  const estimateArea = estimateResult.estimated_area || 0;
  const estimateTotalArea = estimateArea;
  const estimateUnitRate = estimateResult.rate || 0;
  const estimateTotalCost = estimateResult.estimated_price || 0;
  const estimateCustomizationFee = cartDecisionProduct?.customization ? Number(cartDecisionProduct.customization_fee || 0) : 0;
  const estimateInstallationFee = Number(cartDecisionProduct?.installation_fee || 0);
  const estimateSubtotal = Math.max(0, estimateTotalCost - estimateCustomizationFee);
  const estimateGrandTotal = estimateTotalCost + estimateInstallationFee;
  const orderNowSubtotal = orderNowProduct ? Math.max(1, Number(orderNowQuantity) || 1) * Number(orderNowProduct.unit_price || orderNowProduct.price_per_sqft || 0) : 0;
  const orderNowAdditionalCharges = Number(orderNowProduct?.customization_fee || 0);
  const orderNowInstallationFee = Number(orderNowProduct?.installation_fee || 0);
  const orderNowGrandTotal = orderNowSubtotal + orderNowAdditionalCharges + orderNowInstallationFee;
  const orderNowTotal = orderNowGrandTotal;
  const confirmProduct = deliveryConfirmMode === "orderNow" ? orderNowProduct : cartDecisionProduct;
  const confirmQuantity = deliveryConfirmMode === "orderNow" ? Math.max(1, Number(orderNowQuantity) || 1) : estimateQuantity;
  const confirmWidth = deliveryConfirmMode === "orderNow"
    ? orderNowProduct?.width || orderNowProduct?.dimensions?.split("×")?.[0]?.trim() || "—"
    : estimateWidth ? `${estimateWidth} ${selectedUnitLabel}` : "—";
  const confirmHeight = deliveryConfirmMode === "orderNow"
    ? orderNowProduct?.height || orderNowProduct?.dimensions?.split("×")?.[1]?.trim() || "—"
    : estimateHeight ? `${estimateHeight} ${selectedUnitLabel}` : "—";
  const confirmPrice = deliveryConfirmMode === "orderNow" ? orderNowSubtotal : estimateTotalCost;
  const confirmSubtotal = deliveryConfirmMode === "orderNow" ? orderNowSubtotal : estimateSubtotal;
  const confirmAdditionalCharges = deliveryConfirmMode === "orderNow" ? orderNowAdditionalCharges : estimateCustomizationFee;
  const confirmInstallationFee = deliveryConfirmMode === "orderNow" ? orderNowInstallationFee : estimateInstallationFee;
  const confirmGrandTotal = deliveryConfirmMode === "orderNow" ? orderNowGrandTotal : estimateGrandTotal;
  const isDeliveryConfirmValid = Boolean(
    deliveryConfirmForm.phone.trim() &&
    deliveryConfirmForm.street_address.trim() &&
    deliveryConfirmForm.city.trim() &&
    deliveryConfirmForm.province.trim()
  );

  const cartQuantity = cartItems.reduce((sum, item) => sum + (item.quantity || 0), 0);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="h-12 w-12 rounded-full border-4 border-red-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Toaster position="bottom-right" />
      <div className="bg-white shadow sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <img src={logo} alt="ACGC Aluminum Services" className="w-12 h-12 object-contain" />
            <div>
              <h1 className="text-2xl font-bold text-red-600">ACGC Aluminum Services</h1>
              <p className="text-xs text-gray-500">Aluminum & Glass Management System</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 md:gap-4">
            <button onClick={() => setActiveTab("cart")} className={`px-4 py-2 rounded-xl flex items-center gap-2 ${activeTab === "cart" ? "bg-gray-100 text-red" : "hover:bg-gray-100"}`}>
              <ShoppingCart size={40} />
              <span>Cart</span>
              {cartQuantity > 0 && (
                <span className="ml-1 inline-flex items-center justify-center h-6 w-6 rounded-full bg-red-600 text-white text-xs font-semibold">
                  {cartQuantity}
                </span>
              )}
            </button>
            <button onClick={() => setActiveTab("products")} className={`px-4 py-2 rounded-xl ${activeTab === "products" ? "bg-gray-100 text-red" : "hover:bg-gray-100"}`}>
              Products
            </button>
            <button onClick={() => setActiveTab("orders")} className={`px-4 py-2 rounded-xl ${activeTab === "orders" ? "bg-gray-100 text-red" : "hover:bg-gray-100"}`}>
              My Orders
            </button>
            <button onClick={() => setActiveTab("about")} className={`px-4 py-2 rounded-xl ${activeTab === "about" ? "bg-gray-100 text-red" : "hover:bg-gray-100"}`}>
              About Us
            </button>
            <div className="relative">
              <button
                onClick={() => setNotificationsOpen((s) => !s)}
                className={`px-4 py-2 rounded-xl flex items-center gap-2 ${notificationsOpen ? "bg-gray-100 text-red" : "hover:bg-gray-100"}`}
                aria-haspopup="menu"
                aria-expanded={notificationsOpen}
              >
                <Bell size={18} />
                <span>Notifications</span>
                {orders.length > 0 && (
                  <span className="ml-1 inline-flex items-center justify-center h-6 w-6 rounded-full bg-red-600 text-white text-xs font-semibold">
                    {orders.length}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white border rounded shadow-lg z-20 max-h-96 overflow-y-auto">
                  {orders.length === 0 ? (
                    <div className="px-4 py-6 text-center text-gray-600">
                      <p>No notifications yet</p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {orders
                        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                        .slice(0, 5)
                        .map((order) => {
                          const product = order.items?.[0] || {};
                          const notificationMessage = () => {
                            switch (order.status) {
                              case "order_submitted":
                                return "Order submitted";
                              case "admin_review":
                                return "Under review";
                              case "site_inspection":
                                return "Site inspection scheduled";
                              case "contract_sent":
                                return "Contract sent";
                              case "contract_accepted":
                                return "Contract accepted";
                              case "Fabrication":
                                return "In fabrication";
                              case "Installation":
                                return "Installation in progress";
                              case "completed":
                                return "Project completed";
                              case "cancelled":
                                return "Order cancelled";
                              default:
                                return `Status: ${getOrderStatusLabel(order.status)}`;
                            }
                          };

                          return (
                            <button
                              key={order._id || order.tracking}
                              onClick={() => {
                                setSelectedOrderForModal(order);
                                setActiveTab("orders");
                                setNotificationsOpen(false);
                              }}
                              className="w-full text-left px-4 py-3 hover:bg-gray-50 transition"
                            >
                              <div className="flex gap-3">
                                <div className="flex-shrink-0">
                                  <Bell size={16} className={order.status === "completed" ? "text-emerald-600" : order.status === "cancelled" ? "text-red-600" : "text-amber-600"} />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-semibold text-slate-950 truncate">{product.name || "Project Update"}</p>
                                  <p className="text-xs text-slate-600 mt-0.5">{notificationMessage()}</p>
                                  <p className="text-xs text-slate-400 mt-1">{order.tracking}</p>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      <button
                        onClick={() => {
                          setActiveTab("notifications");
                          setNotificationsOpen(false);
                        }}
                        className="w-full text-center px-4 py-2 text-sm font-semibold text-red-600 hover:bg-gray-50"
                      >
                        View All
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="relative">
              <button
                onClick={() => setMenuOpen((s) => !s)}
                className={`px-4 py-2 rounded-xl flex items-center gap-2 ${activeTab === "profile" ? "bg-red-600 text-white" : "hover:bg-gray-100"}`}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                <User size={16} />
                <span>Profile</span>
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-2 w-44 bg-white border rounded shadow-md z-20">
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      setActiveTab("profile");
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <User size={16} />
                    <span>My Profile</span>
                  </button>

                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      setActiveTab("contracts");
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <FileText size={16} />
                    <span>Contracts</span>
                  </button>

                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      setConfirmOpen(true);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2 text-red-600"
                  >
                    <LogOut size={16} />
                    <span>Logout</span>
                  </button>
                </div>
              )}

              {confirmOpen && (
                <div className="fixed inset-0 z-30 flex items-center justify-center">
                  <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmOpen(false)} />
                  <div className="bg-white rounded shadow-lg p-6 z-40 w-full max-w-sm">
                    <h3 className="text-lg font-semibold">Confirm Logout</h3>
                    <p className="text-sm text-gray-600 mt-2">Are you sure you want to log out?</p>
                    <div className="mt-4 flex justify-end gap-2">
                      <button
                        onClick={() => setConfirmOpen(false)}
                        className="px-3 py-1 rounded bg-gray-100 hover:bg-gray-200"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleLogoutConfirm}
                        className="px-3 py-1 rounded bg-red-600 text-white hover:bg-red-700"
                      >
                        Logout
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-r from-red-700 via-red-600 to-orange-500 text-white">
        <div className="max-w-7xl mx-auto px-6 py-14">
          <h1 className="text-4xl font-bold">Welcome back, {user?.first_name || "Customer"}</h1>
          <p className="mt-3 text-red-100 max-w-2xl">Browse aluminum and glass products, monitor your orders, and manage your account.</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {activeTab === "products" && (
          <>
            <div>
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
                <div>
                  <h2 className="text-3xl font-bold">Products</h2>
                  <p className="text-gray-500">Browse available aluminum & glass products</p>
                </div>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-end w-full max-w-3xl">
                  <div className="relative w-full sm:w-80">
                    <Search size={18} className="absolute left-3 top-3 text-gray-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search products..."
                      className="w-full pl-10 pr-4 py-3 border rounded-2xl"
                    />
                  </div>
                  <div className="w-full sm:w-56">
                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="w-full border rounded-2xl py-3 px-4"
                    >
                      <option value="All">All categories</option>
                        <option value="Windows">Windows</option>
                        <option value="Doors">Doors</option>
                        <option value="Cabinets">Cabinets</option>
                        <option value="Shower Enclosures">Shower Enclosures</option>
                        <option value="Aluminum">Aluminum</option>
                        <option value="Glass">Glass</option>
                        <option value="Accessories">Accessories</option>
                    </select>
                  </div>
                </div>
              </div>

              {productError && <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">{productError}</div>}

              {isLoadingProducts ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">{[...Array(6)].map((_, i) => <div key={i} className="animate-pulse bg-white rounded-3xl p-6 h-96" />)}</div>
              ) : products.length === 0 ? (
                <div className="rounded-3xl bg-white p-10 text-center shadow"><p className="text-gray-600">No products matched your search.</p></div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {products.map((product) => (
                    <div
                      key={product._id || product.name}
                      className="group bg-white rounded-3xl shadow-lg overflow-hidden border border-transparent hover:border-red-200 hover:ring-1 hover:ring-red-100 hover:shadow-2xl hover:-translate-y-1 hover:scale-[1.01] transition duration-200 ease-out cursor-pointer flex flex-col h-full"
                      onClick={() => handleViewProduct(product)}
                    >
                      <div className="h-60 overflow-hidden bg-red-50">
                        <img src={getProductImage(product)} alt={product.name} className="w-full h-full object-cover transition duration-300 group-hover:scale-105" />
                      </div>
                      <div className="p-6 flex flex-col justify-between flex-1 gap-6">
                        <div className="space-y-4">
                          <span className="inline-flex items-center rounded-full bg-red-100 text-red-700 px-3 py-1 text-xs font-semibold tracking-wide">
                            {product.category ? product.category.charAt(0).toUpperCase() + product.category.slice(1) : "General"}
                          </span>
                          <div>
                            <h3 className="text-2xl font-semibold text-slate-900">{product.name}</h3>
                            <p className="mt-2 text-sm text-slate-500">{product.product_type || product.category || "General"}</p>
                          </div>
                          <div className="space-y-2 text-sm text-slate-600">
                            {product.dimensions ? (
                              <p><span className="font-medium text-slate-900">Dimensions:</span> {product.dimensions}</p>
                            ) : product.standard_size ? (
                              <p><span className="font-medium text-slate-900">Dimensions:</span> {product.standard_size}</p>
                            ) : product.width && product.height ? (
                              <p><span className="font-medium text-slate-900">Dimensions:</span> {product.width} × {product.height}</p>
                            ) : null}
                            <p><span className="font-medium text-slate-900">Unit Rate:</span> {getProductUnitRate(product)}</p>
                          </div>
                        </div>
                        <div className="mt-auto">
                          <p className="text-3xl font-bold text-red-600">{getProductPrice(product)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {selectedProduct && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4">
                <div className="w-full max-h-[95vh] max-w-5xl rounded-3xl bg-white shadow-2xl overflow-hidden flex flex-col">
                  {/* Header with Gradient */}
                  <div className="flex-shrink-0 bg-gradient-to-r from-red-700 via-red-600 to-orange-500 px-6 py-5">
                    <div className="flex items-center justify-between gap-4">
                      <div className="text-white">
                        <h3 className="text-2xl font-bold">{selectedProduct.name}</h3>
                        <p className="text-red-100 mt-1">{selectedProduct.category || "General"}</p>
                      </div>
                      <button onClick={closeProductModal} className="text-white hover:bg-red-800 p-2 rounded-full transition flex-shrink-0">
                        <span className="text-3xl">×</span>
                      </button>
                    </div>
                  </div>

                  {/* Scrollable Content */}
                  <div className="flex-1 overflow-y-auto">
                    <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr] p-6 lg:p-8">
                      {/* Left: Product Image & Description */}
                      <div className="space-y-6">
                        <img src={getProductImage(selectedProduct)} alt={selectedProduct.name} className="w-full h-96 rounded-3xl object-cover bg-red-50 shadow-lg" />
                        <div className="space-y-4">
                          <button
                            type="button"
                            onClick={() => setShowAboutProduct((prev) => !prev)}
                            className="w-full flex items-center justify-between rounded-3xl border border-gray-200 bg-white px-4 py-4 text-left shadow-sm hover:border-red-300 transition"
                          >
                            <div>
                              <h4 className="text-lg font-bold text-gray-900">About this product</h4>
                              <p className="text-sm text-gray-500 mt-1">Click to expand product details</p>
                            </div>
                            <span className={`text-red-600 text-2xl transition-transform ${showAboutProduct ? "rotate-180" : "rotate-0"}`}>
                              ▼
                            </span>
                          </button>

                          {showAboutProduct && (
                            <div className="rounded-3xl border border-gray-200 bg-gray-50 p-5">
                              <p className="text-gray-600 leading-relaxed">{selectedProduct.description || "No description available."}</p>
                            </div>
                          )}
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          <div className="rounded-2xl bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 p-4">
                            <p className="text-xs text-gray-600 font-medium">Type</p>
                            <p className="text-lg font-bold text-gray-900 mt-2">{selectedProduct.type || selectedProduct.product_type || "N/A"}</p>
                          </div>
                          <div className="rounded-2xl bg-gradient-to-br from-green-50 to-green-100 border border-green-200 p-4">
                            <p className="text-xs text-gray-600 font-medium">Dimensions</p>
                            <p className="text-lg font-bold text-gray-900 mt-2">
                              {selectedProduct.dimensions
                                ? selectedProduct.dimensions
                                : selectedProduct.standard_size
                                ? selectedProduct.standard_size
                                : selectedProduct.width > 0 || selectedProduct.height > 0
                                ? `${selectedProduct.width || 0}" x ${selectedProduct.height || 0}"`
                                : "N/A"}
                            </p>
                          </div>
                          <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-200 p-4">
                            <p className="text-xs text-gray-600 font-medium">Unit Rate</p>
                            <p className="text-lg font-bold text-gray-900 mt-2">{getProductUnitRate(selectedProduct)}</p>
                          </div>
                        </div>
                      </div>

                      {/* Right: Action Buttons & Info */}
                      <div className="space-y-4">
                        {/* Price Card */}
                        <div className="rounded-3xl bg-gradient-to-br from-yellow-50 to-yellow-100 border-2 border-yellow-300 p-6">
                          <p className="text-sm text-gray-600 font-medium">Starting from</p>
                          <p className="text-4xl font-bold text-red-600 mt-2">{getProductPrice(selectedProduct)}</p>
                          <p className="text-xs text-gray-500 mt-3">*Price may vary based on specifications</p>
                        </div>

                        {/* Action Buttons */}
                        <button
                          onClick={() => {
                            openCartDecisionModal(selectedProduct, "estimate");
                            closeProductModal();
                          }}
                          className="w-full rounded-2xl bg-gradient-to-r from-yellow-400 to-yellow-500 text-yellow-900 font-bold py-4 hover:from-yellow-500 hover:to-yellow-600 transition shadow-md flex items-center justify-center gap-2"
                        >
                          <Ruler size={20} />
                          Estimate Product
                        </button>

                        <button
                          onClick={() => {
                            openOrderNowModal(selectedProduct);
                            closeProductModal();
                          }}
                          className="w-full rounded-2xl bg-gradient-to-r from-red-600 to-red-700 text-white font-bold py-4 hover:from-red-700 hover:to-red-800 transition shadow-md flex items-center justify-center gap-2"
                        >
                          <Package size={20} />
                          Order Now
                        </button>

                        <button
                          onClick={() => {
                            openCartDecisionModal(selectedProduct);
                            closeProductModal();
                          }}
                          className="w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold py-4 hover:from-emerald-600 hover:to-emerald-700 transition shadow-md flex items-center justify-center gap-2"
                        >
                          <ShoppingCart size={20} />
                          Add to Cart
                        </button>

                        <button
                          type="button"
                          onClick={openProductReviewModal}
                          className="w-full rounded-[28px] border border-slate-200 bg-white p-5 mt-4 text-left shadow-sm transition hover:shadow-lg hover:border-slate-300"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Customer Reviews</p>
                              <p className="mt-2 text-2xl font-semibold text-slate-900 truncate">
                                {productReviewAverageRating || "—"} / 5
                              </p>
                              <p className="mt-2 text-sm text-slate-500">View all reviews for this product.</p>
                            </div>
                            <div className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-800">
                              <Star size={16} />
                              {productReviews.length} review{productReviews.length === 1 ? "" : "s"}
                            </div>
                          </div>
                          <div className="mt-4 flex items-center justify-between gap-3 text-sm text-slate-600">
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 font-medium">Open reviews</span>
                            <span className="inline-flex items-center gap-2 font-semibold text-slate-900">
                              View reviews
                              <ArrowRight size={18} />
                            </span>
                          </div>
                        </button>

                        {/* Info Box */}
                        <div className="rounded-2xl bg-blue-100 border border-blue-400 p-16.5 mt-6">
                          <div className="flex gap-3">
                            <Info size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
                            <div className="text-sm">
                              <p className="font-bold text-blue-900">Need help?</p>
                              <p className="text-black-600 font-medium mt-1">Use the estimate tool to calculate custom pricing based on your measurements.</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {showCartDecisionModal && cartDecisionProduct && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4">
                <div className="w-full max-h-[95vh] max-w-4xl rounded-3xl bg-white shadow-2xl overflow-hidden flex flex-col">
                  {/* Sticky Header with Gradient */}
                  <div className="flex-shrink-0 bg-gradient-to-r from-red-600 to-red-700 px-6 py-5">
                    <div className="flex items-center justify-between gap-4">
                      <div className="text-white">
                        <h3 className="text-2xl font-bold flex items-center gap-2">
                          <ShoppingCart size={28} />
                          {cartDecisionStep === "choice" ? "Choose Your Option" : "Get an Estimate"}
                        </h3>
                        <p className="text-red-100 mt-1">{cartDecisionStep === "choice" ? "Decide how to add this product to your cart" : "Enter measurements for a personalized estimate"}</p>
                      </div>
                      <button onClick={closeCartDecisionModal} className="text-white hover:bg-red-800 p-2 rounded-full transition">
                        <span className="text-3xl">×</span>
                      </button>
                    </div>
                  </div>

                  {/* Scrollable Content */}
                  <div className="flex-1 overflow-y-auto">
                    {cartDecisionStep === "choice" ? (
                      // CHOICE STEP
                      <div className="px-6 py-8 space-y-6">
                        {/* Product Preview Card */}
                        <div className="rounded-2xl border-2 border-red-100 bg-gradient-to-br from-red-50 to-orange-50 p-6">
                          <div className="flex items-center gap-4">
                            <img src={getProductImage(cartDecisionProduct)} alt={cartDecisionProduct.name} className="w-28 h-28 rounded-2xl object-cover bg-white shadow-md flex-shrink-0" />
                            <div className="flex-1">
                              <p className="text-sm text-gray-600 font-medium">Selected Product</p>
                              <h4 className="text-2xl font-bold text-gray-900 mt-1">{cartDecisionProduct.name}</h4>
                              <p className="text-lg text-red-600 font-bold mt-2">{getProductPrice(cartDecisionProduct)}</p>
                            </div>
                          </div>
                        </div>

                        {/* Option Cards */}
                        <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
                          {/* Estimate Option */}
                          <button
                            onClick={handleCartDecisionEstimate}
                            className="group relative rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-xl"
                          >
                            <div className="absolute inset-0 bg-gradient-to-br from-yellow-400 to-yellow-600 group-hover:from-yellow-500 group-hover:to-yellow-700 transition" />
                            <div className="relative px-6 py-8 text-left text-white">
                              <div className="flex items-start justify-between mb-3">
                                <Ruler size={32} className="text-yellow-100" />
                                <ArrowRight size={24} className="text-yellow-100" />
                              </div>
                              <p className="text-xl font-bold mb-2">Estimate First</p>
                              <p className="text-sm text-yellow-100 leading-relaxed">Enter your measurements to get an accurate price before adding to cart</p>
                            </div>
                          </button>

                          {/* Add to Cart Option */}
                          <button
                            onClick={handleCartDecisionNoAdd}
                            className="group relative rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-xl"
                          >
                            <div className="absolute inset-0 bg-gradient-to-br from-emerald-400 to-emerald-600 group-hover:from-emerald-500 group-hover:to-emerald-700 transition" />
                            <div className="relative px-6 py-8 text-left text-white">
                              <div className="flex items-start justify-between mb-3">
                                <CheckCircle size={32} className="text-emerald-100" />
                                <ArrowRight size={24} className="text-emerald-100" />
                              </div>
                              <p className="text-xl font-bold mb-2">Add to Cart Now</p>
                              <p className="text-sm text-emerald-100 leading-relaxed">Skip the estimate and add this product at the standard price</p>
                            </div>
                          </button>
                        </div>

                        {/* Cancel */}
                        <button
                          onClick={closeCartDecisionModal}
                          className="w-full rounded-2xl border-2 border-gray-200 bg-white text-gray-700 font-semibold py-3 hover:bg-gray-50 transition"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      // ESTIMATE STEP
                      <div className="px-6 py-8 space-y-6">
                        {/* Product Compact Card */}
                        <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-4 border border-gray-200">
                          <img src={getProductImage(cartDecisionProduct)} alt={cartDecisionProduct.name} className="w-16 h-16 rounded-lg object-cover bg-white" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-600">Estimating for</p>
                            <p className="font-semibold text-gray-900 truncate">{cartDecisionProduct.name}</p>
                          </div>
                          <button
                            onClick={() => setCartDecisionStep("choice")}
                            className="text-blue-600 hover:text-blue-700 text-sm font-medium whitespace-nowrap ml-2"
                          >
                            Change
                          </button>
                        </div>

                        {/* Input Form - Card Based */}
                        <div className="grid gap-6 lg:grid-cols-2">
                          {/* Left: Input Fields */}
                          <div className="space-y-5">
                            <div>
                              <label className="block">
                                <div className="flex items-center gap-2 mb-2">
                                  <Ruler size={39} className="text-red-600" />
                                  <span className="text-sm font-semibold text-gray-700">Measurement Unit</span>
                                </div>
                                <select
                                  name="unit"
                                  value={estimateForm.unit}
                                  onChange={handleEstimateFormChange}
                                  className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-200 transition text-lg"
                                >
                                  <option value="in">Inches (in)</option>
                                  <option value="ft">Feet (ft)</option>
                                  <option value="cm">Centimeters (cm)</option>
                                  <option value="m">Meters (m)</option>
                                </select>
                              </label>
                            </div>

                            <div>
                              <label className="block">
                                <div className="flex items-center gap-2 mb-2">
                                  <Ruler size={39} className="text-red-600" />
                                  <span className="text-sm font-semibold text-gray-700">Width ({estimateForm.unit})</span>
                                </div>
                                <input
                                  type="number"
                                  name="width"
                                  min="0"
                                  value={estimateForm.width}
                                  onChange={handleEstimateFormChange}
                                  placeholder="0"
                                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-200 transition text-lg"
                                />
                                {estimateFormErrors.width && <p className="mt-2 text-sm text-red-600">{estimateFormErrors.width}</p>}
                              </label>
                            </div>

                            <div>
                              <label className="block">
                                <div className="flex items-center gap-2 mb-2">
                                  <Ruler size={39} className="text-red-600 rotate-90" />
                                  <span className="text-sm font-semibold text-gray-700">Height ({estimateForm.unit})</span>
                                </div>
                                <input
                                  type="number"
                                  name="height"
                                  min="0"
                                  value={estimateForm.height}
                                  onChange={handleEstimateFormChange}
                                  placeholder="0"
                                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-200 transition text-lg"
                                />
                                {estimateFormErrors.height && <p className="mt-2 text-sm text-red-600">{estimateFormErrors.height}</p>}
                              </label>
                            </div>

                            <div>
                              <label className="block">
                                <div className="flex items-center gap-2 mb-2">
                                  <Package size={39} className="text-red-600" />
                                  <span className="text-sm font-semibold text-gray-700">Quantity</span>
                                </div>
                                <input
                                  type="number"
                                  name="quantity"
                                  value={estimateForm.quantity}
                                  min="1"
                                  onChange={handleEstimateFormChange}
                                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-200 transition text-lg"
                                />
                              </label>
                            </div>

                            <div>
                              <label className="block">
                                <div className="flex items-center gap-2 mb-2">
                                  <Info size={39} className="text-yellow-600" />
                                  <span className="text-sm font-semibold text-gray-700 ">Notes (optional)</span>
                                </div>
                                <textarea
                                  name="notes"
                                  value={estimateForm.notes}
                                  onChange={handleEstimateFormChange}
                                  placeholder="Add any special instructions or details..."
                                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 min-h-[100px] focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-200 transition resize-none"
                                />
                              </label>
                            </div>
                          </div>

                          {/* Right: Calculation Display */}
                          <div className="space-y-4">
                            {/* Measurements Summary */}
                            <div className="rounded-2xl bg-white-100 border-2 border-gray-200 p-5">
                              <div className="flex items-center gap-2 mb-3">
                                <Ruler size={20} className="text-black-600" />
                                <h4 className="font-bold text-black-900">Measurements</h4>
                              </div>
                              <div className="space-y-3 text-sm">
                                <div className="flex justify-between items-center p-3 bg-white rounded-lg">
                                  <span className="text-black-600">Selected Unit</span>
                                  <span className="font-bold text-black-900">{estimateForm.unit === 'in' ? 'Inches' : estimateForm.unit === 'ft' ? 'Feet' : estimateForm.unit === 'cm' ? 'Centimeters' : 'Meters'}</span>
                                </div>
                                <div className="flex justify-between items-center p-3 bg-white rounded-lg">
                                  <span className="text-black-600">Width</span>
                                  <span className="font-bold text-black-900">{estimateForm.width ? `${estimateForm.width} ${estimateForm.unit}` : '—'}</span>
                                </div>
                                <div className="flex justify-between items-center p-3 bg-white rounded-lg">
                                  <span className="text-black-600">Height</span>
                                  <span className="font-bold text-black-900">{estimateForm.height ? `${estimateForm.height} ${estimateForm.unit}` : '—'}</span>
                                </div>
                                <div className="flex justify-between items-center p-3 bg-white rounded-lg">
                                  <span className="text-black-600">Area per unit</span>
                                  <span className="font-bold text-black-900">{estimateAreaSelectedUnit ? `${estimateAreaSelectedUnit.toFixed(2)} ${selectedAreaUnitLabel}` : '—'}</span>
                                </div>
                                <div className="flex justify-between items-center p-3 bg-white rounded-lg">
                                  <span className="text-black-600">Total Quantity</span>
                                  <span className="font-bold text-black-900">{estimateQuantity}</span>
                                </div>
                                <div className="flex justify-between items-center p-3 bg-gradient-to-r from-yellow-400 to-yellow-500 text-yellow-900 font-bold rounded-lg">
                                  <span className="text-black font-semibold">Total Area</span>
                                  <span className="font-bold text-black-900 text-lg">{estimateTotalAreaSelectedUnit ? `${estimateTotalAreaSelectedUnit.toFixed(2)} ${selectedAreaUnitLabel}` : '—'}</span>
                                </div>
                              </div>
                            </div>

                            {/* Price Summary */}
                            <div className="rounded-2xl bg-white border-2 border-green-200 p-5">
                              <div className="flex items-center gap-3 mb-3">
                                <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white-100 text-2xl font-bold text-green-600">₱</span>
                                <h4 className="font-bold text-black-900">Price Summary</h4>
                              </div>
                              <div className="space-y-3 text-sm">
                                <div className="p-3 bg-white rounded-lg">
                                  <p className="text-xs text-black-500 mb-1">Rate per Sq Ft</p>
                                  <p className="font-bold text-gray-900">{estimateUnitRate ? `₱${estimateUnitRate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "Contact us"}</p>
                                </div>
                                <div className="p-3 bg-white rounded-lg">
                                  <p className="text-xs text-black-500 mb-1">Calculation</p>
                                  <p className="text-sm font-semibold text-gray-900">
                                    {estimateWidth && estimateHeight
                                      ? `₱${estimateUnitRate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} × ${estimateTotalArea.toFixed(2)} sq ft`
                                      : "Fill measurements"}
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* Final Cost - Highlighted */}
                            <div className="rounded-2xl bg-gradient-to-br from-red-600 to-red-700 p-5 text-white">
                              <p className="text-sm text-red-100 mb-2">Total Estimated Cost</p>
                              <p className="text-4xl font-bold">
                                {estimateWidth && estimateHeight
                                  ? `₱${estimateTotalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                  : "—"}
                              </p>
                              <p className="text-xs text-red-100 mt-2">*Final price may vary based on final specifications</p>
                            </div>
                          </div>
                        </div>

                        {cartActionError && (
                          <div className="rounded-xl border-2 border-red-300 bg-red-50 p-4 text-sm text-red-700 flex items-start gap-3">
                            <Info size={18} className="flex-shrink-0 mt-0.5" />
                            <div>{cartActionError}</div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Sticky Footer */}
                  <div className="flex-shrink-0 border-t-2 border-gray-200 bg-white px-6 py-4">
                    {cartDecisionStep === "choice" ? null : (
                      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                        <button
                          onClick={closeCartDecisionModal}
                          className="rounded-xl border-2 border-gray-300 bg-white text-gray-700 font-semibold py-3 px-6 hover:bg-gray-50 transition"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleEstimateAfterEstimation}
                          disabled={orderRequestLoading}
                          className={`rounded-xl text-white font-semibold py-3 px-6 transition shadow-lg flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed ${
                            estimateFlowType === "add_to_cart_estimate"
                              ? "bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800"
                              : "bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800"
                          }`}
                        >
                          <CheckCircle size={20} />
                          {estimateFlowType === "add_to_cart_estimate"
                            ? orderRequestLoading
                              ? "Adding..."
                              : "Add to Cart"
                            : orderRequestLoading
                              ? "Requesting..."
                              : "Request Order"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {showDeliveryConfirmModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                <div className="w-full max-w-5xl rounded-3xl bg-white shadow-2xl overflow-hidden max-h-[95vh] flex flex-col">
                  <div className="flex-shrink-0 bg-gradient-to-r from-red-700 via-red-600 to-orange-500 px-6 py-5 text-white">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="text-xl font-bold">Confirm Delivery Information</h3>
                        <p className="text-sm text-red-100 mt-1">Review your delivery details and order preview before moving to the final order summary.</p>
                      </div>
                      <span className="inline-flex items-center rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-white">
                        {deliveryConfirmMode === "orderNow" ? "Order Now" : "Estimate Product"}
                      </span>
                    </div>
                    <p className="text-xs text-red-100 mt-2">Fields marked <span className="font-bold">*</span> are required.</p>
                  </div>

                  <div className="flex-1 overflow-y-auto">
                    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.9fr] bg-slate-50 p-6 min-h-0">
                      <div className="space-y-6 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <h4 className="text-lg font-semibold text-gray-900">Customer Information</h4>
                            <p className="text-sm text-gray-500 mt-1">Verify your contact and delivery address before continuing.</p>
                          </div>
                          {!isDeliveryConfirmValid && (
                            <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">Incomplete required fields</span>
                          )}
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                          <div>
                            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Full Name</label>
                            <p className="mt-2 text-gray-900">{`${profileForm.first_name || user?.first_name || ""} ${profileForm.last_name || user?.last_name || ""}`.trim() || "N/A"}</p>
                          </div>
                          <div>
                            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Email Address</label>
                            <p className="mt-2 text-gray-900">{profileForm.email || user?.email || "N/A"}</p>
                          </div>
                          <div className="sm:col-span-2">
                            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Contact Number <span className="text-red-600">*</span></label>
                            <input
                              name="phone"
                              type="text"
                              value={deliveryConfirmForm.phone}
                              onChange={handleDeliveryConfirmChange}
                              className="mt-2 w-full rounded-2xl border border-gray-300 bg-gray-50 px-4 py-3 text-gray-900 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
                            />
                          </div>
                        </div>

                        <div className="rounded-3xl border border-gray-200 bg-gray-50 p-4">
                          <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-gray-500">Delivery Address</h4>
                          <div className="mt-4 grid gap-4 sm:grid-cols-2">
                            <div className="sm:col-span-2">
                              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Street Address <span className="text-red-600">*</span></label>
                              <input
                                name="street_address"
                                type="text"
                                value={deliveryConfirmForm.street_address}
                                onChange={handleDeliveryConfirmChange}
                                className="mt-2 w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">City <span className="text-red-600">*</span></label>
                              <input
                                name="city"
                                type="text"
                                value={deliveryConfirmForm.city}
                                onChange={handleDeliveryConfirmChange}
                                className="mt-2 w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Province <span className="text-red-600">*</span></label>
                              <input
                                name="province"
                                type="text"
                                value={deliveryConfirmForm.province}
                                onChange={handleDeliveryConfirmChange}
                                className="mt-2 w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Zip Code</label>
                              <input
                                name="zip_code"
                                type="text"
                                value={deliveryConfirmForm.zip_code}
                                onChange={handleDeliveryConfirmChange}
                                className="mt-2 w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
                              />
                            </div>
                          </div>
                        </div>

                        {deliveryConfirmError && (
                          <div className="rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-700">
                            Please complete your delivery information before proceeding.
                          </div>
                        )}
                      </div>

                      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
                        <div className="flex items-start gap-4">
                          <div className="h-24 w-24 overflow-hidden rounded-3xl border border-gray-200 bg-gray-100">
                            <img
                              src={getProductImage(confirmProduct)}
                              alt={confirmProduct?.name || "Product preview"}
                              className="h-full w-full object-cover"
                            />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm uppercase tracking-[0.2em] text-gray-500">Order Preview</p>
                            <h4 className="text-xl font-semibold text-gray-900 mt-2">{confirmProduct?.name || "Product details"}</h4>
                            <p className="mt-1 text-sm text-gray-600">{confirmProduct?.product_type || confirmProduct?.category || "Product"}</p>
                          </div>
                        </div>

                        <div className="mt-6 space-y-4">
                          <div className="rounded-3xl bg-slate-50 p-4 border border-slate-200">
                            <p className="text-sm font-semibold text-gray-700 mb-3">Product Details</p>
                            <div className="grid gap-3 text-sm text-gray-700 sm:grid-cols-2">
                              <div>
                                <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Quantity</p>
                                <p className="mt-2 font-semibold text-gray-900">{confirmQuantity}</p>
                              </div>
                              <div>
                                <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Unit Price</p>
                                <p className="mt-2 font-semibold text-gray-900">{formatCurrency(deliveryConfirmMode === "orderNow" ? Number(orderNowProduct?.unit_price || orderNowProduct?.price_per_sqft || 0) : estimateUnitRate)}</p>
                              </div>
                              <div>
                                <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Width</p>
                                <p className="mt-2 font-semibold text-gray-900">{confirmWidth}</p>
                              </div>
                              <div>
                                <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Height</p>
                                <p className="mt-2 font-semibold text-gray-900">{confirmHeight}</p>
                              </div>
                              <div className="sm:col-span-2">
                                <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Color / Variant</p>
                                <p className="mt-2 font-semibold text-gray-900">{confirmProduct?.variant || confirmProduct?.color || "Standard"}</p>
                              </div>
                            </div>
                          </div>

                          <div className="rounded-3xl bg-slate-50 p-4 border border-slate-200">
                            <p className="text-sm font-semibold text-gray-700 mb-3">Pricing Breakdown</p>
                            <div className="space-y-3 text-sm text-gray-700">
                              <div className="flex items-center justify-between">
                                <span>Subtotal</span>
                                <span className="font-semibold text-gray-900">{formatCurrency(confirmSubtotal)}</span>
                              </div>
                              
                              <div className="border-t border-gray-200 pt-3 flex items-center justify-between text-base font-semibold text-gray-900">
                                <span>Total</span>
                                <span>{formatCurrency(confirmGrandTotal)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="sticky bottom-0 z-10 flex justify-end gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4">
                    <button
                      type="button"
                      onClick={handleCancelDeliveryConfirm}
                      className="rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-100 transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmAndContinue}
                      disabled={!isDeliveryConfirmValid || orderRequestLoading}
                      className="rounded-xl bg-gradient-to-r from-red-600 to-red-700 px-5 py-3 text-sm font-semibold text-white hover:from-red-700 hover:to-red-800 transition shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      Confirm & Continue
                    </button>
                  </div>
                </div>
              </div>
            )}

            {showOrderNowModal && orderNowProduct && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                <div className="w-full max-w-3xl rounded-3xl bg-white shadow-2xl overflow-hidden">
                  <div className="border-b px-6 py-5 bg-gradient-to-r from-red-700 via-red-600 to-orange-500 text-white">
                    <div className="flex flex-col gap-1">
                      <h3 className="text-xl font-bold">Order Now</h3>
                      <p className="text-sm text-red-100">Review product details, set quantity, and continue to the order summary.</p>
                    </div>
                  </div>

                  <div className="grid gap-6 p-6 lg:grid-cols-[1.4fr_0.8fr]">
                    <div className="space-y-6 rounded-[32px] border border-gray-200 bg-gray-50 p-6 shadow-sm">
                      <div className="flex flex-col gap-4 rounded-3xl bg-white p-4 shadow-sm border border-gray-200">
                        <div className="flex items-center gap-4">
                          <div className="h-24 w-24 overflow-hidden rounded-3xl border border-gray-200 bg-gray-100">
                            <img
                              src={getProductImage(orderNowProduct)}
                              alt={orderNowProduct.name}
                              className="h-full w-full object-cover"
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs uppercase tracking-[0.24em] text-gray-500">Selected Product</p>
                            <p className="mt-2 text-2xl font-bold text-gray-900 truncate">{orderNowProduct.name}</p>
                            <p className="mt-1 text-sm text-gray-600">{orderNowProduct.product_type || orderNowProduct.category || "Product"}</p>
                          </div>
                        </div>
                        <p className="text-lg font-semibold text-red-600">{getProductPrice(orderNowProduct)}</p>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-3xl bg-white p-4 border border-gray-200">
                          <p className="text-xs uppercase tracking-[0.24em] text-gray-500">Unit Price</p>
                          <p className="mt-2 text-lg font-semibold text-gray-900">{orderNowProduct ? `₱${Number(orderNowProduct.unit_price || orderNowProduct.price_per_sqft || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "Contact us"}</p>
                        </div>
                        <div className="rounded-3xl bg-white p-4 border border-gray-200">
                          <p className="text-xs uppercase tracking-[0.24em] text-gray-500">Unit</p>
                          <p className="mt-2 text-lg font-semibold text-gray-900">{orderNowProduct.unit || "piece"}</p>
                        </div>
                        <div className="rounded-3xl bg-white p-4 border border-gray-200">
                          <p className="text-xs uppercase tracking-[0.24em] text-gray-500">Variant</p>
                          <p className="mt-2 text-lg font-semibold text-gray-900">{orderNowProduct.variant || "Standard"}</p>
                        </div>
                          <div className="rounded-3xl bg-white p-4 border border-gray-200">
                            <p className="text-xs uppercase tracking-[0.24em] text-gray-500">Dimensions</p>
                            <p className="mt-2 text-lg font-semibold text-gray-900">
                              {orderNowProduct.width && orderNowProduct.height
                                ? `${orderNowProduct.width}" × ${orderNowProduct.height}"`
                                : orderNowProduct.dimensions || orderNowProduct.standard_size || orderNowProduct.size || "—"}
                            </p>
                          </div>
                        </div>

                        <div className="rounded-3xl bg-white p-5 border border-gray-200">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold text-gray-700">Quantity</p>
                            <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-3 py-2">
                              <button
                                type="button"
                                onClick={() => handleOrderNowQuantityChange(-1)}
                                className="rounded-2xl bg-gray-100 p-3 text-gray-700 hover:bg-gray-200 transition"
                              >
                                <Minus size={18} />
                              </button>
                              <span className="text-2xl font-semibold text-gray-900">{orderNowQuantity}</span>
                              <button
                                type="button"
                                onClick={() => handleOrderNowQuantityChange(1)}
                                className="rounded-2xl bg-gray-100 p-3 text-gray-700 hover:bg-gray-200 transition"
                              >
                                <Plus size={18} />
                              </button>
                            </div>
                          </div>
                          <p className="mt-3 text-sm text-gray-500">Adjust the number of units before moving to the summary page.</p>
                        </div>
                        </div>

                    <div className="space-y-6 rounded-[32px] border border-gray-200 bg-white p-6 shadow-sm">
                      <div className="rounded-3xl bg-gradient-to-r from-red-600 to-red-700 p-5 text-white">
                        <p className="text-sm uppercase tracking-[0.24em] text-red-100">Order snapshot</p>
                        <p className="mt-3 text-3xl font-bold">{orderNowProduct ? `₱${(Math.max(1, Number(orderNowQuantity) || 1) * Number(orderNowProduct.unit_price || orderNowProduct.price_per_sqft || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "₱0.00"}</p>
                      </div>

                      <div className="grid gap-3">
                        <div className="rounded-3xl bg-gray-50 p-4 border border-gray-200">
                          <p className="text-xs uppercase tracking-[0.24em] text-gray-500">Estimated total</p>
                          <p className="mt-2 text-lg font-semibold text-gray-900">{orderNowProduct ? `₱${(Math.max(1, Number(orderNowQuantity) || 1) * Number(orderNowProduct.unit_price || orderNowProduct.price_per_sqft || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "₱0.00"}</p>
                        </div>
                        <div className="rounded-3xl bg-gray-50 p-4 border border-gray-200">
                          <p className="text-xs uppercase tracking-[0.24em] text-gray-500">Downpayment</p>
                          <p className="mt-2 text-lg font-semibold text-gray-900">{orderNowProduct ? `₱${(Math.max(1, Number(orderNowQuantity) || 1) * Number(orderNowProduct.unit_price || orderNowProduct.price_per_sqft || 0) * 0.5).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "₱0.00"}</p>
                        </div>
                      </div>

                      <div className="rounded-3xl bg-blue-50 p-4 border border-blue-100">
                        <p className="text-sm font-semibold text-blue-900">Need help?</p>
                        <p className="mt-2 text-sm text-blue-700">Use the estimate tool to calculate custom pricing based on your measurements.</p>
                      </div>

                      {cartActionError && (
                        <div className="rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-700">
                          {cartActionError}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={closeOrderNowModal}
                      className="rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-100 transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={openOrderNowReviewModal}
                      disabled={orderRequestLoading}
                      className="rounded-xl bg-gradient-to-r from-red-600 to-red-700 px-5 py-3 text-sm font-semibold text-white hover:from-red-700 hover:to-red-800 transition shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      Continue to Summary
                    </button>
                  </div>
                </div>
              </div>
            )}

            {showOrderReviewModal && (cartDecisionProduct || orderNowProduct) && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                <div className="w-full max-w-xl rounded-3xl bg-white shadow-2xl overflow-hidden max-h-[90vh] flex min-h-[20rem] flex-col">
                  <div className="bg-gradient-to-r from-red-700 via-red-600 to-orange-500 border-b px-5 py-4">
                    <h3 className="text-white text-medium font-bold">Order Summary & Policy</h3>
                    <p className="mt-2 text-sm text-white">Review your order details and confirm the payment policy before submitting.</p>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100">
                    <div className="rounded-3xl border border-gray-200 bg-white p-4">
                      <p className="text-sm font-semibold text-gray-700 mb-4">Customer Information</p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl bg-gray-50 p-4 border border-gray-200">
                          <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Full Name</p>
                          <p className="mt-2 font-semibold text-gray-900">{`${profileForm.first_name || user?.first_name || ""} ${profileForm.last_name || user?.last_name || ""}`.trim() || "N/A"}</p>
                        </div>
                        <div className="rounded-2xl bg-gray-50 p-4 border border-gray-200">
                          <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Email Address</p>
                          <p className="mt-2 font-semibold text-gray-900">{profileForm.email || user?.email || "N/A"}</p>
                        </div>
                        <div className="rounded-2xl bg-gray-50 p-4 border border-gray-200">
                          <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Contact Number</p>
                          <p className="mt-2 font-semibold text-gray-900">{deliveryConfirmForm.phone || profileForm.phone || user?.phone || "N/A"}</p>
                        </div>
                        <div className="rounded-2xl bg-gray-50 p-4 border border-gray-200">
                          <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Delivery Address</p>
                          <p className="mt-2 font-semibold text-gray-900">{normalizeAddress([
                            deliveryConfirmForm.street_address || profileForm.street_address,
                            deliveryConfirmForm.city || profileForm.city,
                            deliveryConfirmForm.province || profileForm.province,
                            deliveryConfirmForm.zip_code || profileForm.zip_code,
                          ].filter(Boolean).join(", ")) || "N/A"}</p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-3xl border border-gray-200 bg-white p-4">
                      <p className="text-sm font-semibold text-gray-700 mb-4">Order Details</p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl bg-white p-4 border border-gray-200">
                          <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Product</p>
                          <p className="mt-2 font-semibold text-gray-900">{(reviewOrderMode === "orderNow" ? orderNowProduct : cartDecisionProduct)?.name}</p>
                        </div>
                        {reviewOrderMode === "estimate" ? (
                          <>
                            <div className="rounded-2xl bg-white p-4 border border-gray-200">
                              <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Dimensions</p>
                              <p className="mt-2 font-semibold text-gray-900">{estimateWidth || 0}" × {estimateHeight || 0}"</p>
                            </div>
                            <div className="rounded-2xl bg-white p-4 border border-gray-200">
                              <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Area</p>
                              <p className="mt-2 font-semibold text-gray-900">{estimateArea ? `${estimateArea.toFixed(2)} sq ft` : "0.00 sq ft"}</p>
                            </div>
                            <div className="rounded-2xl bg-white p-4 border border-gray-200">
                              <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Price / sq ft</p>
                              <p className="mt-2 font-semibold text-gray-900">{estimateUnitRate ? `₱${estimateUnitRate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "Contact us"}</p>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="rounded-2xl bg-white p-4 border border-gray-200">
                              <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Quantity</p>
                              <p className="mt-2 font-semibold text-gray-900">{orderNowQuantity}</p>
                            </div>
                            <div className="rounded-2xl bg-white p-4 border border-gray-200">
                              <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Unit Price</p>
                              <p className="mt-2 font-semibold text-gray-900">{orderNowProduct ? `₱${Number(orderNowProduct.unit_price || orderNowProduct.price_per_sqft || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "Contact us"}</p>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="rounded-3xl border border-gray-200 p-5 bg-white">
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-sm font-semibold text-gray-700">Total</p>
                        <p className="text-xl font-bold text-gray-900">
                          {reviewOrderMode === "orderNow"
                            ? orderNowProduct
                              ? `₱${(Math.max(1, Number(orderNowQuantity) || 1) * Number(orderNowProduct.unit_price || orderNowProduct.price_per_sqft || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              : "₱0.00"
                            : estimateTotalCost
                              ? `₱${estimateTotalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              : "₱0.00"}
                        </p>
                      </div>
                      <div className="flex items-center justify-between border-t border-gray-200 pt-4">
                        <p className="text-sm text-gray-600">50% Downpayment</p>
                        <p className="font-semibold text-gray-900">
                          {reviewOrderMode === "orderNow"
                            ? orderNowProduct
                              ? `₱${(Math.max(1, Number(orderNowQuantity) || 1) * Number(orderNowProduct.unit_price || orderNowProduct.price_per_sqft || 0) * 0.5).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              : "₱0.00"
                            : estimateTotalCost
                              ? `₱${(estimateTotalCost * 0.5).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              : "₱0.00"}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-3xl border border-gray-200 bg-blue-300 p-5">
                      <p className="font-semibold text-blue-900">Payment Policy</p>
                      <p className="mt-3 text-sm text-black-900">
                        A 50% downpayment {reviewOrderMode === "orderNow" ? "of the total order amount" : "of the estimated total amount"}
                        {reviewOrderMode === "orderNow" && orderNowProduct
                          ? ` (₱${(Math.max(1, Number(orderNowQuantity) || 1) * Number(orderNowProduct.unit_price || orderNowProduct.price_per_sqft || 0) * 0.5).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`
                          : reviewOrderMode === "estimate" && estimateTotalCost
                            ? ` (₱${(estimateTotalCost * 0.5).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`
                            : ""}
                        is required upon order agreement.
                      </p>
                      <p className="mt-2 text-sm text-black-700">For inquiries, please call our shop directly.</p>
                      <p className="mt-3 font-semibold text-blue-900">+63 950-624-8802</p>
                    </div>

                    <label className="flex items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4">
                      <input
                        type="checkbox"
                        checked={orderReviewAgreed}
                        onChange={(e) => setOrderReviewAgreed(e.target.checked)}
                        className="mt-0 h-5 w-5 rounded border-gray-300 text-red-600 focus:ring-red-500"
                      />
                      <span className="text-sm text-black-700">I understand the 50% downpayment policy and agree to proceed.</span>
                    </label>

                    {cartActionError && (
                      <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700">
                        {cartActionError}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-3 border-t border-gray-200 bg-gray-50 px-4 py-3">
                    <button
                      onClick={() => {
                        setShowOrderReviewModal(false);
                        setCartActionError("");
                      }}
                      className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 transition"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleSubmitOrderRequest}
                      disabled={!orderReviewAgreed || orderRequestLoading}
                      className="rounded-xl bg-red-600 px-6 py-3 text-sm font-semibold text-white hover:bg-red-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {orderRequestLoading ? "Requesting..." : "Submit Order Request"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {showOrderSuccessModal && orderSuccessData && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
                <div className="w-full max-w-xl overflow-hidden rounded-[28px] border border-red-100 bg-gradient-to-br from-white via-rose-50 to-red-50 shadow-[0_28px_80px_rgba(220,38,38,0.16)] max-h-[90vh] flex min-h-[18rem] flex-col">
                  <div className="relative overflow-hidden bg-gradient-to-r from-red-700 via-red-600 to-orange-500 px-5 py-5 text-white">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.25),_transparent_40%)]" />
                    <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-300"><span>Tracking ID:</span> {orderSuccessData.tracking}</p>
                        <h3 className="mt-3 text-2xl font-bold">Order Submitted Successfully</h3>
                      </div>
                      <button
                        onClick={() => {
                          setShowOrderSuccessModal(false);
                          setOrderSuccessData(null);
                        }}
                        className="relative z-10 inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-white/10 text-xl text-white transition hover:bg-white/20"
                      >
                        ×
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100">
                    <div className="rounded-[24px] bg-gradient-to-br from-red-50 via-white to-amber-50 p-4 shadow-[0_14px_40px_rgba(15,23,42,0.08)]">
                      <p className="text-sm font-semibold uppercase tracking-[0.3em] text-red-700">Next Steps</p>
                      <p className="mt-3 text-sm leading-6 text-slate-700">Our team will review your request and contact you to confirm the site inspection and next schedule.</p>
                      <div className="mt-4 space-y-2 text-sm text-slate-700">
                        <div className="rounded-3xl bg-green-200 p-3 shadow-sm">
                          <p className="font-semibold text-slate-900">Admin Review</p>
                        </div>
                        <div className="rounded-3xl bg-white/90 p-3 shadow-sm">
                          <p className="font-semibold text-slate-900">Site Inspection</p>
                        </div>
                        <div className="rounded-3xl bg-white/90 p-3 shadow-sm">
                          <p className="font-semibold text-slate-900">Contract Created</p>
                        </div>
                        <div className="rounded-3xl bg-white/90 p-3 shadow-sm">
                          <p className="font-semibold text-slate-900">Contract Acceptance</p>
                        </div>
                        <div className="rounded-3xl bg-white/90 p-3 shadow-sm">
                          <p className="font-semibold text-slate-900">Cutting</p>
                        </div>
                        <div className="rounded-3xl bg-white/90 p-3 shadow-sm">
                          <p className="font-semibold text-slate-900">Fabrication</p>
                        </div>
                        <div className="rounded-3xl bg-white/90 p-3 shadow-sm">
                          <p className="font-semibold text-slate-900">Installation</p>
                        </div>
                        <div className="rounded-3xl bg-white/90 p-3 shadow-sm">
                          <p className="font-semibold text-slate-900">Completed</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end">
                    <button
                      onClick={() => {
                        setShowOrderSuccessModal(false);
                        setOrderSuccessData(null);
                      }}
                      className="rounded-2xl border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                    >
                      Back to Products
                    </button>
                    <button
                      onClick={() => {
                        setShowOrderSuccessModal(false);
                        setOrderSuccessData(null);
                        setActiveTab("orders");
                      }}
                      className="rounded-2xl bg-red-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-red-200 transition hover:from-red-700 hover:to-orange-600"
                    >
                      Track Order
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === "orders" && (
          <>
            <div className="bg-white rounded-3xl shadow p-10 mb-8">
              <div className="flex items-center gap-3 mb-4">
                <Truck size={30} className="text-red-600" />
                <div>
                  <h2 className="text-2xl font-bold">Track an Order</h2>
                  <p className="text-gray-500">Enter your tracking number to see current order status.</p>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-[1fr_auto_auto]">
                <input
                  type="text"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="Enter tracking ID"
                  className="w-full border rounded-2xl px-4 py-3"
                />
                <button
                  onClick={handleTrackingSubmit}
                  className="bg-red-600 hover:bg-red-700 text-white px-6 rounded-2xl py-3 font-semibold"
                >
                  Track
                </button>
                {trackingNumber && (
                  <button
                    onClick={() => {
                      setTrackingNumber("");
                      setTrackingResult(null);
                    }}
                    className="bg-slate-300 hover:bg-slate-400 text-slate-900 px-6 rounded-2xl py-3 font-semibold"
                  >
                    Clear
                  </button>
                )}
              </div>
              {trackingResult && (
                <div className="mt-6 rounded-3xl border border-gray-200 bg-gray-50 p-6 text-left">
                  {trackingResult.error ? (
                    <p className="text-red-600">{trackingResult.error}</p>
                  ) : (
                    <>
                      <p className="text-gray-500">{trackingResult.message}</p>
                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <div>
                          <p className="text-sm text-gray-500">Tracking ID</p>
                          <p className="font-semibold">{trackingResult.tracking}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Status</p>
                          <p className="font-semibold">{getOrderStatusLabel(trackingResult.status)}</p>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-950">My Orders</h2>
                <p className="text-slate-500">Review your completed and in-progress orders with item details and history.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { value: "all", label: "All Orders" },
                  { value: "order", label: "My Orders" },
                  { value: "review", label: "To Review" },
                  { value: "installation", label: "Installation" },
                  { value: "completed", label: "Completed" },
                  { value: "cancel", label: "Cancelled" },
                ].map((tab) => (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => setOrderFilter(tab.value)}
                    className={`px-4 py-2 rounded-2xl text-sm font-semibold transition ${
                      orderFilter === tab.value ? "bg-red-600 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>


            {orderRequestMessage && (
              <div className="mb-6 rounded-3xl border border-emerald-100 bg-emerald-50 px-6 py-4 text-sm text-emerald-700">
                {orderRequestMessage}
              </div>
            )}

            {ordersLoading ? (
              <div className="space-y-4">
                {[...Array(2)].map((_, index) => (
                  <div key={index} className="animate-pulse rounded-3xl bg-white p-8 shadow" />
                ))}
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="rounded-3xl bg-white p-10 text-center shadow">
                <p className="text-gray-600">No orders found.</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
                <table className="min-w-full border-separate border-spacing-0 text-left">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Tracking</th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Image</th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Project</th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Status</th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Total</th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Date</th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map((order) => {
                      const product = order.items?.[0] || {};
                      return (
                        <tr key={order._id || order.tracking} className="border-t border-slate-200 hover:bg-slate-50">
                          <td className="px-6 py-5 align-top text-sm text-slate-700">{order.tracking || order._id || "—"}</td>
                          <td className="px-6 py-5 align-top text-sm text-slate-700">
                            <div className="h-16 w-16 overflow-hidden rounded-2xl bg-slate-100">
                              <img
                                src={getOrderItemImage(product)}
                                alt={product.name || product.product_name || "Product image"}
                                className="h-full w-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.onerror = null;
                                  e.currentTarget.src = PRODUCT_IMAGE_PLACEHOLDER;
                                }}
                              />
                            </div>
                          </td>
                          <td className="px-6 py-5 align-top text-sm text-slate-700">
                            <p className="font-semibold text-slate-900">{product.name || product.product_name || "Project item"}</p>
                            <p className="text-xs text-slate-500 mt-1">Qty: {product.quantity || 1}</p>
                          </td>
                          <td className="px-6 py-5 align-top">
                            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getOrderStatusClasses(order.status)}`}>
                              {getOrderStatusLabel(order.status)}
                            </span>
                          </td>
                          <td className="px-6 py-5 align-top text-sm text-slate-700">{formatCurrency(order.total_amount)}</td>
                          <td className="px-6 py-5 align-top text-sm text-slate-700">{order.updatedAt ? new Date(order.updatedAt).toLocaleDateString() : order.createdAt ? new Date(order.createdAt).toLocaleDateString() : "—"}</td>
                          <td className="px-6 py-5 align-top text-sm text-slate-700">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => setSelectedOrderForModal(order)}
                                className="rounded-2xl bg-slate-950 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
                              >
                                View Order Timeline
                              </button>
                              <button
                                type="button"
                                onClick={() => openContractModal(order)}
                                className="rounded-2xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-700"
                              >
                                Contract
                              </button>
                              {isOrderCompletedAndReviewable(order) ? (
                                hasOrderReview(order) ? (
                                  isOrderReviewEditable(order) ? (
                                    <button
                                      type="button"
                                      onClick={() => openCustomerReviewModal(order)}
                                      className="rounded-2xl bg-orange-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-orange-600"
                                    >
                                      Edit Review
                                    </button>
                                  ) : (
                                    <span className="inline-flex items-center rounded-2xl bg-emerald-100 px-3 py-2 text-xs font-semibold text-emerald-700">
                                      ✓ Review Submitted
                                    </span>
                                  )
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => openCustomerReviewModal(order)}
                                    className="rounded-2xl bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700"
                                  >
                                    ⭐ Write Review
                                  </button>
                                )
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {selectedOrderForModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
            <div className="w-full max-w-2xl overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-2xl max-h-[90vh] flex flex-col">
              <div className="px-6 py-5 border-b border-slate-200 bg-white">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Tracking ID</p>
                    <h3 className="text-2xl font-semibold text-slate-950 mt-2">{selectedOrderForModal.tracking}</h3>
                    <p className="mt-2 text-sm text-slate-500">{selectedOrderForModal.createdAt ? new Date(selectedOrderForModal.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "Date unavailable"}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                      {getOrderStatusLabel(selectedOrderForModal.status)}
                    </span>
                    <button
                      onClick={() => setSelectedOrderForModal(null)}
                      className="relative inline-flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-xl text-slate-600 hover:bg-slate-100 transition"
                    >
                      ×
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100">
                <div className="rounded-[28px] bg-gray-100 p-7 shadow-sm space-y-4">
                  <h5 className="text-sm font-semibold text-slate-900 uppercase tracking-[0.3em]">Order Details</h5>
                  <div className="grid gap-4 sm:grid-cols-2 text-sm">
                    <div>
                      <p className="text-black-500 font-bold text-lg">Order type</p>
                      <p className="mt-1 font-semibold text-slate-900">{selectedOrderForModal.order_type?.replace(/_/g, " ") || "Online order"}</p>
                    </div>
                    <div>
                      <p className="text-black-500 font-bold text-lg">Contract status</p>
                      <p className="mt-1 font-semibold text-slate-900">{selectedOrderForModal.contract_status?.replace(/_/g, " ") || "Pending"}</p>
                    </div>
                      <div>
                        <p className="text-black-500 font-bold text-lg">Items</p>
                        <p className="mt-1 font-semibold text-slate-900">{selectedOrderForModal.items?.length || 0}</p>
                      </div>
                      <div>
                        <p className="text-black-500 font-bold text-lg">Order total</p>
                        <p className="mt-1 font-semibold text-slate-900">{formatCurrency(selectedOrderForModal.total_amount)}</p>
                      </div>
                    <div>
                      <p className="text-black-500 font-bold text-lg">Payment status</p>
                      <p className="mt-1 font-semibold text-slate-900">{selectedOrderForModal.payment_status?.replace(/_/g, " ") || "Not paid"}</p>
                    </div>
                    <div>
                      <p className="text-black-500 font-bold text-lg">Inspection status</p>
                      <p className="mt-1 font-semibold text-slate-900">{selectedOrderForModal.inspection_status || "Pending"}</p>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-black-500 font-bold text-lg">Site address</p>
                      <p className="mt-1 font-semibold text-slate-900">{selectedOrderForModal.shipping_address || "Not provided"}</p>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-black-500 font-bold text-lg">Created at</p>
                      <p className="mt-1 font-semibold text-slate-900">{selectedOrderForModal.createdAt ? new Date(selectedOrderForModal.createdAt).toLocaleString() : "—"}</p>
                    </div>
                    {selectedOrderForModal.inspection_notes ? (
                      <div className="sm:col-span-2">
                        <p className="text-gray-500">Notes</p>
                        <p className="mt-1 font-semibold text-slate-900">{selectedOrderForModal.inspection_notes}</p>
                      </div>
                    ) : null}
                  </div>
                </div>

                {selectedOrderHasContractSummary && (
                  <div className="rounded-[28px] bg-slate-50 p-6 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                      <h5 className="text-sm font-semibold text-slate-900 uppercase tracking-[0.3em]">Contract Summary</h5>
                      <button
                        type="button"
                        onClick={() => setContractSummaryExpanded(!contractSummaryExpanded)}
                        className="text-slate-600 hover:text-slate-900 transition"
                      >
                        {contractSummaryExpanded ? "▼" : "▶"}
                      </button>
                    </div>
                    {contractSummaryExpanded && (
                      <>
                        {selectedOrderForModal.contract_terms ? (
                          <div className="rounded-2xl bg-white p-4">
                            <p className="text-sm font-semibold text-slate-900 uppercase tracking-[0.3em]">Terms</p>
                            <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{selectedOrderForModal.contract_terms}</p>
                          </div>
                        ) : (
                          <p className="text-sm text-slate-600">Contract terms are not yet available.</p>
                        )}
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div>
                            <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Contract Amount</p>
                            <p className="mt-2 text-lg font-semibold text-slate-950">{formatCurrency(selectedOrderForModal.contract_amount || selectedOrderForModal.total_amount)}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Contract Status</p>
                            <p className="mt-2 text-lg font-semibold text-slate-950">{selectedOrderForModal.contract_status?.replace(/_/g, " ") || "Pending"}</p>
                          </div>
                        </div>
                        {selectedOrderCanRespondToContract && (
                          <div className="flex items-center gap-3 mt-4">
                          </div>
                        )}
                        {contractActionError && selectedOrderCanRespondToContract && (
                          <p className="text-sm text-red-600">{contractActionError}</p>
                        )}
                        {contractActionMessage && contractActionOrderId === selectedOrderForModal._id && (
                          <p className="text-sm text-emerald-700">{contractActionMessage}</p>
                        )}
                        <div className="mt-4">
                          <button
                            type="button"
                            onClick={() => openContractModal(selectedOrderForModal)}
                            className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
                          >
                            View Contract
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {hasOrderReview(selectedOrderForModal) && (
                  <div className="rounded-[28px] bg-white p-6 shadow-sm space-y-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h5 className="text-sm font-semibold text-slate-900 uppercase tracking-[0.3em]">Customer Review</h5>
                        <p className="mt-1 text-sm text-slate-500">Review submitted for this completed order.</p>
                      </div>
                      <div className="inline-flex items-center gap-1 text-sm font-semibold text-amber-700">
                        {Array.from({ length: selectedOrderForModal.review?.rating || 0 }).map((_, index) => (
                          <span key={index}>⭐</span>
                        ))}
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Title</p>
                        <p className="mt-2 text-lg font-semibold text-slate-950">{selectedOrderForModal.review?.title || "No title provided"}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Submitted</p>
                        <p className="mt-2 text-lg font-semibold text-slate-950">{selectedOrderForModal.review?.submittedAt ? new Date(selectedOrderForModal.review.submittedAt).toLocaleDateString() : "—"}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Comment</p>
                      <p className="mt-2 text-sm leading-6 text-slate-700">{selectedOrderForModal.review?.comment || "No review comment."}</p>
                    </div>
                    {Array.isArray(selectedOrderForModal.review?.photos) && selectedOrderForModal.review.photos.length > 0 && (
                      <div className="grid grid-cols-2 gap-3">
                        {selectedOrderForModal.review.photos.map((photo, index) => (
                          <img key={index} src={ensureAbsoluteUrl(photo)} alt={`Review photo ${index + 1}`} className="h-28 w-full rounded-3xl object-cover" />
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <OrderTimeline
                  order={selectedOrderForModal}
                  onOrderChange={handleOrderUpdate}
                  audience="customer"
                  onViewContract={() => openContractModal(selectedOrderForModal)}
                />
              </div>

              <div className="border-t border-slate-200 bg-slate-50 px-6 py-4 flex justify-end gap-3">
                <button
                  onClick={() => setSelectedOrderForModal(null)}
                  className="rounded-2xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {showCustomerReviewModal && selectedReviewOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-3xl overflow-hidden rounded-[32px] bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-950">{hasOrderReview(selectedReviewOrder) ? "Edit Review" : "Write a Review"}</h2>
                  <p className="text-sm text-slate-500">Share your experience after your completed order.</p>
                </div>
                <button
                  type="button"
                  onClick={closeCustomerReviewModal}
                  className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-xl text-slate-600 hover:bg-slate-100 transition"
                >
                  ×
                </button>
              </div>
              <div className="max-h-[80vh] overflow-y-auto p-6 space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Order</p>
                    <p className="mt-2 font-semibold text-slate-900">{selectedReviewOrder.tracking}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Product</p>
                    <p className="mt-2 font-semibold text-slate-900">{selectedReviewOrder.items?.[0]?.name || "Project item"}</p>
                  </div>
                </div>
                <div className="rounded-3xl bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">Overall Rating</p>
                  <div className="mt-3 flex gap-2">
                    {Array.from({ length: 5 }).map((_, index) => {
                      const value = index + 1;
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => handleOrderReviewChange("rating", value)}
                          className={`rounded-2xl px-3 py-2 text-lg transition ${orderReviewForm.rating >= value ? "bg-amber-400 text-white" : "bg-white text-slate-400 border border-slate-200 hover:bg-slate-100"}`}
                        >
                          ⭐
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-3 text-sm text-slate-500">Required. Choose a rating from 1 to 5 stars.</p>
                </div>
                <div className="grid gap-4">
                  <div>
                    <label className="text-sm font-semibold text-slate-900">Review Title</label>
                    <input
                      type="text"
                      value={orderReviewForm.title}
                      onChange={(e) => handleOrderReviewChange("title", e.target.value)}
                      placeholder="Excellent Service"
                      className="mt-2 w-full rounded-3xl border border-slate-200 px-4 py-3 focus:border-red-500 focus:outline-none"
                    />
                    <p className="mt-2 text-sm text-slate-500">Optional. Example: Excellent Service, Professional Installation.</p>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-900">Review Comment</label>
                    <textarea
                      value={orderReviewForm.comment}
                      onChange={(e) => handleOrderReviewChange("comment", e.target.value)}
                      placeholder="Tell us about the product quality, installation, and service experience."
                      rows={6}
                      className="mt-2 w-full rounded-3xl border border-slate-200 px-4 py-3 focus:border-red-500 focus:outline-none"
                    />
                    <p className="mt-2 text-sm text-slate-500">Required. 10-500 characters.</p>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-900">Upload Photos</label>
                    <p className="mt-2 text-sm text-slate-500">Optional. Up to 5 photos of the finished project.</p>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleOrderReviewPhotoChange}
                      className="mt-3 w-full"
                    />
                    {orderReviewForm.photoPreviews.length > 0 && (
                      <div className="mt-4 grid grid-cols-2 gap-3">
                        {orderReviewForm.photoPreviews.map((src, index) => (
                          <div key={index} className="relative rounded-3xl overflow-hidden border border-slate-200">
                            <img src={ensureAbsoluteUrl(src)} alt={`Preview ${index + 1}`} className="h-28 w-full object-cover" />
                            <button
                              type="button"
                              onClick={() => handleRemoveReviewPhoto(index)}
                              className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-700 shadow"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {reviewFormError && (
                  <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{reviewFormError}</div>
                )}
              </div>
              <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeCustomerReviewModal}
                  className="rounded-2xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitCustomerReview}
                  disabled={reviewFormLoading}
                  className="rounded-2xl bg-red-600 px-6 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {reviewFormLoading ? "Submitting..." : hasOrderReview(selectedReviewOrder) ? "Update Review" : "Submit Review"}
                </button>
              </div>
            </div>
          </div>
        )}

        {showProductReviewModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
            <div className="w-full max-w-3xl overflow-hidden rounded-[32px] bg-white shadow-2xl ring-1 ring-slate-200">
              <div className="flex flex-col gap-4 border-b border-slate-200 bg-slate-50 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-950">Customer Reviews</h2>
                  <p className="mt-1 text-sm text-slate-600">Reviews for {selectedProduct?.product_name || selectedProduct?.name || "this product"}.</p>
                </div>
                <button
                  type="button"
                  onClick={closeProductReviewModal}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition"
                >
                  Close
                </button>
              </div>
              <div className="max-h-[82vh] overflow-y-auto p-6 space-y-6">
                <div className="rounded-[28px] bg-gradient-to-r from-slate-100 via-white to-slate-100 p-5 shadow-sm">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Average Rating</p>
                      <p className="mt-2 text-3xl font-semibold text-slate-950">{productReviewAverageRating || "—"} / 5</p>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-800">
                      <span className="inline-flex items-center gap-1">
                        <Star size={16} />
                        {productReviews.length}
                      </span>
                      review{productReviews.length === 1 ? "" : "s"}
                    </div>
                  </div>
                </div>

                {productReviews.length === 0 ? (
                  <div className="rounded-[28px] border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-slate-600">
                    <p className="text-lg font-semibold">No reviews yet</p>
                    <p className="mt-2 text-sm">Be the first customer to leave a review for this product.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {productReviews.map((review, index) => (
                      <div key={`${review.orderId || index}-${review.submittedAt || index}`} className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0">
                            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Customer</p>
                            <p className="mt-1 text-lg font-semibold text-slate-950 truncate">{review.customerName || "Anonymous"}</p>
                          </div>
                          <div className="inline-flex items-center gap-3 rounded-full bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-800">
                            <span className="inline-flex items-center gap-1">
                              {Array.from({ length: review.rating || 0 }).map((_, starIndex) => (
                                <Star key={starIndex} size={14} />
                              ))}
                            </span>
                            <span>{review.rating?.toFixed?.(1) ?? review.rating ?? "0"}</span>
                          </div>
                        </div>
                        <div className="mt-4 grid gap-4 sm:grid-cols-2">
                          <div>
                            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Title</p>
                            <p className="mt-2 font-semibold text-slate-900">{review.title || "No title provided"}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Submitted</p>
                            <p className="mt-2 font-semibold text-slate-900">{review.submittedAt ? new Date(review.submittedAt).toLocaleDateString() : "—"}</p>
                          </div>
                        </div>
                        <div className="mt-4 rounded-3xl bg-slate-50 p-4">
                          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Comment</p>
                          <p className="mt-2 text-sm leading-6 text-slate-700">{review.comment || "No review comment."}</p>
                        </div>
                        {review.photos?.length > 0 && (
                          <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            {review.photos.map((photo, photoIndex) => (
                              <img
                                key={photoIndex}
                                src={photo}
                                alt={`Review photo ${photoIndex + 1}`}
                                className="h-36 w-full rounded-3xl object-cover"
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "cart" && (
          <div className="bg-white rounded-3xl shadow p-10">
            <div className="flex flex-col items-center gap-4 md:flex-row md:justify-between">
              <div>
                <h2 className="text-2xl font-bold">Shopping Cart</h2>
                <p className="text-gray-500">Review the items you’ve added for checkout.</p>
              </div>
              <div className="rounded-full bg-red-100 px-4 py-2 text-red-700">{cartQuantity} item{cartQuantity === 1 ? "" : "s"}</div>
            </div>
            {cartItems.length === 0 ? (<div className="mt-10 text-center text-gray-600">Your cart is empty. Add a product to start shopping.</div>) : (<>
              <div className="mt-8 rounded-3xl border border-gray-200 bg-gray-50 p-4">
                <div className="flex flex-col gap-4 rounded-3xl bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                  <label className="inline-flex items-center gap-3 text-sm font-semibold text-gray-700">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={(e) => handleSelectAllCartItems(e.target.checked)}
                      className="h-5 w-5 rounded border-gray-300 text-red-600 focus:ring-red-500"
                    />
                    Select All ({cartItems.length} Item{cartItems.length === 1 ? "" : "s"})
                  </label>
                  <div className="text-sm text-gray-600">
                    Selected: {selectedItemCount} of {cartItems.length} Item{cartItems.length === 1 ? "" : "s"}
                  </div>
                </div>
                <div className="mt-4 space-y-4">
                  {cartItems.map((item) => (
                    <div key={item.cartId || item._id || item.name} className="flex flex-col gap-4 rounded-3xl border border-gray-200 bg-white p-5 md:flex-row md:items-center md:justify-between">
                      <div className="flex items-start gap-4">
                        <label className="inline-flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={Boolean(item.selected)}
                            onChange={() => handleToggleCartItem(item.cartId)}
                            className="h-5 w-5 rounded border-gray-300 text-red-600 focus:ring-red-500"
                          />
                        </label>
                        <div className="flex items-center gap-4">
                          <div className="h-20 w-20 overflow-hidden rounded-3xl border border-gray-200 bg-gray-100">
                            <img src={getProductImage(item)} alt={item.name} className="h-full w-full object-cover" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{item.name}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-gray-500">
                              <span>Qty: {item.quantity}</span>
                              {item.is_estimate && item.width && item.height && (
                                <span>Measurements: {item.width} {item.measurementUnit || item.unit || ""} × {item.height} {item.measurementUnit || item.unit || ""}</span>
                              )}
                            </div>
                            <p className="mt-2 text-sm text-gray-500">
                              {item.is_estimate ? `₱${Number(item.estimated_price || 0).toLocaleString()} (estimated)` : getProductPrice(item)}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="inline-flex overflow-hidden rounded-full border border-gray-200">
                          <button
                            onClick={() => handleUpdateCartQuantity(item.cartId, -1)}
                            className="px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200"
                          >
                            −
                          </button>
                          <div className="px-4 py-2 bg-white text-sm font-semibold">{item.quantity}</div>
                          <button
                            onClick={() => handleUpdateCartQuantity(item.cartId, 1)}
                            className="px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200"
                          >
                            +
                          </button>
                        </div>
                        <button onClick={() => handleRemoveFromCart(item.cartId)} className="rounded-2xl border border-red-200 px-4 py-2 text-red-600 hover:bg-red-50">Remove</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {checkoutError && <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">{checkoutError}</div>}
              {checkoutMessage && <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-700">{checkoutMessage}</div>}
              <div className="mt-6 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-gray-50 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Selected Products</p>
                    <p className="mt-2 text-lg font-semibold text-gray-900">{selectedItemCount}</p>
                  </div>
                  <div className="rounded-2xl bg-gray-50 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Total Quantity</p>
                    <p className="mt-2 text-lg font-semibold text-gray-900">{selectedQuantityTotal}</p>
                  </div>
                  <div className="rounded-2xl bg-gray-50 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Estimated Total</p>
                    <p className="mt-2 text-lg font-semibold text-gray-900">{formatCurrency(selectedSubtotal)}</p>
                  </div>
                </div>
              </div>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  onClick={handleClearCart}
                  className="w-full sm:w-auto rounded-2xl border border-gray-200 bg-white px-6 py-3 text-gray-700 hover:bg-gray-50"
                >
                  Clear Cart
                </button>
                <button
                  onClick={handleCheckout}
                  disabled={checkoutLoading}
                  className="w-full sm:w-auto rounded-2xl bg-red-600 px-6 py-3 text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {checkoutLoading ? "Placing order..." : "Place Order"}
                </button>
              </div>
            </>) }
          </div>
        )}

        {activeTab === "about" && (
          <div className="bg-white rounded-3xl shadow p-10">
            <div className="flex items-center gap-3 mb-4"><Info size={30} className="text-red-600" /><h2 className="text-3xl font-bold">About Us</h2></div>
            <p className="text-gray-600 leading-8">ACGC Aluminum & Glass Construction specializes in high-quality aluminum and glass solutions for residential and commercial projects.</p>
          </div>
        )}

        {activeTab === "notifications" && (
          <>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-950">Notifications</h2>
                <p className="text-slate-500">Stay updated on your orders and project status.</p>
              </div>
            </div>

            {ordersLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, index) => (
                  <div key={index} className="animate-pulse rounded-3xl bg-white p-8 shadow" />
                ))}
              </div>
            ) : orders.length === 0 ? (
              <div className="rounded-3xl bg-white p-10 text-center shadow">
                <p className="text-gray-600">No notifications yet. You'll see updates about your orders here.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {orders
                  .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                  .map((order) => {
                    const product = order.items?.[0] || {};
                    const notificationMessage = () => {
                      switch (order.status) {
                        case "order_submitted":
                          return "Your order has been submitted and is awaiting admin review.";
                        case "admin_review":
                          return "Your order is under admin review.";
                        case "site_inspection":
                          return "Your project site inspection is scheduled.";
                        case "contract_sent":
                          return "A contract has been sent for your review and acceptance.";
                        case "contract_accepted":
                          return "Your contract has been accepted. Fabrication is starting soon.";
                        case "Fabrication":
                          return "Your project is currently in fabrication.";
                        case "Installation":
                          return "Your project installation is in progress.";
                        case "completed":
                          return "Your project has been completed successfully!";
                        case "cancelled":
                          return "Your order has been cancelled.";
                        default:
                          return `Order status: ${getOrderStatusLabel(order.status)}`;
                      }
                    };

                    const notificationIcon = () => {
                      if (order.status === "completed") return "text-emerald-600";
                      if (order.status === "cancelled") return "text-red-600";
                      if (["contract_sent", "contract_accepted"].includes(order.status)) return "text-blue-600";
                      return "text-amber-600";
                    };

                    return (
                      <div
                        key={order._id || order.tracking}
                        className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md"
                      >
                        <div className="flex gap-4">
                          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-100 ${notificationIcon()}`}>
                            <Bell size={20} />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <h3 className="font-semibold text-slate-950 break-words">{product.name || "Project Update"}</h3>
                                <p className="mt-1 text-sm text-slate-600">{notificationMessage()}</p>
                                <p className="mt-2 text-xs text-slate-400">{order.tracking}</p>
                              </div>
                              <span className={`inline-flex shrink-0 items-center rounded-full px-3 py-1 text-xs font-semibold ${getOrderStatusClasses(order.status)}`}>
                                {getOrderStatusLabel(order.status)}
                              </span>
                            </div>

                            <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                              <span>{order.createdAt ? new Date(order.createdAt).toLocaleDateString() : "—"}</span>
                              <button
                                onClick={() => {
                                  setSelectedOrderForModal(order);
                                  setActiveTab("orders");
                                }}
                                className="text-slate-950 hover:text-red-600 font-semibold transition"
                              >
                                View Order
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </>
        )}

        {activeTab === "profile" && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="bg-white rounded-3xl shadow p-8">
              <div className="flex flex-col items-center">
                <div className="relative">
                  <img
                    src="https://i.pravatar.cc/300"
                    alt="User avatar"
                    className="w-36 h-36 rounded-full object-cover border-4 border-red-100"
                  />
                  <button className="absolute bottom-2 right-2 bg-red-600 text-white p-3 rounded-full shadow-lg hover:bg-red-700">
                    <Camera size={18} />
                  </button>
                </div>

                <h2 className="text-2xl font-bold mt-5">{`${profileForm.first_name || user?.first_name || ""} ${profileForm.last_name || user?.last_name || ""}`.trim() || "Customer"}</h2>
                <p className="text-gray-500 capitalize">{user?.role || "customer"}</p>

                <div className="mt-6 w-full space-y-4">
                  <div className="bg-gray-50 rounded-2xl p-4 flex items-center gap-4">
                    <Mail className="text-red-600" />
                    <div>
                      <p className="text-sm text-gray-500">Email</p>
                      <p className="font-medium">{profileForm.email}</p>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-2xl p-4 flex items-center gap-4">
                    <Phone className="text-red-600" />
                    <div>
                      <p className="text-sm text-gray-500">Phone</p>
                      <p className="font-medium">{profileForm.phone || "Not set"}</p>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-2xl p-4 flex items-center gap-4">
                    <ShieldCheck className="text-red-600" />
                    <div>
                      <p className="text-sm text-gray-500">Role</p>
                      <p className="font-medium capitalize">{user?.role || "customer"}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="xl:col-span-2 bg-white rounded-3xl shadow p-8">
              <div className="flex items-center gap-3 mb-6">
                <User size={28} className="text-red-600" />
                <div>
                  <h2 className="text-2xl font-bold">Profile Settings</h2>
                  <p className="text-gray-500">Update your account and password settings.</p>
                </div>
              </div>

              {profileError && (
                <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
                  {profileError}
                </div>
              )}

              {profileMessage && (
                <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-700">
                  {profileMessage}
                </div>
              )}

              <div className="mt-8">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="rounded-3xl bg-gray-100 border border-gray-200 p-2 flex overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setProfileTab("profile")}
                      className={`rounded-2xl px-5 py-3 text-sm font-semibold transition ${
                        profileTab === "profile"
                          ? "bg-white text-red-600 shadow-sm"
                          : "text-gray-600 hover:text-red-600"
                      }`}
                    >
                      Profile
                    </button>
                    <button
                      type="button"
                      onClick={() => setProfileTab("security")}
                      className={`rounded-2xl px-5 py-3 text-sm font-semibold transition ${
                        profileTab === "security"
                          ? "bg-white text-red-600 shadow-sm"
                          : "text-gray-600 hover:text-red-600"
                      }`}
                    >
                      Security
                    </button>
                  </div>
                </div>

                <div className="mt-6">
                  {profileTab === "profile" ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="text-sm font-medium text-gray-600">First Name</label>
                        <div className="relative mt-2">
                          <User size={18} className="absolute left-4 top-4 text-gray-400" />
                          <input
                            type="text"
                            name="first_name"
                            value={profileForm.first_name}
                            onChange={handleProfileChange}
                            placeholder="First Name"
                            className="w-full pl-12 pr-4 py-3 border rounded-2xl focus:outline-none focus:ring-2 focus:ring-red-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-sm font-medium text-gray-600">Last Name</label>
                        <div className="relative mt-2">
                          <User size={18} className="absolute left-4 top-4 text-gray-400" />
                          <input
                            type="text"
                            name="last_name"
                            value={profileForm.last_name}
                            onChange={handleProfileChange}
                            placeholder="Last Name"
                            className="w-full pl-12 pr-4 py-3 border rounded-2xl focus:outline-none focus:ring-2 focus:ring-red-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-sm font-medium text-gray-600">Phone Number</label>
                        <div className="relative mt-2">
                          <Phone size={18} className="absolute left-4 top-4 text-gray-400" />
                          <input
                            type="text"
                            name="phone"
                            value={profileForm.phone}
                            onChange={handleProfileChange}
                            placeholder="Phone Number"
                            className="w-full pl-12 pr-4 py-3 border rounded-2xl focus:outline-none focus:ring-2 focus:ring-red-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-sm font-medium text-gray-600">Email Address</label>
                        <div className="relative mt-2">
                          <Mail size={18} className="absolute left-4 top-4 text-gray-400" />
                          <input
                            type="email"
                            name="email"
                            value={profileForm.email}
                            disabled
                            className="w-full pl-12 pr-4 py-3 border rounded-2xl bg-gray-100 text-gray-500"
                          />
                        </div>
                      </div>

                      <div className="md:col-span-2">
                        <label className="text-sm font-medium text-gray-600">Street Address</label>
                        <input
                          type="text"
                          name="street_address"
                          value={profileForm.street_address}
                          onChange={handleProfileChange}
                          placeholder="Street address"
                          className="w-full mt-2 px-4 py-3 border rounded-2xl focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                      </div>

                      <div>
                        <label className="text-sm font-medium text-gray-600">City</label>
                        <input
                          type="text"
                          name="city"
                          value={profileForm.city}
                          onChange={handleProfileChange}
                          placeholder="City"
                          className="w-full mt-2 px-4 py-3 border rounded-2xl focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                      </div>

                      <div>
                        <label className="text-sm font-medium text-gray-600">Province</label>
                        <input
                          type="text"
                          name="province"
                          value={profileForm.province}
                          onChange={handleProfileChange}
                          placeholder="Province"
                          className="w-full mt-2 px-4 py-3 border rounded-2xl focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="text-sm font-medium text-gray-600">Zip Code</label>
                        <input
                          type="text"
                          name="zip_code"
                          value={profileForm.zip_code}
                          onChange={handleProfileChange}
                          placeholder="Zip Code"
                          className="w-full mt-2 px-4 py-3 border rounded-2xl focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="md:col-span-3">
                        <label className="text-sm font-medium text-gray-600">Current Password</label>
                        <input
                          type="password"
                          name="current_password"
                          value={profileForm.current_password}
                          onChange={handleProfileChange}
                          placeholder="Enter current password"
                          className="w-full mt-2 px-4 py-3 border rounded-2xl focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                      </div>

                      <div>
                        <label className="text-sm font-medium text-gray-600">New Password</label>
                        <input
                          type="password"
                          name="new_password"
                          value={profileForm.new_password}
                          onChange={handleProfileChange}
                          placeholder="Enter new password"
                          className="w-full mt-2 px-4 py-3 border rounded-2xl focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                      </div>

                      <div>
                        <label className="text-sm font-medium text-gray-600">Confirm Password</label>
                        <input
                          type="password"
                          name="confirm_password"
                          value={profileForm.confirm_password}
                          onChange={handleProfileChange}
                          placeholder="Confirm new password"
                          className="w-full mt-2 px-4 py-3 border rounded-2xl focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-8 flex justify-end">
                <button
                  onClick={handleProfileSave}
                  disabled={profileSaving}
                  className="bg-red-600 text-white px-6 py-3 rounded-2xl flex items-center gap-2 hover:bg-red-700 transition disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Save size={18} />
                  {profileSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>

              {showPasswordModal && (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4 py-6">
                  <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
                    <h3 className="text-xl font-semibold mb-3">Confirm Profile Changes</h3>
                    <p className="text-gray-600 mb-4">
                      Enter your current password to confirm saving profile changes.
                    </p>
                    {passwordModalError && (
                      <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
                        {passwordModalError}
                      </div>
                    )}
                    <input
                      type="password"
                      name="current_password"
                      value={profileForm.current_password}
                      onChange={handleProfileChange}
                      placeholder="Current password"
                      className="w-full border rounded-2xl px-4 py-3 mb-4 focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                    <div className="flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setShowPasswordModal(false);
                          setPasswordModalError("");
                        }}
                        className="px-4 py-3 rounded-2xl border border-gray-200 bg-white hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          setPasswordModalError("");
                          if (!profileForm.current_password) {
                            setPasswordModalError("Please enter your current password.");
                            return;
                          }
                          const success = await performProfileSave();
                          if (success) {
                            setShowPasswordModal(false);
                          }
                        }}
                        className="px-4 py-3 rounded-2xl bg-red-600 text-white hover:bg-red-700"
                      >
                        Confirm
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "contracts" && (
          <>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-950">My Contracts & Warranties</h2>
                <p className="text-slate-500">Review your contracts and warranty coverage.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => { setContractHistoryTab("accepted"); setWarrantyHistoryTab(null); }}
                  className={`px-4 py-2 rounded-2xl font-semibold transition ${
                    contractHistoryTab === "accepted" && !warrantyHistoryTab ? "bg-red-600 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  Accepted Contracts ({acceptedContracts.length})
                </button>
                <button
                  type="button"
                  onClick={() => { setContractHistoryTab("rejected"); setWarrantyHistoryTab(null); }}
                  className={`px-4 py-2 rounded-2xl font-semibold transition ${
                    contractHistoryTab === "rejected" && !warrantyHistoryTab ? "bg-red-600 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  Declined Contracts ({rejectedContracts.length})
                </button>
                <button
                  type="button"
                  onClick={() => { setContractHistoryTab(null); setWarrantyHistoryTab("active"); }}
                  className={`px-4 py-2 rounded-2xl font-semibold transition ${
                    warrantyHistoryTab === "active" ? "bg-emerald-600 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  Active Warranty ({activeWarranties.length})
                </button>
                <button
                  type="button"
                  onClick={() => { setContractHistoryTab(null); setWarrantyHistoryTab("expired"); }}
                  className={`px-4 py-2 rounded-2xl font-semibold transition ${
                    warrantyHistoryTab === "expired" ? "bg-red-600 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  Out-of-Warranty ({expiredWarranties.length})
                </button>
              </div>
            </div>

            {ordersLoading ? (
              <div className="space-y-4">
                {[...Array(2)].map((_, index) => (
                  <div key={index} className="animate-pulse rounded-3xl bg-white p-8 shadow" />
                ))}
              </div>
            ) : warrantyHistoryTab ? (
              // WARRANTY VIEW
              warrantiesInTab.length === 0 ? (
                <div className="rounded-3xl bg-white p-10 text-center shadow">
                  <p className="text-gray-600">No {warrantyHistoryTab === "active" ? "active" : "expired"} warranties found.</p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
                  <table className="min-w-full border-collapse text-left">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Tracking No.</th>
                        <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Product</th>
                        <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Warranty Period</th>
                        <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Start Date</th>
                        <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Expiry Date</th>
                        <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Status</th>
                        <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {warrantiesInTab.map((order) => {
                        const product = order.items?.[0] || {};
                        const warrantyStartDate = order.warranty_start_date ? new Date(order.warranty_start_date).toLocaleDateString() : "—";
                        const warrantyExpiryDate = order.warranty_expiry_date ? new Date(order.warranty_expiry_date).toLocaleDateString() : "—";
                        const isActive = warrantyHistoryTab === "active";
                        const statusClass = isActive
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-orange-100 text-orange-700";
                        const statusLabel = isActive ? "Active" : "Expired";

                        return (
                          <tr key={order._id || order.tracking} className="border-t border-slate-200">
                            <td className="px-6 py-5 align-top text-sm text-slate-700">{order.tracking || order._id || "—"}</td>
                            <td className="px-6 py-5 align-top text-sm text-slate-700">{product.name || product.product_name || "Product"}</td>
                            <td className="px-6 py-5 align-top text-sm text-slate-700">{order.warranty_period || "—"}</td>
                            <td className="px-6 py-5 align-top text-sm text-slate-700">{warrantyStartDate}</td>
                            <td className="px-6 py-5 align-top text-sm text-slate-700">{warrantyExpiryDate}</td>
                            <td className="px-6 py-5 align-top">
                              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClass}`}>{statusLabel}</span>
                            </td>
                            <td className="px-6 py-5 align-top text-sm text-slate-700">
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => setSelectedOrderForModal(order)}
                                  className="rounded-2xl bg-slate-950 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
                                >
                                  View Details
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )
            ) : contractsInTab.length === 0 ? (
              <div className="rounded-3xl bg-white p-10 text-center shadow">
                <p className="text-gray-600">No {contractHistoryTab === "accepted" ? "accepted" : "rejected"} contracts found yet.</p>
              </div>
            ) : (
              // CONTRACT VIEW
              <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
                <table className="min-w-full border-collapse text-left">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Tracking No.</th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Project</th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Amount</th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Status</th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Date</th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contractsInTab.map((order) => {
                      const product = order.items?.[0] || {};
                      const statusLabel = order.contract_status?.replace(/_/g, " ") || order.status?.replace(/_/g, " ") || "Unknown";
                      const statusClass = order.contract_status === "accepted" || order.status === "contract_accepted"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-red-100 text-red-700";

                      return (
                        <tr key={order._id || order.tracking} className="border-t border-slate-200">
                          <td className="px-6 py-5 align-top text-sm text-slate-700">{order.tracking || order._id || "—"}</td>
                          <td className="px-6 py-5 align-top text-sm text-slate-700">{product.name || product.product_name || "Project"}</td>
                          <td className="px-6 py-5 align-top text-sm text-slate-700">{formatCurrency(order.contract_amount || order.total_amount)}</td>
                          <td className="px-6 py-5 align-top">
                            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClass}`}>{statusLabel}</span>
                          </td>
                          <td className="px-6 py-5 align-top text-sm text-slate-700">{order.updatedAt ? new Date(order.updatedAt).toLocaleDateString() : order.createdAt ? new Date(order.createdAt).toLocaleDateString() : "—"}</td>
                          <td className="px-6 py-5 align-top text-sm text-slate-700">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => openContractModal(order)}
                                className="rounded-2xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-700"
                              >
                                View Contract
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedOrderForModal(order)}
                                className="rounded-2xl bg-slate-950 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
                              >
                                Order Details
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        <ContractModal
          isOpen={showContractModal}
          onClose={closeContractModal}
          inspection={contractPreviewOrder}
          contractData={contractPreviewData}
          onAccept={() => contractPreviewOrder && openContractConfirmModal("accept", contractPreviewOrder._id || contractPreviewOrder.id)}
          onDecline={() => contractPreviewOrder && openContractConfirmModal("decline", contractPreviewOrder._id || contractPreviewOrder.id)}
          isLoading={contractActionLoading}
          actionError={contractActionError}
        />

        {/* CONTRACT CONFIRMATION MODAL */}
        {contractConfirmModal.open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40" onClick={closeContractConfirmModal} />
            <div className="relative bg-white rounded-3xl shadow-lg p-6 w-full max-w-md">
              <h2 className="text-2xl font-bold mb-4">
                {contractConfirmModal.action === "accept"
                  ? "Confirm Contract Acceptance"
                  : "Confirm Contract Decline"}
              </h2>
              <p className="text-sm text-slate-600 mb-6">
                {contractConfirmModal.action === "accept"
                  ? "Are you sure you want to accept this contract? This action cannot be undone."
                  : "Are you sure you want to decline this contract? This will cancel your order."}
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={closeContractConfirmModal}
                  className="px-4 py-2 rounded-lg bg-gray-100 text-slate-700 hover:bg-gray-200 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmContractAction}
                  disabled={contractActionLoading}
                  className={`px-4 py-2 rounded-lg text-white transition disabled:opacity-50 disabled:cursor-not-allowed ${
                    contractConfirmModal.action === "accept"
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : "bg-red-600 hover:bg-red-700"
                  }`}
                >
                  {contractActionLoading
                    ? contractConfirmModal.action === "accept"
                      ? "Accepting..."
                      : "Declining..."
                    : "Confirm"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CustomerDashboard;
