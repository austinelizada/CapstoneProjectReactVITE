import { useEffect, useState } from "react";
import { Star, Search, Loader2 } from "lucide-react";
import Sidebar from "../../components/layout/Sidebar";
import Navbar from "../../components/layout/Navbar";
import { getProducts } from "@/api/products";
import { getProductReviews } from "@/api/orders";

function ProductReviews() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem("sidebarOpen");
    return stored !== null ? JSON.parse(stored) : true;
  });
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    localStorage.setItem("sidebarOpen", JSON.stringify(isSidebarOpen));
  }, [isSidebarOpen]);

  useEffect(() => {
    let active = true;
    const loadProducts = async () => {
      setProductsLoading(true);
      try {
        const response = await getProducts();
        if (!active) return;
        setProducts(response.products || []);
      } catch (err) {
        if (!active) return;
        setError(err.data?.message || err.message || "Unable to load products.");
      } finally {
        if (active) setProductsLoading(false);
      }
    };
    loadProducts();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedProduct?._id) {
      setReviews([]);
      return;
    }

    let active = true;
    const loadReviews = async () => {
      setReviewsLoading(true);
      setError("");
      try {
        const response = await getProductReviews(selectedProduct._id);
        if (!active) return;
        setReviews(response.reviews || []);
      } catch (err) {
        if (!active) return;
        setError(err.data?.message || err.message || "Unable to load reviews.");
        setReviews([]);
      } finally {
        if (active) setReviewsLoading(false);
      }
    };

    loadReviews();
    return () => {
      active = false;
    };
  }, [selectedProduct]);

  const avgRating = reviews.length
    ? (reviews.reduce((sum, review) => sum + (review.rating || 0), 0) / reviews.length).toFixed(1)
    : "—";

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">
      <Sidebar isOpen={isSidebarOpen} />
      <div className="flex-1 min-h-0 flex flex-col">
        <Navbar toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
        <main className="flex-1 min-h-0 overflow-y-auto p-6">
          <div className="bg-gradient-to-r from-red-700 via-red-600 to-orange-500 rounded-3xl p-8 text-white shadow-lg">
            <h1 className="text-3xl font-bold">Product Reviews</h1>
            <p className="mt-2 text-red-100 max-w-2xl">
              Review customer feedback by product and monitor ratings, comments, and submitted photos.
            </p>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[320px_1fr]">
            <div className="space-y-4">
              <div className="rounded-3xl bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">Select Product</h2>
                <p className="mt-2 text-sm text-slate-500">Choose a product to load its customer reviews.</p>
                <div className="mt-4">
                  <label className="block text-sm font-semibold text-slate-700">Product</label>
                  <div className="mt-2 relative">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <select
                      value={selectedProduct?._id || ""}
                      onChange={(e) => {
                        const product = products.find((p) => String(p._id || p.id) === e.target.value);
                        setSelectedProduct(product || null);
                      }}
                      className="w-full rounded-3xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-900 shadow-sm focus:border-red-600 focus:outline-none"
                    >
                      <option value="">Choose a product</option>
                      {products.map((product) => (
                        <option key={product._id || product.id} value={product._id || product.id}>
                          {product.product_name || product.name || "Unnamed product"}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">Summary</h2>
                <div className="mt-4 grid gap-4">
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Selected Product</p>
                    <p className="mt-2 font-semibold text-slate-900">{selectedProduct?.product_name || selectedProduct?.name || "No product selected"}</p>
                  </div>
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Total Reviews</p>
                    <p className="mt-2 font-semibold text-slate-900">{selectedProduct ? reviews.length : "—"}</p>
                  </div>
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Average Rating</p>
                    <p className="mt-2 flex items-center gap-2 font-semibold text-slate-900">
                      {avgRating}
                      <span className="inline-flex items-center gap-1 text-amber-500">
                        <Star size={16} />
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-3xl bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Customer Reviews</h2>
                    <p className="mt-1 text-sm text-slate-500">Showing reviews for the selected product.</p>
                  </div>
                  {reviewsLoading && (
                    <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-700">
                      <Loader2 size={18} className="animate-spin" /> Loading reviews
                    </div>
                  )}
                </div>

                {error && (
                  <div className="mt-4 rounded-3xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    {error}
                  </div>
                )}

                {!selectedProduct && !productsLoading && (
                  <div className="mt-6 rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-slate-600">
                    Select a product to view reviews.
                  </div>
                )}

                {selectedProduct && !reviewsLoading && reviews.length === 0 && (
                  <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-6 text-center text-slate-600">
                    No reviews found for this product.
                  </div>
                )}

                {selectedProduct && reviews.length > 0 && (
                  <div className="mt-6 space-y-4">
                    {reviews.map((review) => (
                      <div key={`${review.orderId}-${review.submittedAt}`} className="rounded-3xl border border-slate-200 p-6">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm text-slate-500">Customer</p>
                            <p className="mt-1 font-semibold text-slate-900">{review.customerName}</p>
                          </div>
                          <div className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-700">
                            <span>{Array.from({ length: review.rating || 0 }).map((_, index) => (<Star key={index} size={14} />))}</span>
                            <span>{review.rating.toFixed(1)}</span>
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

                        <div className="mt-4">
                          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Comment</p>
                          <p className="mt-2 text-sm leading-6 text-slate-700">{review.comment}</p>
                        </div>

                        {review.photos?.length > 0 && (
                          <div className="mt-4 grid grid-cols-2 gap-3">
                            {review.photos.map((photo, index) => (
                              <img
                                key={index}
                                src={photo}
                                alt={`Review photo ${index + 1}`}
                                className="h-28 w-full rounded-3xl object-cover"
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
        </main>
      </div>
    </div>
  );
}

export default ProductReviews;
