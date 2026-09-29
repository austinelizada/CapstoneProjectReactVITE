import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { createPortal } from "react-dom";
import toast, { Toaster } from "react-hot-toast";
import { toPng } from "html-to-image";
import {
  ShoppingCart,
  Info,
  User,
  LogOut,
  Search,
  Mail,
  Phone,
  MapPin,
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
  CheckCheck,
  Check,
  AlertTriangle,
  Star,
  StarHalf,
  Clock3,
  Wrench,
  ArrowLeft,
  X,
  ClipboardList,
  CreditCard,
  Paperclip,
  ChevronDown,
  ChevronUp,
  ImagePlus,
} from "lucide-react";
import logo from "../../assets/images/ACGCLOGO1.png";
import { useAuth } from "@/contexts/AuthContext";
import { getProducts } from "@/api/products";
import { API_BASE, apiFetch } from "@/api/client";
import {
  createOrder,
  getOrders,
  trackOrder,
  acceptContract,
  declineContract,
  submitOrderReview,
  getProductReviews,
  cancelCustomerOrder,
} from "@/api/orders";
import { uploadFiles } from "@/api/uploads";
import ContractModal from "../../components/ContractModal";
import OrderTimeline from "@/components/OrderTimeline";
import { calculateEstimate } from "@/lib/estimator";
import { buildOrderTimelineStages } from "@/lib/orderTimeline";
import { getProgressColor } from "@/lib/utils";
import { paginateItems } from "@/lib/pagination";
import { getSystemSettings, getSystemSettingsEventsUrl } from "@/api/users";
import { getCart, saveCart } from "@/api/cart";
import { formatDateToMMMDDYYYY, formatDateTimeToMMMDDYYYY } from "@/lib/dateUtils";

const PRODUCT_IMAGE_PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='400' viewBox='0 0 600 400'%3E%3Crect width='600' height='400' fill='%23e2e8f0'/%3E%3Cpath d='M248 148h104a28 28 0 0 1 28 28v48a28 28 0 0 1-28 28H248a28 28 0 0 1-28-28v-48a28 28 0 0 1 28-28Zm0 20a8 8 0 0 0-8 8v48a8 8 0 0 0 8 8h104a8 8 0 0 0 8-8v-48a8 8 0 0 0-8-8H248Zm18 22a16 16 0 1 1 0 32 16 16 0 0 1 0-32Zm50 35 17-21 31 40H244l34-42 25 30 13-7Z' fill='%2394a3b8'/%3E%3Ctext x='300' y='292' text-anchor='middle' font-family='Arial, sans-serif' font-size='24' font-weight='700' fill='%23475569'%3EProduct image%3C/text%3E%3C/svg%3E";

const CUSTOMER_READ_NOTIFICATIONS_KEY = "acgc-customer-read-notifications";
const ORDER_REVIEW_TEMPLATES = [
  {
    value: "quality",
    label: "Product quality",
    title: "Excellent product quality",
    comment: "The product quality is excellent, and the finished project looks great. I am very satisfied with the result.",
  },
  {
    value: "service",
    label: "Professional service",
    title: "Professional service",
    comment: "The team communicated clearly, arrived as scheduled, and handled the project professionally. I am happy with the service.",
  },
  {
    value: "installation",
    label: "Installation experience",
    title: "Great installation experience",
    comment: "The installation was completed carefully and as agreed. The team did a great job, and I would recommend their service.",
  },
];

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
  const canTrackProducts = !maintenanceMode && accountPermissions.can_track_products && !accountPermissions.view_only_access;
  const canUploadFeedback = !maintenanceMode && accountPermissions.can_upload_feedback && !accountPermissions.view_only_access;
  const canShowRatings = accountPermissions.show_ratings_homepage && !accountPermissions.view_only_access;

  const [activeTab, setActiveTab] = useState("home");
  const darkMode = false;
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
  const [cartLoaded, setCartLoaded] = useState(false);
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
  const [batchOrderForm, setBatchOrderForm] = useState({
    phone: "",
    shipping_address: "",
    notes: "",
  });

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
  const autoOpenedContractRef = useRef("");
  const [contractConfirmModal, setContractConfirmModal] = useState({
    open: false,
    action: null,
    orderId: null,
  });
  const [contractDeclineReason, setContractDeclineReason] = useState("");
  const [showOrderReviewModal, setShowOrderReviewModal] = useState(false);
  const [showBatchOrderModal, setShowBatchOrderModal] = useState(false);
  const [showBatchOrderConfirmModal, setShowBatchOrderConfirmModal] = useState(false);
  const [showBatchSuccessModal, setShowBatchSuccessModal] = useState(false);
  const [paymentProofOpenOrderId, setPaymentProofOpenOrderId] = useState(null);
  const [paymentProofForm, setPaymentProofForm] = useState({
    amount: "",
    fileName: "",
  });
  const [paymentProofError, setPaymentProofError] = useState("");
  const [paymentProofLoading, setPaymentProofLoading] = useState(false);
  const [paymentProofSuccessByOrder, setPaymentProofSuccessByOrder] = useState({});
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
  const [deliveryConfirmNotes, setDeliveryConfirmNotes] = useState("");
  const [deliveryConfirmError, setDeliveryConfirmError] = useState("");
  const [showOrderNowModal, setShowOrderNowModal] = useState(false);
  const [orderNowProduct, setOrderNowProduct] = useState(null);
  const [orderNowQuantity, setOrderNowQuantity] = useState(1);
  const [showOrderSuccessModal, setShowOrderSuccessModal] = useState(false);
  const [orderSuccessData, setOrderSuccessData] = useState(null);
  const [cancelRequestModal, setCancelRequestModal] = useState({ open: false, order: null });
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [orderFilter, setOrderFilter] = useState("all");
  const [orderPage, setOrderPage] = useState(1);
  const [orderViewMode, setOrderViewMode] = useState("view2");
  const [selectedOrderForModal, setSelectedOrderForModal] = useState(null);
  const [contractSummaryExpanded, setContractSummaryExpanded] = useState(true);
  const [contractHistoryTab, setContractHistoryTab] = useState("accepted");
  const [contractPage, setContractPage] = useState(1);
  const [warrantyHistoryTab, setWarrantyHistoryTab] = useState(null);

  const customerContracts = orders.filter((order) => {
    const status = String(order.status || "").toLowerCase();
    const contractStatus = String(order.contract_status || "").toLowerCase();
    return ["contract_sent", "contract_accepted"].includes(status) || ["sent", "accepted"].includes(contractStatus);
  });
  const rejectedContracts = orders.filter(
    (order) =>
      order.status === "contract_declined" ||
      order.contract_status?.toString().toLowerCase() === "declined"
  );
  const contractsInTab = contractHistoryTab === "rejected" ? rejectedContracts : customerContracts;
  const CONTRACT_PAGE_SIZE = 5;
  const contractPageCount = Math.max(1, Math.ceil(contractsInTab.length / CONTRACT_PAGE_SIZE));
  const safeContractPage = Math.min(Math.max(1, contractPage), contractPageCount);
  const paginatedContracts = contractsInTab.slice(
    (safeContractPage - 1) * CONTRACT_PAGE_SIZE,
    safeContractPage * CONTRACT_PAGE_SIZE
  );

  useEffect(() => {
    setContractPage(1);
  }, [contractHistoryTab, contractsInTab.length]);

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
  const [notificationFilter, setNotificationFilter] = useState("all");
  const [readNotificationIds, setReadNotificationIds] = useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(CUSTOMER_READ_NOTIFICATIONS_KEY) || "[]"));
    } catch {
      return new Set();
    }
  });
  const [profileTab, setProfileTab] = useState("profile");
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordModalError, setPasswordModalError] = useState("");
  const [permissionNotice, setPermissionNotice] = useState(null);
  const [maintenanceCountdown, setMaintenanceCountdown] = useState(10);
  const permissionNoticeTimer = useRef(null);
  const customerNotificationItems = orders.flatMap((order) => {
    const orderId = order._id || order.id || order.tracking;
    const notifications = [{
      ...order,
      notificationType: "order",
      notificationId: orderId,
      notificationDate: order.updatedAt || order.createdAt,
    }];

    if (order.payment_proof_submitted_at) {
      notifications.unshift({
        ...order,
        notificationType: "payment",
        notificationId: `${orderId}-payment-${new Date(order.payment_proof_submitted_at).getTime()}`,
        notificationDate: order.payment_proof_submitted_at,
      });
    }

    return notifications;
  });
  const unreadNotificationCount = customerNotificationItems.filter((notification) => !readNotificationIds.has(notification.notificationId)).length;
  const readNotificationCount = customerNotificationItems.length - unreadNotificationCount;
  const filteredNotifications = customerNotificationItems.filter((notification) => {
    const isRead = readNotificationIds.has(notification.notificationId);
    return notificationFilter === "all" || (notificationFilter === "unread" ? !isRead : isRead);
  });

  const markAllCustomerNotificationsRead = () => {
    const nextReadNotificationIds = new Set(readNotificationIds);
    customerNotificationItems.forEach((notification) => nextReadNotificationIds.add(notification.notificationId));
    setReadNotificationIds(nextReadNotificationIds);
    localStorage.setItem(CUSTOMER_READ_NOTIFICATIONS_KEY, JSON.stringify([...nextReadNotificationIds]));
  };

  const markCustomerNotificationRead = (notificationId) => {
    if (!notificationId || readNotificationIds.has(notificationId)) return;
    const nextReadNotificationIds = new Set(readNotificationIds);
    nextReadNotificationIds.add(notificationId);
    setReadNotificationIds(nextReadNotificationIds);
    localStorage.setItem(CUSTOMER_READ_NOTIFICATIONS_KEY, JSON.stringify([...nextReadNotificationIds]));
  };

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
    if (!user) return undefined;

    let active = true;
    const loadCart = async () => {
      try {
        const response = await getCart();
        if (!active) return;
        setCartItems(
          Array.isArray(response.items)
            ? response.items.map((item) => ({ ...item, selected: item.selected !== false }))
            : []
        );
      } catch (error) {
        if (!active) return;
        const storedCart = localStorage.getItem("customerCart");
        if (storedCart) {
          try {
            const cart = JSON.parse(storedCart);
            setCartItems(
              Array.isArray(cart)
                ? cart.map((item) => ({ ...item, selected: item.selected !== false }))
                : []
            );
          } catch (parseError) {
            console.warn("Unable to parse saved cart", parseError);
          }
        }
        console.warn("Unable to load cart from backend; using local cart fallback.", error);
      } finally {
        if (active) setCartLoaded(true);
      }
    };

    loadCart();
    return () => {
      active = false;
    };
  }, [user]);

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
    if (!cartLoaded) return;
    localStorage.setItem("customerCart", JSON.stringify(cartItems));

    const saveTimer = setTimeout(() => {
      saveCart(cartItems).catch((error) => {
        console.warn("Unable to save cart to backend.", error);
      });
    }, 250);

    return () => clearTimeout(saveTimer);
  }, [cartItems, cartLoaded]);

  const selectedCartItems = cartItems.filter((item) => item.selected);
  const selectedItemCount = selectedCartItems.length;
  const selectedQuantityTotal = selectedCartItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const selectedSubtotal = selectedCartItems.reduce((sum, item) => sum + getItemPriceValue(item), 0);
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
    (selectedOrderStatus === "contract_sent" || selectedOrderStatus === "site_inspection" || selectedOrderContractStatus === "sent") &&
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

  const isCustomerContractAccepted = (order) => {
    if (!order) return false;
    const status = String(order.status || "").toLowerCase();
    const contractStatus = String(order.contract_status || "").toLowerCase();
    return Boolean(
      order.acceptedByCustomer === true ||
      status === "contract_accepted" ||
      contractStatus === "accepted" ||
      status === "contract_signed" ||
      contractStatus === "signed"
    );
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
    const orderId = new URLSearchParams(location.search).get("orderId");
    if (!orderId || ordersLoading || !orders.length || autoOpenedContractRef.current === orderId) return;

    const order = orders.find((candidate) => String(candidate._id || candidate.id) === String(orderId));
    if (!order || !canShowContractForOrder(order)) return;

    autoOpenedContractRef.current = orderId;
    setActiveTab("contracts");
    openContractModal(order);
    navigate(`${location.pathname}?tab=contracts`, { replace: true });
  }, [location.pathname, location.search, navigate, orders, ordersLoading]);

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

    toast.success("Product added to cart.");
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

    toast.success("Estimate added to cart.");
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
    if (!estimateForm.width || !estimateForm.height) {
      setCartActionError("Please enter width and height to request an order.");
      return;
    }
    if (Number(estimateForm.width) <= 0 || Number(estimateForm.height) <= 0) {
      setCartActionError("Width and height must be greater than 0.");
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
    if (!deliveryConfirmForm.street_address.trim() || !deliveryConfirmForm.phone.trim()) {
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
      setContractActionMessage("Contract accepted and signed successfully.");
      toast.success("Contract accepted and signed successfully.");
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

  const handleDeclineContract = async (orderId, declineReason) => {
    if (!orderId || contractActionLoading) return;

    setContractActionError("");
    setContractActionMessage("");
    setContractActionOrderId(orderId);
    setContractActionLoading(true);
    try {
      const response = await declineContract(orderId, declineReason);
      updateLocalOrder(response.order);
      if (selectedOrderForModal?._id === orderId) {
        setSelectedOrderForModal(response.order);
      }
      setContractActionMessage("Contract declined. ACGC has received your reason.");
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
    setContractActionError("");
    setContractDeclineReason("");
    setContractConfirmModal({
      open: true,
      action,
      orderId,
    });
  };

  const closeContractConfirmModal = () => {
    setContractConfirmModal({ open: false, action: null, orderId: null });
    setContractDeclineReason("");
  };

  const handleConfirmContractAction = async () => {
    if (!contractConfirmModal.orderId || !contractConfirmModal.action) return;

    const orderId = contractConfirmModal.orderId;
    const action = contractConfirmModal.action;
    const declineReason = contractDeclineReason.trim();

    if (action === "decline" && !declineReason) {
      setContractActionError("Please provide a reason for declining the contract.");
      return;
    }

    closeContractConfirmModal();

    if (action === "accept") {
      await handleAcceptContract(orderId);
    } else if (action === "decline") {
      await handleDeclineContract(orderId, declineReason);
    }
  };

  const handleRemoveFromCart = (cartId) => {
    setCartItems((prev) => prev.filter((item) => item.cartId !== cartId));
  };

  const handleDeleteSelectedItems = () => {
    setCartItems((prev) => prev.filter((item) => !item.selected));
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
    setDeliveryConfirmMode("orderNow");
    setDeliveryConfirmForm({
      phone: profileForm.phone || user?.phone || "",
      street_address: profileForm.street_address || user?.street_address || "",
      city: profileForm.city || user?.city || "",
      province: profileForm.province || user?.province || "",
      zip_code: profileForm.zip_code || user?.zip_code || "",
    });
    setDeliveryConfirmNotes("");
    setDeliveryConfirmError("");
    setShowDeliveryConfirmModal(true);
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
      notes: deliveryConfirmNotes.trim(),
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
      setShowOrderNowModal(false);
      setOrderNowProduct(null);
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

  const openBatchOrderModal = () => {
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
    setBatchOrderForm({
      phone: profileForm.phone || user?.phone || "",
      shipping_address: normalizeAddress(
        [profileForm.street_address || user?.street_address, profileForm.city || user?.city, profileForm.province || user?.province, profileForm.zip_code || user?.zip_code]
          .filter(Boolean)
          .join(", ")
      ),
      notes: "",
    });
    setActiveTab("products");
    setShowBatchOrderModal(true);
  };

  const closeBatchOrderModal = () => {
    setShowBatchOrderModal(false);
    setShowBatchOrderConfirmModal(false);
    setActiveTab("cart");
  };

  const handleOpenPaymentProofForm = (orderId) => {
    setPaymentProofOpenOrderId(orderId);
    setPaymentProofError("");
    setPaymentProofLoading(false);
    setPaymentProofForm({ amount: "", fileName: "" });
  };

  const handleCancelRequest = (order) => {
    setCancelRequestModal({ open: true, order });
  };

  const confirmCancelRequest = async () => {
    if (!cancelRequestModal.order) return;

    const orderIdentifier = cancelRequestModal.order._id || cancelRequestModal.order.id || cancelRequestModal.order.tracking;

    try {
      const response = await cancelCustomerOrder(orderIdentifier);
      const updatedOrder = response.order || {
        ...cancelRequestModal.order,
        status: "cancelled",
      };

      setOrders((prevOrders) =>
        prevOrders.map((order) => {
          const currentOrderId = order._id || order.id || order.tracking;
          return currentOrderId === orderIdentifier ? { ...order, ...updatedOrder, status: updatedOrder.status || "cancelled" } : order;
        })
      );

      setExpandedOrderId((prev) => (prev === orderIdentifier ? null : prev));
      setCancelRequestModal({ open: false, order: null });
      toast.success(response.message || "Order request cancelled.");
    } catch (error) {
      toast.error(error?.data?.message || error?.message || "Unable to cancel this order request.");
    }
  };

  const handlePaymentProofFileChange = (event) => {
    const file = event.target.files && event.target.files[0];
    setPaymentProofForm((prev) => ({
      ...prev,
      file,
      fileName: file ? file.name : "",
    }));
  };

  const submitPaymentProof = async (order) => {
    const normalizedAmount = Number(String(paymentProofForm.amount).replace(/[^\d.]/g, ""));

    if (!paymentProofForm.amount || !Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      setPaymentProofError("Please enter the amount you paid.");
      return;
    }

    setPaymentProofLoading(true);
    setPaymentProofError("");

    const orderId = order?._id || order?.id || order?.tracking;

    try {
      let uploadedFileName = paymentProofForm.fileName || "";
      let uploadedFileUrl = "";

      if (paymentProofForm.file) {
        const uploadResult = await uploadFiles([paymentProofForm.file]);
        const uploadedFile = uploadResult?.files?.[0];
        uploadedFileName = uploadedFile?.originalName || uploadedFile?.filename || paymentProofForm.fileName || "";
        uploadedFileUrl = uploadedFile?.url || "";
      }

      const response = await apiFetch(`/orders/${orderId}/payment-proof`, {
        method: "PUT",
        body: JSON.stringify({
          amount: normalizedAmount,
          payment_method: "Cash",
          proof_file_name: uploadedFileName,
          proof_file_url: uploadedFileUrl,
        }),
      });

      const savedOrder = response.order || {
        ...order,
        payment_status: "paid",
        payment_proof_amount: normalizedAmount,
        payment_proof_file_name: uploadedFileName,
        payment_proof_file_url: uploadedFileUrl,
        payment_method: "Cash",
      };

      setOrders((prev) =>
        prev.map((entry) => {
          const entryId = entry?._id || entry?.id || entry?.tracking;
          if (entryId === orderId) {
            return {
              ...entry,
              ...savedOrder,
              payment_status: "paid",
              payment_proof_amount: normalizedAmount,
              payment_proof_file_name: uploadedFileName,
              payment_proof_file_url: uploadedFileUrl,
              payment_method: savedOrder.payment_method || "Cash",
            };
          }
          return entry;
        })
      );

      if (selectedOrderForModal && (selectedOrderForModal?._id || selectedOrderForModal?.id || selectedOrderForModal?.tracking) === orderId) {
        setSelectedOrderForModal((prev) =>
          prev
            ? {
                ...prev,
                ...savedOrder,
                payment_status: "paid",
                payment_proof_amount: normalizedAmount,
                payment_proof_file_name: uploadedFileName,
                payment_proof_file_url: uploadedFileUrl,
                payment_method: savedOrder.payment_method || "Cash",
              }
            : prev
        );
      }

      setPaymentProofSuccessByOrder((prev) => ({
        ...prev,
        [orderId]: {
          amount: normalizedAmount,
          fileName: uploadedFileName,
          fileUrl: uploadedFileUrl,
        },
      }));

      toast.success(response.message || "Payment proof submitted successfully.");
      setPaymentProofOpenOrderId(null);
      setPaymentProofForm({ amount: "", fileName: "", file: null });
    } catch (error) {
      setPaymentProofError(error?.message || "Unable to submit payment proof.");
    } finally {
      setPaymentProofLoading(false);
    }
  };

  const handleCheckout = () => {
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
    setShowBatchOrderConfirmModal(true);
  };

  const handleConfirmBatchOrder = async () => {
    setCheckoutLoading(true);
    let orderSubmitted = false;
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
          notes: batchOrderForm.notes.trim() || item.notes,
          is_estimate: item.is_estimate,
        })
      );

      if (orderItems.some((item) => !areOrderItemDimensionsValid(item.dimensions))) {
        setCheckoutError("Please provide valid product dimensions before submitting your order.");
        return;
      }

      const response = await createOrder({
        items: orderItems,
        shipping_address: normalizeAddress(batchOrderForm.shipping_address || buildFullAddress(user)),
        customer_phone: batchOrderForm.phone.trim(),
      });

      setCheckoutMessage(`Order placed successfully. Tracking ID: ${response.order.tracking}`);
      setCartItems((prev) => prev.filter((item) => !item.selected));
      addCreatedOrderToMyOrders(response.order);
      setShowBatchSuccessModal(true);
      setShowBatchOrderModal(false);
      setShowBatchOrderConfirmModal(false);
      orderSubmitted = true;
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

  const getCartItemMeasurementDetails = (item) => {
    const width = Number(item.width ?? item.dimensions?.width ?? 0);
    const height = Number(item.height ?? item.dimensions?.height ?? 0);
    const measurementUnit = item.measurementUnit || item.measurement_unit || item.dimensions?.unit || item.unit || "in";
    const rawArea = Number(item.area ?? item.dimensions?.area ?? 0);
    const estimatedPrice = Number(item.estimated_price || 0);
    const quantity = Number(item.quantity || 1);

    if (!width || !height) return null;

    const areaInSqFt =
      rawArea > 0
        ? rawArea
        : measurementUnit === "in"
          ? (width * height * quantity) / 144
          : measurementUnit === "ft"
            ? width * height * quantity
            : measurementUnit === "cm"
              ? (width * height * quantity) / 929.0304
              : measurementUnit === "m"
                ? (width * height * quantity) * 10.7639
                : width * height * quantity;

    const ratePerSqFt =
      Number(item.unit_price) > 0
        ? Number(item.unit_price)
        : areaInSqFt > 0
          ? estimatedPrice / areaInSqFt
          : 0;

    const unitSymbol = measurementUnit === "in" ? '"' : measurementUnit === "ft" ? "'" : measurementUnit === "cm" ? "cm" : measurementUnit === "m" ? "m" : "";

    return {
      dimensions: `${width}${unitSymbol} x ${height}${unitSymbol}`,
      area: `${areaInSqFt > 0 ? areaInSqFt.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "0"} sq.ft`,
      unitRate: `₱${Number(ratePerSqFt || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}/sq.ft`,
    };
  };

  const getProductImage = (product) => {
    let candidate = null;
    if (product?.image_url) candidate = product.image_url;
    if (!candidate && product?.image) candidate = product.image;
    if (!candidate && product?.images && typeof product.images === "object") {
      const images = Object.values(product.images).flat().filter(Boolean);
      if (images.length > 0) candidate = images[0];
    }
    return ensureAbsoluteUrl(candidate);
  };

  function getOrderItemImage(item) {
    if (!item) return PRODUCT_IMAGE_PLACEHOLDER;
    let candidate = null;
    if (item.image_url) candidate = item.image_url;
    if (!candidate && item.image) candidate = item.image;
    const product = item.product_id || item.product;
    if (!candidate && product) candidate = getProductImage(product);
    return ensureAbsoluteUrl(candidate);
  }

  function formatCurrency(amount) {
    return `₱${Number(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function getItemPriceValue(item) {
    if (!item) return 0;

    const quantity = Number(item.quantity || item.qty || 1) || 1;
    const normalizedArea = Number(item.area || 0) || 0;
    const itemHeight = Number(item.height ?? item.dimensions?.height ?? 0) || 0;
    const itemWidth = Number(item.width ?? item.dimensions?.width ?? 0) || 0;
    const derivedArea = normalizedArea || (itemWidth && itemHeight ? itemWidth * itemHeight / 144 : 0);
    const productRate = Number(
      item.price_per_sqft ??
      item.product?.price_per_sqft ??
      item.product_id?.price_per_sqft ??
      0
    ) || 0;
    const productUnitPrice = Number(
      item.unit_price ??
      item.price ??
      item.amount ??
      item.product?.unit_price ??
      item.product_id?.unit_price ??
      0
    ) || 0;

    if (item.is_estimate && Number(item.estimated_price || item.manual_estimated_total || 0) > 0) {
      return Number(item.estimated_price || item.manual_estimated_total || 0);
    }

    if (Number(item.amount || item.total_price || 0) > 0) {
      return Number(item.amount || item.total_price || 0);
    }

    if (productRate > 0 && derivedArea > 0) {
      return productRate * derivedArea;
    }

    if (productUnitPrice > 0) {
      return productUnitPrice * quantity;
    }

    if (Number(item.unit_price || 0) > 0) {
      return Number(item.unit_price || 0) * quantity;
    }

    return 0;
  }

  function getOrderTotalValue(order) {
    if (!order) return 0;

    const orderItems = Array.isArray(order.items) ? order.items : [];
    if (orderItems.length > 0) {
      return orderItems.reduce((sum, item) => sum + getItemPriceValue(item), 0);
    }

    return Number(order.total_amount || 0);
  };

  const getConfirmationItemDimensionText = (item) => {
    const dimensions = item?.dimensions || {};
    const width = Number(dimensions.width ?? item?.width ?? 0);
    const height = Number(dimensions.height ?? item?.height ?? 0);
    const quantity = Math.max(1, Number(item?.quantity) || 1);
    const unit = dimensions.unit || item?.measurementUnit || item?.measurement_unit || "in";

    if (!(width > 0 && height > 0)) return `Quantity: ${quantity}`;

    const areaInSqFt = Number(item?.area) > 0
      ? Number(item.area)
      : unit === "in"
        ? (width * height * quantity) / 144
        : unit === "ft"
          ? width * height * quantity
          : unit === "cm"
            ? (width * height * quantity) / 929.0304
            : unit === "m"
              ? width * height * quantity * 10.7639
              : width * height * quantity;
    const unitSymbol = unit === "in" ? '"' : unit;

    return `Size: ${width}${unitSymbol} x ${height}${unitSymbol} (${areaInSqFt.toLocaleString(undefined, { maximumFractionDigits: 2 })} sq ft)`;
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

    const accepted = order.acceptedByCustomer === true || String(order.contract_status || "").toLowerCase() === "accepted" || order.status === "contract_accepted";

    return {
      orderNumber: order.tracking || order._id || "N/A",
      contractDate: formatDateToMMMDDYYYY(order.updatedAt || order.createdAt) || "N/A",
      orderDate: formatDateToMMMDDYYYY(order.createdAt) || "N/A",
      status: order.status?.replace(/_/g, " ") || "Pending",
      orderStatus: order.status || "",
      rawContractStatus: order.contract_status || "",
      contractStatus,
      customerName: order.customer?.first_name || order.customer_name || "Customer",
      customerEmail: order.customer?.email || order.customer_email || "N/A",
      customerPhone: order.customer?.phone || order.customer_phone || "N/A",
      projectLocation: order.shipping_address || "N/A",
      siteInspectionDate: formatDateToMMMDDYYYY(order.inspection_date) || "TBD",
      paymentTerms: order.payment_terms || "Standard payment terms apply.",
      contractTerms: order.contract_terms || "",
      subtotal: amount,
      totalProjectCost: amount,
      downPayment,
      items,
      accepted,
      acceptanceMethod: accepted ? order.acceptanceMethod || (order.acceptance_method === "walk_in_signed_contract" ? "Walk-in Signed Contract" : "Online Acceptance") : null,
      acceptanceDate: accepted && (order.acceptedAt || order.contract_signed_date || order.updatedAt)
        ? formatDateTimeToMMMDDYYYY(order.acceptedAt || order.contract_signed_date || order.updatedAt)
        : null,
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

  const contractPreviewData = contractPreviewOrder
    ? buildContractDataFromOrder(contractPreviewOrder)
    : null;
  const isContractAccepted = contractPreviewOrder?.acceptedByCustomer === true || contractPreviewOrder?.status === "contract_accepted"
    || String(contractPreviewOrder?.contract_status || "").toLowerCase() === "accepted";

  const createContractExportClone = () => {
    const element = document.getElementById("contract-content");
    if (!element) return null;

    const clone = element.cloneNode(true);
    clone.style.width = `${element.scrollWidth}px`;
    clone.style.height = "auto";
    clone.style.maxHeight = "none";
    clone.style.overflow = "visible";
    clone.style.position = "relative";

    const wrapper = document.createElement("div");
    wrapper.style.position = "fixed";
    wrapper.style.left = "-9999px";
    wrapper.style.top = "0";
    wrapper.style.opacity = "0";
    wrapper.style.pointerEvents = "none";
    wrapper.appendChild(clone);
    document.body.appendChild(wrapper);

    return { wrapper, clone };
  };

  const downloadAcceptedContractPNG = async () => {
    const exportClone = createContractExportClone();
    if (!exportClone) {
      toast.error("Unable to locate the accepted contract.");
      return;
    }

    try {
      await new Promise((resolve) => setTimeout(resolve, 100));
      const dataUrl = await toPng(exportClone.clone, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
      });
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `accepted-contract-${contractPreviewOrder?.tracking || contractPreviewOrder?._id || "export"}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Failed to export accepted contract PNG", error);
      toast.error("Failed to save the accepted contract as PNG.");
    } finally {
      exportClone.wrapper.remove();
    }
  };

  const printAcceptedContract = async () => {
    const exportClone = createContractExportClone();
    if (!exportClone) {
      toast.error("Unable to locate the accepted contract.");
      return;
    }

    try {
      await new Promise((resolve) => setTimeout(resolve, 100));
      const dataUrl = await toPng(exportClone.clone, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
      });
      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        toast.error("Please allow popups to print the accepted contract.");
        return;
      }
      printWindow.document.write(`<!doctype html><html><head><title>Accepted Contract</title><style>html,body{margin:0;padding:0;background:#fff;}body{padding:12mm;}img{width:100%;height:auto;display:block;}@media print{body{padding:0;}}</style></head><body><img src="${dataUrl}" alt="Accepted contract" /></body></html>`);
      printWindow.document.close();
      printWindow.focus();
      printWindow.onload = () => printWindow.print();
    } catch (error) {
      console.error("Failed to print accepted contract", error);
      toast.error("Failed to print the accepted contract.");
    } finally {
      exportClone.wrapper.remove();
    }
  };

  const getOrderStatusLabel = (status) => {
    switch (status) {
      case "order_submitted": return "Order Submitted";
      case "admin_review": return "Admin Review";
      case "site_inspection": return "Site Inspection";
      case "contract_sent": return "Contract Sent";
      case "contract_accepted": return "Contract Accepted";
      case "contract_declined": return "Contract Declined";
      case "Cutting": return "Cutting";
      case "Fabrication": return "Fabrication";
      case "Installation": return "Installation";
      case "completed": return "Completed";
      case "cancelled": return "Cancelled";
      default: return status?.replace(/_/g, " ") || "Unknown";
    }
  };

  const getContractStatusLabel = (order) => {
    const contractStatus = String(order?.contract_status || "").toLowerCase();
    const orderStatus = String(order?.status || "").toLowerCase();

    if (contractStatus === "sent" || orderStatus === "contract_sent") return "Needs Your Response";
    if (contractStatus === "accepted" || orderStatus === "contract_accepted") return "Accepted";
    if (contractStatus === "declined" || orderStatus === "contract_declined") return "Declined";
    return contractStatus.replace(/_/g, " ") || orderStatus.replace(/_/g, " ") || "Unknown";
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
      { key: "site_inspection", label: "Site Inspection" },
      { key: "contract_sent", label: "Contract Sent" },
      { key: "contract_accepted", label: "Contract Accepted" },
      { key: "fabrication", label: "Fabrication" },
      { key: "installation", label: "Installation" },
      { key: "completed", label: "Completed" },
    ];

    const statusKey = String(order?.status || "").trim();
    const normalizedStatus = statusKey.toLowerCase();
    const statusStepMap = {
      order_submitted: 0,
      admin_review: 0,
      site_inspection: 1,
      contract_sent: 2,
      contract_accepted: 3,
      processing: 4,
      fabrication: 4,
      installation: 5,
      completed: 6,
    };
    const activeIndex = statusStepMap[normalizedStatus] ?? 0;

    if (statusKey === "cancelled") {
      return steps.map((step) => ({
        ...step,
        done: false,
        active: false,
        future: true,
      }));
    }

    return steps.map((step, index) => ({
      ...step,
      done: index < activeIndex,
      active: index === activeIndex && activeIndex < steps.length - 1,
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
    if (orderFilter === "completed") return order.status === "completed" && (hasOrderReview(order) || !isOrderCompletedAndReviewable(order));
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
  const orderReviewMeasurementText = reviewOrderMode === "orderNow"
    ? (() => {
        if (!orderNowProduct) return `Qty: ${Math.max(1, Number(orderNowQuantity) || 1)}`;
        const defaultDims = getProductDefaultDimensions(orderNowProduct, Math.max(1, Number(orderNowQuantity) || 1));
        if (!defaultDims || Number(defaultDims.width) <= 0 || Number(defaultDims.height) <= 0) {
          return `Qty: ${Math.max(1, Number(orderNowQuantity) || 1)}`;
        }

        const quantity = Math.max(1, Number(orderNowQuantity) || 1);
        const unit = defaultDims.unit || "in";
        const area = Number(defaultDims.area) > 0
          ? Number(defaultDims.area)
          : unit === "in"
            ? (Number(defaultDims.width) * Number(defaultDims.height) * quantity) / 144
            : unit === "ft"
              ? Number(defaultDims.width) * Number(defaultDims.height) * quantity
              : unit === "cm"
                ? (Number(defaultDims.width) * Number(defaultDims.height) * quantity) / 929.0304
                : unit === "m"
                  ? Number(defaultDims.width) * Number(defaultDims.height) * quantity * 10.7639
                  : Number(defaultDims.width) * Number(defaultDims.height) * quantity;

        return getConfirmationItemDimensionText({
          width: Number(defaultDims.width),
          height: Number(defaultDims.height),
          quantity,
          measurementUnit: unit,
          area,
        });
      })()
    : getConfirmationItemDimensionText({
        width: estimateWidth,
        height: estimateHeight,
        quantity: estimateQuantity,
        measurementUnit: estimateForm.unit,
        area: estimateArea,
      });
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
  const orderNowDimensions = orderNowProduct
    ? getProductDefaultDimensions(orderNowProduct, confirmQuantity)
    : null;
  const confirmWidth = deliveryConfirmMode === "orderNow"
    ? orderNowDimensions?.width
      ? `${orderNowDimensions.width} ${orderNowDimensions.unit || "in"}`
      : "—"
    : estimateWidth ? `${estimateWidth} ${selectedUnitLabel}` : "—";
  const confirmHeight = deliveryConfirmMode === "orderNow"
    ? orderNowDimensions?.height
      ? `${orderNowDimensions.height} ${orderNowDimensions.unit || "in"}`
      : "—"
    : estimateHeight ? `${estimateHeight} ${selectedUnitLabel}` : "—";
  const confirmPrice = deliveryConfirmMode === "orderNow" ? orderNowSubtotal : estimateTotalCost;
  const confirmSubtotal = deliveryConfirmMode === "orderNow" ? orderNowSubtotal : estimateSubtotal;
  const confirmAdditionalCharges = deliveryConfirmMode === "orderNow" ? orderNowAdditionalCharges : estimateCustomizationFee;
  const confirmInstallationFee = deliveryConfirmMode === "orderNow" ? orderNowInstallationFee : estimateInstallationFee;
  const confirmGrandTotal = deliveryConfirmMode === "orderNow" ? orderNowGrandTotal : estimateGrandTotal;
  const isDeliveryConfirmValid = Boolean(
    deliveryConfirmForm.phone.trim() &&
    deliveryConfirmForm.street_address.trim()
  );

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
    <div className={`admin-theme-shell relative flex min-h-screen flex-col overflow-x-clip ${darkMode
      ? "admin-theme-dark"
      : "admin-theme-light"
    }`}>
      <div className="admin-shell-drawing" aria-hidden="true">
        <div className="admin-shell-circle admin-shell-circle-top" />
        <div className="admin-shell-circle admin-shell-circle-top-small" />
        <div className="admin-shell-circle admin-shell-circle-middle" />
        <div className="admin-shell-circle admin-shell-circle-middle-small" />
        <div className="admin-shell-circle admin-shell-circle-bottom" />
        <div className="admin-shell-circle admin-shell-circle-bottom-small" />
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
      <div className={`${darkMode ? "bg-slate-900/90 border-b border-slate-700 shadow-lg shadow-slate-950/20" : "bg-white/90 border-b border-slate-200 shadow-sm"} sticky top-0 z-50`}>
        <div className="w-full px-4 py-2.5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <button
            type="button"
            onClick={() => setActiveTab("home")}
            className="flex items-center gap-3 px-1.5 py-0.5 text-left transition duration-200"
            aria-label="Go to ACGC Services home"
          >
            <img src={logo} alt="ACGC Aluminum Services" className="w-14 h-14 object-contain" />
            <div>
              <h1 className="text-xl font-bold text-red-500">
                ACGC Services
              </h1>
              <p className={`text-sm font-bold ${darkMode ? "text-slate-300" : "text-slate-700"}`}>
                Aluminum & Glass Services
              </p>
            </div>
          </button>

          <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
            <button
              onClick={() => setActiveTab("cart")}
              className={`order-1 relative p-2.5 text-sm font-semibold transition ${
                activeTab === "cart" || cartQuantity > 0
                  ? darkMode
                    ? "text-white"
                    : "text-slate-700"
                  : darkMode
                    ? "text-slate-200 hover:text-white"
                    : "text-slate-700 hover:text-slate-900"
              }`}
              aria-label="Cart"
              title="Cart"
            >
              <ShoppingCart size={42} strokeWidth={2.2} />
              {cartQuantity > 0 && (
                <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 animate-pulse items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white shadow-md shadow-red-500/40">
                  {cartQuantity}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("products")}
              className={`order-3 rounded-full px-4 py-2 text-base font-semibold transition ${
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
              className={`order-4 rounded-full px-4 py-2 text-base font-semibold transition ${
                activeTab === "orders"
                  ? darkMode
                    ? "border border-slate-700 bg-slate-800 text-white shadow-sm"
                    : "border border-slate-200 bg-slate-100 text-red-600 shadow-sm"
                  : darkMode
                    ? "text-slate-200 hover:bg-slate-800"
                    : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              Your Orders
            </button>
            <button
              onClick={() => setActiveTab("about")}
              className={`order-5 rounded-full px-4 py-2 text-base font-semibold transition ${
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
            <div className="relative order-2">
              <button
                onClick={() => setNotificationsOpen((s) => !s)}
                className={`relative p-2.5 text-sm font-semibold transition ${
                  darkMode ? "text-slate-200" : "text-slate-700"
                }`}
                aria-haspopup="menu"
                aria-expanded={notificationsOpen}
                aria-label="Notifications"
                title="Notifications"
              >
                <Bell size={26} strokeWidth={2.2} />
                {unreadNotificationCount > 0 && (
                  <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 animate-pulse items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white shadow-md shadow-red-500/40">
                    {unreadNotificationCount}
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
                    <div className="flex items-center gap-2">
                      {unreadNotificationCount > 0 && <span className="rounded-full bg-red-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-red-600">{unreadNotificationCount} new</span>}
                      <button
                        type="button"
                        onClick={markAllCustomerNotificationsRead}
                        disabled={unreadNotificationCount === 0}
                        className={`inline-flex items-center gap-1 text-xs font-semibold transition ${unreadNotificationCount === 0 ? "cursor-not-allowed text-slate-400" : darkMode ? "text-red-300 hover:text-white" : "text-red-600 hover:text-red-700"}`}
                      >
                        <CheckCheck size={14} />
                        Mark all as read
                      </button>
                    </div>
                  </div>

                  <div className={`flex gap-1 border-b px-3 py-2 ${darkMode ? "border-slate-700" : "border-slate-100"}`}>
                    {[
                      ["all", "All", orders.length],
                      ["unread", "Unread", unreadNotificationCount],
                      ["read", "Read", readNotificationCount],
                    ].map(([filter, label, count]) => (
                      <button
                        key={filter}
                        type="button"
                        onClick={() => setNotificationFilter(filter)}
                        className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition ${
                          notificationFilter === filter
                            ? darkMode
                              ? "bg-slate-950 text-white"
                              : "bg-slate-100 text-slate-950"
                            : darkMode
                              ? "text-slate-300 hover:bg-slate-700"
                              : "text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {label} ({count})
                      </button>
                    ))}
                  </div>

                  {ordersLoading ? (
                    <div className={`px-4 py-8 text-center text-sm ${darkMode ? "text-slate-300" : "text-slate-500"}`}>Loading your updates...</div>
                  ) : filteredNotifications.length === 0 ? (
                    <div className={`px-4 py-6 text-center ${darkMode ? "text-slate-300" : "text-gray-600"}`}>
                      <Bell size={22} className="mx-auto mb-2 text-slate-400" />
                      <p>{notificationFilter === "all" ? "No project updates yet" : `No ${notificationFilter} notifications`}</p>
                    </div>
                  ) : (
                    <div className={darkMode ? "max-h-96 divide-y divide-slate-700 overflow-y-auto" : "max-h-96 divide-y divide-slate-200 overflow-y-auto"}>
                      {[...filteredNotifications]
                        .sort((a, b) => new Date(b.notificationDate || 0) - new Date(a.notificationDate || 0))
                        .slice(0, 5)
                        .map((order) => {
                          const product = order.items?.[0] || {};
                          const status = String(order.status || "").toLowerCase();
                          const contractStatus = String(order.contract_status || "").toLowerCase();
                          const isPaymentNotification = order.notificationType === "payment";
                          const isContractReady =
                            status === "contract_sent" ||
                            (status === "site_inspection" && contractStatus === "sent") ||
                            contractStatus === "sent";
                          const notificationDetails = () => {
                            if (isPaymentNotification) {
                              return {
                                title: "Payment proof submitted",
                                message: `Your payment proof for ${formatCurrency(order.payment_proof_amount)} has been sent for confirmation.`,
                                color: "text-emerald-600",
                              };
                            }
                            if (contractStatus === "accepted" || status === "contract_accepted") {
                              return { title: "Contract accepted", message: "Your contract has been accepted. Work can now move forward.", color: "text-emerald-600" };
                            }
                            if (contractStatus === "declined" || status === "contract_declined" || status === "cancelled") {
                              return { title: "Order update", message: "Your contract or order was declined or cancelled.", color: "text-red-600" };
                            }
                            if (isContractReady) {
                              return { title: "Contract ready", message: "Review and respond to your project contract.", color: "text-blue-600" };
                            }

                            switch (status) {
                              case "order_submitted":
                                return { title: "Order submitted", message: "Your order is waiting for admin review.", color: "text-blue-600" };
                              case "admin_review":
                                return { title: "Order under review", message: "Our team is reviewing your project request.", color: "text-amber-600" };
                              case "site_inspection":
                                return { title: "Site inspection", message: "Your project is ready for site inspection.", color: "text-amber-600" };
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
                          const hasContractBeenSent =
                            status === "contract_sent" ||
                            contractStatus === "sent" ||
                            (status === "site_inspection" && contractStatus === "sent");
                          const isContractNotification = !isPaymentNotification && (
                            hasContractBeenSent ||
                            ["contract_accepted"].includes(status) ||
                            ["accepted"].includes(contractStatus)
                          );

                          return (
                            <button
                              key={order.notificationId}
                              onClick={() => {
                                markCustomerNotificationRead(order.notificationId);
                                if (isPaymentNotification) {
                                  const orderId = order._id || order.id || order.tracking;
                                  setOrderFilter("all");
                                  setOrderPage(1);
                                  setSelectedOrderForModal(null);
                                  setExpandedOrderId(orderId);
                                } else if (isContractNotification && canShowContractForOrder(order)) {
                                  openContractModal(order);
                                  setActiveTab("contracts");
                                } else {
                                  setSelectedOrderForModal(order);
                                  setActiveTab("orders");
                                }
                                setNotificationsOpen(false);
                                setActiveTab(isPaymentNotification ? "orders" : activeTab);
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
            <div className="relative order-6">
              <button
                onClick={() => setMenuOpen((s) => !s)}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-base font-semibold transition ${
                  activeTab === "profile"
                    ? "bg-red-600 text-white shadow-sm"
                    : darkMode
                      ? "text-slate-200 hover:bg-slate-800"
                      : "text-slate-700 hover:bg-slate-100"
                }`}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                <User size={24} />
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
                    <span>My Contracts</span>
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

      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col p-6">
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
                              title="Place order"
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
                          <div className={`rounded-3xl border p-5 ${darkMode ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-slate-50"}`}>
                            <h4 className={`text-lg font-bold ${darkMode ? "text-white" : "text-slate-900"}`}>About this product</h4>
                            <p className={`mt-2 leading-relaxed ${darkMode ? "text-slate-300" : "text-slate-600"}`}>
                              {selectedProduct.description || "No description available."}
                            </p>
                          </div>
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
                          Place Order
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
                          disabled={
                            orderRequestLoading ||
                            !canRequestOrders ||
                            !estimateForm.width ||
                            !estimateForm.height ||
                            Number(estimateForm.width) <= 0 ||
                            Number(estimateForm.height) <= 0
                          }
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
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
                <div className={`order-flow-modal w-full max-w-5xl overflow-hidden rounded-3xl shadow-2xl max-h-[95vh] flex flex-col ${darkMode ? "order-flow-modal-dark bg-slate-900" : "bg-white"}`}>
                  <div className={`flex-shrink-0 border-b px-6 py-4 ${darkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"}`}>
                    <div className="flex items-center justify-between gap-4">
                      <button
                        type="button"
                        onClick={handleCancelDeliveryConfirm}
                        className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold transition ${darkMode ? "text-slate-200 hover:bg-slate-800" : "text-slate-700 hover:bg-slate-100"}`}
                      >
                        <ArrowLeft size={15} />
                        Back to Product
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelDeliveryConfirm}
                        className={`rounded-full border p-2 transition ${darkMode ? "border-slate-600 text-slate-300 hover:bg-slate-800" : "border-slate-200 text-slate-500 hover:bg-slate-100"}`}
                        aria-label="Close place order request"
                      >
                        <X size={18} />
                      </button>
                    </div>
                    <div className="mt-1">
                      <h3 className={`text-2xl font-bold ${darkMode ? "text-white" : "text-slate-900"}`}>Place Order Request</h3>
                      <p className={`mt-1 text-sm ${darkMode ? "text-slate-300" : "text-slate-600"}`}>Review your details and submit your request.</p>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto">
                    <div className={`grid gap-6 lg:grid-cols-[1.2fr_0.9fr] p-6 min-h-0 ${darkMode ? "bg-slate-950" : "bg-slate-50"}`}>
                      <div className={`space-y-5 rounded-3xl border p-6 shadow-sm ${darkMode ? "border-slate-700 bg-slate-900" : "border-gray-200 bg-white"}`}>
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <h4 className={`text-lg font-semibold ${darkMode ? "text-white" : "text-gray-900"}`}>Customer Information</h4>
                            <p className={`text-sm mt-1 ${darkMode ? "text-slate-400" : "text-gray-500"}`}>Review your details before submitting your request.</p>
                          </div>
                          {!isDeliveryConfirmValid && (
                            <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">Incomplete required fields</span>
                          )}
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                          <div>
                            <label className={`text-xs font-semibold uppercase tracking-[0.2em] ${darkMode ? "text-slate-400" : "text-gray-500"}`}>Full Name</label>
                            <p className={`mt-2 ${darkMode ? "text-white" : "text-gray-900"}`}>{`${profileForm.first_name || user?.first_name || ""} ${profileForm.last_name || user?.last_name || ""}`.trim() || "N/A"}</p>
                          </div>
                          <div>
                            <label className={`text-xs font-semibold uppercase tracking-[0.2em] ${darkMode ? "text-slate-400" : "text-gray-500"}`}>Email Address</label>
                            <p className={`mt-2 ${darkMode ? "text-white" : "text-gray-900"}`}>{profileForm.email || user?.email || "N/A"}</p>
                          </div>
                        </div>

                        <div className={`rounded-3xl border p-4 ${darkMode ? "border-slate-700 bg-slate-800" : "border-gray-200 bg-gray-50"}`}>
                          <h4 className={`text-sm font-semibold uppercase tracking-[0.2em] ${darkMode ? "text-slate-400" : "text-gray-500"}`}>Contact &amp; Installation Details</h4>
                          <div className="mt-4 grid gap-4 sm:grid-cols-2">
                            <div className="sm:col-span-2">
                              <label className={`text-xs font-semibold uppercase tracking-[0.2em] ${darkMode ? "text-slate-400" : "text-gray-500"}`}>Contact Number <span className="text-red-600">*</span></label>
                              <input
                                name="phone"
                                type="text"
                                value={deliveryConfirmForm.phone}
                                onChange={handleDeliveryConfirmChange}
                                className={`mt-2 w-full rounded-2xl border px-4 py-3 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100 ${darkMode ? "border-slate-700 bg-slate-900 text-white" : "border-gray-300 bg-white text-gray-900"}`}
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <label className={`text-xs font-semibold uppercase tracking-[0.2em] ${darkMode ? "text-slate-400" : "text-gray-500"}`}>Street Address <span className="text-red-600">*</span></label>
                              <input
                                name="street_address"
                                type="text"
                                value={deliveryConfirmForm.street_address}
                                onChange={handleDeliveryConfirmChange}
                                className={`mt-2 w-full rounded-2xl border px-4 py-3 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100 ${darkMode ? "border-slate-700 bg-slate-900 text-white" : "border-gray-300 bg-white text-gray-900"}`}
                              />
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className={`text-xs font-semibold uppercase tracking-[0.2em] ${darkMode ? "text-slate-400" : "text-gray-500"}`}>Special Instructions / Engineering Notes (Optional)</label>
                          <textarea
                            value={deliveryConfirmNotes}
                            onChange={(event) => setDeliveryConfirmNotes(event.target.value)}
                            placeholder="Add notes about structure elevations, framing colors, glass thickness preferences, etc."
                            className={`mt-2 min-h-[92px] w-full resize-none rounded-2xl border px-4 py-3 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100 ${darkMode ? "border-slate-700 bg-slate-900 text-white placeholder:text-slate-500" : "border-gray-300 bg-white text-gray-900"}`}
                          />
                        </div>

                        {deliveryConfirmError && (
                          <div className={`rounded-2xl border p-4 text-sm ${darkMode ? "border-red-800 bg-red-950/40 text-red-200" : "border-red-300 bg-red-50 text-red-700"}`}>
                            Please complete your delivery information before proceeding.
                          </div>
                        )}
                      </div>

                      <div className={`rounded-3xl border p-6 shadow-sm ${darkMode ? "border-slate-700 bg-slate-900" : "border-gray-200 bg-white"}`}>
                        <div className="flex items-start gap-4">
                          <div className="h-24 w-24 overflow-hidden rounded-3xl border border-gray-200 bg-gray-100">
                            <img
                              src={getProductImage(confirmProduct)}
                              alt={confirmProduct?.name || "Product preview"}
                              className="h-full w-full object-cover"
                            />
                          </div>
                          <div className="flex-1">
                            <p className={`text-sm uppercase tracking-[0.2em] ${darkMode ? "text-slate-400" : "text-gray-500"}`}>Order Summary</p>
                            <h4 className={`text-xl font-semibold mt-2 ${darkMode ? "text-white" : "text-gray-900"}`}>{confirmProduct?.name || "Product details"}</h4>
                            <p className={`mt-1 text-sm ${darkMode ? "text-slate-400" : "text-gray-600"}`}>{confirmProduct?.product_type || confirmProduct?.category || "Product"}</p>
                          </div>
                        </div>

                        <div className="mt-6 space-y-4">
                          <div className={`rounded-3xl p-4 border ${darkMode ? "border-slate-700 bg-slate-800" : "bg-slate-50 border-slate-200"}`}>
                            <p className={`text-sm font-semibold mb-3 ${darkMode ? "text-slate-200" : "text-gray-700"}`}>Product Details</p>
                            <div className={`grid gap-3 text-sm sm:grid-cols-2 ${darkMode ? "text-slate-300" : "text-gray-700"}`}>
                              <div>
                                <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Quantity</p>
                                <p className={`mt-2 font-semibold ${darkMode ? "text-white" : "text-gray-900"}`}>{confirmQuantity}</p>
                              </div>
                              <div>
                                <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Unit Price</p>
                                <p className={`mt-2 font-semibold ${darkMode ? "text-white" : "text-gray-900"}`}>{formatCurrency(deliveryConfirmMode === "orderNow" ? Number(orderNowProduct?.unit_price || orderNowProduct?.price_per_sqft || 0) : estimateUnitRate)}</p>
                              </div>
                              <div>
                                <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Width</p>
                                <p className={`mt-2 font-semibold ${darkMode ? "text-white" : "text-gray-900"}`}>{confirmWidth}</p>
                              </div>
                              <div>
                                <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Height</p>
                                <p className={`mt-2 font-semibold ${darkMode ? "text-white" : "text-gray-900"}`}>{confirmHeight}</p>
                              </div>
                              <div className="sm:col-span-2">
                                <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Color / Variant</p>
                                <p className={`mt-2 font-semibold ${darkMode ? "text-white" : "text-gray-900"}`}>{confirmProduct?.variant || confirmProduct?.color || "Standard"}</p>
                              </div>
                            </div>
                          </div>

                          <div className={`rounded-3xl p-4 border ${darkMode ? "border-slate-700 bg-slate-800" : "bg-slate-50 border-slate-200"}`}>
                            <p className={`text-sm font-semibold mb-3 ${darkMode ? "text-slate-200" : "text-gray-700"}`}>Pricing Breakdown</p>
                            <div className={`space-y-3 text-sm ${darkMode ? "text-slate-300" : "text-gray-700"}`}>
                              <div className="flex items-center justify-between">
                                <span>Subtotal</span>
                                <span className={`font-semibold ${darkMode ? "text-white" : "text-gray-900"}`}>{formatCurrency(confirmSubtotal)}</span>
                              </div>
                              
                              <div className={`border-t pt-3 flex items-center justify-between text-base font-semibold ${darkMode ? "border-slate-700 text-white" : "border-gray-200 text-gray-900"}`}>
                                <span>Total</span>
                                <span>{formatCurrency(confirmGrandTotal)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className={`sticky bottom-0 z-10 flex justify-end gap-3 border-t px-6 py-4 ${darkMode ? "border-slate-700 bg-slate-900" : "border-gray-200 bg-gray-50"}`}>
                    <button
                      type="button"
                      onClick={handleCancelDeliveryConfirm}
                      className={`rounded-xl border px-5 py-3 text-sm font-semibold transition ${darkMode ? "border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700" : "border-gray-300 bg-white text-gray-700 hover:bg-gray-100"}`}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmAndContinue}
                      disabled={!isDeliveryConfirmValid || orderRequestLoading}
                      className="rounded-xl bg-gradient-to-r from-red-600 to-red-700 px-5 py-3 text-sm font-semibold text-white hover:from-red-700 hover:to-red-800 transition shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      Submit Order Request
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
                      <h3 className="text-xl font-bold">Place Order</h3>
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

            {showBatchOrderModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
                <div className={`w-full max-w-4xl overflow-hidden rounded-[20px] shadow-2xl ${darkMode ? "bg-slate-900" : "bg-white"}`}>
                  <div className={`flex items-center justify-between border-b px-6 py-4 ${darkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"}`}>
                    <button
                      type="button"
                      onClick={closeBatchOrderModal}
                      className={`inline-flex items-center gap-2 text-sm font-semibold ${darkMode ? "text-slate-200" : "text-slate-700"}`}
                    >
                      <ArrowLeft size={16} />
                      Back to Cart
                    </button>
                    <button
                      type="button"
                      onClick={closeBatchOrderModal}
                      className={`rounded-full border p-2 transition ${darkMode ? "border-slate-600 text-slate-300 hover:bg-slate-800" : "border-slate-200 text-slate-500 hover:bg-slate-100"}`}
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <div className={`px-6 pb-6 pt-5 ${darkMode ? "bg-slate-900" : "bg-white"}`}>
                    <h3 className={`text-3xl font-bold ${darkMode ? "text-white" : "text-slate-900"}`}>
                      {selectedItemCount === 1 ? "Place Order Request" : "Place Batch Order Request"}
                    </h3>
                    <p className={`mt-2 text-sm ${darkMode ? "text-slate-300" : "text-slate-600"}`}>
                      {selectedItemCount === 1
                        ? "Review your contact data and selected item before submitting your request."
                        : "Review your contact data and selected items to compile requests."}
                    </p>

                    <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.9fr]">
                      <div className="flex flex-col gap-5">
                        <div className={`rounded-2xl border p-4 ${darkMode ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-slate-50"}`}>
                          <div className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.2em] text-red-600">
                            <User size={16} />
                            Customer Information
                          </div>

                          <div className="space-y-4">
                            <div>
                              <label className={`mb-2 block text-sm font-medium ${darkMode ? "text-slate-300" : "text-slate-600"}`}>Full Name</label>
                              <input
                                value={`${profileForm.first_name || user?.first_name || ""} ${profileForm.last_name || user?.last_name || ""}`.trim() || ""}
                                readOnly
                                className={`w-full cursor-not-allowed rounded-xl border px-3 py-3 outline-none ${darkMode ? "border-slate-700 bg-slate-900 text-slate-400" : "border-slate-200 bg-slate-100 text-slate-500"}`}
                              />
                            </div>
                            <div>
                              <label className={`mb-2 block text-sm font-medium ${darkMode ? "text-slate-300" : "text-slate-600"}`}>Email Address</label>
                              <input
                                value={profileForm.email || user?.email || ""}
                                readOnly
                                className={`w-full cursor-not-allowed rounded-xl border px-3 py-3 outline-none ${darkMode ? "border-slate-700 bg-slate-900 text-slate-400" : "border-slate-200 bg-slate-100 text-slate-500"}`}
                              />
                            </div>
                            <div>
                              <label className={`mb-2 block text-sm font-medium ${darkMode ? "text-slate-300" : "text-slate-600"}`}>Phone Number *</label>
                              <input
                                name="phone"
                                type="tel"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={batchOrderForm.phone}
                                onChange={(event) => setBatchOrderForm((current) => ({ ...current, phone: event.target.value.replace(/\D/g, "") }))}
                                className={`w-full rounded-xl border px-3 py-3 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100 ${darkMode ? "border-slate-700 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-800"}`}
                              />
                            </div>
                            <div>
                              <label className={`mb-2 block text-sm font-medium ${darkMode ? "text-slate-300" : "text-slate-600"}`}>Complete Installation Address *</label>
                              <input
                                name="shipping_address"
                                value={batchOrderForm.shipping_address}
                                onChange={(event) => setBatchOrderForm((current) => ({ ...current, shipping_address: event.target.value }))}
                                className={`w-full rounded-xl border px-3 py-3 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100 ${darkMode ? "border-slate-700 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-800"}`}
                              />
                            </div>
                            <div>
                              <label className={`mb-2 block text-sm font-medium ${darkMode ? "text-slate-300" : "text-slate-600"}`}>Special Instructions / Engineering Notes (Optional)</label>
                              <textarea
                                name="notes"
                                value={batchOrderForm.notes}
                                onChange={(event) => setBatchOrderForm((current) => ({ ...current, notes: event.target.value }))}
                                className={`min-h-[100px] w-full resize-none rounded-xl border px-3 py-3 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100 ${darkMode ? "border-slate-700 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-800"}`}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-5">
                        <div className={`rounded-2xl border p-4 ${darkMode ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-slate-50"}`}>
                          <div className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.2em] text-red-600">
                            <ClipboardList size={16} />
                            {selectedItemCount === 1 ? "Order Review (1 item)" : `Batch Review (${selectedItemCount} items)`}
                          </div>

                          <div className="max-h-[260px] space-y-3 overflow-y-auto pr-2">
                            {selectedCartItems.map((item) => (
                              <div key={item.cartId || item._id} className={`rounded-xl border p-3 ${darkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"}`}>
                                <div className="flex items-start gap-3">
                                  <div className={`h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border ${darkMode ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-slate-100"}`}>
                                    <img
                                      src={getProductImage(item)}
                                      alt={item.name || "Product"}
                                      className="h-full w-full object-cover"
                                    />
                                  </div>
                                  <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className={`truncate text-base font-bold ${darkMode ? "text-white" : "text-slate-900"}`}>{item.name}</div>
                                      <div className={`mt-1 text-sm ${darkMode ? "text-slate-300" : "text-slate-600"}`}>
                                        {item.is_estimate && item.width && item.height
                                          ? `${item.width} x ${item.height} = ${Number(item.area || ((Number(item.width) * Number(item.height)) / 144)).toLocaleString(undefined, { maximumFractionDigits: 2 })} sq.ft`
                                          : item.dimensions?.width && item.dimensions?.height
                                            ? `${item.dimensions.width} x ${item.dimensions.height} = ${Number(item.dimensions.area || ((Number(item.dimensions.width) * Number(item.dimensions.height)) / 144)).toLocaleString(undefined, { maximumFractionDigits: 2 })} sq.ft`
                                            : "Customized measurement"}
                                      </div>
                                    </div>
                                    <div className="flex-shrink-0 text-right">
                                      <div className="text-base font-bold text-red-600">{formatCurrency(getItemPriceValue(item))}</div>
                                      <div className={`text-xs ${darkMode ? "text-slate-400" : "text-slate-500"}`}>x{item.quantity}</div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className={`mt-5 rounded-xl border p-4 ${darkMode ? "border-red-900 bg-red-950/50" : "border-red-200 bg-red-50"}`}>
                            <div className={`flex items-center justify-between text-base font-bold ${darkMode ? "text-white" : "text-slate-900"}`}>
                              <span>Grand Estimated Total</span>
                              <span className="text-red-600">₱{Number(selectedSubtotal || 0).toLocaleString()}</span>
                            </div>
                            <div className={`mt-3 flex items-center justify-between text-sm ${darkMode ? "text-slate-300" : "text-slate-700"}`}>
                              <span>50% Requred Downpayment</span>
                              <span>₱{Number((selectedSubtotal || 0) * 0.5).toLocaleString()}</span>
                            </div>
                          </div>

                          <div className={`mt-5 rounded-xl border p-3 text-sm ${darkMode ? "border-slate-700 bg-slate-900 text-slate-300" : "border-slate-200 bg-white text-slate-600"}`}>
                            Final pricing will be confirmed during shop discussion or site inspection. Contact: 09123456789
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={handleCheckout}
                          disabled={checkoutLoading || selectedItemCount === 0}
                          className="mt-auto w-full rounded-xl bg-red-600 px-4 py-4 text-base font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <span className="inline-flex items-center justify-center gap-2">
                            <CheckCircle size={18} />
                            {checkoutLoading
                              ? selectedItemCount === 1
                                ? "Submitting Order Request..."
                                : "Submitting Order Requests..."
                              : selectedItemCount === 1
                                ? "Submit Order Request"
                                : "Submit Order Requests Bunch"}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {showBatchOrderConfirmModal && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
                <div className={`w-full max-w-xl overflow-hidden rounded-2xl shadow-2xl ${darkMode ? "bg-slate-900" : "bg-white"}`}>
                  <div className={`flex items-center gap-3 border-b px-5 py-4 ${darkMode ? "border-slate-700" : "border-slate-200"}`}>
                    <CheckCircle size={20} className="text-red-600" />
                    <h3 className={`text-lg font-bold ${darkMode ? "text-white" : "text-slate-800"}`}>
                      {selectedItemCount === 1 ? "Confirm Order Request" : "Confirm Batch Order Request"}
                    </h3>
                  </div>

                  <div className={`max-h-[calc(100vh-190px)] space-y-5 overflow-y-auto px-5 py-4 text-sm ${darkMode ? "text-slate-200" : "text-slate-700"}`}>
                    <section>
                      <h4 className="border-b border-red-100 pb-2 text-xs font-bold uppercase tracking-wide text-red-700">Customer Information</h4>
                      <div className="mt-3 space-y-3">
                        <p className="flex items-center gap-2"><User size={14} className="text-slate-400" />{`${profileForm.first_name || user?.first_name || ""} ${profileForm.last_name || user?.last_name || ""}`.trim() || "N/A"}</p>
                        <p className="flex items-center gap-2"><Mail size={14} className="text-slate-400" />{profileForm.email || user?.email || "N/A"}</p>
                        <p className="flex items-center gap-2"><Phone size={14} className="text-slate-400" />{batchOrderForm.phone || "N/A"}</p>
                        <p className="flex items-start gap-2"><MapPin size={14} className="mt-0.5 shrink-0 text-slate-400" />{normalizeAddress(batchOrderForm.shipping_address) || "N/A"}</p>
                      </div>
                    </section>

                    <section>
                      <h4 className="border-b border-red-100 pb-2 text-xs font-bold uppercase tracking-wide text-red-700">
                        {selectedItemCount === 1 ? "Selected Product (1)" : `Selected Products (${selectedItemCount})`}
                      </h4>
                      <div className="mt-3 space-y-2">
                        {selectedCartItems.map((item) => (
                          <div key={item.cartId || item._id || item.name} className={`flex items-center justify-between gap-3 rounded-sm border px-3 py-2 ${darkMode ? "border-slate-700 bg-slate-800" : "border-slate-200"}`}>
                            <div className="min-w-0">
                              <p className={`truncate font-semibold ${darkMode ? "text-white" : "text-slate-800"}`}>{item.name}</p>
                              <p className={`text-xs ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                                {getConfirmationItemDimensionText(item)}
                              </p>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className={`text-xs ${darkMode ? "text-slate-400" : "text-slate-500"}`}>x{item.quantity || 1}</p>
                              <p className={`font-semibold ${darkMode ? "text-slate-200" : "text-slate-700"}`}>{formatCurrency(getItemPriceValue(item))}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>

                    <section>
                      <h4 className="border-b border-red-100 pb-2 text-xs font-bold uppercase tracking-wide text-red-700">Pricing Compilation</h4>
                      <div className="mt-3 space-y-2">
                        <div className={`flex items-center justify-between rounded-sm px-3 py-2 font-bold ${darkMode ? "bg-red-950/50" : "bg-red-50"}`}>
                          <span>Est. Grand Total</span>
                          <span className="text-red-700">{formatCurrency(selectedSubtotal)}</span>
                        </div>
                        <div className={`flex items-center justify-between px-3 py-1 font-semibold ${darkMode ? "text-slate-200" : ""}`}>
                          <span>50% Downpayment</span>
                          <span className="text-red-700">{formatCurrency(selectedSubtotal * 0.5)}</span>
                        </div>
                      </div>
                    </section>

                    <div className={`rounded-md border px-3 py-2 text-xs ${darkMode ? "border-amber-700 bg-amber-950/40 text-amber-100" : "border-amber-300 bg-amber-50 text-slate-600"}`}>
                      <p>Final pricing will be confirmed during shop discussion or site inspection.</p>
                      <p className="mt-1">Contact: <span className="font-semibold">09123456789</span></p>
                    </div>

                    {checkoutError && (
                      <div className="rounded-md border border-red-300 bg-red-950/40 px-3 py-2 text-sm text-red-200">
                        {checkoutError}
                      </div>
                    )}
                  </div>

                  <div className={`flex justify-end gap-2 border-t px-5 py-3 ${darkMode ? "border-slate-700 bg-slate-900" : "border-slate-200"}`}>
                    <button
                      type="button"
                      onClick={() => setShowBatchOrderConfirmModal(false)}
                      disabled={checkoutLoading}
                      className={`rounded-lg border px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${darkMode ? "border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmBatchOrder}
                      disabled={checkoutLoading}
                      className="inline-flex items-center gap-2 rounded-lg bg-red-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <CheckCircle size={16} />
                      {checkoutLoading ? "Submitting..." : "Proceed"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {showBatchSuccessModal && (
              <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
                <div className={`w-full max-w-md rounded-[26px] border p-6 shadow-[0_24px_80px_rgba(15,23,42,0.18)] ${darkMode ? "border-slate-700 bg-slate-900" : "border-transparent bg-white"}`}>
                  <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full border-2 ${darkMode ? "border-green-800 bg-green-950/50" : "border-green-200 bg-green-50"}`}>
                    <CheckCircle className={`h-8 w-8 ${darkMode ? "text-green-400" : "text-green-700"}`} />
                  </div>

                  <h3 className={`mt-5 text-center text-2xl font-bold ${darkMode ? "text-white" : "text-slate-900"}`}>Batch Requests Submitted!</h3>

                  <p className={`mt-4 text-center text-sm leading-6 ${darkMode ? "text-slate-300" : "text-slate-600"}`}>
                    Thank you! Your architectural order requests have been received. Our estimating team will contact you shortly to schedule your site inspection and finalize quotation blueprints.
                  </p>

                  <p className={`mt-5 flex items-center justify-center gap-2 text-sm font-medium ${darkMode ? "text-slate-200" : "text-slate-700"}`}>
                    <Phone size={15} className={darkMode ? "text-slate-400" : "text-slate-500"} />
                    Questions? Call us at 09123456789
                  </p>

                  <div className="mt-6 flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowBatchSuccessModal(false);
                        setActiveTab("orders");
                      }}
                      className="flex-1 rounded-xl border border-red-600 bg-red-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-800"
                    >
                      View Your Orders
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowBatchSuccessModal(false);
                        setActiveTab("products");
                      }}
                      className={`flex-1 rounded-xl border px-4 py-3 text-sm font-semibold transition ${darkMode ? "border-red-500 bg-slate-900 text-red-300 hover:bg-red-950/50" : "border-red-600 bg-white text-red-700 hover:bg-red-50"}`}
                    >
                      Continue Browsing
                    </button>
                  </div>
                </div>
              </div>
            )}

            {showOrderReviewModal && (cartDecisionProduct || orderNowProduct) && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
                <div className={`w-full max-w-xl overflow-hidden rounded-2xl shadow-2xl ${darkMode ? "bg-slate-900" : "bg-white"}`}>
                  <div className={`flex items-center gap-3 border-b px-5 py-4 ${darkMode ? "border-slate-700" : "border-slate-200"}`}>
                    <CheckCircle size={20} className="text-red-600" />
                    <h3 className={`text-lg font-bold ${darkMode ? "text-white" : "text-slate-800"}`}>
                      Order Summary & Policy
                    </h3>
                  </div>

                  <div className={`max-h-[calc(100vh-190px)] space-y-5 overflow-y-auto px-5 py-4 text-sm ${darkMode ? "text-slate-200" : "text-slate-700"}`}>
                    <section>
                      <h4 className="border-b border-red-100 pb-2 text-xs font-bold uppercase tracking-wide text-red-700">Customer Information</h4>
                      <div className="mt-3 space-y-3">
                        <div className="flex items-center gap-2">
                          <User size={14} className="text-slate-400" />
                          <span>{`${profileForm.first_name || user?.first_name || ""} ${profileForm.last_name || user?.last_name || ""}`.trim() || "N/A"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Mail size={14} className="text-slate-400" />
                          <span>{profileForm.email || user?.email || "N/A"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone size={14} className="text-slate-400" />
                          <span>{deliveryConfirmForm.phone || profileForm.phone || user?.phone || "N/A"}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <MapPin size={14} className="mt-0.5 shrink-0 text-slate-400" />
                          <span>{normalizeAddress([
                            deliveryConfirmForm.street_address || profileForm.street_address,
                            deliveryConfirmForm.city || profileForm.city,
                            deliveryConfirmForm.province || profileForm.province,
                            deliveryConfirmForm.zip_code || profileForm.zip_code,
                          ].filter(Boolean).join(", ")) || "N/A"}</span>
                        </div>
                      </div>
                    </section>

                    <section>
                      <h4 className="border-b border-red-100 pb-2 text-xs font-bold uppercase tracking-wide text-red-700">Selected Product (1)</h4>
                      <div className={`mt-3 rounded-xl border px-3 py-3 ${darkMode ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-slate-50"}`}>
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className={`truncate font-semibold ${darkMode ? "text-white" : "text-slate-800"}`}>
                              {(reviewOrderMode === "orderNow" ? orderNowProduct : cartDecisionProduct)?.name || "Selected product"}
                            </p>
                            <p className={`mt-1 text-xs ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                              {orderReviewMeasurementText}
                            </p>
                          </div>
                          <p className="shrink-0 text-base font-bold text-red-600">
                            {reviewOrderMode === "orderNow"
                              ? orderNowProduct
                                ? `₱${(Math.max(1, Number(orderNowQuantity) || 1) * Number(orderNowProduct.unit_price || orderNowProduct.price_per_sqft || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                : "₱0.00"
                              : estimateTotalCost
                                ? `₱${estimateTotalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                : "₱0.00"}
                          </p>
                        </div>
                      </div>
                    </section>

                    <section>
                      <h4 className="border-b border-red-100 pb-2 text-xs font-bold uppercase tracking-wide text-red-700">Pricing Compilation</h4>
                      <div className="mt-3 space-y-2">
                        <div className={`flex items-center justify-between rounded-md px-3 py-2 font-bold ${darkMode ? "bg-red-950/50 text-white" : "bg-red-50 text-slate-800"}`}>
                          <span>Est. Grand Total</span>
                          <span className="text-red-600">
                            {reviewOrderMode === "orderNow"
                              ? orderNowProduct
                                ? `₱${(Math.max(1, Number(orderNowQuantity) || 1) * Number(orderNowProduct.unit_price || orderNowProduct.price_per_sqft || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                : "₱0.00"
                              : estimateTotalCost
                                ? `₱${estimateTotalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                : "₱0.00"}
                          </span>
                        </div>
                        <div className={`flex items-center justify-between px-3 py-1 font-semibold ${darkMode ? "text-slate-200" : "text-slate-700"}`}>
                          <span>50% Downpayment</span>
                          <span className="text-red-600">
                            {reviewOrderMode === "orderNow"
                              ? orderNowProduct
                                ? `₱${(Math.max(1, Number(orderNowQuantity) || 1) * Number(orderNowProduct.unit_price || orderNowProduct.price_per_sqft || 0) * 0.5).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                : "₱0.00"
                              : estimateTotalCost
                                ? `₱${(estimateTotalCost * 0.5).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                : "₱0.00"}
                          </span>
                        </div>
                      </div>
                    </section>

                    <div className={`rounded-md border px-3 py-3 text-xs ${darkMode ? "border-amber-700 bg-amber-950/40 text-amber-100" : "border-amber-300 bg-amber-50 text-slate-600"}`}>
                      <p>Final pricing will be confirmed during shop discussion or site inspection.</p>
                      <p className="mt-1">Contact: <span className="font-semibold">09123456789</span></p>
                    </div>

                    <div className={`rounded-xl border p-3 ${darkMode ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-slate-50"}`}>
                      <p className={`text-sm font-semibold ${darkMode ? "text-red-400" : "text-red-700"}`}>Payment Policy</p>
                      <p className={`mt-2 text-sm ${darkMode ? "text-slate-300" : "text-slate-700"}`}>
                        A 50% downpayment of the total order amount is required before proceeding with the order.
                      </p>
                    </div>

                    <label className={`flex items-start gap-3 rounded-lg border p-3 ${darkMode ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-slate-50"}`}>
                      <input
                        type="checkbox"
                        checked={orderReviewAgreed}
                        onChange={(e) => setOrderReviewAgreed(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                      />
                      <span className={darkMode ? "text-slate-200" : "text-slate-700"}>
                        I understand the 50% downpayment policy and agree to proceed.
                      </span>
                    </label>

                    {cartActionError && (
                      <div className="rounded-md border border-red-300 bg-red-950/40 px-3 py-2 text-sm text-red-200">
                        {cartActionError}
                      </div>
                    )}
                  </div>

                  <div className={`flex justify-end gap-2 border-t px-5 py-3 ${darkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-slate-50"}`}>
                    <button
                      type="button"
                      onClick={() => {
                        setShowOrderReviewModal(false);
                        setCartActionError("");
                      }}
                      className={`rounded-lg border px-4 py-2.5 text-sm font-semibold transition ${darkMode ? "border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"}`}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmitOrderRequest}
                      disabled={!orderReviewAgreed || orderRequestLoading}
                      className="inline-flex items-center gap-2 rounded-lg bg-red-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <CheckCircle size={16} />
                      {orderRequestLoading ? "Submitting..." : "Proceed"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {showOrderSuccessModal && orderSuccessData && (
              <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
                <div className={`w-full max-w-md rounded-[26px] border p-6 shadow-[0_24px_80px_rgba(15,23,42,0.18)] ${darkMode ? "border-slate-700 bg-slate-900" : "border-transparent bg-white"}`}>
                  <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full border-2 ${darkMode ? "border-emerald-700 bg-emerald-950/40" : "border-emerald-200 bg-emerald-50"}`}>
                    <CheckCircle className={`h-8 w-8 ${darkMode ? "text-emerald-400" : "text-emerald-600"}`} />
                  </div>

                  <h3 className={`mt-5 text-center text-2xl font-bold ${darkMode ? "text-white" : "text-slate-900"}`}>Order Request Submitted!</h3>

                  <p className={`mt-4 text-center text-sm leading-6 ${darkMode ? "text-slate-300" : "text-slate-600"}`}>
                    Thank you! Your order request has been received. Our estimating team will contact you shortly to confirm the details and finalize the quotation.
                  </p>

                  <p className={`mt-5 flex items-center justify-center gap-2 text-sm font-medium ${darkMode ? "text-slate-200" : "text-slate-700"}`}>
                    <Phone size={15} className={darkMode ? "text-slate-400" : "text-slate-500"} />
                    Questions? Call us at 09123456789
                  </p>

                  <div className="mt-6 flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowOrderSuccessModal(false);
                        setOrderSuccessData(null);
                        setActiveTab("orders");
                      }}
                      className="flex-1 rounded-xl border border-red-500 bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700"
                    >
                      View Your Orders
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowOrderSuccessModal(false);
                        setOrderSuccessData(null);
                        setActiveTab("products");
                      }}
                      className="flex-1 rounded-xl border border-red-500 bg-transparent px-4 py-3 text-sm font-semibold text-red-400 transition hover:bg-red-950/30"
                    >
                      Continue Browsing
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === "orders" && (
          <>
            <div className="mb-5 flex flex-col gap-4 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className={`text-2xl font-black tracking-[-0.03em] ${darkMode ? "text-white" : "text-slate-900"}`}>My Orders</h2>
                <p className={`mt-1 text-sm ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Track progress, payments, and completed projects.</p>
              </div>
              <div className={`max-w-full overflow-x-auto rounded-xl border p-1 ${darkMode ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-slate-100"}`}>
                <div className="flex w-max items-center gap-1" role="group" aria-label="Filter orders">
                {[
                  { value: "all", label: "All Orders" },
                  { value: "order", label: "My Orders" },
                  { value: "review", label: "To Review" },
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
                    aria-pressed={orderFilter === tab.value}
                    className={`rounded-lg px-3.5 py-2 text-sm font-semibold transition ${
                      orderFilter === tab.value 
                        ? "bg-red-700 text-white shadow-sm"
                        : darkMode
                          ? "text-slate-300 hover:bg-slate-700 hover:text-white"
                          : "text-slate-600 hover:bg-white hover:text-slate-900"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
                </div>
              </div>
            </div>


            {orderRequestMessage && (
              <div className={`mb-6 rounded-3xl border px-6 py-4 text-sm ${darkMode ? "border-emerald-800 bg-emerald-950/40 text-emerald-300" : "border-emerald-100 bg-emerald-50 text-emerald-700"}`}>
                {orderRequestMessage}
              </div>
            )}

            {ordersLoading ? (
              <div className="space-y-4">
                {[...Array(2)].map((_, index) => (
                  <div key={index} className={`h-20 animate-pulse rounded-xl border ${darkMode ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white"}`} />
                ))}
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className={`rounded-xl border border-dashed px-6 py-12 text-center ${darkMode ? "border-slate-700 bg-slate-800/60" : "border-slate-300 bg-white"}`}>
                <p className={`font-semibold ${darkMode ? "text-slate-200" : "text-slate-800"}`}>No orders found</p>
                <p className={`mt-1 text-sm ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Try another filter to see your orders.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pagedFilteredOrders.map((order) => {
                  const orderId = order._id || order.id || order.tracking;
                  const product = order.items?.[0] || {};
                  const orderItems = Array.isArray(order.items) ? order.items : [];
                  const isOrderExpanded = expandedOrderId === orderId;
                  const orderTotal = getOrderTotalValue(order);
                  const recordedPaidAmount = Number(order.paid_amount || order.amount_paid || order.downpayment_amount || order.downpayment || 0) || 0;
                  const downpaymentAmount = Math.max(recordedPaidAmount, Number(order.downpayment_amount || order.downpayment || 0) || orderTotal * 0.5);
                  const balanceAmount = Math.max(0, orderTotal - downpaymentAmount);
                  const paymentStatus = (() => {
                    if (orderTotal > 0 && downpaymentAmount >= orderTotal) {
                      return { label: "FULLY PAID", className: darkMode ? "border border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border border-emerald-200 bg-emerald-50 text-emerald-700" };
                    }
                    if (downpaymentAmount > 0) {
                      return { label: "Downpayment", className: darkMode ? "border border-violet-500/40 bg-violet-500/10 text-violet-200" : "border border-violet-200 bg-violet-50 text-violet-800" };
                    }
                    return { label: "PENDING PAYMENT", className: darkMode ? "border border-violet-300/40 bg-violet-200/15 text-violet-200" : "border border-violet-200 bg-violet-50 text-violet-800" };
                  })();
                  const isBatchOrder = orderItems.length > 1;
                  const orderDisplayName = isBatchOrder ? "Batch Order" : product.name || product.product_name || "Project item";
                  const orderDisplayQuantity = isBatchOrder ? `${orderItems.length} items` : product.quantity ? `Qty ${product.quantity}` : "Qty 1";
                  const orderPreviewItems = isBatchOrder ? orderItems.slice(0, 3) : [product];
                  const orderDate = formatDateToMMMDDYYYY(order.updatedAt || order.createdAt) || "—";
                  const orderStatusLabel = getOrderStatusLabel(order.status);
                  const hasContractBeenSent =
                    order.status === "contract_sent" ||
                    order.contract_status === "sent" ||
                    (order.status === "site_inspection" && order.contract_status === "sent");
                  const isContractWaitingForCustomer =
                    hasContractBeenSent &&
                    order.order_type !== "walk_in_customer";
                  const isCustomerAcceptedContract = isCustomerContractAccepted(order);
                  const isOnlineContractAccepted = order.acceptedByCustomer === true || (order.contract_status === "accepted" && order.acceptance_method === "online");
                  const isProjectFinished = String(order.status || "").toLowerCase() === "completed";
                  const paymentProofSubmission = paymentProofSuccessByOrder[orderId];
                  const lastPaymentProofUrl = paymentProofSubmission?.fileUrl || order.payment_proof_file_url || order.proof_file_url || "";

                  return (
                    <div
                      key={orderId}
                      className={`overflow-hidden rounded-xl border shadow-sm transition hover:shadow-md ${darkMode ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white"}`}
                    >
                      <div className="grid gap-3 p-3.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-4">
                        <div className="flex min-w-0 items-center gap-3">
                          {isBatchOrder ? (
                            <div className="relative flex h-12 w-14 shrink-0 items-center">
                              {orderPreviewItems.map((item, index) => (
                                <div
                                  key={`${orderId}-thumb-${index}`}
                                  className="absolute overflow-hidden rounded-[10px] border border-white bg-white shadow-sm"
                                  style={{
                                    width: "2.1rem",
                                    height: "2.1rem",
                                    left: `${index * 0.9}rem`,
                                    zIndex: 10 + index,
                                  }}
                                >
                                  <img
                                    src={getOrderItemImage(item)}
                                    alt={item.name || item.product_name || "Product image"}
                                    className="h-full w-full object-cover"
                                    onError={(e) => {
                                      e.currentTarget.onerror = null;
                                      e.currentTarget.src = PRODUCT_IMAGE_PLACEHOLDER;
                                    }}
                                  />
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className={`h-11 w-11 shrink-0 overflow-hidden rounded-[12px] border shadow-sm sm:h-12 sm:w-12 ${darkMode ? "border-slate-600 bg-slate-700" : "border-red-100 bg-red-50"}`}>
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
                          )}

                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`text-sm font-bold ${darkMode ? "text-white" : "text-slate-900"}`}>
                                {orderDisplayName}
                              </span>
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${getOrderStatusClasses(order.status)}`}>
                                {orderStatusLabel}
                              </span>
                            </div>
                            <div className={`mt-1 flex flex-wrap items-center gap-x-2 text-xs ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                              <span>{order.tracking || order._id || "—"}</span>
                              <span aria-hidden="true">·</span>
                              <span>{orderDisplayQuantity}</span>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 sm:flex sm:justify-end sm:gap-5">
                          <div className="text-right sm:min-w-[110px]">
                            <p className={`text-[10px] font-semibold uppercase tracking-wide ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Total</p>
                            <p className="mt-0.5 text-base font-bold text-red-600">{formatCurrency(orderTotal)}</p>
                          </div>
                          <div className="text-right sm:min-w-[90px]">
                            <p className={`text-[10px] font-semibold uppercase tracking-wide ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Updated</p>
                            <p className={`mt-0.5 text-xs font-medium ${darkMode ? "text-slate-300" : "text-slate-600"}`}>{orderDate}</p>
                          </div>
                          <div className="col-span-2 flex justify-end sm:col-span-1">
                            <div className="flex items-center gap-2">
                              {orderFilter === "review" && isProjectFinished && isOrderCompletedAndReviewable(order) && !hasOrderReview(order) && (
                                <button
                                  type="button"
                                  onClick={() => openCustomerReviewModal(order)}
                                  className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border px-3 text-[10px] font-black leading-none tracking-[0.02em] shadow-sm transition-all duration-200 ${darkMode ? "border-amber-500/70 bg-amber-500/15 text-amber-200 hover:bg-amber-500/20 hover:text-amber-100 shadow-amber-500/10" : "border-amber-500 bg-amber-400 text-slate-950 hover:bg-amber-300 hover:shadow-amber-500/30"}`}
                                >
                                  <Star size={12} fill="currentColor" className="drop-shadow-[0_0_2px_rgba(0,0,0,0.12)]" aria-hidden="true" />
                                  <span className="whitespace-nowrap">Leave Feedback</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setExpandedOrderId(isOrderExpanded ? null : orderId)}
                                aria-expanded={isOrderExpanded}
                                className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${darkMode ? "bg-red-600 text-white hover:bg-red-500" : "bg-red-700 text-white hover:bg-red-800"}`}
                              >
                                {isOrderExpanded ? "Hide details" : "View details"}
                                {isOrderExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {isOrderExpanded && (
                        <div className={`border-t p-3 sm:p-4 ${darkMode ? "border-slate-700 bg-slate-900/60" : "border-slate-200 bg-slate-50"}`}>
                          <div className={`flex flex-col gap-2 pb-3 sm:flex-row sm:items-center sm:justify-between ${darkMode ? "border-b border-slate-700" : "border-b border-slate-200"}`}>
                            <div>
                              <h4 className={`text-base font-black ${darkMode ? "text-white" : "text-slate-900"}`}>
                                {isBatchOrder ? "Batch order" : orderDisplayName}
                              </h4>
                              <p className={`mt-1 text-xs ${darkMode ? "text-slate-300" : "text-slate-600"}`}>
                                {order.tracking || order._id || "—"} · {orderDate}
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center justify-start gap-2 sm:justify-end">
                              {isOnlineContractAccepted && (
                                <div className={`inline-flex max-w-full flex-wrap items-center justify-start gap-3 rounded-xl border px-4 py-3 text-sm font-bold ${darkMode ? "border-emerald-700/60 bg-emerald-950/20 text-emerald-300" : "border-emerald-200/70 bg-emerald-50/40 text-emerald-700"}`}>
                                  <span>✓ Contract Accepted &amp; Signed</span>
                                  <button
                                    type="button"
                                    onClick={() => openContractModal(order)}
                                    className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition ${darkMode ? "border-emerald-600 text-emerald-200 hover:bg-emerald-900/50" : "border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-50"}`}
                                  >
                                    View Contract
                                  </button>
                                </div>
                              )}
                              <button
                                type="button"
                                onClick={() => setSelectedOrderForModal(order)}
                                className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition shadow-sm ${darkMode ? "bg-green-600 text-slate-100 hover:bg-green-700" : "bg-green-600 text-white hover:bg-green-700"}`}
                              >
                                View Order Timeline
                              </button>
                            </div>
                          </div>

                          {isContractWaitingForCustomer && (
                            <section className={`mt-4 rounded-xl border p-4 ${darkMode ? "border-amber-500/30 bg-amber-500/10" : "border-amber-200 bg-amber-50"}`}>
                              <h4 className={`text-base font-black ${darkMode ? "text-amber-100" : "text-amber-900"}`}>Contract Acceptance</h4>
                              <p className={`mt-1 text-sm font-bold ${darkMode ? "text-amber-200" : "text-amber-800"}`}>Contract Sent to You</p>
                              <p className={`mt-1 text-sm ${darkMode ? "text-slate-300" : "text-slate-700"}`}>Please review the contract details before accepting.</p>
                              <div className="mt-4 flex flex-wrap gap-2">
                                <button type="button" onClick={() => openContractModal(order)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100">View Contract</button>
                                <button type="button" onClick={() => openContractConfirmModal("decline", orderId)} className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-50">Decline</button>
                                <button type="button" onClick={() => openContractConfirmModal("accept", orderId)} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700">Accept &amp; Sign Contract</button>
                              </div>
                            </section>
                          )}
                          {order.contract_status === "declined" && (
                            <div className={`mt-4 rounded-xl border p-4 ${darkMode ? "border-red-800 bg-red-950/40" : "border-red-200 bg-red-50"}`}>
                              <p className={`text-sm font-bold ${darkMode ? "text-red-300" : "text-red-700"}`}>Contract Declined</p>
                              <p className={`mt-1 text-sm ${darkMode ? "text-slate-300" : "text-slate-700"}`}>{order.contractDeclineReason || "No reason provided."}</p>
                            </div>
                          )}

                          <div className={`mt-4 overflow-hidden rounded-xl border ${darkMode ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white"}`}>
                            <div className={`divide-y ${darkMode ? "divide-slate-700" : "divide-slate-200"}`}>
                              {orderItems.map((item, itemIndex) => (
                                <div key={`${orderId}-item-${itemIndex}`} className="flex items-center justify-between gap-3 px-3 py-3 sm:px-4">
                                  <div className="flex min-w-0 items-center gap-3">
                                    <div className={`h-12 w-12 shrink-0 overflow-hidden rounded-lg border ${darkMode ? "border-slate-600 bg-slate-700" : "border-slate-200 bg-slate-100"}`}>
                                      <img
                                        src={getOrderItemImage(item)}
                                        alt={item.name || item.product_name || `Product ${itemIndex + 1}`}
                                        className="h-full w-full object-cover"
                                        onError={(e) => {
                                          e.currentTarget.onerror = null;
                                          e.currentTarget.src = PRODUCT_IMAGE_PLACEHOLDER;
                                        }}
                                      />
                                    </div>
                                    <div className="min-w-0">
                                      <p className={`truncate text-sm font-semibold ${darkMode ? "text-white" : "text-slate-900"}`}>
                                        {item.name || item.product_name || `Product ${itemIndex + 1}`}
                                      </p>
                                      <p className={`mt-1 text-sm ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                                        {getConfirmationItemDimensionText(item)}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-sm font-bold text-red-600">
                                      {formatCurrency(getItemPriceValue(item))}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className={`mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-y py-4 sm:grid-cols-4 ${darkMode ? "border-slate-700" : "border-slate-200"}`}>
                            <div className="flex flex-col gap-1">
                              <span className={`text-[10px] font-semibold uppercase tracking-wide ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Grand total</span>
                              <span className="text-lg font-bold text-red-600">{formatCurrency(orderTotal)}</span>
                            </div>
                            <div className="flex flex-col gap-1">
                              <span className={`text-[10px] font-semibold uppercase tracking-wide ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Downpayment paid</span>
                              <span className="text-lg font-bold text-emerald-600">{formatCurrency(downpaymentAmount)}</span>
                            </div>
                            <div className="flex flex-col gap-1">
                              <span className={`text-[10px] font-semibold uppercase tracking-wide ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Balance</span>
                              <span className={`text-lg font-bold ${darkMode ? "text-white" : "text-slate-900"}`}>{formatCurrency(balanceAmount)}</span>
                            </div>
                            <div className="flex flex-col gap-1">
                              <span className={`text-[10px] font-semibold uppercase tracking-wide ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Payment status</span>
                              <span className={`inline-flex items-center justify-center rounded-full px-3 py-2 text-xs font-black uppercase tracking-[0.08em] ${paymentStatus.className}`}>
                                {paymentStatus.label}
                              </span>
                            </div>
                          </div>

                          {!isProjectFinished && <div className="mt-6 grid gap-3 sm:grid-cols-2">
                            {paymentProofSubmission || lastPaymentProofUrl ? (
                              <div className={`rounded-xl border px-4 py-3 text-sm font-medium sm:col-span-2 ${darkMode ? "border-sky-800 bg-sky-950/50 text-sky-200" : "border-sky-200 bg-sky-50 text-sky-800"}`}>
                                <p>
                                  We've notified admin that you paid {formatCurrency(paymentProofSubmission?.amount ?? order.payment_proof_amount ?? 0)}. This is pending confirmation — we'll notify you here once it's verified.
                                </p>
                                {lastPaymentProofUrl && (
                                  <a
                                    href={ensureAbsoluteUrl(lastPaymentProofUrl)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className={`mt-2 inline-flex items-center gap-1.5 font-bold underline underline-offset-2 ${darkMode ? "text-sky-200 hover:text-white" : "text-sky-800 hover:text-sky-950"}`}
                                  >
                                    <Paperclip size={14} aria-hidden="true" />
                                    View your last uploaded proof
                                  </a>
                                )}
                              </div>
                            ) : paymentProofOpenOrderId === orderId ? (
                              <div className={`sm:col-span-2 rounded-xl border p-3 sm:p-4 ${darkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"}`}>
                                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                                  <div>
                                    <label htmlFor={`payment-amount-${orderId}`} className={`mb-1.5 block text-xs font-bold ${darkMode ? "text-slate-200" : "text-slate-700"}`}>
                                      Amount paid <span className="text-red-500">(required)</span>
                                    </label>
                                    <input
                                      id={`payment-amount-${orderId}`}
                                      type="text"
                                      inputMode="decimal"
                                      value={paymentProofForm.amount}
                                      onChange={(event) => setPaymentProofForm((prev) => ({ ...prev, amount: event.target.value }))}
                                      placeholder="₱0.00"
                                      className={`w-full rounded-lg border px-3 py-2.5 text-sm font-semibold outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 ${darkMode ? "border-slate-600 bg-slate-800 text-white placeholder:text-slate-400" : "border-slate-300 bg-white text-slate-900 placeholder:text-slate-400"}`}
                                    />
                                  </div>
                                  <div>
                                    <div className={`mb-1.5 text-xs font-bold ${darkMode ? "text-slate-200" : "text-slate-700"}`}>
                                      Payment proof <span className={`font-normal ${darkMode ? "text-slate-400" : "text-slate-500"}`}>(optional)</span>
                                    </div>
                                    <label
                                      htmlFor={`payment-proof-${orderId}`}
                                      className={`flex min-h-[42px] cursor-pointer items-center gap-2 rounded-lg border border-dashed px-3 py-2 transition focus-within:ring-2 focus-within:ring-emerald-500 ${darkMode ? "border-slate-600 bg-slate-800 hover:border-slate-500" : "border-slate-300 bg-slate-50 hover:border-emerald-400 hover:bg-emerald-50/50"}`}
                                    >
                                      <FileText size={17} className="shrink-0 text-emerald-600" aria-hidden="true" />
                                      <span className={`min-w-0 flex-1 truncate text-xs font-medium ${darkMode ? "text-slate-300" : "text-slate-600"}`}>
                                        {paymentProofForm.fileName || "Choose an image or PDF"}
                                      </span>
                                      <input
                                        id={`payment-proof-${orderId}`}
                                        type="file"
                                        accept="image/*,.pdf"
                                        onChange={handlePaymentProofFileChange}
                                        className="sr-only"
                                      />
                                    </label>
                                  </div>
                                </div>

                                {paymentProofError && (
                                  <p role="alert" className="mt-2 text-xs font-semibold text-red-600">{paymentProofError}</p>
                                )}

                                <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPaymentProofOpenOrderId(null);
                                      setPaymentProofError("");
                                      setPaymentProofForm({ amount: "", fileName: "" });
                                    }}
                                    className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${darkMode ? "border-slate-600 text-slate-300 hover:bg-slate-800" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => submitPaymentProof(order)}
                                    disabled={paymentProofLoading}
                                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
                                  >
                                    {paymentProofLoading ? "Submitting..." : "Submit Payment Info"}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => isCustomerAcceptedContract && handleOpenPaymentProofForm(orderId)}
                                disabled={!isCustomerAcceptedContract}
                                className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-base font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-emerald-600"
                              >
                                {isCustomerAcceptedContract ? "I've already paid" : "Awaiting contract sign-off"}
                              </button>
                            )}

                            {!isCustomerAcceptedContract && (
                              <button
                                type="button"
                                onClick={() => handleCancelRequest(order)}
                                className={`w-full rounded-xl border px-4 py-3 text-base font-black transition ${darkMode ? "border-red-500/60 bg-red-500/10 text-red-400 hover:bg-red-500/20" : "border-red-500 bg-transparent text-red-600 hover:bg-red-50"}`}
                              >
                                Cancel request
                              </button>
                            )}
                          </div>}

                        </div>
                      )}
                    </div>
                  );
                })}

              </div>
            )}

            {!ordersLoading && (
              <div className={`mt-auto flex flex-wrap items-center justify-center gap-3 rounded-xl border px-3 py-2.5 ${darkMode ? "border-slate-700 bg-slate-800/90" : "border-slate-200 bg-white"}`}>
                <p className={`text-xs font-medium ${darkMode ? "text-slate-300" : "text-slate-600"}`}>
                  Showing {filteredOrders.length ? pageStart + 1 : 0}-{Math.min(pageStart + ORDER_PAGE_SIZE, filteredOrders.length)} of {filteredOrders.length} orders
                </p>
                <div className="flex items-center justify-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setOrderPage((page) => Math.max(1, page - 1))}
                    disabled={safeOrderPage === 1 || filteredOrders.length === 0}
                    className={`h-8 rounded-lg px-2.5 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${darkMode ? "bg-slate-700 text-slate-200 hover:bg-slate-600" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
                  >
                    Prev
                  </button>

                  {Array.from({ length: orderPageCount }, (_, index) => index + 1).map((pageNum) => (
                    <button
                      key={pageNum}
                      type="button"
                      onClick={() => setOrderPage(pageNum)}
                      aria-current={safeOrderPage === pageNum ? "page" : undefined}
                      className={`h-8 min-w-8 rounded-lg px-2 text-xs font-black transition ${safeOrderPage === pageNum
                        ? "bg-red-600 text-white shadow-sm shadow-red-200"
                        : darkMode
                          ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
                    >
                      {pageNum}
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={() => setOrderPage((page) => Math.min(orderPageCount, page + 1))}
                    disabled={safeOrderPage === orderPageCount || filteredOrders.length === 0}
                    className={`h-8 rounded-lg px-2.5 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${darkMode ? "bg-slate-700 text-slate-200 hover:bg-slate-600" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}

            {cancelRequestModal.open && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
                <div className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl ${darkMode ? "border-slate-700 bg-slate-800 text-white" : "border-slate-200 bg-white text-slate-900"}`}>
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
                    <AlertTriangle size={22} />
                  </div>
                  <h3 className="mt-4 text-center text-xl font-black">Cancel request?</h3>
                  <p className={`mt-2 text-center text-sm ${darkMode ? "text-slate-300" : "text-slate-600"}`}>
                    This will mark the current order request as cancelled. You can still review it afterwards in your order list.
                  </p>

                  <div className="mt-6 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setCancelRequestModal({ open: false, order: null })}
                      className={`flex-1 rounded-xl px-4 py-3 text-sm font-black transition ${darkMode ? "bg-slate-700 text-slate-100 hover:bg-slate-600" : "bg-slate-200 text-slate-700 hover:bg-slate-300"}`}
                    >
                      Keep request
                    </button>
                    <button
                      type="button"
                      onClick={confirmCancelRequest}
                      className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-sm font-black text-white transition hover:bg-red-700"
                    >
                      Confirm cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {selectedOrderForModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="order-timeline-title"
              className={`order-details-modal flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border shadow-2xl ${darkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"}`}
            >
              <div className={`border-b px-4 py-3 sm:px-5 ${darkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"}`}>
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <h3 id="order-timeline-title" className={`truncate text-lg font-bold sm:text-xl ${darkMode ? "text-white" : "text-slate-950"}`}>Order Timeline</h3>
                    <p className={`mt-0.5 truncate text-xs ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                      {selectedOrderForModal.tracking || selectedOrderForModal._id || "Order"}
                      {selectedOrderForModal.updatedAt || selectedOrderForModal.createdAt
                        ? ` · ${formatDateToMMMDDYYYY(selectedOrderForModal.updatedAt || selectedOrderForModal.createdAt)}`
                        : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedOrderForModal(null)}
                    className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition ${darkMode ? "border-slate-700 text-slate-300 hover:bg-slate-800" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                    aria-label="Close order timeline"
                  >
                    <X size={17} aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className={`flex-1 overflow-y-auto p-4 sm:p-5 ${darkMode ? "bg-slate-950" : "bg-slate-50"}`}>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h4 className={`text-xs font-bold uppercase tracking-wide ${darkMode ? "text-slate-300" : "text-slate-600"}`}>Items &amp; progress</h4>
                  <span className={`text-xs ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                    {(selectedOrderForModal.items || []).length} item{(selectedOrderForModal.items || []).length === 1 ? "" : "s"}
                  </span>
                </div>
                {(selectedOrderForModal.items || []).length === 0 ? (
                  <div className={`rounded-xl border border-dashed p-8 text-center text-sm ${darkMode ? "border-slate-700 text-slate-400" : "border-slate-300 text-slate-500"}`}>
                    No items are listed for this order.
                  </div>
                ) : (
                  <div className={`divide-y overflow-hidden rounded-xl border ${darkMode ? "divide-slate-700 border-slate-700 bg-slate-900" : "divide-slate-200 border-slate-200 bg-white"}`}>
                    {(selectedOrderForModal.items || []).map((item, itemIndex) => {
                      const productName = item?.name || item?.product_name || `Product ${itemIndex + 1}`;
                      const productSize = getConfirmationItemDimensionText(item);
                      const progressSteps = getOrderProgressSteps(selectedOrderForModal);
                      const normalizedStatus = String(selectedOrderForModal.status || "").toLowerCase();
                      const statusClass = getOrderStatusClasses(selectedOrderForModal.status);

                      return (
                        <article key={`${selectedOrderForModal._id || selectedOrderForModal.id || "order"}-detail-${itemIndex}`} className="p-3 sm:p-4">
                          <div className="flex min-w-0 items-center justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <div className={`h-11 w-11 shrink-0 overflow-hidden rounded-lg border ${darkMode ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-slate-100"}`}>
                                <img
                                  src={getOrderItemImage(item)}
                                  alt={productName}
                                  className="h-full w-full object-cover"
                                  onError={(event) => {
                                    event.currentTarget.onerror = null;
                                    event.currentTarget.src = PRODUCT_IMAGE_PLACEHOLDER;
                                  }}
                                />
                              </div>
                              <div className="min-w-0">
                                <p className={`truncate text-sm font-semibold ${darkMode ? "text-white" : "text-slate-900"}`}>{productName}</p>
                                <p className={`mt-0.5 truncate text-xs ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Size: {productSize}</p>
                              </div>
                            </div>
                            <div className="shrink-0 text-right">
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusClass}`}>{getOrderStatusLabel(selectedOrderForModal.status)}</span>
                              <p className="mt-1 text-sm font-bold text-red-600">{formatCurrency(getItemPriceValue(item))}</p>
                            </div>
                          </div>

                          <div className={`mt-3 grid grid-cols-4 gap-x-2 gap-y-3 rounded-lg p-3 sm:grid-cols-8 ${darkMode ? "bg-slate-800/70" : "bg-slate-50"}`}>
                            {progressSteps.map((step, stepIndex) => {
                              const isCompleted = step.done || (normalizedStatus === "completed" && step.key === "completed");
                              const isCancelled = normalizedStatus === "cancelled";
                              const circleClass = isCancelled && stepIndex === 0
                                ? "border-red-600 bg-red-600 text-white"
                                : isCompleted
                                  ? "border-emerald-600 bg-emerald-600 text-white"
                                  : step.active
                                    ? "border-amber-500 bg-amber-500 text-white"
                                    : darkMode
                                      ? "border-slate-600 bg-slate-900 text-slate-400"
                                      : "border-slate-300 bg-white text-slate-500";
                              const labelClass = isCancelled && stepIndex === 0
                                ? "text-red-600"
                                : isCompleted
                                  ? "text-emerald-700"
                                  : step.active
                                    ? "text-amber-700"
                                    : darkMode
                                      ? "text-slate-400"
                                      : "text-slate-500";

                              return (
                                <div key={`${productName}-${step.key}`} className="flex min-w-0 flex-col items-center gap-1 text-center" aria-current={step.active ? "step" : undefined}>
                                  <span className={`flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-bold ${circleClass}`}>
                                    {isCompleted ? <Check size={12} aria-hidden="true" /> : stepIndex + 1}
                                  </span>
                                  <span className={`text-[9px] font-medium leading-tight ${labelClass}`}>{step.label}</span>
                                </div>
                              );
                            })}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className={`flex justify-end border-t px-4 py-3 sm:px-5 ${darkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"}`}>
                <button
                  type="button"
                  onClick={() => setSelectedOrderForModal(null)}
                  className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${darkMode ? "border-slate-600 text-slate-200 hover:bg-slate-800" : "border-slate-300 text-slate-700 hover:bg-slate-50"}`}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {showCustomerReviewModal && selectedReviewOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-3 backdrop-blur-sm">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="customer-review-title"
              className={`flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl shadow-2xl ${darkMode ? "bg-slate-900" : "bg-white"}`}
            >
              <div className={`flex items-center justify-between border-b px-5 py-3.5 ${darkMode ? "border-slate-700" : "border-slate-200"}`}>
                <div>
                  <h2 id="customer-review-title" className={`text-lg font-bold ${darkMode ? "text-white" : "text-slate-950"}`}>
                    {hasOrderReview(selectedReviewOrder) ? "Edit Review" : "Write a Review"}
                  </h2>
                  <p className={`text-xs ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Share your experience after your completed order.</p>
                </div>
                <button
                  type="button"
                  onClick={closeCustomerReviewModal}
                  aria-label="Close review form"
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-full border text-lg transition ${darkMode ? "border-slate-700 text-slate-300 hover:bg-slate-800" : "border-slate-200 text-slate-600 hover:bg-slate-100"}`}
                >
                  ×
                </button>
              </div>
              <div className="flex-1 space-y-4 overflow-y-auto p-5">
                <div className="space-y-2">
                  <p className={`text-sm font-semibold ${darkMode ? "text-white" : "text-slate-900"}`}>Overall Rating</p>
                  <div className="flex gap-2" role="group" aria-label="Overall rating">
                    {Array.from({ length: 5 }).map((_, index) => {
                      const value = index + 1;
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => handleOrderReviewChange("rating", value)}
                          aria-label={`${value} star${value === 1 ? "" : "s"}`}
                          aria-pressed={orderReviewForm.rating === value}
                          className={`inline-flex h-10 w-10 items-center justify-center rounded-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${orderReviewForm.rating >= value ? "text-amber-400" : darkMode ? "text-slate-500 hover:text-amber-400" : "text-slate-400 hover:text-amber-400"}`}
                        >
                          <Star size={18} fill="currentColor" aria-hidden="true" />
                        </button>
                      );
                    })}
                  </div>
                  <p className={`mt-2 text-xs ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Choose 1 to 5 stars.</p>
                </div>
                <div className="space-y-3">
                  <div>
                    <label htmlFor="review-template" className={`text-sm font-semibold ${darkMode ? "text-slate-200" : "text-slate-900"}`}>Review template</label>
                    <select
                      id="review-template"
                      defaultValue=""
                      onChange={(event) => {
                        const template = ORDER_REVIEW_TEMPLATES.find((entry) => entry.value === event.target.value);
                        if (!template) return;
                        setOrderReviewForm((current) => ({ ...current, title: template.title, comment: template.comment }));
                        setReviewFormError("");
                      }}
                      className={`mt-1.5 w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-red-500 ${darkMode ? "border-slate-700 bg-slate-800 text-white" : "border-slate-200 bg-white text-slate-900"}`}
                    >
                      <option value="">Choose a starting point</option>
                      {ORDER_REVIEW_TEMPLATES.map((template) => (
                        <option key={template.value} value={template.value}>{template.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="review-title" className={`text-sm font-semibold ${darkMode ? "text-slate-200" : "text-slate-900"}`}>Review Title</label>
                    <input
                      id="review-title"
                      type="text"
                      value={orderReviewForm.title}
                      onChange={(e) => handleOrderReviewChange("title", e.target.value)}
                      placeholder="Excellent Service"
                      className={`mt-1.5 w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-red-500 ${darkMode ? "border-slate-700 bg-slate-800 text-white placeholder:text-slate-500" : "border-slate-200 bg-white text-slate-900 placeholder:text-slate-400"}`}
                    />
                  </div>
                  <div>
                    <label htmlFor="review-comment" className={`text-sm font-semibold ${darkMode ? "text-slate-200" : "text-slate-900"}`}>Review Comment</label>
                    <textarea
                      id="review-comment"
                      value={orderReviewForm.comment}
                      onChange={(e) => handleOrderReviewChange("comment", e.target.value)}
                      placeholder="Tell us about the product quality, installation, and service experience."
                      rows={4}
                      maxLength={500}
                      className={`mt-1.5 w-full resize-y rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-red-500 ${darkMode ? "border-slate-700 bg-slate-800 text-white placeholder:text-slate-500" : "border-slate-200 bg-white text-slate-900 placeholder:text-slate-400"}`}
                    />
                    <p className={`mt-1 flex justify-between text-xs ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                      <span>Required. 10–500 characters.</span>
                      <span>{orderReviewForm.comment.length}/500</span>
                    </p>
                  </div>
                  <div>
                    <div className="mb-1.5 flex items-center justify-between gap-3">
                      <p className={`text-sm font-semibold ${darkMode ? "text-slate-200" : "text-slate-900"}`}>Upload Photos <span className={`font-normal ${darkMode ? "text-slate-400" : "text-slate-500"}`}>(optional)</span></p>
                      <span className={`text-xs ${darkMode ? "text-slate-400" : "text-slate-500"}`}>{orderReviewForm.photos.length}/5</span>
                    </div>
                    <label
                      htmlFor="review-photos"
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border border-dashed px-4 py-3 transition focus-within:ring-2 focus-within:ring-red-500 ${darkMode ? "border-slate-600 bg-slate-800 hover:border-slate-500" : "border-slate-300 bg-slate-50 hover:border-red-300 hover:bg-red-50/50"}`}
                    >
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${darkMode ? "bg-slate-700 text-red-300" : "bg-white text-red-600 shadow-sm"}`}>
                        <ImagePlus size={19} aria-hidden="true" />
                      </span>
                      <span className="min-w-0">
                        <span className={`block text-sm font-semibold ${darkMode ? "text-slate-100" : "text-slate-800"}`}>Choose project photos</span>
                        <span className={`mt-0.5 block text-xs ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Select up to 5 images from your device</span>
                      </span>
                      <input
                        id="review-photos"
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleOrderReviewPhotoChange}
                        className="sr-only"
                      />
                    </label>
                    {orderReviewForm.photoPreviews.length > 0 && (
                      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
                        {orderReviewForm.photoPreviews.map((src, index) => (
                          <div key={index} className="relative overflow-hidden rounded-lg border border-slate-200">
                            <img src={ensureAbsoluteUrl(src)} alt={`Preview ${index + 1}`} className="h-20 w-full object-cover" />
                            <button
                              type="button"
                              onClick={() => handleRemoveReviewPhoto(index)}
                              aria-label={`Remove photo ${index + 1}`}
                              className="absolute right-1 top-1 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white text-slate-700 shadow"
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
                  <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{reviewFormError}</div>
                )}
              </div>
              <div className={`flex flex-col-reverse gap-2 border-t px-5 py-3 sm:flex-row sm:justify-end ${darkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-slate-50"}`}>
                <button
                  type="button"
                  onClick={closeCustomerReviewModal}
                  className={`rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${darkMode ? "border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"}`}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitCustomerReview}
                  disabled={reviewFormLoading}
                  className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
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
                            <p className="mt-2 font-semibold text-slate-900">{formatDateToMMMDDYYYY(review.submittedAt) || "—"}</p>
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
              <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.8fr)_minmax(280px,0.8fr)]">
                <div className={`rounded-[22px] border p-4 shadow-sm ${darkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-slate-50"}`}>
                  <div className={`flex flex-col gap-4 rounded-[18px] border p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between ${darkMode ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white"}`}>
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

                  <div
                    className="mt-4 max-h-[560px] space-y-4 overflow-y-auto overflow-x-hidden pr-2 [&::-webkit-scrollbar]:h-2.5 [&::-webkit-scrollbar]:w-2.5 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-400 hover:[&::-webkit-scrollbar-thumb]:bg-slate-500 dark:[&::-webkit-scrollbar-track]:bg-slate-700 dark:[&::-webkit-scrollbar-thumb]:bg-slate-500 dark:hover:[&::-webkit-scrollbar-thumb]:bg-slate-400"
                    style={{ scrollbarWidth: "thin", scrollbarColor: darkMode ? "#64748b #334155" : "#94a3b8 #e2e8f0" }}
                  >
                    {cartItems.map((item) => (
                      <div key={item.cartId || item._id || item.name} className={`flex flex-col gap-4 rounded-[18px] border p-5 md:flex-row md:items-center md:justify-between ${darkMode ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white"}`}>
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
                            <div className="h-20 w-20 overflow-hidden rounded-[16px] border border-slate-200 bg-slate-100">
                              <img src={getProductImage(item)} alt={item.name} className="h-full w-full object-cover" />
                            </div>
                            <div>
                              <p className={darkMode ? "font-semibold text-white" : "font-semibold text-gray-900"}>{item.name}</p>
                              {(() => {
                                const measurementDetails = getCartItemMeasurementDetails(item);
                                if (measurementDetails) {
                                  return (
                                    <div className={`mt-2 space-y-1 text-sm ${darkMode ? "text-slate-300" : "text-gray-600"}`}>
                                      <div>
                                        {measurementDetails.dimensions} = {measurementDetails.area}
                                      </div>
                                      <div className={darkMode ? "text-slate-200" : "text-slate-700"}>
                                        {measurementDetails.unitRate}
                                      </div>
                                    </div>
                                  );
                                }

                                return (
                                  <div className={`mt-2 flex flex-wrap items-center gap-3 text-sm ${darkMode ? "text-slate-300" : "text-gray-500"}`}>
                                    <span>Qty: {item.quantity}</span>
                                    {item.is_estimate && item.width && item.height && (
                                      <span>Measurements: {item.width} {item.measurementUnit || item.unit || ""} × {item.height} {item.measurementUnit || item.unit || ""}</span>
                                    )}
                                  </div>
                                );
                              })()}
                              <p className={`mt-2 text-sm ${darkMode ? "text-slate-300" : "text-gray-500"}`}>
                                {item.is_estimate ? `₱${Number(item.estimated_price || 0).toLocaleString()} (estimated)` : getProductPrice(item)}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          <div className={`inline-flex overflow-hidden rounded-full border ${darkMode ? "border-slate-600 bg-slate-700" : "border-slate-200 bg-slate-100"}`}>
                            <button
                              onClick={() => handleUpdateCartQuantity(item.cartId, -1)}
                              className={`px-4 py-2 ${darkMode ? "bg-slate-700 text-slate-100 hover:bg-slate-600" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
                            >
                              −
                            </button>
                            <div className={`min-w-[52px] px-4 py-2 text-center text-sm font-semibold ${darkMode ? "bg-slate-800 text-white" : "bg-white text-slate-900"}`}>
                              {item.quantity}
                            </div>
                            <button
                              onClick={() => handleUpdateCartQuantity(item.cartId, 1)}
                              className={`px-4 py-2 ${darkMode ? "bg-slate-700 text-slate-100 hover:bg-slate-600" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
                            >
                              +
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveFromCart(item.cartId)}
                            aria-label={`Remove ${item.name || "item"} from cart`}
                            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-100"
                          >
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="h-5 w-5"
                              aria-hidden="true"
                            >
                              <path d="M3 6h18" />
                              <path d="M8 6V4.8A1.8 1.8 0 0 1 9.8 3h4.4A1.8 1.8 0 0 1 16 4.8V6" />
                              <path d="M6 6l1 13.2A1.8 1.8 0 0 0 8.8 21h6.4a1.8 1.8 0 0 0 1.8-1.8L18 6" />
                              <path d="M10 11v5" />
                              <path d="M14 11v5" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <aside className={`rounded-[22px] border p-5 shadow-sm ${darkMode ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white"}`}>
                  <h3 className={`text-2xl font-bold ${darkMode ? "text-white" : "text-slate-900"}`}>Order Summary</h3>

                  <div className="mt-5 space-y-4">
                    <div className={`flex items-center justify-between gap-4 py-2 ${darkMode ? "text-slate-200" : "text-slate-700"}`}>
                      <span>Subtotal ({selectedItemCount} selected)</span>
                      <span className="font-semibold">₱{Number(selectedSubtotal || 0).toLocaleString()}</span>
                    </div>
                    <div className={`flex items-center justify-between gap-4 border-t py-3 ${darkMode ? "border-slate-700 text-slate-200" : "border-slate-200 text-slate-900"}`}>
                      <span className="font-semibold">Estimated Total</span>
                      <span className="font-bold text-red-600">₱{Number(selectedSubtotal || 0).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="mt-6 space-y-3">
                    <button
                      type="button"
                      onClick={openBatchOrderModal}
                      disabled={checkoutLoading || selectedItemCount === 0}
                      className="w-full rounded-[14px] border border-red-300 bg-white px-4 py-3 text-base font-bold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Checkout Selected ({selectedItemCount})
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteSelectedItems}
                      disabled={selectedItemCount === 0}
                      className="w-full rounded-[14px] bg-red-600 px-4 py-3 text-base font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Delete Selected ({selectedItemCount})
                    </button>
                  </div>
                </aside>
              </div>

              {checkoutError && <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">{checkoutError}</div>}
              {checkoutMessage && <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-700">{checkoutMessage}</div>}
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

            <div className={`mb-6 inline-flex flex-wrap gap-1 rounded-2xl border p-1 ${darkMode ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-slate-100"}`}>
              {[
                ["all", "All", orders.length],
                ["unread", "Unread", unreadNotificationCount],
                ["read", "Read", readNotificationCount],
              ].map(([filter, label, count]) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setNotificationFilter(filter)}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                    notificationFilter === filter
                      ? darkMode
                        ? "bg-slate-950 text-white shadow-sm"
                        : "bg-white text-slate-950 shadow-sm"
                      : darkMode
                        ? "text-slate-300 hover:bg-slate-700"
                        : "text-slate-600 hover:bg-white/70"
                  }`}
                >
                  {label} ({count})
                </button>
              ))}
            </div>

            {ordersLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, index) => (
                  <div key={index} className="animate-pulse rounded-3xl bg-white p-8 shadow" />
                ))}
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className={`rounded-3xl p-10 text-center shadow ${darkMode ? "bg-slate-800 text-slate-200" : "bg-white text-gray-600"}`}>
                <p className={darkMode ? "text-slate-300" : "text-gray-600"}>{notificationFilter === "all" ? "No notifications yet. You'll see updates about your orders here." : `No ${notificationFilter} notifications.`}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {[...filteredNotifications]
                  .sort((a, b) => new Date(b.notificationDate || 0) - new Date(a.notificationDate || 0))
                  .map((order) => {
                    const product = order.items?.[0] || {};
                    const status = String(order.status || "").toLowerCase();
                    const contractStatus = String(order.contract_status || "").toLowerCase();
                    const isPaymentNotification = order.notificationType === "payment";
                    const isContractReady =
                      status === "contract_sent" ||
                      (status === "site_inspection" && contractStatus === "sent") ||
                      contractStatus === "sent";
                    const notificationMessage = () => {
                      if (isPaymentNotification) {
                        return `Your payment proof for ${formatCurrency(order.payment_proof_amount)} has been sent for confirmation.`;
                      }
                      if (isContractReady) {
                        return "A contract has been sent for your review and acceptance.";
                      }

                      switch (status) {
                        case "order_submitted":
                          return "Your order has been submitted and is awaiting admin review.";
                        case "admin_review":
                          return "Your order is under admin review.";
                        case "site_inspection":
                          return "Your project site inspection is scheduled.";
                        case "contract_accepted":
                          return "Your contract has been accepted. Fabrication is starting soon.";
                        case "fabrication":
                          return "Your project is currently in fabrication.";
                        case "installation":
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
                      if (isPaymentNotification) return "text-emerald-600";
                      if (order.status === "completed") return "text-emerald-600";
                      if (order.status === "cancelled") return "text-red-600";
                      if (isContractReady || ["contract_sent", "contract_accepted"].includes(status) || ["sent", "accepted"].includes(contractStatus)) return "text-blue-600";
                      return "text-amber-600";
                    };

                    return (
                      <div
                        key={order.notificationId}
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
                              <span>{formatDateToMMMDDYYYY(order.notificationDate) || "—"}</span>
                              <button
                                onClick={() => {
                                  markCustomerNotificationRead(order.notificationId);
                                  if (isPaymentNotification) {
                                    const orderId = order._id || order.id || order.tracking;
                                    setOrderFilter("all");
                                    setOrderPage(1);
                                    setSelectedOrderForModal(null);
                                    setExpandedOrderId(orderId);
                                  } else {
                                    setSelectedOrderForModal(order);
                                  }
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
                  Contracts ({customerContracts.length})
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
                        const warrantyStartDate = formatDateToMMMDDYYYY(order.warranty_start_date) || "—";
                        const warrantyExpiryDate = formatDateToMMMDDYYYY(order.warranty_expiry_date) || "—";
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
                              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-black leading-tight ${statusClass}`}>{statusLabel}</span>
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
              <>
                <div className={`space-y-3 rounded-[28px] border p-3 shadow-[0_18px_45px_rgba(127,29,29,0.08)] sm:p-4 ${darkMode ? "border-slate-700 bg-slate-900" : "border-red-200 bg-slate-50"}`}>
                {paginatedContracts.map((order) => {
                  const product = order.items?.[0] || {};
                  const statusLabel = getContractStatusLabel(order);
                  const statusClass = order.contract_status === "accepted" || order.status === "contract_accepted"
                    ? darkMode
                      ? "border border-emerald-400/30 bg-emerald-500/15 text-emerald-300"
                      : "bg-emerald-100 text-emerald-700"
                    : darkMode
                      ? "border border-red-400/30 bg-red-500/15 text-red-300"
                      : "bg-red-100 text-red-700";
                  const orderDate = formatDateToMMMDDYYYY(order.updatedAt || order.createdAt) || "—";

                  return (
                    <article key={order._id || order.tracking} className={`overflow-hidden rounded-[20px] border shadow-[0_8px_18px_rgba(15,23,42,0.04)] transition hover:shadow-[0_10px_24px_rgba(15,23,42,0.08)] ${darkMode ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white"}`}>
                      <div className="grid min-w-0 items-center gap-4 p-4 xl:grid-cols-[minmax(0,2.1fr)_minmax(150px,0.8fr)_minmax(150px,0.8fr)_minmax(140px,0.75fr)_auto]">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[12px] border text-lg font-black ${darkMode ? "border-red-900 bg-red-950/50 text-red-300" : "border-red-100 bg-red-50 text-red-700"}`}>
                            <FileText size={21} />
                          </div>
                          <div className="min-w-0">
                            <p className={`truncate text-base font-black ${darkMode ? "text-white" : "text-slate-900"}`}>{product.name || product.product_name || "Project"}</p>
                            <p className={`mt-1 text-xs font-semibold ${darkMode ? "text-slate-400" : "text-slate-500"}`}>{order.tracking || order._id || "—"}</p>
                          </div>
                        </div>

                        <div className="min-w-0 text-center xl:text-left">
                          <p className={`text-[9px] font-black uppercase tracking-[0.18em] ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Amount</p>
                          <p className="mt-1 text-base font-black text-red-600 sm:text-lg">{formatCurrency(order.contract_amount || order.total_amount)}</p>
                        </div>

                        <div className="min-w-0 text-center xl:text-left">
                          <p className={`text-[9px] font-black uppercase tracking-[0.18em] ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Status</p>
                          <span className={`mt-1 inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-black leading-tight ${statusClass}`}>{statusLabel}</span>
                        </div>

                        <div className="min-w-0 text-center xl:text-left">
                          <p className={`text-[9px] font-black uppercase tracking-[0.18em] ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Date</p>
                          <p className={`mt-1 text-xs font-semibold ${darkMode ? "text-slate-300" : "text-slate-700"}`}>{orderDate}</p>
                        </div>

                        <div className="flex min-w-0 flex-wrap justify-center gap-2 xl:justify-end">
                          <button type="button" onClick={() => openContractModal(order)} className="rounded-[10px] bg-red-600 px-3.5 py-2 text-xs font-black text-white transition hover:bg-red-700">
                            View Contract
                          </button>
                          <button type="button" onClick={() => setSelectedOrderForModal(order)} className="rounded-[10px] bg-[#101114] px-3.5 py-2 text-xs font-black text-white transition hover:bg-black">
                            Order Details
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
                </div>

                {contractPageCount > 1 && (
                  <div className={`mt-4 flex flex-wrap items-center justify-center gap-2 rounded-2xl border p-3 ${darkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"}`}>
                    <button
                      type="button"
                      onClick={() => setContractPage((page) => Math.max(1, page - 1))}
                      disabled={safeContractPage === 1}
                      className={`rounded-xl border px-3 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${darkMode ? "border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
                    >
                      Previous
                    </button>
                    {Array.from({ length: contractPageCount }, (_, index) => index + 1).map((pageNumber) => (
                      <button
                        key={pageNumber}
                        type="button"
                        onClick={() => setContractPage(pageNumber)}
                        className={`h-9 min-w-9 rounded-xl px-2 text-sm font-black transition ${safeContractPage === pageNumber ? "bg-red-600 text-white" : darkMode ? "border border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
                      >
                        {pageNumber}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setContractPage((page) => Math.min(contractPageCount, page + 1))}
                      disabled={safeContractPage === contractPageCount}
                      className={`rounded-xl border px-3 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${darkMode ? "border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        <footer className={`relative left-1/2 -mb-6 ${activeTab === "orders" ? "mt-0" : "mt-auto"} w-screen -translate-x-1/2 border-t ${darkMode ? "border-slate-700 bg-slate-950/90" : "border-slate-200 bg-slate-900/90"}`}>
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <div className="grid gap-6 md:gap-8 lg:grid-cols-3">
              <div>
                <div className="flex items-center gap-3">
                  <img src={logo} alt="logo" className="h-10 w-14 object-contain" />
                  <div>
                    <h3 className={`text-base font-bold ${darkMode ? "text-white" : "text-white"}`}>ACGC Aluminum Services</h3>
                    <p className="text-xs text-slate-300">Premium Glass &amp; Aluminum Solutions</p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="mb-3 text-sm font-bold text-white">Quick Links</h4>
                <div className="space-y-2 text-xs text-slate-300">
                  <p>Home</p>
                  <p>Browse Products</p>
                  <p>Track Order</p>
                  <p>About Us</p>
                </div>
              </div>

              <div>
                <h4 className="mb-3 text-sm font-bold text-white">Contact</h4>
                <div className="space-y-2 text-xs text-slate-300">
                  <p>Email: acgc.services00@email.com</p>
                  <p>Phone: +63 900 000 0000</p>
                  <p>Philippines</p>
                </div>
              </div>
            </div>

            <div className="mt-6 border-t border-white/20 pt-4 text-center text-[11px] text-slate-300">
              © 2026 ACGC Aluminum Services — All Rights Reserved.
            </div>
          </div>
        </footer>

        <ContractModal
          isOpen={showContractModal}
          onClose={closeContractModal}
          inspection={contractPreviewOrder}
          contractData={contractPreviewData}
          onDownloadPNG={isContractAccepted ? downloadAcceptedContractPNG : undefined}
          onPrint={isContractAccepted ? printAcceptedContract : undefined}
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
                  ? "By accepting, you confirm that you reviewed and electronically signed this contract. The completed inspection will move to Transactions for admin approval."
                  : "Please tell ACGC why you are declining this contract. Your order will remain in the Site Inspection workflow."}
              </p>
              {contractConfirmModal.action === "decline" && (
                <textarea
                  value={contractDeclineReason}
                  onChange={(event) => setContractDeclineReason(event.target.value)}
                  placeholder="Reason for declining (required)"
                  rows={3}
                  className="mb-3 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-red-500"
                />
              )}
              {contractActionError && <p className="mb-3 text-sm font-semibold text-red-600">{contractActionError}</p>}
              <div className="flex justify-end gap-3">
                <button
                  onClick={closeContractConfirmModal}
                  className="px-4 py-2 rounded-lg bg-gray-100 text-slate-700 hover:bg-gray-200 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmContractAction}
                    disabled={contractActionLoading || (contractConfirmModal.action === "decline" && !contractDeclineReason.trim())}
                  className={`px-4 py-2 rounded-lg text-white transition disabled:opacity-50 disabled:cursor-not-allowed ${
                    contractConfirmModal.action === "accept"
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : "bg-red-600 hover:bg-red-700"
                  }`}
                >
                  {contractActionLoading
                    ? contractConfirmModal.action === "accept"
                      ? "Signing..."
                      : "Declining..."
                    : contractConfirmModal.action === "accept" ? "Accept & Sign Contract" : "Confirm Decline"}
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
