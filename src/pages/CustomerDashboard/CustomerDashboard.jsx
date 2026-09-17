import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { createPortal } from "react-dom";
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
  StarHalf,
  Clock3,
  Wrench,
  Sun,
  Moon,
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
import { paginateItems } from "@/lib/pagination";
import { getSystemSettings, getSystemSettingsEventsUrl } from "@/api/users";

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

const renderRatingStars = (rating = 0, size = 18) => {
  const normalizedRating = Number(rating) || 0;
  const fullStars = Math.floor(normalizedRating);
  const hasHalfStar = normalizedRating - fullStars >= 0.5;

  return Array.from({ length: 5 }, (_, index) => {
    if (index < fullStars) {
      return <Star key={index} size={size} fill="currentColor" className="text-amber-500" />;
    }

    if (index === fullStars && hasHalfStar) {
      return <StarHalf key={index} size={size} fill="currentColor" className="text-amber-500" />;
    }

    return <Star key={index} size={size} className="text-slate-300" />;
  });
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
  const { user, loading, updateProfile, refreshUser, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const accountPermissions = {
    can_request_orders: true,
    can_estimate_pricing: true,
    view_only_access: false,
    can_track_products: true,
    can_upload_feedback: true,
    show_ratings_homepage: true,
    ...(user?.access_permissions || {}),
  };
  const canRequestOrders = !maintenanceMode && accountPermissions.can_request_orders && !accountPermissions.view_only_access;
  const canEstimatePricing = !maintenanceMode && accountPermissions.can_estimate_pricing && !accountPermissions.view_only_access;
  const canTrackProducts = !maintenanceMode && accountPermissions.can_track_products;
  const canUploadFeedback = !maintenanceMode && accountPermissions.can_upload_feedback && !accountPermissions.view_only_access;
  const canShowRatings = accountPermissions.show_ratings_homepage;

  const [activeTab, setActiveTab] = useState("home");
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window === "undefined") return false;
    const savedTheme = localStorage.getItem("acgc-dark-mode");
    if (savedTheme !== null) return savedTheme === "true";
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  });
  const [products, setProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [productPage, setProductPage] = useState(1);
  const [productsPerPage, setProductsPerPage] = useState(8);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [productError, setProductError] = useState("");
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [featuredProductsLoading, setFeaturedProductsLoading] = useState(false);
  const [featuredProductsError, setFeaturedProductsError] = useState("");
  const [featuredRatingStats, setFeaturedRatingStats] = useState({
    average: 0,
    total: 0,
    counts: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
  });

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
  const [productReviewStats, setProductReviewStats] = useState({});

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
  const [selectedReviewRatingTab, setSelectedReviewRatingTab] = useState(0);
  const [reviewOrderMode, setReviewOrderMode] = useState("estimate");
  const [orderReviewAgreed, setOrderReviewAgreed] = useState(false);
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
  const [orderPage, setOrderPage] = useState(1);
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
  const [permissionNotice, setPermissionNotice] = useState(null);
  const [maintenanceCountdown, setMaintenanceCountdown] = useState(10);
  const permissionNoticeTimer = useRef(null);

  useEffect(() => {
    getSystemSettings()
      .then((response) => {
        const enabled = response.maintenance_mode === true;
        setMaintenanceMode(enabled);
        if (enabled) showPermissionNotice("The system is under maintenance. Please log out and try again later.", { maintenance: true });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    const events = new EventSource(getSystemSettingsEventsUrl());
    events.onmessage = (event) => {
      try {
        const enabled = JSON.parse(event.data).maintenance_mode === true;
        setMaintenanceMode(enabled);
        if (enabled) {
          showPermissionNotice("The system is under maintenance. Please log out and try again later.", { maintenance: true });
        } else {
          setPermissionNotice((current) => (current?.maintenance ? null : current));
        }
      } catch (error) {
        console.error("Unable to process maintenance mode update", error);
      }
    };
    events.onerror = () => {
      // EventSource automatically retries while the customer remains signed in.
    };
    return () => events.close();
  }, [user]);

  const showPermissionNotice = (message, options = {}) => {
    if (permissionNoticeTimer.current) {
      clearTimeout(permissionNoticeTimer.current);
    }

    setPermissionNotice((current) => {
      if (current?.maintenance && options.maintenance) return current;
      return { message, maintenance: options.maintenance === true, closing: false };
    });
    if (options.maintenance) {
      setMaintenanceCountdown(10);
      return;
    }

    permissionNoticeTimer.current = setTimeout(() => {
      setPermissionNotice((current) => (current ? { ...current, closing: true } : current));
      permissionNoticeTimer.current = setTimeout(() => setPermissionNotice(null), 350);
    }, 2400);
  };

  useEffect(() => () => {
    if (permissionNoticeTimer.current) clearTimeout(permissionNoticeTimer.current);
  }, []);

  const handleLogoutConfirm = () => {
    logout();
    setConfirmOpen(false);
    navigate("/login");
  };

  useEffect(() => {
    if (!permissionNotice?.maintenance) return undefined;

    setMaintenanceCountdown(5);
    const countdownTimer = setInterval(() => {
      setMaintenanceCountdown((current) => {
        if (current <= 1) {
          clearInterval(countdownTimer);
          handleLogoutConfirm();
          return 0;
        }
        return current - 1;
      });
    }, 1800);

    return () => clearInterval(countdownTimer);
  }, [permissionNotice?.maintenance]);

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

  const ratedProductReviews = productReviews.filter((review) => Number(review.rating) > 0);
  const totalRatedReviews = ratedProductReviews.length;

  const productReviewAverageRating = totalRatedReviews
    ? (ratedProductReviews.reduce((sum, review) => sum + Number(review.rating), 0) / totalRatedReviews).toFixed(1)
    : null;

  const averageProductReviewRating = Number(productReviewAverageRating) || 0;

  const reviewRatingCounts = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: ratedProductReviews.filter((review) => Math.round(Number(review.rating)) === star).length,
  }));

  const filteredProductReviews = selectedReviewRatingTab
    ? productReviews.filter((review) => Math.round(Number(review.rating || 0)) === selectedReviewRatingTab)
    : productReviews;

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

  function canShowContractForOrder(order) {
    if (!order) return false;

    const status = String(order.status || "").toLowerCase();
    const contractStatus = String(order.contract_status || "").toLowerCase();
    const contractStageStatus = [
      "contract_sent",
      "contract_accepted",
      "contract_declined",
      "sent",
      "accepted",
      "declined",
    ];

    const hasContractArtifacts = Boolean(
      order.contract_terms ||
      order.contract_amount ||
      order.contract_status ||
      order.contract_number ||
      order.contract_id
    );

    return hasContractArtifacts && (
      contractStageStatus.includes(status) ||
      contractStageStatus.includes(contractStatus)
    );
  }

  const selectedOrderContractStatus = selectedOrderForModal?.contract_status?.toString().toLowerCase() || "";
  const selectedOrderStatus = selectedOrderForModal?.status?.toString().toLowerCase() || "";
  const selectedOrderHasContractSummary = Boolean(selectedOrderForModal) && canShowContractForOrder(selectedOrderForModal);
  const selectedOrderCanRespondToContract =
    selectedOrderHasContractSummary &&
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
    if (!canUploadFeedback) {
      showPermissionNotice("Feedback access is disabled for your account.");
      return;
    }
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
    if (!canUploadFeedback) {
      showPermissionNotice("Feedback access is disabled for your account.");
      return;
    }
    setShowProductReviewModal(true);
  };

  const closeProductReviewModal = () => {
    setShowProductReviewModal(false);
  };

  const handleOrderReviewChange = (field, value) => {
    setOrderReviewForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleOrderReviewPhotoChange = async (e) => {
    if (!canUploadFeedback) return;
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
    if (!canUploadFeedback) return;
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

    const fetchFeaturedProducts = async () => {
      setFeaturedProductsLoading(true);
      setFeaturedProductsError("");

      try {
        let response = await getProducts({ featured: true });
        let productsList = response.products || [];

        if (!productsList.length) {
          const fallbackResponse = await getProducts();
          productsList = fallbackResponse.products || [];
        }

        const eligibleProducts = productsList.filter((product) => product.is_active !== false);

        if (!canUploadFeedback) {
          setFeaturedRatingStats({ average: 0, total: 0, counts: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } });
          setFeaturedProducts(eligibleProducts.slice(0, 3));
          return;
        }

        const productReviewData = await Promise.all(
          eligibleProducts.map(async (product) => {
            try {
              const reviewResponse = await getProductReviews(product._id || product.id);
              const reviews = Array.isArray(reviewResponse.reviews) ? reviewResponse.reviews : [];
              const ratedReviews = reviews.filter((review) => Number(review.rating) > 0);
              const averageRating = ratedReviews.length
                ? ratedReviews.reduce((sum, review) => sum + Number(review.rating), 0) / ratedReviews.length
                : 0;

              return {
                product,
                averageRating,
                ratingsCount: ratedReviews.length,
                ratingCounts: [5, 4, 3, 2, 1].reduce((counts, star) => {
                  counts[star] = ratedReviews.filter((review) => Math.round(Number(review.rating)) === star).length;
                  return counts;
                }, {}),
              };
            } catch (error) {
              return {
                product,
                averageRating: 0,
                ratingsCount: 0,
                ratingCounts: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
              };
            }
          })
        );

        const totalFeaturedRatings = productReviewData.reduce((sum, entry) => sum + entry.ratingsCount, 0);
        const featuredRatingCounts = productReviewData.reduce((counts, entry) => {
          [5, 4, 3, 2, 1].forEach((star) => {
            counts[star] += entry.ratingCounts?.[star] || 0;
          });
          return counts;
        }, { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 });
        const featuredRatingTotal = [5, 4, 3, 2, 1].reduce(
          (sum, star) => sum + featuredRatingCounts[star] * star,
          0
        );

        setFeaturedRatingStats({
          average: totalFeaturedRatings ? featuredRatingTotal / totalFeaturedRatings : 0,
          total: totalFeaturedRatings,
          counts: featuredRatingCounts,
        });

        const sortedProducts = productReviewData
          .sort((a, b) => {
            if (b.averageRating !== a.averageRating) return b.averageRating - a.averageRating;
            return b.ratingsCount - a.ratingsCount;
          })
          .map((entry) => entry.product)
          .slice(0, 3);

        if (!active) return;
        setFeaturedProducts(sortedProducts);
      } catch (error) {
        if (!active) return;
        setFeaturedProducts([]);
        setFeaturedRatingStats({ average: 0, total: 0, counts: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } });
        setFeaturedProductsError(error.data?.message || error.message || "Unable to load featured products.");
      } finally {
        if (active) setFeaturedProductsLoading(false);
      }
    };

    fetchFeaturedProducts();

    return () => {
      active = false;
    };
  }, [canUploadFeedback]);

  useEffect(() => {
    setProductPage(1);
  }, [searchQuery, categoryFilter, productsPerPage]);

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

        const productsList = response.products || [];
        setProducts(productsList);

        if (!canUploadFeedback) {
          setProductReviewStats({});
          return;
        }

        const stats = {};
        await Promise.all(
          productsList.slice(0, 12).map(async (product) => {
            try {
              const reviewResponse = await getProductReviews(product._id || product.id);
              const reviews = Array.isArray(reviewResponse.reviews) ? reviewResponse.reviews : [];
              const rated = reviews.filter((review) => Number(review.rating) > 0);
              const average = rated.length
                ? (rated.reduce((sum, review) => sum + Number(review.rating), 0) / rated.length).toFixed(1)
                : null;
              stats[product._id || product.id] = {
                averageRating: Number(average) || 0,
                ratingsCount: rated.length,
              };
            } catch (error) {
              stats[product._id || product.id] = {
                averageRating: 0,
                ratingsCount: 0,
              };
            }
          })
        );

        if (active) {
          setProductReviewStats(stats);
        }
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
  }, [searchQuery, categoryFilter, canUploadFeedback]);

  const paginatedProducts = paginateItems(products, productPage, productsPerPage);

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
    if (!selectedProduct?._id || !canUploadFeedback) {
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
  }, [selectedProduct, canUploadFeedback]);

  const generateCartId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  const parseProductDimensionText = (value) => {
    if (!value) return {};
    const text = String(value);
    const match = text.match(/(\d+(?:\.\d+)?)\s*(?:x|×|by)\s*(\d+(?:\.\d+)?)/i);
    const unitMatch = text.match(/\b(cm|mm|m|ft|in|inch|inches|feet|meter|meters)\b|"/i);
    const unitMap = {
      inch: "in",
      inches: "in",
      feet: "ft",
      meter: "m",
      meters: "m",
    };

    return {
      width: match ? Number(match[1]) : 0,
      height: match ? Number(match[2]) : 0,
      unit: unitMatch ? unitMap[unitMatch[1]?.toLowerCase()] || unitMatch[1]?.toLowerCase() || "in" : "in",
    };
  };

  const getProductDefaultDimensions = (product, quantity = 1) => {
    const parsed = parseProductDimensionText(product?.dimensions || product?.standard_size || product?.size);
    const width = Number(product?.width) > 0 ? Number(product.width) : Number(parsed.width) || 0;
    const height = Number(product?.height) > 0 ? Number(product.height) : Number(parsed.height) || 0;
    const unit = product?.measurement_unit || product?.measurementUnit || parsed.unit || "in";

    return {
      width,
      height,
      unit,
      quantity: Math.max(1, Number(quantity) || 1),
      customized: false,
    };
  };

  const buildOrderItemDimensions = ({ product, width, height, unit, quantity, customized = false }) => {
    const defaultDimensions = getProductDefaultDimensions(product, quantity);
    const useCustomized = customized || Number(width) > 0 || Number(height) > 0;
    const dimensions = useCustomized
      ? {
          width: Number(width) || 0,
          height: Number(height) || 0,
          unit: unit || defaultDimensions.unit || "in",
          quantity: Math.max(1, Number(quantity) || 1),
          customized: true,
        }
      : defaultDimensions;

    return dimensions;
  };

  const areOrderItemDimensionsValid = (dimensions) =>
    Number(dimensions?.width) > 0 &&
    Number(dimensions?.height) > 0 &&
    Number(dimensions?.quantity) > 0 &&
    Boolean(dimensions?.unit);

  const getOrderItemDimensionText = (itemOrDimensions) => {
    const dimensions = itemOrDimensions?.dimensions || itemOrDimensions || {};
    if (!areOrderItemDimensionsValid(dimensions)) return "—";
    return `${dimensions.width} ${dimensions.unit} × ${dimensions.height} ${dimensions.unit}`;
  };

  const buildCustomerOrderItem = (product, options = {}) => {
    const quantity = Math.max(1, Number(options.quantity) || 1);
    const dimensions = buildOrderItemDimensions({
      product,
      width: options.width,
      height: options.height,
      unit: options.measurementUnit || options.unit,
      quantity,
      customized: Boolean(options.customized),
    });

    return {
      ...product,
      _id: product?._id,
      product_id: product?._id,
      name: product?.name || product?.product_name || "Product",
      quantity,
      unit_price: Number(product?.unit_price || product?.price_per_sqft || options.unit_price || 0),
      unit: product?.unit || "piece",
      category: product?.category || "",
      product_type: product?.product_type || "",
      width: dimensions.width,
      height: dimensions.height,
      measurementUnit: dimensions.unit,
      measurement_unit: dimensions.unit,
      dimensions,
      customized: dimensions.customized,
      area: Number(options.area) || 0,
      notes: options.notes || "",
      estimated_price: Number(options.estimated_price) || 0,
      is_estimate: Boolean(options.is_estimate || dimensions.customized),
    };
  };

  const handleAddToCart = (product) => {
    if (!canRequestOrders) {
      setCartActionError("Order requests are disabled for your account.");
      return;
    }
    const cartItem = buildCustomerOrderItem(product, { quantity: 1 });
    if (!areOrderItemDimensionsValid(cartItem.dimensions)) {
      setCartActionError("Please provide valid product dimensions before submitting your order.");
      return;
    }

    setCartItems((prev) => {
      const existing = prev.find((p) => !p.is_estimate && (p._id === product._id || p.name === product.name));
      if (existing) {
        return prev.map((p) =>
          p.cartId === existing.cartId
            ? {
                ...p,
                quantity: p.quantity + 1,
                dimensions: {
                  ...(p.dimensions || {}),
                  quantity: p.quantity + 1,
                },
                selected: true,
              }
            : p
        );
      }
      return [...prev, { ...cartItem, cartId: generateCartId(), selected: true }];
    });
  };

  const handleAddEstimateToCart = ({ product, width, height, quantity, notes, measurementUnit }) => {
    if (!canRequestOrders) {
      setCartActionError("Order requests are disabled for your account.");
      return;
    }
    if (!canEstimatePricing) {
      setCartActionError("Pricing estimates are disabled for your account.");
      return;
    }
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
        ...buildCustomerOrderItem(product, {
          quantity: parsedQuantity,
          width: parsedWidth,
          height: parsedHeight,
          measurementUnit,
          customized: true,
          area,
          notes,
          estimated_price,
          is_estimate: true,
        }),
        cartId: generateCartId(),
        selected: true,
      },
    ]);
  };

  const openCartDecisionModal = (product, step = "choice") => {
    if (step === "estimate" && !canEstimatePricing) {
      showPermissionNotice("Pricing estimates are disabled for your account.");
      return;
    }
    if (step !== "estimate" && !canRequestOrders) {
      showPermissionNotice("Order requests are disabled for your account.");
      return;
    }
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
    if (!canRequestOrders) {
      setCartActionError("Order requests are disabled for your account.");
      return;
    }
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
    if (!canRequestOrders) {
      setCartActionError("Your estimate is ready, but order requests are disabled for your account.");
      return;
    }
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

  const addCreatedOrderToMyOrders = (createdOrder) => {
    if (!createdOrder) return;

    const createdOrderId = createdOrder._id || createdOrder.id || createdOrder.tracking;
    setOrders((prev = []) => {
      const existingIndex = prev.findIndex(
        (order) => (order._id || order.id || order.tracking) === createdOrderId
      );

      if (existingIndex >= 0) {
        const next = [...prev];
        next[existingIndex] = createdOrder;
        return next;
      }

      return [createdOrder, ...prev];
    });
    setOrderFilter("all");
    setTrackingNumber("");
    setTrackingResult(null);
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

        const item = buildCustomerOrderItem(cartDecisionProduct, {
          quantity: parsedQuantity,
          width: parsedWidth,
          height: parsedHeight,
          measurementUnit: estimateForm.unit,
          customized: true,
          area: estimationResult.estimated_area || 0,
          estimated_price: estimationResult.estimated_price || 0,
          notes: estimateForm.notes || "",
          is_estimate: true,
        });

        if (!areOrderItemDimensionsValid(item.dimensions)) {
          setCartActionError("Please provide valid product dimensions before submitting your order.");
          return;
        }

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
        addCreatedOrderToMyOrders(response.order);
        setOrderSuccessData(response.order);
      }

      setOrderReviewAgreed(false);
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
            ? {
                ...item,
                quantity: Math.max(1, item.quantity + delta),
                dimensions: {
                  ...(item.dimensions || {}),
                  quantity: Math.max(1, item.quantity + delta),
                },
              }
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
    if (!canRequestOrders) {
      showPermissionNotice("Order requests are disabled for your account.");
      return;
    }
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

    const item = buildCustomerOrderItem(orderNowProduct, {
      quantity,
      area: 0,
      estimated_price: 0,
      notes: "",
      is_estimate: false,
      unit_price,
    });

    if (!areOrderItemDimensionsValid(item.dimensions)) {
      setCartActionError("Please provide valid product dimensions before submitting your order.");
      return;
    }

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
    addCreatedOrderToMyOrders(response.order);
    setOrderSuccessData(response.order);
    setOrderReviewAgreed(false);
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
    if (!canTrackProducts) {
      showPermissionNotice("Product tracking is disabled for your account.");
      return;
    }
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
        first_name: profileForm.first_name.trim(),
        last_name: profileForm.last_name.trim(),
        phone: profileForm.phone.trim(),
        street_address: normalizeAddress(profileForm.street_address || ""),
        city: profileForm.city.trim(),
        province: profileForm.province.trim(),
        zip_code: profileForm.zip_code.trim(),
        current_password: profileForm.current_password,
      };

      if (profileForm.new_password) {
        payload.new_password = profileForm.new_password;
      }

      const response = await updateProfile(payload);
      const nextProfile = response.user || user;

      setProfileForm({
        first_name: nextProfile?.first_name || "",
        last_name: nextProfile?.last_name || "",
        phone: nextProfile?.phone || "",
        email: nextProfile?.email || profileForm.email,
        street_address: nextProfile?.street_address || "",
        city: nextProfile?.city || "",
        province: nextProfile?.province || "",
        zip_code: nextProfile?.zip_code || "",
        current_password: "",
        new_password: "",
        confirm_password: "",
      });

      try {
        await refreshUser();
      } catch (refreshError) {
        console.warn("Profile refresh after save failed", refreshError);
      }

      setProfileMessage("Profile updated successfully.");
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
      const orderItems = selectedCartItems.map((item) =>
        buildCustomerOrderItem(item, {
          quantity: item.quantity,
          width: item.dimensions?.width ?? item.width,
          height: item.dimensions?.height ?? item.height,
          measurementUnit: item.dimensions?.unit || item.measurementUnit || item.measurement_unit,
          customized: item.dimensions?.customized ?? item.customized ?? item.is_estimate,
          area: item.area,
          estimated_price: item.estimated_price,
          notes: item.notes,
          is_estimate: item.is_estimate,
        })
      );

      if (orderItems.some((item) => !areOrderItemDimensionsValid(item.dimensions))) {
        setCheckoutError("Please provide valid product dimensions before submitting your order.");
        return;
      }

      const response = await createOrder({
        items: orderItems,
        shipping_address: normalizeAddress(
          [profileForm.street_address, profileForm.city, profileForm.province, profileForm.zip_code]
            .filter(Boolean)
            .join(", ") || buildFullAddress(user)
        ),
      });

      setCheckoutMessage(`Order placed successfully. Tracking ID: ${response.order.tracking}`);
      setCartItems((prev) => prev.filter((item) => !item.selected));
      addCreatedOrderToMyOrders(response.order);
      setActiveTab("orders");
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

  const getOrderMeasurementRows = (order) => {
    if (!order || !Array.isArray(order.items)) return [];

    return order.items.map((item, index) => {
      const dimensions = item?.dimensions || {};
      const width = Number(dimensions.width ?? item.width ?? 0) || 0;
      const height = Number(dimensions.height ?? item.height ?? 0) || 0;
      const quantity = Number(item.quantity || item.qty || 1) || 1;
      const unit = String(dimensions.unit || item.measurement_unit || item.measurementUnit || "in");
      const area = Number(item.area || (width * height * quantity) || 0) || 0;
      const label = item.name || item.product_name || item.product?.name || `Project item ${index + 1}`;

      return {
        label,
        quantity,
        width,
        height,
        unit,
        area,
      };
    }).filter((row) => row.width > 0 || row.height > 0);
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

    const contractStatusRaw = String(order.contract_status || "").trim();
    const contractStatus = contractStatusRaw
      ? contractStatusRaw.replace(/_/g, " ")
      : (order.status === "contract_sent" || order.status === "contract_accepted" || order.status === "contract_declined")
        ? String(order.status).replace(/_/g, " ")
        : "No contract yet";

    const accepted = String(order.contract_status || "").toLowerCase() === "accepted" || order.status === "contract_accepted";

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
    if (!order || !canShowContractForOrder(order)) return;
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
        return "bg-red-50 text-red-700 border border-red-200";
      case "contract_declined":
      case "cancelled":
        return "bg-red-100 text-red-800 border border-red-300";
      case "order_submitted":
      case "admin_review":
      case "site_inspection":
      case "contract_sent":
      case "contract_accepted":
      case "Cutting":
      case "Fabrication":
      case "Installation":
        return "bg-red-50 text-red-700 border border-red-200";
      default:
        return "bg-slate-100 text-slate-700 border border-slate-200";
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

  const ORDER_PAGE_SIZE = 5;
  const orderPageCount = Math.max(1, Math.ceil(filteredOrders.length / ORDER_PAGE_SIZE));
  const safeOrderPage = Math.min(Math.max(1, orderPage), orderPageCount);
  const pageStart = (safeOrderPage - 1) * ORDER_PAGE_SIZE;
  const pagedFilteredOrders = filteredOrders.slice(pageStart, pageStart + ORDER_PAGE_SIZE);

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

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("acgc-dark-mode", String(darkMode));
    }
  }, [darkMode]);

  const cartQuantity = cartItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
  const showFeaturedSection = activeTab === "home";
  const sectionTextClass = darkMode ? "text-slate-100" : "text-slate-900";
  const sectionMutedTextClass = darkMode ? "text-slate-300" : "text-slate-600";
  const panelClass = darkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="h-12 w-12 rounded-full border-4 border-red-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className={`relative min-h-screen overflow-x-clip bg-[size:42px_42px] ${darkMode
      ? "bg-slate-950 text-slate-100 [background-image:linear-gradient(rgba(148,163,184,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.07)_1px,transparent_1px),radial-gradient(circle_at_top_right,rgba(127,29,29,0.24),transparent_34%)]"
      : "bg-gray-100 text-slate-900 [background-image:linear-gradient(rgba(148,163,184,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.12)_1px,transparent_1px),linear-gradient(135deg,rgba(255,255,255,0.9),transparent_58%)]"
    }`}>
      <div className="customer-theme-drawing" aria-hidden="true">
        <div className="customer-theme-circle customer-theme-circle-top" />
        <div className="customer-theme-circle customer-theme-circle-top-small" />
        <div className="customer-theme-circle customer-theme-circle-middle" />
        <div className="customer-theme-circle customer-theme-circle-middle-small" />
        <div className="customer-theme-circle customer-theme-circle-bottom" />
        <div className="customer-theme-circle customer-theme-circle-bottom-small" />
      </div>
      <Toaster position="bottom-right" />
      {permissionNotice && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-[2px]">
          <div
            className={`w-full max-w-md rounded-3xl border border-amber-200 bg-white p-6 text-center shadow-2xl transition-all duration-300 ${
              permissionNotice.closing ? "translate-y-2 scale-95 opacity-0" : "translate-y-0 scale-100 opacity-100"
            }`}
            role="alertdialog"
            aria-live="assertive"
            aria-label="Permission notice"
          >
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
              <Info size={24} />
            </div>
            <h2 className="mt-4 text-lg font-black text-slate-900">{permissionNotice.maintenance ? "System Under Maintenance" : "Access Restricted"}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{permissionNotice.message}</p>
            {permissionNotice.maintenance ? (
              <button type="button" onClick={handleLogoutConfirm} className="mt-5 rounded-xl bg-red-700 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-red-800">Logout ({maintenanceCountdown})</button>
            ) : (
              <button type="button" onClick={() => setPermissionNotice(null)} className="mt-5 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800">Close</button>
            )}
          </div>
        </div>
      )}
      <div className={`${darkMode ? "bg-slate-900/90 border-b border-slate-700 shadow-lg shadow-slate-950/20" : "bg-white/95 border-b border-slate-200 shadow-sm"} sticky top-0 z-50`}>
        <div className="w-full px-6 py-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <button
            type="button"
            onClick={() => setActiveTab("home")}
            className={`flex items-center gap-4 rounded-2xl border border-transparent px-2 py-1 text-left transition duration-200 ${
              darkMode ? "hover:bg-slate-800/80 hover:shadow-sm" : "hover:bg-slate-100 hover:shadow-sm"
            }`}
            aria-label="Go to ACGC Services home"
          >
            <img src={logo} alt="ACGC Aluminum Services" className="w-20 h-20 object-contain" />
            <div>
              <h1 className="text-2xl font-bold text-red-500">
                ACGC Services
              </h1>
              <p className={`text-xl font-bold ${darkMode ? "text-slate-300" : "text-slate-700"}`}>
                Aluminum & Glass Services
              </p>
            </div>
          </button>

          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            <button
              type="button"
              onClick={() => {
                const nextMode = !darkMode;
                setDarkMode(nextMode);
                toast.success(nextMode ? "Night mode enabled" : "Day mode enabled", {
                  position: "top-center",
                  duration: 1800,
                });
              }}
              className={`relative inline-flex h-10 w-[128px] shrink-0 items-center rounded-full border p-1 transition-all duration-500 ease-in-out focus:outline-none focus:ring-2 focus:ring-red-500/40 ${
                darkMode
                  ? "border-black bg-black text-white hover:bg-slate-950"
                  : "border-slate-300 bg-slate-200 text-slate-950 hover:bg-slate-300"
              }`}
              aria-label={darkMode ? "Switch to day mode" : "Switch to night mode"}
              aria-pressed={darkMode}
            >
              <span className={`absolute inset-y-1 flex w-[84px] items-center justify-center gap-1 text-[8px] font-black uppercase tracking-[0.06em] transition-all duration-500 ease-in-out ${
                darkMode ? "left-[40px] text-white" : "left-1 text-slate-950"
              }`}>
                {darkMode ? "Night Mode" : "Day Mode"}
              </span>
              <span className={`relative z-10 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-white text-black shadow-sm transition-all duration-500 ease-in-out ${
                darkMode ? "translate-x-0 border-slate-300" : "translate-x-[86px] border-slate-200"
              }`}>
                {darkMode ? <Moon size={18} strokeWidth={1.8} /> : <Sun size={18} strokeWidth={1.8} />}
              </span>
            </button>
            <button
              onClick={() => setActiveTab("cart")}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                activeTab === "cart"
                  ? darkMode
                    ? "border border-slate-700 bg-slate-800 text-white shadow-sm"
                    : "border border-slate-200 bg-slate-100 text-red-600 shadow-sm"
                  : darkMode
                    ? "text-slate-200 hover:bg-slate-800"
                    : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              <ShoppingCart size={18} />
              <span>Cart</span>
              {cartQuantity > 0 && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                  {cartQuantity}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("products")}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                activeTab === "products"
                  ? darkMode
                    ? "border border-slate-700 bg-slate-800 text-white shadow-sm"
                    : "border border-slate-200 bg-slate-100 text-red-600 shadow-sm"
                  : darkMode
                    ? "text-slate-200 hover:bg-slate-800"
                    : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              Browse Products
            </button>
            <button
              onClick={() => setActiveTab("orders")}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                activeTab === "orders"
                  ? darkMode
                    ? "border border-slate-700 bg-slate-800 text-white shadow-sm"
                    : "border border-slate-200 bg-slate-100 text-red-600 shadow-sm"
                  : darkMode
                    ? "text-slate-200 hover:bg-slate-800"
                    : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              My Orders
            </button>
            <button
              onClick={() => setActiveTab("about")}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                activeTab === "about"
                  ? darkMode
                    ? "border border-slate-700 bg-slate-800 text-white shadow-sm"
                    : "border border-slate-200 bg-slate-100 text-red-600 shadow-sm"
                  : darkMode
                    ? "text-slate-200 hover:bg-slate-800"
                    : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              About Us
            </button>
            <div className="relative">
              <button
                onClick={() => setNotificationsOpen((s) => !s)}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  notificationsOpen
                    ? darkMode
                      ? "border border-slate-700 bg-slate-800 text-white shadow-sm"
                      : "border border-slate-200 bg-slate-100 text-red-600 shadow-sm"
                    : darkMode
                      ? "text-slate-200 hover:bg-slate-800"
                      : "text-slate-700 hover:bg-slate-100"
                }`}
                aria-haspopup="menu"
                aria-expanded={notificationsOpen}
              >
                <Bell size={18} />
                <span>Notifications</span>
                {orders.length > 0 && (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                    {orders.length}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <div className={`absolute right-0 z-20 mt-2 w-96 overflow-hidden rounded-2xl border shadow-xl ${darkMode ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white"}`}>
                  <div className={`flex items-center justify-between border-b px-4 py-3 ${darkMode ? "border-slate-700" : "border-slate-100"}`}>
                    <div>
                      <p className={`text-sm font-bold ${darkMode ? "text-white" : "text-slate-950"}`}>Project updates</p>
                      <p className="mt-0.5 text-xs text-slate-400">Your latest order activity</p>
                    </div>
                    {orders.length > 0 && <span className="rounded-full bg-red-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-red-600">{orders.length} updates</span>}
                  </div>

                  {ordersLoading ? (
                    <div className={`px-4 py-8 text-center text-sm ${darkMode ? "text-slate-300" : "text-slate-500"}`}>Loading your updates...</div>
                  ) : orders.length === 0 ? (
                    <div className={`px-4 py-6 text-center ${darkMode ? "text-slate-300" : "text-gray-600"}`}>
                      <Bell size={22} className="mx-auto mb-2 text-slate-400" />
                      <p>No project updates yet</p>
                    </div>
                  ) : (
                    <div className={darkMode ? "max-h-96 divide-y divide-slate-700 overflow-y-auto" : "max-h-96 divide-y divide-slate-200 overflow-y-auto"}>
                      {[...orders]
                        .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))
                        .slice(0, 5)
                        .map((order) => {
                          const product = order.items?.[0] || {};
                          const status = String(order.status || "").toLowerCase();
                          const contractStatus = String(order.contract_status || "").toLowerCase();
                          const notificationDetails = () => {
                            if (contractStatus === "accepted" || status === "contract_accepted") {
                              return { title: "Contract accepted", message: "Your contract has been accepted. Work can now move forward.", color: "text-emerald-600" };
                            }
                            if (contractStatus === "declined" || status === "contract_declined" || status === "cancelled") {
                              return { title: "Order update", message: "Your contract or order was declined or cancelled.", color: "text-red-600" };
                            }

                            switch (status) {
                              case "order_submitted":
                                return { title: "Order submitted", message: "Your order is waiting for admin review.", color: "text-blue-600" };
                              case "admin_review":
                                return { title: "Order under review", message: "Our team is reviewing your project request.", color: "text-amber-600" };
                              case "site_inspection":
                                return { title: "Site inspection", message: "Your project is ready for site inspection.", color: "text-amber-600" };
                              case "contract_sent":
                                return { title: "Contract ready", message: "Review and respond to your project contract.", color: "text-blue-600" };
                              case "fabrication":
                                return { title: "Fabrication started", message: "Your project is currently being fabricated.", color: "text-indigo-600" };
                              case "installation":
                                return { title: "Installation in progress", message: "Your project installation is underway.", color: "text-violet-600" };
                              case "completed":
                                return { title: "Project completed", message: "Your project has been completed successfully.", color: "text-emerald-600" };
                              default:
                                return { title: "Project update", message: `Your order is now ${getOrderStatusLabel(order.status).toLowerCase()}.`, color: "text-amber-600" };
                            }
                          };
                          const details = notificationDetails();

                          return (
                            <button
                              key={order._id || order.tracking}
                              onClick={() => {
                                setSelectedOrderForModal(order);
                                setActiveTab("orders");
                                setNotificationsOpen(false);
                              }}
                              className={`w-full px-4 py-3 text-left transition ${darkMode ? "hover:bg-slate-700" : "hover:bg-slate-50"}`}
                            >
                              <div className="flex gap-3">
                                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${darkMode ? "bg-slate-700" : "bg-slate-100"}`}>
                                  <Bell size={17} className={details.color} />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center justify-between gap-3">
                                    <p className={`truncate text-sm font-semibold ${darkMode ? "text-white" : "text-slate-950"}`}>{details.title}</p>
                                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${getOrderStatusClasses(order.status)}`}>{getOrderStatusLabel(order.status)}</span>
                                  </div>
                                  <p className={`mt-0.5 text-xs ${darkMode ? "text-slate-300" : "text-slate-600"}`}>
                                    {details.message}
                                  </p>
                                  <p className="mt-1 text-xs text-slate-400">{product.name || "Project"} · {order.tracking || "Order update"}</p>
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
                        className={`w-full px-4 py-2 text-center text-sm font-semibold ${darkMode ? "text-red-300 hover:bg-slate-700" : "text-red-600 hover:bg-gray-50"}`}
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
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  activeTab === "profile"
                    ? "bg-red-600 text-white shadow-sm"
                    : darkMode
                      ? "text-slate-200 hover:bg-slate-800"
                      : "text-slate-700 hover:bg-slate-100"
                }`}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                <User size={16} />
                <span>Profile</span>
              </button>

              {menuOpen && (
                <div className={`absolute right-0 z-20 mt-2 w-44 rounded-xl border shadow-md ${darkMode ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white"}`}>
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      setActiveTab("profile");
                    }}
                    className={`flex w-full items-center gap-2 px-4 py-2 text-left ${darkMode ? "text-slate-200 hover:bg-slate-700" : "text-slate-700 hover:bg-gray-50"}`}
                  >
                    <User size={16} />
                    <span>My Profile</span>
                  </button>

                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      setActiveTab("contracts");
                    }}
                    className={`flex w-full items-center gap-2 px-4 py-2 text-left ${darkMode ? "text-slate-200 hover:bg-slate-700" : "text-slate-700 hover:bg-gray-50"}`}
                  >
                    <FileText size={16} />
                    <span>Contracts</span>
                  </button>

                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      setConfirmOpen(true);
                    }}
                    className={`flex w-full items-center gap-2 px-4 py-2 text-left ${darkMode ? "text-red-300 hover:bg-slate-700" : "text-red-600 hover:bg-gray-50"}`}
                  >
                    <LogOut size={16} />
                    <span>Logout</span>
                  </button>
                </div>
              )}

              {confirmOpen && createPortal(
                <div className="fixed inset-0 z-[100] flex min-h-screen items-center justify-center p-4">
                  <div className="logout-modal-backdrop-in absolute inset-0 bg-black/45 backdrop-blur-md" onClick={() => setConfirmOpen(false)} />
                  <div className={`logout-modal-in relative z-40 w-full max-w-sm rounded-2xl p-6 text-center shadow-2xl ${darkMode ? "bg-slate-800 text-white" : "bg-white text-slate-900"}`}>
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
                      <LogOut size={22} />
                    </div>
                    <h3 className="mt-4 text-lg font-semibold">Confirm Logout</h3>
                    <p className={`mt-2 text-sm ${darkMode ? "text-slate-300" : "text-gray-600"}`}>Are you sure you want to log out?</p>
                    <div className="mt-5 flex justify-center gap-2">
                      <button
                        onClick={() => setConfirmOpen(false)}
                        className={`rounded-lg px-3 py-1 ${darkMode ? "bg-slate-700 text-slate-100 hover:bg-slate-600" : "bg-gray-100 hover:bg-gray-200"}`}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleLogoutConfirm}
                        className="rounded-lg bg-red-600 px-3 py-1 text-white hover:bg-red-700"
                      >
                        Confirm
                      </button>
                    </div>
                  </div>
                </div>,
                document.body
              )}
            </div>
          </div>
        </div>
      </div>

      {activeTab === "home" && (
        <>
          <section className="relative overflow-hidden bg-[#941d24] text-white">
            <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.18)_1px,transparent_1px)] [background-size:42px_42px]" />
            <div className="relative mx-auto flex min-h-[360px] max-w-7xl items-center justify-center px-6 py-16 text-center">
              <div className="max-w-2xl">
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-red-100">ACGC Services</p>
                <h2 className="mt-4 text-4xl font-black leading-tight sm:text-6xl">Custom Glass & Aluminum Solutions</h2>
                <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-red-100 sm:text-lg">
                  Professional fabrication and installation of glass windows, doors, partitions, and aluminum works for your space.
                </p>
                <div className="mt-8 flex flex-wrap justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveTab("products")}
                    className="rounded-xl bg-white px-5 py-3 text-sm font-bold text-red-700 shadow-lg transition hover:bg-red-50"
                  >
                    Browse Products
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("orders")}
                    className="rounded-xl border border-white/70 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10"
                  >
                    View My Orders
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className="relative z-10 mx-auto -mt-8 max-w-5xl px-6">
            <div className={`grid gap-6 rounded-3xl px-6 py-8 text-center shadow-xl sm:grid-cols-3 sm:px-10 ${darkMode ? "bg-slate-800 text-slate-100" : "bg-white text-slate-900"}`}>
              <div className="flex flex-col items-center">
                <ShieldCheck className={`h-12 w-12 ${darkMode ? "text-slate-100" : "text-slate-900"}`} strokeWidth={1.7} />
                <h3 className={`mt-4 text-xl font-black ${darkMode ? "text-white" : "text-slate-900"}`}>Quality Guaranteed</h3>
                <p className={`mt-2 text-sm ${darkMode ? "text-slate-300" : "text-slate-600"}`}>Premium materials and careful workmanship.</p>
              </div>
              <div className="flex flex-col items-center">
                <Clock3 className={`h-12 w-12 ${darkMode ? "text-slate-100" : "text-slate-900"}`} strokeWidth={1.7} />
                <h3 className={`mt-4 text-xl font-black ${darkMode ? "text-white" : "text-slate-900"}`}>Fast Turnaround</h3>
                <p className={`mt-2 text-sm ${darkMode ? "text-slate-300" : "text-slate-600"}`}>Efficient production for your project timeline.</p>
              </div>
              <div className="flex flex-col items-center">
                <Wrench className={`h-12 w-12 ${darkMode ? "text-slate-100" : "text-slate-900"}`} strokeWidth={1.7} />
                <h3 className={`mt-4 text-xl font-black ${darkMode ? "text-white" : "text-slate-900"}`}>Expert Installation</h3>
                <p className={`mt-2 text-sm ${darkMode ? "text-slate-300" : "text-slate-600"}`}>Professional site inspection and installation.</p>
              </div>
            </div>
          </section>
        </>
      )}

      {showFeaturedSection && (
        <div className={`max-w-7xl mx-auto px-6 py-8 ${darkMode ? "bg-slate-900" : "bg-gray-100"}`}>
          <div className={`rounded-[24px] border p-5 shadow-[0_14px_35px_rgba(148,163,184,0.12)] ${darkMode ? "border-slate-700 bg-slate-800" : "border-red-100 bg-white"}`}>
            <div className="mb-5 flex items-center justify-between gap-4">
              <div className="text-left">
                <h2 className={`text-5xl font-black leading-none tracking-[-0.05em] ${darkMode ? "text-white" : "text-slate-900"}`}>
                  Featured <span className="text-red-500">Products</span>
                </h2>
                <p className={`mt-6 max-w-3xl text-lg ${darkMode ? "text-slate-300" : "text-slate-500"}`}>
                  Discover premium aluminum and glass solutions crafted for modern residential and commercial projects.
                </p>
              </div>
            </div>

            {featuredProductsError ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {featuredProductsError}
              </div>
            ) : featuredProductsLoading ? (
              <div className="grid gap-4 md:grid-cols-3">
                {[...Array(3)].map((_, index) => (
                  <div key={index} className="h-72 animate-pulse rounded-[20px] bg-slate-100" />
                ))}
              </div>
            ) : featuredProducts.length === 0 ? (
              <div className={`rounded-2xl border border-dashed p-8 text-center ${darkMode ? "border-slate-600 bg-slate-700 text-slate-300" : "border-slate-200 bg-slate-50 text-slate-600"}`}>
                No featured products are available right now.
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-3">
                {featuredProducts.map((product) => {
                  const reviewStats = productReviewStats[product._id || product.id] || { averageRating: 0, ratingsCount: 0 };
                  const averageRating = Number(reviewStats.averageRating) || 0;
                  const reviewsCount = Number(reviewStats.ratingsCount) || 0;

                  return (
                    <div
                      key={product._id || product.name}
                      className={`group overflow-hidden rounded-[20px] border shadow-[0_8px_22px_rgba(15,23,42,0.05)] ${
                        darkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-slate-50"
                      }`}
                    >
                      <div className={`relative h-44 overflow-hidden ${darkMode ? "bg-slate-800" : "bg-slate-100"}`}>
                        <img
                          src={getProductImage(product)}
                          alt={product.name}
                          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-slate-900/25 to-transparent" />
                      </div>

                      <div className="space-y-3 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <span className={`rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-[0.18em] ${
                            darkMode ? "bg-red-950/60 text-red-300" : "bg-red-50 text-red-700"
                          }`}>
                            {product.category || "Product"}
                          </span>
                          <span className="text-m font-bold text-red-500">{getProductPrice(product)}</span>
                        </div>

                        <div>
                          <h3 className={`text-xl font-bold leading-tight ${darkMode ? "text-white" : "text-slate-900"}`}>{product.name}</h3>
                          <p className={`mt-1 text-xs leading-5 ${darkMode ? "text-slate-300" : "text-slate-600"}`}>
                            {product.description || "Premium aluminum and glass solution for modern spaces."}
                          </p>
                        </div>

                        <div className="flex items-center justify-between gap-3 pt-1">
                          <div className="flex min-w-0 flex-col">
                            <div className="flex items-center gap-1 text-amber-500">
                              {renderRatingStars(averageRating, 14)}
                            </div>
                            <span className={`mt-1 text-[11px] font-medium ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                              {averageRating > 0 ? `${averageRating.toFixed(1)} (${reviewsCount} review${reviewsCount === 1 ? "" : "s"})` : "No reviews yet"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {canShowRatings && <section className={`mt-8 rounded-3xl px-6 py-8 shadow-sm sm:px-10 ${darkMode ? "bg-slate-800 text-slate-100" : "bg-white text-slate-900"}`}>
            <h2 className={`text-center text-3xl font-black ${darkMode ? "text-white" : "text-slate-900"}`}>Customer Ratings</h2>
            <div className="mt-8 grid gap-8 md:grid-cols-[220px_1fr] md:items-center">
              <div className="text-center">
                <p className={`text-6xl font-black leading-none ${darkMode ? "text-white" : "text-slate-950"}`}>
                  {featuredRatingStats.average.toFixed(1)}
                </p>
                <div className="mt-3 flex justify-center gap-1 text-amber-500">
                  {renderRatingStars(featuredRatingStats.average, 22)}
                </div>
                <p className={`mt-3 text-sm font-semibold ${darkMode ? "text-slate-300" : "text-slate-600"}`}>
                  Average Rating ({featuredRatingStats.total} review{featuredRatingStats.total === 1 ? "" : "s"})
                </p>
              </div>

              <div className="space-y-3">
                {[5, 4, 3, 2, 1].map((star) => {
                  const count = featuredRatingStats.counts[star] || 0;
                  const percentage = featuredRatingStats.total
                    ? Math.round((count / featuredRatingStats.total) * 100)
                    : 0;
                  return (
                    <div key={star} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 text-sm">
                      <span className={`font-semibold ${darkMode ? "text-slate-300" : "text-slate-600"}`}>{star}</span>
                      <div className={`h-3 overflow-hidden rounded-full ${darkMode ? "bg-slate-700" : "bg-slate-100"}`}>
                        <div
                          className="h-full rounded-full bg-amber-400 transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className={`w-12 text-right font-semibold ${darkMode ? "text-slate-300" : "text-slate-500"}`}>{percentage}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>}
        </div>
      )}

      <div className="mx-auto max-w-7xl p-6">
        {activeTab === "products" && (
          <>
            <div>
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
                <div>
                  <h2 className={`text-3xl font-bold ${darkMode ? "text-white" : "text-slate-900"}`}>Products</h2>
                  <p className={darkMode ? "text-slate-300" : "text-gray-500"}>Browse available aluminum & glass products</p>
                </div>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-end w-full max-w-3xl">
                  <div className="relative w-full sm:w-80">
                    <Search size={18} className="absolute left-3 top-3 text-gray-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search products..."
                      className={`w-full pl-10 pr-4 py-3 border rounded-2xl ${darkMode ? "border-slate-700 bg-slate-800 text-white placeholder:text-slate-400" : "border-slate-200 bg-white text-slate-900"}`}
                    />
                  </div>
                  <div className="w-full sm:w-56">
                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className={`w-full border rounded-2xl py-3 px-4 ${darkMode ? "border-slate-700 bg-slate-800 text-white" : "border-slate-200 bg-white text-slate-900"}`}
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
                <div className={`rounded-3xl p-10 text-center shadow ${darkMode ? "bg-slate-800 text-slate-200" : "bg-white text-gray-600"}`}><p className={darkMode ? "text-slate-300" : "text-gray-600"}>No products matched your search.</p></div>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                    {paginatedProducts.items.map((product) => (
                      <div
                        key={product._id || product.name}
                        className={`group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl border shadow-[0_12px_30px_rgba(15,23,42,0.12)] transition duration-300 ease-out hover:-translate-y-1 ${
                          darkMode
                            ? "border-slate-700 bg-slate-800/95 hover:border-red-400/60 hover:shadow-[0_22px_45px_rgba(15,23,42,0.55)]"
                            : "border-slate-200 bg-white hover:border-red-200 hover:shadow-[0_22px_45px_rgba(127,29,29,0.16)]"
                        }`}
                        onClick={() => handleViewProduct(product)}
                      >
                      <div className="relative h-64 overflow-hidden bg-slate-100">
                        <img src={getProductImage(product)} alt={product.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/45 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                          <span className="rounded-full border border-white/40 bg-white/95 px-4 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-slate-900 shadow-lg">
                            Click to see product details
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-1 flex-col justify-between gap-5 p-5">
                        <div className="space-y-3">
                          <span className={`inline-flex items-center rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${darkMode ? "bg-red-950/70 text-red-300" : "bg-red-50 text-red-700"}`}>
                            {product.category ? product.category.charAt(0).toUpperCase() + product.category.slice(1) : "General"}
                          </span>
                          <div>
                            <h3 className={`text-xl font-black leading-tight ${darkMode ? "text-white" : "text-slate-900"}`}>{product.name}</h3>
                            <p className={`mt-1.5 text-xs font-medium uppercase tracking-[0.12em] ${darkMode ? "text-slate-400" : "text-slate-500"}`}>{product.product_type || product.category || "General"}</p>
                          </div>
                          <div className={`flex items-center gap-2 text-sm ${darkMode ? "text-slate-300" : "text-slate-600"}`}>
                            {renderRatingStars(productReviewStats[product._id || product.id]?.averageRating || 0, 16)}
                            <span className={darkMode ? "font-medium text-slate-200" : "font-medium text-slate-700"}>
                              {productReviewStats[product._id || product.id]?.averageRating > 0
                                ? `${productReviewStats[product._id || product.id].averageRating.toFixed(1)} (${productReviewStats[product._id || product.id].ratingsCount} rating${productReviewStats[product._id || product.id].ratingsCount === 1 ? "" : "s"})`
                                : "No ratings yet"}
                            </span>
                          </div>
                          <div className={`space-y-2 text-sm ${darkMode ? "text-slate-300" : "text-slate-600"}`}>
                            {product.dimensions ? (
                              <p><span className={darkMode ? "font-medium text-white" : "font-medium text-slate-900"}>Dimensions:</span> {product.dimensions}</p>
                            ) : product.standard_size ? (
                              <p><span className={darkMode ? "font-medium text-white" : "font-medium text-slate-900"}>Dimensions:</span> {product.standard_size}</p>
                            ) : product.width && product.height ? (
                              <p><span className={darkMode ? "font-medium text-white" : "font-medium text-slate-900"}>Dimensions:</span> {product.width} × {product.height}</p>
                            ) : null}
                            <p><span className={darkMode ? "font-medium text-white" : "font-medium text-slate-900"}>Unit Rate:</span> {getProductUnitRate(product)}</p>
                          </div>
                        </div>
                        <div className="mt-auto space-y-3">
                          <div className={`border-t pt-4 ${darkMode ? "border-slate-700" : "border-slate-100"}`}>
                            <p className="text-2xl font-black text-red-500">{getProductPrice(product)}</p>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                openCartDecisionModal(product, "estimate");
                              }}
                              className="inline-flex items-center justify-center gap-1 rounded-xl bg-slate-950 px-2 py-2 text-[11px] font-bold text-white shadow-sm transition hover:bg-red-700"
                              title="Estimate"
                            >
                              <Ruler size={14} />
                              <span className="hidden sm:inline">Estimate</span>
                            </button>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                openOrderNowModal(product);
                              }}
                              className="inline-flex items-center justify-center gap-1 rounded-xl border border-red-200 bg-red-50 px-2 py-2 text-[11px] font-bold text-red-700 shadow-sm transition hover:bg-red-100"
                              title="Order now"
                            >
                              <Package size={14} />
                              <span className="hidden sm:inline">Order</span>
                            </button>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleAddToCart(product);
                              }}
                              className={`inline-flex items-center justify-center gap-1 rounded-xl border px-2 py-2 text-[11px] font-bold shadow-sm transition hover:bg-slate-950 hover:text-white ${darkMode ? "border-slate-600 bg-slate-700 text-slate-100" : "border-slate-200 bg-white text-slate-700"}`}
                              title="Add to cart"
                            >
                              <ShoppingCart size={14} />
                              <span className="hidden sm:inline">Add</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                    ))}
                  </div>

                  {products.length > 0 && (
                    <div className={`mt-8 grid gap-4 rounded-[20px] border p-4 shadow-[0_12px_30px_rgba(15,23,42,0.06)] md:grid-cols-[1fr_auto_1fr] md:items-center ${
                      darkMode ? "border-slate-700 bg-slate-800" : "border-red-100 bg-white"
                    }`}>
                      <div className={`flex items-center gap-3 text-sm font-medium ${darkMode ? "text-slate-300" : "text-slate-600"}`}>
                        <span>Items per page</span>
                        <select
                          value={productsPerPage}
                          onChange={(event) => setProductsPerPage(Number(event.target.value))}
                          className={`rounded-xl border px-3 py-2 text-sm font-semibold outline-none transition ${
                            darkMode
                              ? "border-slate-600 bg-slate-700 text-slate-100 focus:border-red-400 focus:ring-2 focus:ring-red-500/30"
                              : "border-red-200 bg-red-50 text-slate-800 focus:border-red-300 focus:ring-2 focus:ring-red-100"
                          }`}
                        >
                          <option value={4}>4</option>
                          <option value={8}>8</option>
                          <option value={12}>12</option>
                          <option value={16}>16</option>
                        </select>
                      </div>

                      {products.length > 0 && (
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => setProductPage((page) => Math.max(1, page - 1))}
                            disabled={paginatedProducts.currentPage === 1}
                            className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                              darkMode
                                ? "border-slate-600 bg-slate-700 text-slate-100 hover:border-red-400 hover:text-red-300 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
                                : "border-slate-200 bg-white text-slate-700 hover:border-red-200 hover:text-red-600 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                            }`}
                          >
                            Previous
                          </button>

                          <div className="flex items-center gap-1">
                            {Array.from({ length: Math.max(1, paginatedProducts.totalPages) }, (_, index) => index + 1).map((pageNumber) => (
                              <button
                                key={pageNumber}
                                type="button"
                                onClick={() => setProductPage(pageNumber)}
                                className={`h-9 min-w-9 rounded-xl px-2 text-sm font-bold transition ${
                                  pageNumber === paginatedProducts.currentPage
                                    ? "bg-red-600 text-white shadow-sm"
                                    : darkMode
                                      ? "border border-slate-600 bg-slate-700 text-slate-100 hover:border-red-400 hover:text-red-300"
                                      : "border border-slate-200 bg-white text-slate-700 hover:border-red-200 hover:text-red-600"
                                }`}
                              >
                                {pageNumber}
                              </button>
                            ))}
                          </div>

                          <button
                            type="button"
                            onClick={() => setProductPage((page) => Math.min(Math.max(1, paginatedProducts.totalPages), page + 1))}
                            disabled={paginatedProducts.currentPage >= paginatedProducts.totalPages}
                            className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                              darkMode
                                ? "border-slate-600 bg-slate-700 text-slate-100 hover:border-red-400 hover:text-red-300 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
                                : "border-slate-200 bg-white text-slate-700 hover:border-red-200 hover:text-red-600 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                            }`}
                          >
                            Next
                          </button>
                        </div>
                      )}

                      <div className={`text-right text-sm font-medium ${darkMode ? "text-slate-300" : "text-slate-600"}`}>
                        Showing {paginatedProducts.items.length ? (paginatedProducts.currentPage - 1) * productsPerPage + 1 : 0}
                        {paginatedProducts.items.length ? `-${Math.min(paginatedProducts.currentPage * productsPerPage, products.length)}` : ""} of {products.length} products
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {selectedProduct && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4">
                <div className={`order-flow-modal w-full max-h-[95vh] max-w-5xl rounded-3xl bg-white shadow-2xl overflow-hidden flex flex-col ${darkMode ? "order-flow-modal-dark" : ""}`}>
                  {/* Header with shared brand gradient */}
                  <div className="flex-shrink-0 bg-red-600 px-6 py-5">
                    <div className="flex items-center justify-between gap-4">
                      <div className="text-white">
                        <h3 className="text-2xl font-bold">{selectedProduct.name}</h3>
                        <p className="text-red-100 mt-1">{selectedProduct.category || "General"}</p>
                      </div>
                      <button onClick={closeProductModal} className="text-white hover:bg-white/10 p-2 rounded-full transition flex-shrink-0">
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
                            className="w-full flex items-center justify-between rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 text-left shadow-sm hover:border-red-300 transition"
                          >
                            <div>
                              <h4 className="text-lg font-bold text-slate-900">About this product</h4>
                              <p className="text-sm text-slate-500 mt-1">Click to expand product details</p>
                            </div>
                            <span className={`text-red-600 text-2xl transition-transform ${showAboutProduct ? "rotate-180" : "rotate-0"}`}>
                              ▼
                            </span>
                          </button>

                          {showAboutProduct && (
                            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                              <p className="text-slate-600 leading-relaxed">{selectedProduct.description || "No description available."}</p>
                            </div>
                          )}
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
                            <p className="text-xs text-slate-500 font-medium uppercase tracking-[0.2em]">Type</p>
                            <p className="text-lg font-bold text-slate-900 mt-2">{selectedProduct.type || selectedProduct.product_type || "N/A"}</p>
                          </div>
                          <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
                            <p className="text-xs text-slate-500 font-medium uppercase tracking-[0.2em]">Dimensions</p>
                            <p className="text-lg font-bold text-slate-900 mt-2">
                              {selectedProduct.dimensions
                                ? selectedProduct.dimensions
                                : selectedProduct.standard_size
                                ? selectedProduct.standard_size
                                : selectedProduct.width > 0 || selectedProduct.height > 0
                                ? `${selectedProduct.width || 0}" x ${selectedProduct.height || 0}"`
                                : "N/A"}
                            </p>
                          </div>
                          <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
                            <p className="text-xs text-slate-500 font-medium uppercase tracking-[0.2em]">Unit Rate</p>
                            <p className="text-lg font-bold text-slate-900 mt-2">{getProductUnitRate(selectedProduct)}</p>
                          </div>
                        </div>
                      </div>

                      {/* Right: Action Buttons & Info */}
                      <div className="space-y-4">
                        {/* Price Card */}
                        <div className="rounded-3xl bg-red-50 border-2 border-red-200 p-6">
                          <p className="text-sm text-slate-600 font-medium uppercase tracking-[0.2em]">Starting from</p>
                          <p className="text-4xl font-bold text-white-600 mt-2">{getProductPrice(selectedProduct)}</p>
                          <p className="text-xs text-slate-500 mt-3">*Price may vary based on specifications</p>
                        </div>

                        {/* Action Buttons */}
                        <button
                          onClick={() => {
                            openCartDecisionModal(selectedProduct, "estimate");
                            closeProductModal();
                          }}
                          className="w-full rounded-2xl bg-gray-600 text-white font-bold py-4 hover:bg-gray-700 transition shadow-md flex items-center justify-center gap-2"
                        >
                          <Ruler size={20} />
                          Estimate Product
                        </button>

                        <button
                          onClick={() => {
                            openOrderNowModal(selectedProduct);
                            closeProductModal();
                          }}
                          className="w-full rounded-2xl bg-red-600 text-white font-bold py-4 hover:bg-red-700 transition shadow-md flex items-center justify-center gap-2"
                        >
                          <Package size={20} />
                          Order Now
                        </button>

                        <button
                          onClick={() => {
                            openCartDecisionModal(selectedProduct);
                            closeProductModal();
                          }}
                          className="w-full rounded-2xl bg-[#101114] text-white font-bold py-4 hover:bg-[#050608] transition shadow-md flex items-center justify-center gap-2"
                        >
                          <ShoppingCart size={20} />
                          Add to Cart
                        </button>

                        <button
                          type="button"
                          onClick={openProductReviewModal}
                          className="w-full rounded-[28px] border border-slate-200 bg-white p-5 mt-4 text-left shadow-sm transition hover:shadow-lg hover:border-slate-300"
                        >
                          <div className="flex items-center gap-4">
                            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-3xl border border-slate-200 bg-slate-50">
                              <img src={getProductImage(selectedProduct)} alt={selectedProduct?.name || "Product"} className="h-full w-full object-cover" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Customer Reviews</p>
                              <div className="mt-2 flex items-center gap-2">
                                {renderRatingStars(averageProductReviewRating, 18)}
                              </div>
                              <p className="mt-2 text-2xl font-semibold text-slate-900 truncate">
                                {productReviewAverageRating || "—"} / 5
                              </p>
                              <p className="mt-2 text-sm text-slate-500">
                                {productReviews[0]?.title ? `Latest review: ${productReviews[0].title}` : "View all reviews for this product."}
                              </p>
                            </div>
                          </div>
                          <div className="mt-4 flex items-center justify-between gap-3 text-sm text-slate-600">
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 font-medium">{totalRatedReviews} rating{totalRatedReviews === 1 ? "" : "s"}</span>
                            <span className="inline-flex items-center gap-2 font-semibold text-slate-900">
                              View reviews
                              <ArrowRight size={18} />
                            </span>
                          </div>
                        </button>

                        {/* Info Box */}
                        <div className="rounded-2xl bg-red-50 border border-red-200 p-4 mt-6">
                          <div className="flex items-start gap-3">
                            <Info size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
                            <div className="text-sm text-slate-700">
                              <p className="font-semibold text-red-700">Need help?</p>
                              <p className="mt-1 text-slate-600">Use the estimate tool for quick pricing guidance.</p>
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
                <div className={`order-flow-modal w-full max-h-[95vh] max-w-4xl rounded-3xl bg-white shadow-2xl overflow-hidden flex flex-col ${darkMode ? "order-flow-modal-dark" : ""}`}>
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
                        <div className="rounded-2xl border-2 border-white-200 bg-gray-100 p-6">
                          <div className="flex items-center gap-4">
                            <img src={getProductImage(cartDecisionProduct)} alt={cartDecisionProduct.name} className="w-28 h-28 rounded-2xl object-cover bg-white shadow-md flex-shrink-0" />
                            <div className="flex-1">
                              <p className="text-sm text-slate-600 font-medium">Selected Product</p>
                              <h4 className="text-2xl font-bold text-slate-900 mt-1">{cartDecisionProduct.name}</h4>
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
                            <div className="absolute inset-0 bg-gray-600 transition" />
                            <div className="relative px-6 py-8 text-left text-white">
                              <div className="flex items-start justify-between mb-3">
                                <Ruler size={32} className="text-white" />
                                <ArrowRight size={24} className="text-white" />
                              </div>
                              <p className="text-xl font-bold mb-2">Estimate First</p>
                              <p className="text-sm text-red-50 leading-relaxed">Enter your measurements to get an accurate price before adding to cart</p>
                            </div>
                          </button>

                          {/* Add to Cart Option */}
                          <button
                            onClick={handleCartDecisionNoAdd}
                            className="group relative rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-xl"
                          >
                            <div className="absolute inset-0 bg-[#101114] transition" />
                            <div className="relative px-6 py-8 text-left text-white">
                              <div className="flex items-start justify-between mb-3">
                                <CheckCircle size={32} className="text-white" />
                                <ArrowRight size={24} className="text-white" />
                              </div>
                              <p className="text-xl font-bold mb-2">Add to Cart Now</p>
                              <p className="text-sm text-slate-200 leading-relaxed">Skip the estimate and add this product at the standard price</p>
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
                            className="text-red-600 hover:text-red-700 text-sm font-medium whitespace-nowrap ml-2"
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
                  <div className="flex-shrink-0 px-6 py-4">
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
                          disabled={orderRequestLoading || !canRequestOrders}
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
                              : canRequestOrders ? "Add to Cart" : "Orders Disabled"
                            : orderRequestLoading
                              ? "Requesting..."
                              : canRequestOrders ? "Request Order" : "Orders Disabled"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {showDeliveryConfirmModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                <div className={`order-flow-modal w-full max-w-5xl rounded-3xl bg-white shadow-2xl overflow-hidden max-h-[95vh] flex flex-col ${darkMode ? "order-flow-modal-dark" : ""}`}>
                  <div className="flex-shrink-0 bg-red-600 px-6 py-5 text-white">
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
                <div className={`order-flow-modal w-full max-w-3xl rounded-3xl bg-white shadow-2xl overflow-hidden ${darkMode ? "order-flow-modal-dark" : ""}`}>
                  <div className="border-b px-6 py-5 bg-red-600 text-white">
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

                      <div className="rounded-3xl bg-red-50 p-4 border border-red-200">
                        <p className="text-sm font-semibold text-red-700">Need help?</p>
                        <p className="mt-2 text-sm text-slate-600">Use the estimate tool to calculate custom pricing based on your measurements.</p>
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
                <div className={`order-flow-modal w-full max-w-xl rounded-3xl bg-white shadow-2xl overflow-hidden max-h-[90vh] flex min-h-[20rem] flex-col ${darkMode ? "order-flow-modal-dark" : ""}`}>
                  <div className="bg-red-600 border-b px-5 py-4">
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

                    <div className="rounded-3xl border border-red-200 bg-red-50 p-5">
                      <p className="font-semibold text-red-700">Payment Policy</p>
                      <p className="mt-3 text-sm text-slate-700">
                        A 50% downpayment {reviewOrderMode === "orderNow" ? "of the total order amount" : "of the estimated total amount"}
                        {reviewOrderMode === "orderNow" && orderNowProduct
                          ? ` (₱${(Math.max(1, Number(orderNowQuantity) || 1) * Number(orderNowProduct.unit_price || orderNowProduct.price_per_sqft || 0) * 0.5).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`
                          : reviewOrderMode === "estimate" && estimateTotalCost
                            ? ` (₱${(estimateTotalCost * 0.5).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`
                            : ""}
                        is required upon order agreement.
                      </p>
                      <p className="mt-2 text-sm text-slate-600">For inquiries, please call our shop directly.</p>
                      <p className="mt-3 font-semibold text-red-700">+63 950-624-8802</p>
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
                <div className={`order-flow-modal order-success-modal w-full max-w-xl overflow-hidden rounded-[28px] border border-red-100 bg-gradient-to-br from-white via-rose-50 to-red-50 shadow-[0_28px_80px_rgba(220,38,38,0.16)] max-h-[90vh] flex min-h-[18rem] flex-col ${darkMode ? "order-flow-modal-dark order-success-modal-dark" : ""}`}>
                  <div className="relative overflow-hidden bg-red-600 px-5 py-5 text-white">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.25),_transparent_40%)]" />
                    <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-red-100"><span>Tracking ID:</span> {orderSuccessData.tracking}</p>
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
                      className="rounded-2xl bg-red-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-red-200 transition hover:bg-red-700"
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
            <div className={`rounded-3xl p-10 mb-8 shadow ${darkMode ? "bg-slate-800 text-slate-100" : "bg-white text-slate-900"}`}>
              <div className="flex items-center gap-3 mb-4">
                <Truck size={30} className="text-red-600" />
                <div>
                  <h2 className="text-2xl font-bold">Track an Order</h2>
                  <p className={darkMode ? "text-slate-300" : "text-gray-500"}>Enter your tracking number to see current order status.</p>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-[1fr_auto_auto]">
                <input
                  type="text"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="Enter tracking ID"
                  className={`w-full rounded-2xl border px-4 py-3 ${darkMode ? "border-slate-600 bg-slate-900 text-white placeholder:text-slate-400" : "border-slate-200 bg-white text-slate-900"}`}
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
                    className={`px-6 py-3 rounded-2xl font-semibold ${darkMode ? "bg-slate-700 text-slate-100 hover:bg-slate-600" : "bg-slate-300 text-slate-900 hover:bg-slate-400"}`}
                  >
                    Clear
                  </button>
                )}
              </div>
              {trackingResult && (
                <div className={`mt-6 rounded-3xl border p-6 text-left ${darkMode ? "border-slate-700 bg-slate-900" : "border-gray-200 bg-gray-50"}`}>
                  {trackingResult.error ? (
                    <p className="text-red-600">{trackingResult.error}</p>
                  ) : (
                    <>
                      <p className={darkMode ? "text-slate-300" : "text-gray-500"}>{trackingResult.message}</p>
                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <div>
                          <p className={darkMode ? "text-sm text-slate-400" : "text-sm text-gray-500"}>Tracking ID</p>
                          <p className={darkMode ? "font-semibold text-white" : "font-semibold"}>{trackingResult.tracking}</p>
                        </div>
                        <div>
                          <p className={darkMode ? "text-sm text-slate-400" : "text-sm text-gray-500"}>Status</p>
                          <p className={darkMode ? "font-semibold text-white" : "font-semibold"}>{getOrderStatusLabel(trackingResult.status)}</p>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
              <div>
                <h2 className={`text-2xl font-black tracking-[-0.03em] ${darkMode ? "text-white" : "text-slate-900"}`}>My Orders</h2>
                <p className={`mt-2 text-sm font-medium ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Review your completed and in-progress orders with item details and history.</p>
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
                    onClick={() => {
                      setOrderFilter(tab.value);
                      setOrderPage(1);
                    }}
                    className={`px-4 py-2 rounded-2xl text-sm font-bold transition ${
                      orderFilter === tab.value 
                        ? "bg-red-700 text-white shadow-sm shadow-red-200" 
                        : darkMode
                          ? "bg-slate-800 text-slate-200 border border-slate-600 hover:bg-slate-700 hover:text-white"
                          : "bg-white text-slate-700 border border-red-200 hover:bg-red-50 hover:text-red-700"
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
                  <div key={index} className={`animate-pulse rounded-3xl p-8 shadow ${darkMode ? "bg-slate-800" : "bg-white"}`} />
                ))}
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className={`rounded-3xl p-10 text-center shadow ${darkMode ? "bg-slate-800" : "bg-white"}`}>
                <p className={darkMode ? "text-slate-300" : "text-gray-600"}>No orders found.</p>
              </div>
            ) : (
              <div className={`overflow-hidden rounded-[28px] border shadow-[0_18px_45px_rgba(127,29,29,0.08)] ${darkMode ? "border-slate-700 bg-slate-800" : "border-red-200 bg-white"}`}>
                <table className="min-w-full table-fixed border-separate border-spacing-0 text-left">
                  <thead className="bg-gradient-to-r from-red-700 via-red-600 to-red-500">
                    <tr>
                      <th className="w-[12%] px-6 py-4 text-xs font-black uppercase tracking-[0.24em] text-white text-center">Tracking</th>
                      <th className="w-[10%] px-6 py-4 text-xs font-black uppercase tracking-[0.24em] text-white text-center">Image</th>
                      <th className="w-[22%] px-6 py-4 text-xs font-black uppercase tracking-[0.24em] text-white">Project</th>
                      <th className="w-[14%] px-6 py-4 text-xs font-black uppercase tracking-[0.24em] text-white text-center">Status</th>
                      <th className="w-[12%] px-6 py-4 text-xs font-black uppercase tracking-[0.24em] text-white text-right">Total</th>
                      <th className="w-[14%] px-6 py-4 text-xs font-black uppercase tracking-[0.24em] text-white text-center">Date</th>
                      <th className="w-[16%] px-6 py-4 text-xs font-black uppercase tracking-[0.24em] text-white text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedFilteredOrders.map((order) => {
                      const product = order.items?.[0] || {};
                      return (
                        <tr key={order._id || order.tracking} className={`border-t transition ${darkMode ? "border-slate-700 hover:bg-slate-700/60" : "border-red-100 hover:bg-red-50/70"}`}>
                          <td className="px-6 py-5 align-middle text-sm font-black text-red-500 text-center">{order.tracking || order._id || "—"}</td>
                          <td className="px-6 py-5 align-middle">
                            <div className="mx-auto h-16 w-16 overflow-hidden rounded-2xl border border-red-100 bg-red-50 shadow-sm">
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
                          <td className={`px-6 py-5 align-middle text-sm ${darkMode ? "text-slate-300" : "text-slate-700"}`}>
                            <p className={`font-black ${darkMode ? "text-white" : "text-slate-900"}`}>{product.name || product.product_name || "Project item"}</p>
                            <p className={`mt-1 text-xs font-medium ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Qty: {product.quantity || 1}</p>
                          </td>
                          <td className="px-6 py-5 align-middle text-center">
                            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${getOrderStatusClasses(order.status)}`}>
                              {getOrderStatusLabel(order.status)}
                            </span>
                          </td>
                          <td className={`px-6 py-5 align-middle text-sm font-black text-right ${darkMode ? "text-slate-100" : "text-slate-800"}`}>{formatCurrency(order.total_amount)}</td>
                          <td className={`px-6 py-5 align-middle text-sm font-medium text-center ${darkMode ? "text-slate-400" : "text-slate-600"}`}>{order.updatedAt ? new Date(order.updatedAt).toLocaleDateString() : order.createdAt ? new Date(order.createdAt).toLocaleDateString() : "—"}</td>
                          <td className={`px-6 py-5 align-middle text-sm ${darkMode ? "text-slate-300" : "text-slate-700"}`}>
                            <div className="flex flex-wrap justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => setSelectedOrderForModal(order)}
                                className="rounded-2xl bg-[#101114] px-3 py-2 text-xs font-black text-white transition hover:bg-black shadow-sm"
                              >
                                View Order Timeline
                              </button>
                              {canShowContractForOrder(order) && (
                                <button
                                  type="button"
                                  onClick={() => openContractModal(order)}
                                  className="rounded-2xl bg-red-600 px-3 py-2 text-xs font-black text-white transition hover:bg-red-700 shadow-sm"
                                >
                                  Contract
                                </button>
                              )}
                              {isOrderCompletedAndReviewable(order) ? (
                                hasOrderReview(order) ? (
                                  isOrderReviewEditable(order) ? (
                                    <button
                                      type="button"
                                      onClick={() => openCustomerReviewModal(order)}
                                      className="rounded-2xl bg-red-600 px-3 py-2 text-xs font-black text-white transition hover:bg-red-700 shadow-sm"
                                    >
                                      Edit Review
                                    </button>
                                  ) : (
                                    <span className="inline-flex items-center rounded-2xl bg-emerald-100 px-3 py-2 text-xs font-black text-emerald-700">
                                      ✓ Review Submitted
                                    </span>
                                  )
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => openCustomerReviewModal(order)}
                                    className="rounded-2xl bg-red-600 px-3 py-2 text-xs font-black text-white transition hover:bg-red-700 shadow-sm"
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

                {filteredOrders.length > ORDER_PAGE_SIZE && (
                  <div className={`flex items-center justify-between gap-3 border-t px-6 py-4 ${darkMode ? "border-slate-700 bg-slate-800" : "border-red-100 bg-white"}`}>
                    <div className={`text-sm font-semibold ${darkMode ? "text-slate-400" : "text-slate-600"}`}>
                      Showing {Math.min(pageStart + 1, filteredOrders.length)}-{Math.min(pageStart + ORDER_PAGE_SIZE, filteredOrders.length)} of {filteredOrders.length}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setOrderPage((page) => Math.max(1, page - 1))}
                        disabled={safeOrderPage === 1}
                        className={`rounded-2xl border px-4 py-2 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${darkMode ? "border-slate-600 text-red-300 hover:bg-slate-700" : "border-red-200 text-red-700 hover:bg-red-50"}`}
                      >
                        Previous
                      </button>
                      <span className="rounded-2xl bg-red-700 px-4 py-2 text-sm font-black text-white">
                        Page {safeOrderPage} / {orderPageCount}
                      </span>
                      <button
                        type="button"
                        onClick={() => setOrderPage((page) => Math.min(orderPageCount, page + 1))}
                        disabled={safeOrderPage >= orderPageCount}
                        className={`rounded-2xl border px-4 py-2 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${darkMode ? "border-slate-600 text-red-300 hover:bg-slate-700" : "border-red-200 text-red-700 hover:bg-red-50"}`}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {selectedOrderForModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
            <div className={`order-details-modal w-full max-w-4xl overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-2xl max-h-[90vh] flex flex-col ${darkMode ? "order-details-modal-dark" : ""}`}>
              <div className="px-6 py-4 border-b border-slate-200 bg-white">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-[11px] font-black uppercase tracking-[0.32em] text-slate-500">Tracking ID</p>
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <h3 className="text-[30px] font-black text-slate-950 tracking-tight">{selectedOrderForModal.tracking || "TRK-B9HI9Z"}</h3>
                      <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-emerald-700">
                        {selectedOrderForModal.status === "contract_accepted" || selectedOrderForModal.contract_status === "accepted" ? "Approved" : getOrderStatusLabel(selectedOrderForModal.status)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-medium text-slate-500">{selectedOrderForModal.createdAt ? new Date(selectedOrderForModal.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "Sep 12, 2026"}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedOrderForModal(null)}
                      className="relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-2xl font-light text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-red-700 hover:border-red-200"
                      aria-label="Close order details"
                    >
                      ×
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-5 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100">
                <div className="rounded-[20px] bg-gray-50 p-7 shadow-sm border border-slate-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="h-5 w-5 rounded-[4px] border border-slate-300 bg-slate-100" />
                      <h5 className="text-[22px] font-black uppercase tracking-[0.16em] text-slate-900">Order details</h5>
                    </div>
                    <span className="rounded-full border border-red-200 bg-white px-4 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-green-500">
                      {selectedOrderForModal.order_type?.replace(/_/g, " ") || "Online order"}
                    </span>
                  </div>

                  <div className="mt-6 grid gap-8 sm:grid-cols-2">
                    <div className="space-y-4">
                      <div className="grid grid-cols-[140px_1fr] items-center gap-2">
                        <p className="text-[13px] font-black uppercase tracking-[0.24em] text-slate-500">Order type</p>
                        <p className="text-[16px] font-semibold text-slate-900 break-words">{selectedOrderForModal.order_type?.replace(/_/g, " ") || "online order"}</p>
                      </div>
                      <div className="grid grid-cols-[140px_1fr] items-center gap-2">
                        <p className="text-[13px] font-black uppercase tracking-[0.24em] text-slate-500">Items</p>
                        <p className="text-[16px] font-semibold text-slate-900">{selectedOrderForModal.items?.length || 0}</p>
                      </div>
                      <div className="grid grid-cols-[140px_1fr] items-center gap-2">
                        <p className="text-[13px] font-black uppercase tracking-[0.24em] text-slate-500">Payment status</p>
                        <p className="text-[16px] font-semibold text-slate-900">{selectedOrderForModal.payment_status?.replace(/_/g, " ") || "Not paid"}</p>
                      </div>
                      <div className="grid grid-cols-[140px_1fr] items-start gap-2">
                        <p className="text-[13px] font-black uppercase tracking-[0.24em] text-slate-500">Site address</p>
                        <p className="text-[16px] font-semibold text-slate-900 break-words leading-relaxed">{selectedOrderForModal.shipping_address || "69 Irving Street, Olongapo City, Zambales, 2200"}</p>
                      </div>
                      <div className="grid grid-cols-[140px_1fr] items-center gap-2">
                        <p className="text-[13px] font-black uppercase tracking-[0.24em] text-slate-500">Created at</p>
                        <p className="text-[16px] font-semibold text-slate-900">{selectedOrderForModal.createdAt ? new Date(selectedOrderForModal.createdAt).toLocaleString() : "9/12/2026, 11:05:55 AM"}</p>
                      </div>
                      {selectedOrderForModal.inspection_notes ? (
                        <div className="grid grid-cols-[140px_1fr] items-start gap-2">
                          <p className="text-[13px] font-black uppercase tracking-[0.24em] text-slate-500">Notes</p>
                          <p className="text-[16px] font-semibold text-slate-900">{selectedOrderForModal.inspection_notes}</p>
                        </div>
                      ) : null}
                    </div>

                    <div className="space-y-4">
                      {canShowContractForOrder(selectedOrderForModal) && (
                        <div className="grid grid-cols-[150px_1fr] items-center gap-2">
                          <p className="text-[13px] font-black uppercase tracking-[0.24em] text-slate-500">Contract status</p>
                          <p className="text-[16px] font-semibold text-slate-900">{selectedOrderForModal.contract_status?.replace(/_/g, " ") || "accepted"}</p>
                        </div>
                      )}
                      <div className="grid grid-cols-[150px_1fr] items-center gap-2">
                        <p className="text-[13px] font-black uppercase tracking-[0.24em] text-slate-500">Order total</p>
                        <p className="text-[16px] font-black text-red-700">{formatCurrency(selectedOrderForModal.total_amount || 1222)}</p>
                      </div>
                      <div className="grid grid-cols-[150px_1fr] items-center gap-2">
                        <p className="text-[13px] font-black uppercase tracking-[0.24em] text-slate-500">Inspection status</p>
                        <p className="text-[16px] font-semibold text-slate-900">{selectedOrderForModal.inspection_status || "completed"}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-[20px] bg-white p-5 shadow-sm border border-slate-200">
                  <div className="flex items-center justify-between gap-4 border-b border-red-100 pb-4">
                    <div>
                      <h5 className="text-[23px] font-black uppercase tracking-[0.14em] text-slate-900">Project Measurements</h5>
                      <p className="mt-1 text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Measurement details</p>
                    </div>
                    <span className="rounded-full bg-red-700 px-5 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-white shadow-sm">
                      Project specs
                    </span>
                  </div>

                  <div className="mt-4">
                    {getOrderMeasurementRows(selectedOrderForModal).length > 0 ? (
                      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                        <div className="hidden grid-cols-5 bg-slate-50 px-4 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500 sm:grid">
                          <span className="sm:col-span-2">Project item</span>
                          <span>Width</span>
                          <span>Height</span>
                          <span>Qty / area</span>
                        </div>
                        {getOrderMeasurementRows(selectedOrderForModal).map((row, index) => (
                          <div key={`${row.label}-${index}`} className="grid gap-4 border-t border-slate-100 px-4 py-4 sm:grid-cols-5 sm:items-center">
                            <div className="sm:col-span-2">
                              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 sm:hidden">Project item</p>
                              <p className="mt-1 text-sm font-black text-slate-900">{row.label}</p>
                            </div>
                            <div>
                              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 sm:hidden">Width</p>
                              <p className="mt-1 text-sm font-bold text-slate-800">{row.width || "—"} {row.width ? row.unit : ""}</p>
                            </div>
                            <div>
                              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 sm:hidden">Height</p>
                              <p className="mt-1 text-sm font-bold text-slate-800">{row.height || "—"} {row.height ? row.unit : ""}</p>
                            </div>
                            <div className="sm:col-span-1">
                              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 sm:hidden">Qty / area</p>
                              <p className="mt-1 text-sm font-bold text-slate-800">Qty {row.quantity || 1} · {row.area ? `${row.area.toFixed(2)} sq ${row.unit}` : "—"}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-red-200 bg-white p-4 text-sm font-semibold text-slate-600">
                        No project measurements available yet.
                      </div>
                    )}
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
                  darkMode={darkMode}
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
                        {renderRatingStars(averageProductReviewRating, 16)}
                      </span>
                      {totalRatedReviews} rating{totalRatedReviews === 1 ? "" : "s"}
                    </div>
                  </div>
                </div>

                <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap gap-2">
                    {reviewRatingCounts.map(({ star, count }) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setSelectedReviewRatingTab(star)}
                        className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                          selectedReviewRatingTab === star
                            ? "border-red-500 bg-red-50 text-red-700"
                            : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-slate-100"
                        }`}
                      >
                        {star} star{star === 1 ? "" : "s"} ({count})
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setSelectedReviewRatingTab(0)}
                      className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                        selectedReviewRatingTab === 0
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-slate-100"
                      }`}
                    >
                      All ({productReviews.length})
                    </button>
                  </div>
                </div>

                {filteredProductReviews.length === 0 ? (
                  <div className="rounded-[28px] border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-slate-600">
                    <p className="text-lg font-semibold">No reviews yet</p>
                    <p className="mt-2 text-sm">Be the first customer to leave a review for this product.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredProductReviews.map((review, index) => (
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
          <div className={`rounded-3xl shadow p-10 ${darkMode ? "bg-slate-800 text-slate-100" : "bg-white text-slate-900"}`}>
            <div className="flex flex-col items-center gap-4 md:flex-row md:justify-between">
              <div>
                <h2 className={`text-2xl font-bold ${darkMode ? "text-white" : "text-slate-900"}`}>Shopping Cart</h2>
                <p className={darkMode ? "text-slate-300" : "text-gray-500"}>Review the items you’ve added for checkout.</p>
              </div>
              <div className="rounded-full bg-red-100 px-4 py-2 text-red-700">{cartQuantity} item{cartQuantity === 1 ? "" : "s"}</div>
            </div>
            {cartItems.length === 0 ? (<div className={`mt-10 text-center ${darkMode ? "text-slate-300" : "text-gray-600"}`}>Your cart is empty. Add a product to start shopping.</div>) : (<>
              <div className={`mt-8 rounded-3xl border p-4 ${darkMode ? "border-slate-700 bg-slate-900" : "border-gray-200 bg-gray-50"}`}>
                <div className={`flex flex-col gap-4 rounded-3xl p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between ${darkMode ? "bg-slate-800 border border-slate-700" : "bg-white"}`}>
                  <label className={`inline-flex items-center gap-3 text-sm font-semibold ${darkMode ? "text-slate-200" : "text-gray-700"}`}>
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={(e) => handleSelectAllCartItems(e.target.checked)}
                      className="h-5 w-5 rounded border-gray-300 text-red-600 focus:ring-red-500"
                    />
                    Select All ({cartItems.length} Item{cartItems.length === 1 ? "" : "s"})
                  </label>
                  <div className={darkMode ? "text-sm text-slate-300" : "text-sm text-gray-600"}>
                    Selected: {selectedItemCount} of {cartItems.length} Item{cartItems.length === 1 ? "" : "s"}
                  </div>
                </div>
                <div className="mt-4 space-y-4">
                  {cartItems.map((item) => (
                    <div key={item.cartId || item._id || item.name} className={`flex flex-col gap-4 rounded-3xl border p-5 md:flex-row md:items-center md:justify-between ${darkMode ? "border-slate-700 bg-slate-800" : "border-gray-200 bg-white"}`}>
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
                            <p className={darkMode ? "font-semibold text-white" : "font-semibold text-gray-900"}>{item.name}</p>
                            <div className={`mt-2 flex flex-wrap items-center gap-3 text-sm ${darkMode ? "text-slate-300" : "text-gray-500"}`}>
                              <span>Qty: {item.quantity}</span>
                              {item.is_estimate && item.width && item.height && (
                                <span>Measurements: {item.width} {item.measurementUnit || item.unit || ""} × {item.height} {item.measurementUnit || item.unit || ""}</span>
                              )}
                            </div>
                            <p className={`mt-2 text-sm ${darkMode ? "text-slate-300" : "text-gray-500"}`}>
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
              <div className={`mt-6 rounded-3xl border p-5 shadow-sm ${darkMode ? "border-slate-700 bg-slate-900" : "border-gray-200 bg-white"}`}>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className={`rounded-2xl p-4 ${darkMode ? "bg-slate-800" : "bg-gray-50"}`}>
                    <p className={`text-xs uppercase tracking-[0.2em] ${darkMode ? "text-slate-400" : "text-gray-500"}`}>Selected Products</p>
                    <p className={`mt-2 text-lg font-semibold ${darkMode ? "text-white" : "text-gray-900"}`}>{selectedItemCount}</p>
                  </div>
                  <div className={`rounded-2xl p-4 ${darkMode ? "bg-slate-800" : "bg-gray-50"}`}>
                    <p className={`text-xs uppercase tracking-[0.2em] ${darkMode ? "text-slate-400" : "text-gray-500"}`}>Total Quantity</p>
                    <p className={`mt-2 text-lg font-semibold ${darkMode ? "text-white" : "text-gray-900"}`}>{selectedQuantityTotal}</p>
                  </div>
                  <div className={`rounded-2xl p-4 ${darkMode ? "bg-slate-800" : "bg-gray-50"}`}>
                    <p className={`text-xs uppercase tracking-[0.2em] ${darkMode ? "text-slate-400" : "text-gray-500"}`}>Estimated Total</p>
                    <p className={`mt-2 text-lg font-semibold ${darkMode ? "text-white" : "text-gray-900"}`}>{formatCurrency(selectedSubtotal)}</p>
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
          <div className={`rounded-[28px] border p-8 shadow-sm sm:p-10 ${darkMode ? "border-slate-700 bg-slate-800 text-slate-100" : "border-slate-200 bg-white text-slate-900"}`}>
            <div className={`flex items-center justify-between gap-4 border-b pb-4 ${darkMode ? "border-slate-700" : "border-slate-100"}`}>
              <div className="flex items-center gap-3">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-red-50 text-red-600">
                  <Info size={20} />
                </span>
                <h2 className={`text-3xl font-black tracking-tight ${darkMode ? "text-white" : "text-slate-950"}`}>About Us</h2>
              </div>
              <span className={`rounded-full border px-5 py-2 text-[11px] font-black uppercase tracking-[0.2em] ${darkMode ? "border-slate-600 bg-slate-700 text-slate-100" : "border-red-200 bg-white text-red-700"}`}>
                ACGC Services
              </span>
            </div>

            <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_1fr]">
              <div className="space-y-5">
                <div>
                  <p className={`text-xs font-black uppercase tracking-[0.28em] ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Who We Are</p>
                  <p className={`mt-3 text-sm leading-8 ${darkMode ? "text-slate-300" : "text-slate-600"}`}>
                    ACGC Aluminum & Glass Construction provides durable and professional aluminum and glass solutions for residential and commercial spaces. We combine accurate measurements, quality materials, and dependable installation services to help every project feel complete.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className={`rounded-2xl border p-5 ${darkMode ? "border-slate-700 bg-slate-900" : "border-slate-100 bg-slate-50"}`}>
                    <p className="text-[11px] font-black uppercase tracking-[0.26em] text-red-700">Our Mission</p>
                    <p className={`mt-3 text-sm leading-7 ${darkMode ? "text-slate-300" : "text-slate-600"}`}>
                      To deliver clean, dependable, and customer-focused aluminum and glass workmanship.
                    </p>
                  </div>
                  <div className={`rounded-2xl border p-5 ${darkMode ? "border-slate-700 bg-slate-900" : "border-slate-100 bg-slate-50"}`}>
                    <p className="text-[11px] font-black uppercase tracking-[0.26em] text-red-700">Our Work</p>
                    <p className={`mt-3 text-sm leading-7 ${darkMode ? "text-slate-300" : "text-slate-600"}`}>
                      Windows, doors, partitions, shutters, safety glass, and custom aluminum fabrication.
                    </p>
                  </div>
                </div>

                <div className={`rounded-2xl border p-5 ${darkMode ? "border-red-900 bg-red-950/60" : "border-red-100 bg-red-50"}`}>
                  <p className="text-[11px] font-black uppercase tracking-[0.25em] text-red-700">Our Promise</p>
                  <p className={`mt-3 text-sm leading-7 ${darkMode ? "text-slate-200" : "text-slate-700"}`}>
                    Every job is handled with honest guidance, careful project planning, and professional execution.
                  </p>
                </div>
              </div>

              <div className="rounded-[24px] bg-slate-950 p-6 text-white">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <span className="text-[11px] font-black uppercase tracking-[0.26em] text-red-300">Our Process</span>
                  <span className="rounded-full border border-white/20 px-4 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-white">01 → 04</span>
                </div>
                <div className="mt-6 space-y-5">
                  {[
                    ["Consultation", "Learn your project needs and timeline."],
                    ["Measurement", "Plan the precise fit and materials."],
                    ["Fabrication", "Produce the aluminum and glass elements."],
                    ["Installation", "Finish the project with quality workmanship."]
                  ].map(([title, desc], index) => (
                    <div key={title} className="flex items-start gap-3">
                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-600 text-[11px] font-black text-white">{String(index + 1).padStart(2, "0")}</span>
                      <div className="pt-0.5">
                        <p className="text-sm font-black uppercase tracking-[0.16em] text-white">{title}</p>
                        <p className="mt-1 text-xs leading-6 text-slate-300">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "notifications" && (
          <>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
              <div>
                <h2 className={`text-2xl font-bold ${darkMode ? "text-white" : "text-slate-950"}`}>Notifications</h2>
                <p className={darkMode ? "text-slate-300" : "text-slate-500"}>Stay updated on your orders and project status.</p>
              </div>
            </div>

            {ordersLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, index) => (
                  <div key={index} className="animate-pulse rounded-3xl bg-white p-8 shadow" />
                ))}
              </div>
            ) : orders.length === 0 ? (
              <div className={`rounded-3xl p-10 text-center shadow ${darkMode ? "bg-slate-800 text-slate-200" : "bg-white text-gray-600"}`}>
                <p className={darkMode ? "text-slate-300" : "text-gray-600"}>No notifications yet. You'll see updates about your orders here.</p>
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
                        className={`rounded-[28px] border p-5 shadow-sm transition hover:shadow-md ${darkMode ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white"}`}
                      >
                        <div className="flex gap-4">
                          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${darkMode ? "bg-slate-700" : "bg-slate-100"} ${notificationIcon()}`}>
                            <Bell size={20} />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <h3 className={`font-semibold break-words ${darkMode ? "text-white" : "text-slate-950"}`}>{product.name || "Project Update"}</h3>
                                <p className={`mt-1 text-sm ${darkMode ? "text-slate-300" : "text-slate-600"}`}>{notificationMessage()}</p>
                                <p className="mt-2 text-xs text-slate-400">{order.tracking}</p>
                              </div>
                              <span className={`inline-flex shrink-0 items-center rounded-full px-3 py-1 text-xs font-semibold ${getOrderStatusClasses(order.status)}`}>
                                {getOrderStatusLabel(order.status)}
                              </span>
                            </div>

                            <div className={`mt-3 flex items-center justify-between text-xs ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                              <span>{order.createdAt ? new Date(order.createdAt).toLocaleDateString() : "—"}</span>
                              <button
                                onClick={() => {
                                  setSelectedOrderForModal(order);
                                  setActiveTab("orders");
                                }}
                                className={darkMode ? "text-white hover:text-red-300 font-semibold transition" : "text-slate-950 hover:text-red-600 font-semibold transition"}
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
            <div className={`rounded-3xl shadow p-8 ${darkMode ? "bg-slate-800 text-slate-100" : "bg-white text-slate-900"}`}>
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

                <h2 className={`text-2xl font-bold mt-5 ${darkMode ? "text-white" : "text-slate-900"}`}>{`${profileForm.first_name || user?.first_name || ""} ${profileForm.last_name || user?.last_name || ""}`.trim() || "Customer"}</h2>
                <p className={darkMode ? "text-slate-300 capitalize" : "text-gray-500 capitalize"}>{user?.role || "customer"}</p>

                <div className="mt-6 w-full space-y-4">
                  <div className={`rounded-2xl p-4 flex items-center gap-4 ${darkMode ? "bg-slate-900" : "bg-gray-50"}`}>
                    <Mail className="text-red-600" />
                    <div>
                      <p className={darkMode ? "text-sm text-slate-400" : "text-sm text-gray-500"}>Email</p>
                      <p className={`font-medium ${darkMode ? "text-white" : "text-slate-900"}`}>{profileForm.email}</p>
                    </div>
                  </div>

                  <div className={`rounded-2xl p-4 flex items-center gap-4 ${darkMode ? "bg-slate-900" : "bg-gray-50"}`}>
                    <Phone className="text-red-600" />
                    <div>
                      <p className={darkMode ? "text-sm text-slate-400" : "text-sm text-gray-500"}>Phone</p>
                      <p className={`font-medium ${darkMode ? "text-white" : "text-slate-900"}`}>{profileForm.phone || "Not set"}</p>
                    </div>
                  </div>

                  <div className={`rounded-2xl p-4 flex items-center gap-4 ${darkMode ? "bg-slate-900" : "bg-gray-50"}`}>
                    <ShieldCheck className="text-red-600" />
                    <div>
                      <p className={darkMode ? "text-sm text-slate-400" : "text-sm text-gray-500"}>Role</p>
                      <p className={`font-medium capitalize ${darkMode ? "text-white" : "text-slate-900"}`}>{user?.role || "customer"}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className={`xl:col-span-2 rounded-3xl shadow p-8 ${darkMode ? "bg-slate-800" : "bg-white"}`}>
              <div className="flex items-center gap-3 mb-6">
                <User size={28} className="text-red-600" />
                <div>
                  <h2 className={`text-2xl font-bold ${darkMode ? "text-white" : "text-slate-900"}`}>Profile Settings</h2>
                  <p className={darkMode ? "text-slate-300" : "text-gray-500"}>Update your account and password settings.</p>
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
                  <div className={`rounded-3xl border p-2 flex overflow-hidden ${darkMode ? "bg-slate-900 border-slate-700" : "bg-gray-100 border-gray-200"}`}>
                    <button
                      type="button"
                      onClick={() => setProfileTab("profile")}
                      className={`rounded-2xl px-5 py-3 text-sm font-semibold transition ${
                        profileTab === "profile"
                          ? darkMode ? "bg-slate-700 text-red-400 shadow-sm" : "bg-white text-red-600 shadow-sm"
                          : darkMode ? "text-slate-300 hover:text-red-300" : "text-gray-600 hover:text-red-600"
                      }`}
                    >
                      Profile
                    </button>
                    <button
                      type="button"
                      onClick={() => setProfileTab("security")}
                      className={`rounded-2xl px-5 py-3 text-sm font-semibold transition ${
                        profileTab === "security"
                          ? darkMode ? "bg-slate-700 text-red-400 shadow-sm" : "bg-white text-red-600 shadow-sm"
                          : darkMode ? "text-slate-300 hover:text-red-300" : "text-gray-600 hover:text-red-600"
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
                        <label className={darkMode ? "text-sm font-medium text-slate-300" : "text-sm font-medium text-gray-600"}>First Name</label>
                        <div className="relative mt-2">
                          <User size={18} className="absolute left-4 top-4 text-gray-400" />
                          <input
                            type="text"
                            name="first_name"
                            value={profileForm.first_name}
                            onChange={handleProfileChange}
                            placeholder="First Name"
                            className={`w-full pl-12 pr-4 py-3 border rounded-2xl focus:outline-none focus:ring-2 focus:ring-red-500 ${darkMode ? "bg-slate-900 border-slate-700 text-white placeholder:text-slate-400" : "bg-white border-slate-200"}`}
                          />
                        </div>
                      </div>

                      <div>
                        <label className={darkMode ? "text-sm font-medium text-slate-300" : "text-sm font-medium text-gray-600"}>Last Name</label>
                        <div className="relative mt-2">
                          <User size={18} className="absolute left-4 top-4 text-gray-400" />
                          <input
                            type="text"
                            name="last_name"
                            value={profileForm.last_name}
                            onChange={handleProfileChange}
                            placeholder="Last Name"
                            className={`w-full pl-12 pr-4 py-3 border rounded-2xl focus:outline-none focus:ring-2 focus:ring-red-500 ${darkMode ? "bg-slate-900 border-slate-700 text-white placeholder:text-slate-400" : "bg-white border-slate-200"}`}
                          />
                        </div>
                      </div>

                      <div>
                        <label className={darkMode ? "text-sm font-medium text-slate-300" : "text-sm font-medium text-gray-600"}>Phone Number</label>
                        <div className="relative mt-2">
                          <Phone size={18} className="absolute left-4 top-4 text-gray-400" />
                          <input
                            type="text"
                            name="phone"
                            value={profileForm.phone}
                            onChange={handleProfileChange}
                            placeholder="Phone Number"
                            className={`w-full pl-12 pr-4 py-3 border rounded-2xl focus:outline-none focus:ring-2 focus:ring-red-500 ${darkMode ? "bg-slate-900 border-slate-700 text-white placeholder:text-slate-400" : "bg-white border-slate-200"}`}
                          />
                        </div>
                      </div>

                      <div>
                        <label className={darkMode ? "text-sm font-medium text-slate-300" : "text-sm font-medium text-gray-600"}>Email Address</label>
                        <div className="relative mt-2">
                          <Mail size={18} className="absolute left-4 top-4 text-gray-400" />
                          <input
                            type="email"
                            name="email"
                            value={profileForm.email}
                            disabled
                            className={`w-full pl-12 pr-4 py-3 border rounded-2xl ${darkMode ? "bg-slate-900 border-slate-700 text-slate-400" : "bg-gray-100 text-gray-500 border-slate-200"}`}
                          />
                        </div>
                      </div>

                      <div className="md:col-span-2">
                        <label className={darkMode ? "text-sm font-medium text-slate-300" : "text-sm font-medium text-gray-600"}>Street Address</label>
                        <input
                          type="text"
                          name="street_address"
                          value={profileForm.street_address}
                          onChange={handleProfileChange}
                          placeholder="Street address"
                          className={`w-full mt-2 px-4 py-3 border rounded-2xl focus:outline-none focus:ring-2 focus:ring-red-500 ${darkMode ? "bg-slate-900 border-slate-700 text-white placeholder:text-slate-400" : "bg-white border-slate-200"}`}
                        />
                      </div>

                      <div>
                        <label className={darkMode ? "text-sm font-medium text-slate-300" : "text-sm font-medium text-gray-600"}>City</label>
                        <input
                          type="text"
                          name="city"
                          value={profileForm.city}
                          onChange={handleProfileChange}
                          placeholder="City"
                          className={`w-full mt-2 px-4 py-3 border rounded-2xl focus:outline-none focus:ring-2 focus:ring-red-500 ${darkMode ? "bg-slate-900 border-slate-700 text-white placeholder:text-slate-400" : "bg-white border-slate-200"}`}
                        />
                      </div>

                      <div>
                        <label className={darkMode ? "text-sm font-medium text-slate-300" : "text-sm font-medium text-gray-600"}>Province</label>
                        <input
                          type="text"
                          name="province"
                          value={profileForm.province}
                          onChange={handleProfileChange}
                          placeholder="Province"
                          className={`w-full mt-2 px-4 py-3 border rounded-2xl focus:outline-none focus:ring-2 focus:ring-red-500 ${darkMode ? "bg-slate-900 border-slate-700 text-white placeholder:text-slate-400" : "bg-white border-slate-200"}`}
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className={darkMode ? "text-sm font-medium text-slate-300" : "text-sm font-medium text-gray-600"}>Zip Code</label>
                        <input
                          type="text"
                          name="zip_code"
                          value={profileForm.zip_code}
                          onChange={handleProfileChange}
                          placeholder="Zip Code"
                          className={`w-full mt-2 px-4 py-3 border rounded-2xl focus:outline-none focus:ring-2 focus:ring-red-500 ${darkMode ? "bg-slate-900 border-slate-700 text-white placeholder:text-slate-400" : "bg-white border-slate-200"}`}
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
                <h2 className={`text-2xl font-black tracking-[-0.03em] ${darkMode ? "text-white" : "text-slate-950"}`}>My Contracts & Warranties</h2>
                <p className={darkMode ? "text-slate-400" : "text-slate-500"}>Review your contracts and warranty coverage.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => { setContractHistoryTab("accepted"); setWarrantyHistoryTab(null); }}
                  className={`px-4 py-2 rounded-2xl font-black text-sm transition ${
                    contractHistoryTab === "accepted" && !warrantyHistoryTab
                      ? "bg-red-600 text-white shadow-sm"
                      : darkMode
                        ? "bg-slate-800 text-slate-200 border border-slate-600 hover:bg-slate-700"
                        : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  Accepted Contracts ({acceptedContracts.length})
                </button>
                <button
                  type="button"
                  onClick={() => { setContractHistoryTab("rejected"); setWarrantyHistoryTab(null); }}
                  className={`px-4 py-2 rounded-2xl font-black text-sm transition ${
                    contractHistoryTab === "rejected" && !warrantyHistoryTab
                      ? "bg-red-600 text-white shadow-sm"
                      : darkMode
                        ? "bg-slate-800 text-slate-200 border border-slate-600 hover:bg-slate-700"
                        : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  Declined Contracts ({rejectedContracts.length})
                </button>
                <button
                  type="button"
                  onClick={() => { setContractHistoryTab(null); setWarrantyHistoryTab("active"); }}
                  className={`px-4 py-2 rounded-2xl font-black text-sm transition ${
                    warrantyHistoryTab === "active"
                      ? "bg-emerald-600 text-white shadow-sm"
                      : darkMode
                        ? "bg-slate-800 text-slate-200 border border-slate-600 hover:bg-slate-700"
                        : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  Active Warranty ({activeWarranties.length})
                </button>
                <button
                  type="button"
                  onClick={() => { setContractHistoryTab(null); setWarrantyHistoryTab("expired"); }}
                  className={`px-4 py-2 rounded-2xl font-black text-sm transition ${
                    warrantyHistoryTab === "expired"
                      ? "bg-red-600 text-white shadow-sm"
                      : darkMode
                        ? "bg-slate-800 text-slate-200 border border-slate-600 hover:bg-slate-700"
                        : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  Out-of-Warranty ({expiredWarranties.length})
                </button>
              </div>
            </div>

            {ordersLoading ? (
              <div className="space-y-4">
                {[...Array(2)].map((_, index) => (
                  <div key={index} className={`animate-pulse rounded-[28px] p-8 shadow ${darkMode ? "bg-slate-800" : "bg-white"}`} />
                ))}
              </div>
            ) : warrantyHistoryTab ? (
              warrantiesInTab.length === 0 ? (
                <div className={`rounded-[28px] border p-10 text-center shadow-sm ${darkMode ? "border-slate-700 bg-slate-800" : "border-red-200 bg-white"}`}>
                  <p className={darkMode ? "text-slate-300" : "text-gray-600"}>No {warrantyHistoryTab === "active" ? "active" : "expired"} warranties found.</p>
                </div>
              ) : (
                <div className={`overflow-hidden rounded-[28px] border shadow-[0_18px_45px_rgba(127,29,29,0.08)] ${darkMode ? "border-slate-700 bg-slate-800" : "border-red-200 bg-white"}`}>
                  <table className="min-w-full table-fixed border-separate border-spacing-0 text-left">
                    <thead className="bg-gradient-to-r from-red-700 via-red-600 to-red-500">
                      <tr>
                        <th className="w-[14%] px-6 py-4 text-xs font-black uppercase tracking-[0.24em] text-white text-center">Tracking No.</th>
                        <th className="w-[16%] px-6 py-4 text-xs font-black uppercase tracking-[0.24em] text-white">Product</th>
                        <th className="w-[16%] px-6 py-4 text-xs font-black uppercase tracking-[0.24em] text-white text-center">Warranty Period</th>
                        <th className="w-[14%] px-6 py-4 text-xs font-black uppercase tracking-[0.24em] text-white text-center">Start Date</th>
                        <th className="w-[14%] px-6 py-4 text-xs font-black uppercase tracking-[0.24em] text-white text-center">Expiry Date</th>
                        <th className="w-[14%] px-6 py-4 text-xs font-black uppercase tracking-[0.24em] text-white text-center">Status</th>
                        <th className="w-[12%] px-6 py-4 text-xs font-black uppercase tracking-[0.24em] text-white text-center">Actions</th>
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
                          <tr key={order._id || order.tracking} className={`border-t transition ${darkMode ? "border-slate-700 hover:bg-slate-700/60" : "border-red-100 hover:bg-red-50/70"}`}>
                            <td className="px-6 py-5 align-middle text-sm font-black text-red-700 text-center">{order.tracking || order._id || "—"}</td>
                            <td className={`px-6 py-5 align-middle text-sm ${darkMode ? "text-slate-300" : "text-slate-700"}`}>
                              <span className={`font-black ${darkMode ? "text-white" : "text-slate-900"}`}>{product.name || product.product_name || "Product"}</span>
                            </td>
                            <td className={`px-6 py-5 align-middle text-sm font-medium text-center ${darkMode ? "text-slate-400" : "text-slate-600"}`}>{order.warranty_period || "—"}</td>
                            <td className={`px-6 py-5 align-middle text-sm font-medium text-center ${darkMode ? "text-slate-400" : "text-slate-600"}`}>{warrantyStartDate}</td>
                            <td className={`px-6 py-5 align-middle text-sm font-medium text-center ${darkMode ? "text-slate-400" : "text-slate-600"}`}>{warrantyExpiryDate}</td>
                            <td className="px-6 py-5 align-middle text-center">
                              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${statusClass}`}>{statusLabel}</span>
                            </td>
                            <td className="px-6 py-5 align-middle text-center">
                              <div className="flex flex-wrap justify-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setSelectedOrderForModal(order)}
                                  className="rounded-2xl bg-[#101114] px-3 py-2 text-xs font-black text-white transition hover:bg-black shadow-sm"
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
              <div className={`rounded-[28px] border p-10 text-center shadow-sm ${darkMode ? "border-slate-700 bg-slate-800" : "border-red-200 bg-white"}`}>
                <p className={darkMode ? "text-slate-300" : "text-gray-600"}>No {contractHistoryTab === "accepted" ? "accepted" : "rejected"} contracts found yet.</p>
              </div>
            ) : (
              <div className={`overflow-hidden rounded-[28px] border shadow-[0_18px_45px_rgba(127,29,29,0.08)] ${darkMode ? "border-slate-700 bg-slate-800" : "border-red-200 bg-white"}`}>
                <table className="min-w-full table-fixed border-separate border-spacing-0 text-left">
                  <thead className="bg-gradient-to-r from-red-700 via-red-600 to-red-500">
                    <tr>
                      <th className="w-[14%] px-6 py-4 text-xs font-black uppercase tracking-[0.24em] text-white text-center">Tracking No.</th>
                      <th className="w-[20%] px-6 py-4 text-xs font-black uppercase tracking-[0.24em] text-white">Project</th>
                      <th className="w-[14%] px-6 py-4 text-xs font-black uppercase tracking-[0.24em] text-white text-right">Amount</th>
                      <th className="w-[14%] px-6 py-4 text-xs font-black uppercase tracking-[0.24em] text-white text-center">Status</th>
                      <th className="w-[14%] px-6 py-4 text-xs font-black uppercase tracking-[0.24em] text-white text-center">Date</th>
                      <th className="w-[24%] px-6 py-4 text-xs font-black uppercase tracking-[0.24em] text-white text-center">Actions</th>
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
                        <tr key={order._id || order.tracking} className={`border-t transition ${darkMode ? "border-slate-700 hover:bg-slate-700/60" : "border-red-100 hover:bg-red-50/70"}`}>
                          <td className="px-6 py-5 align-middle text-sm font-black text-red-700 text-center">{order.tracking || order._id || "—"}</td>
                          <td className={`px-6 py-5 align-middle text-sm ${darkMode ? "text-slate-300" : "text-slate-700"}`}>
                            <span className={`font-black ${darkMode ? "text-white" : "text-slate-900"}`}>{product.name || product.product_name || "Project"}</span>
                          </td>
                          <td className={`px-6 py-5 align-middle text-sm font-black text-right ${darkMode ? "text-slate-100" : "text-slate-800"}`}>{formatCurrency(order.contract_amount || order.total_amount)}</td>
                          <td className="px-6 py-5 align-middle text-center">
                            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${statusClass}`}>{statusLabel}</span>
                          </td>
                          <td className={`px-6 py-5 align-middle text-sm font-medium text-center ${darkMode ? "text-slate-400" : "text-slate-600"}`}>{order.updatedAt ? new Date(order.updatedAt).toLocaleDateString() : order.createdAt ? new Date(order.createdAt).toLocaleDateString() : "—"}</td>
                          <td className="px-6 py-5 align-middle text-center">
                            <div className="flex flex-wrap justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => openContractModal(order)}
                                className="rounded-2xl bg-blue-600 px-3 py-2 text-xs font-black text-white transition hover:bg-blue-700 shadow-sm"
                              >
                                View Contract
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedOrderForModal(order)}
                                className="rounded-2xl bg-[#101114] px-3 py-2 text-xs font-black text-white transition hover:bg-black shadow-sm"
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

        <footer className="relative left-1/2 -mb-6 mt-10 w-screen -translate-x-1/2 border-t border-white/10 bg-black/70">
          <div className="mx-auto max-w-7xl px-6 py-14">
            <div className="grid gap-14 lg:grid-cols-3">
              <div>
                <div className="flex items-center gap-4">
                  <img src={logo} alt="logo" className="h-14 w-20 object-contain" />
                  <div>
                    <h3 className="text-xl font-bold text-white">ACGC Aluminum Services</h3>
                    <p className="text-sm text-gray-300">Premium Glass &amp; Aluminum Solutions</p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="mb-6 font-bold text-white">Quick Links</h4>
                <div className="space-y-4 text-gray-300">
                  <p>Home</p>
                  <p>Browse Products</p>
                  <p>Track Order</p>
                  <p>About Us</p>
                </div>
              </div>

              <div>
                <h4 className="mb-6 font-bold text-white">Contact</h4>
                <div className="space-y-4 text-gray-300">
                  <p>Email: acgc.services00@email.com</p>
                  <p>Phone: +63 900 000 0000</p>
                  <p>Philippines</p>
                </div>
              </div>
            </div>

            <div className="mt-12 border-t border-white/40 pt-8 text-center text-sm text-white">
              © 2026 ACGC Aluminum Services — All Rights Reserved.
            </div>
          </div>
        </footer>

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
