import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Menu,
  X,
  ArrowRight,
  ShoppingBag,
  Search,
  BriefcaseBusiness,
  ShieldCheck,
  Clock3,
  Wrench,
  Star,
  StarHalf,
} from "lucide-react";
import { getProducts } from "../../api/products";
import { getProductReviews } from "../../api/orders";
import logo from "../../assets/images/ACGCLOGO1.png";
import heroVisual from "../../../backend/uploads/1780678859091-c2tdfj-main.jpg";

function LandingPage() {

  const [active, setActive] = useState("home");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [featuredProductStats, setFeaturedProductStats] = useState({});
  const [heroImages, setHeroImages] = useState([heroVisual]);
  const [heroImageIndex, setHeroImageIndex] = useState(0);
  const [isLoadingFeatured, setIsLoadingFeatured] = useState(false);
  const [featuredError, setFeaturedError] = useState("");
  const scrollToSection = (sectionId) => {
    setActive(sectionId);
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    const loadFeaturedProducts = async () => {
      setIsLoadingFeatured(true);
      setFeaturedError("");

      try {
        const response = await getProducts();
        let allProducts = response.products || [];

        const activeProducts = allProducts.filter((product) => product.is_active !== false);

        const productReviewData = await Promise.all(
          activeProducts.map(async (product) => {
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
              };
            } catch (error) {
              return {
                product,
                averageRating: 0,
                ratingsCount: 0,
              };
            }
          })
        );

        const stats = {};
        const sortedProducts = productReviewData
          .sort((a, b) => {
            if (b.averageRating !== a.averageRating) return b.averageRating - a.averageRating;
            return b.ratingsCount - a.ratingsCount;
          })
          .map(({ product, averageRating, ratingsCount }) => {
            stats[product._id || product.id] = { averageRating, ratingsCount };
            return product;
          });

        const productImages = allProducts
          .filter((product) => product.is_active !== false)
          .map((product) => getProductImage(product))
          .filter(Boolean);

        setFeaturedProducts(sortedProducts);
        setFeaturedProductStats(stats);
        setHeroImages(productImages.length ? productImages : [heroVisual]);
        setHeroImageIndex(0);
      } catch (error) {
        console.error("Failed to load featured products", error);
        setFeaturedProducts([]);
        setFeaturedProductStats({});
        setFeaturedError(
          error?.data?.message || error?.message || "Failed to load featured products."
        );
      } finally {
        setIsLoadingFeatured(false);
      }
    };

    loadFeaturedProducts();
  }, []);

  const isLocalBlobOrFile = (url) =>
    typeof url === "string" && (url.startsWith("blob:") || url.startsWith("file:"));

  const getProductImage = (product) => {
    if (!product) return "";
    const imageCandidates = [product.image_url, product.image];
    if (Array.isArray(product.images) && product.images.length > 0) {
      imageCandidates.push(product.images[0]);
    }
    if (product.images && typeof product.images === "object") {
      const images = Object.values(product.images).flat().filter(Boolean);
      if (images.length > 0) imageCandidates.push(images[0]);
    }

    for (const candidate of imageCandidates) {
      if (typeof candidate === "string" && candidate.trim()) {
        if (!isLocalBlobOrFile(candidate)) {
          return candidate;
        }
      }
    }

    return "";
  };

  const getProductPrice = (product) => {
    if (!product) return "Contact us";
    const pricePerSqft = Number(product.price_per_sqft || 0);
    const unitPrice = Number(product.unit_price || 0);
    if (pricePerSqft > 0) return `₱${pricePerSqft.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/sqft`;
    if (unitPrice > 0) return `₱${unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    return "Contact us";
  };

  const renderRatingStars = (rating = 0, size = 16) => {
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

  useEffect(() => {
    if (heroImages.length <= 1) return undefined;

    const intervalId = setInterval(() => {
      setHeroImageIndex((currentIndex) => (currentIndex + 1) % heroImages.length);
    }, 2000);

    return () => clearInterval(intervalId);
  }, [heroImages]);

  return (
  <div className="min-h-screen bg-gradient-to-r from-white-300 via-gray-100 to-white-200 text-gray-900 overflow-x-hidden"> {/* BACKGROUND FX */}

      <motion.div
        animate={{
          x:[0,50,0],
          y:[0,-40,0],
        }}
        transition={{
          duration:10,
          repeat:Infinity,
        }}
    className="absolute top-[-120px] right-[-120px] w-[420px] h-[420px] rounded-full bg-red-500/20 blur-[120px]"      />

      <motion.div
        animate={{
          x:[0,-80,0],
          y:[0,60,0],
        }}
        transition={{
          duration:14,
          repeat:Infinity,
        }}
    className="absolute bottom-[-180px] left-[-120px] w-[500px] h-[500px] rounded-full bg-gray-300/40 blur-[160px]"      />

      {/* NAVBAR */}

      <motion.header
        initial={{y:-80,opacity:0}}
        animate={{y:0,opacity:1}}
        transition={{duration:1}}
        className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-white/95 backdrop-blur-2xl shadow-sm"
      >

        <div className="w-full px-6 py-5 flex justify-between items-center">

          {/* LOGO */}

          <button
            type="button"
            onClick={() => {
              setActive("home");
              document.getElementById("home")?.scrollIntoView({ behavior: "smooth" });
            }}
            className="flex items-center gap-4 text-left"
            aria-label="Go to ACGC Services home"
          >
            <motion.img
              animate={{
                rotate:[0,3,-3,0]
              }}
              transition={{
                duration:6,
                repeat:Infinity
              }}
              src={logo}
              alt="logo"
              className="w-16 h-16 object-contain sm:w-20 sm:h-20"
            />

            <div className="leading-tight">
              <h1 className="font-black text-2xl text-red-600 tracking-tight">
                ACGC Services
              </h1>
              <p className="text-2xl text-gray-700 font-bold tracking-tight sm:text-2xl">
                Aluminum & Glass Services
              </p>
            </div>
          </button>

          {featuredError && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
              <p className="font-semibold">Backend connection issue</p>
              <p>{featuredError}</p>
            </div>
          )}

                {/* DESKTOP NAV */}

        <nav className="hidden lg:flex items-center gap-10">

        {[
            { name: "Browse Products", id: "products" },
            { name: "About Us", id: "about" },
            { name: "Track Order", id: "track-order", path: "/track-order" },
        ].map((item, index) => (

            item.path ? (
              <Link
                key={index}
                to={item.path}
                onClick={() => setActive(item.id)}
                className={`relative transition duration-300 font-medium ${
                  active === item.id
                    ? "text-red-600"
                    : "text-gray-800 hover:text-red-600"
                }`}
              >

                {item.name}

                {active === item.id && (
                  <motion.div
                    layoutId="activeNav"
                    className="absolute -bottom-2 left-0 w-full h-[2px] bg-red-500"
                  />
                )}

              </Link>
            ) : (
              <button
                key={index}
                onClick={() => {
                  setActive(item.id);

                  document
                    .getElementById(item.id)
                    ?.scrollIntoView({
                      behavior: "smooth",
                    });
                }}
                className={`relative transition duration-300 font-medium ${
                  active === item.id
                    ? "text-red-600"
                    : "text-gray-800 hover:text-red-600"
                }`}
              >

                {item.name}

                {active === item.id && (
                  <motion.div
                    layoutId="activeNav"
                    className="absolute -bottom-2 left-0 w-full h-[2px] bg-red-500"
                  />
                )}

              </button>
            )

        ))}

        </nav>
          {/* ACTIONS */}

          <div className="hidden lg:flex items-center gap-4">

            <Link
              to="/login"
              className="border border-white/20 hover:border-gray-500 px-5 py-2 rounded-xl bg-white/5 backdrop-blur-xl transition"
            >
              Login
            </Link>

            <Link
              to="/signup"
              className="bg-red-600 text-white px-6 py-2 rounded-xl font-semibold shadow-lg shadow-red-900/20 hover:scale-105 transition"
            >
              Sign Up
            </Link>

          </div>

          {/* MOBILE MENU */}

          <button
            onClick={()=>setMobileMenu(!mobileMenu)}
            className="lg:hidden"
          >
            {mobileMenu ? <X size={30}/> : <Menu size={30}/>}
          </button>

        </div>

        {/* MOBILE DROPDOWN */}

        {mobileMenu && (

          <motion.div
            initial={{opacity:0,y:-30}}
            animate={{opacity:1,y:0}}
            className="lg:hidden bg-[#111] border-t border-gray-200"
          >

            <div className="px-6 py-6 flex flex-col gap-5">

              <button
                type="button"
                onClick={() => {
                  setMobileMenu(false);
                  scrollToSection("products");
                }}
                className="text-left text-white hover:text-red-400"
              >
                Browse Products
              </button>

              <button
                onClick={() => {
                  setActive("about");
                  setMobileMenu(false);
                  document.getElementById("about")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="text-left text-white hover:text-red-400"
              >
                About Us
              </button>

              <Link to="/track-order" onClick={() => setMobileMenu(false)} className="text-left text-white hover:text-gray-400">
                Track Order
              </Link>

              <Link
                to="/login"
                onClick={() => setMobileMenu(false)}
                className="text-center border border-red-600 py-3 rounded-xl"
              >
                Login
              </Link>

              <Link
                to="/signup"
                onClick={() => setMobileMenu(false)}
                className="text-center bg-red-600 py-3 rounded-xl text-white"
              >
                Sign Up
              </Link>

            </div>

          </motion.div>

        )}

      </motion.header>

      {/* HERO */}

      <section id="home" className="relative overflow-hidden bg-[#941d24] text-white pt-32">
        <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.18)_1px,transparent_1px)] [background-size:42px_42px]" />
        <div className="relative mx-auto flex min-h-[470px] max-w-7xl items-center justify-center px-6 py-20 text-center">
          <div className="max-w-3xl">
            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-sm font-semibold uppercase tracking-[0.28em] text-red-100">
              ACGC Services
            </motion.p>
            <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="mt-5 text-4xl font-black leading-tight sm:text-6xl">
              Custom Glass &amp; Aluminum Solutions
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 25 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mx-auto mt-6 max-w-2xl text-base leading-7 text-red-100 sm:text-lg">
              Professional fabrication and installation of glass windows, doors, partitions, and aluminum works for your space.
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="mt-9 flex flex-wrap justify-center gap-3">
              <button type="button" onClick={() => scrollToSection("products")} className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-red-700 shadow-lg transition hover:bg-red-50">
                <ShoppingBag size={18} /> Browse Products <ArrowRight size={16} />
              </button>
              <Link to="/track-order" className="inline-flex items-center gap-2 rounded-xl border border-white/70 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10">
                <Search size={18} /> Track Order
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto -mt-8 max-w-5xl px-6">
        <div className="grid gap-6 rounded-3xl bg-white px-6 py-8 text-center shadow-xl sm:grid-cols-3 sm:px-10">
          <div><ShieldCheck className="mx-auto h-11 w-11 text-slate-900" strokeWidth={1.7} /><h2 className="mt-4 text-lg font-black">Quality Guaranteed</h2><p className="mt-2 text-sm text-slate-600">Premium materials and careful workmanship.</p></div>
          <div><Clock3 className="mx-auto h-11 w-11 text-slate-900" strokeWidth={1.7} /><h2 className="mt-4 text-lg font-black">Fast Turnaround</h2><p className="mt-2 text-sm text-slate-600">Efficient production for your project timeline.</p></div>
          <div><Wrench className="mx-auto h-11 w-11 text-slate-900" strokeWidth={1.7} /><h2 className="mt-4 text-lg font-black">Expert Installation</h2><p className="mt-2 text-sm text-slate-600">Professional site inspection and installation.</p></div>
        </div>
      </section>
{/* PRODUCTS SECTION */}

<section
  id="products"
  className="relative max-w-7xl mx-auto px-6 py-28"
>

  <motion.div
    initial={{opacity:0,y:60}}
    whileInView={{opacity:1,y:0}}
    viewport={{once:true}}
    transition={{duration:1}}
    className="text-center"
  >

    <h2 className="text-5xl font-black">

      Browse

      <span className="text-red-500">
        {" "}Products
      </span>

    </h2>

    <p className="text-gray-400 mt-6 max-w-2xl mx-auto">

      Explore all available aluminum and glass solutions
      created for modern residential and commercial projects.

    </p>

  </motion.div>

  <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-3">
    {isLoadingFeatured ? (
      <div className="col-span-full rounded-[24px] border border-slate-200 bg-white p-10 text-center text-slate-600 shadow-sm">
        Loading products...
      </div>
    ) : featuredProducts.length === 0 ? (
      <div className="col-span-full rounded-[24px] border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-slate-600">
        No products are available right now.
      </div>
    ) : (
      featuredProducts.map((product, index) => {
        const imageUrl = getProductImage(product);
        const reviewStats = featuredProductStats[product._id || product.id] || { averageRating: 0, ratingsCount: 0 };
        const averageRating = Number(reviewStats.averageRating) || 0;
        const reviewsCount = Number(reviewStats.ratingsCount) || 0;

        return (
          <motion.div
            key={product._id || product.id || index}
            initial={{opacity:0,y:80}}
            whileInView={{opacity:1,y:0}}
            viewport={{once:true}}
            transition={{delay:index * 0.12,duration:0.7}}
            whileHover={{scale:1.01}}
            className="group cursor-pointer overflow-hidden rounded-[20px] border border-slate-200 bg-slate-50 shadow-[0_8px_22px_rgba(15,23,42,0.05)] transition duration-300 hover:-translate-y-1 hover:border-red-200 hover:shadow-[0_18px_30px_rgba(239,68,68,0.12)]"
          >
            <div className="relative h-100 overflow-hidden bg-slate-100">
              {imageUrl ? (
                <img src={imageUrl} alt={product.product_name || product.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-red-600/20 to-white/5" />
              )}
              <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-slate-900/25 to-transparent" />
            </div>

            <div className="space-y-5 p-5">
              <div className="flex items-center justify-between gap-3">
                <span className="rounded-full bg-red-50 px-2.5 py-1 text-[12px] font-bold uppercase tracking-[0.18em] text-red-700">
                  {product.category || product.product_type || "General"}
                </span>
                <span className="text-base font-extrabold text-emerald-600">{getProductPrice(product)}</span>
              </div>

              <div>
                <h3 className="text-[1.8rem] font-black leading-tight text-slate-900">
                  {product.product_name || product.name || "Unnamed Product"}
                </h3>
                <p className="mt-2 line-clamp-2 text-[0.95rem] leading-6 text-slate-700">
                  {product.description || "Premium aluminum and glass product crafted for reliability and style."}
                </p>
              </div>

              <div className="flex items-center justify-between gap-3 pt-1">
                <div className="flex min-w-0 flex-col">
                  <div className="flex items-center gap-1 text-amber-500">
                    {renderRatingStars(averageRating, 14)}
                  </div>
                  <span className="mt-1 text-[15px] font-semibold text-slate-600">
                    {averageRating > 0 ? `${averageRating.toFixed(1)} (${reviewsCount} review${reviewsCount === 1 ? "" : "s"})` : "No reviews yet"}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => scrollToSection("products")}
                  className="inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700"
                >
                  View
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </motion.div>
        );
      })
    )}
  </div>

</section>

{/* TRACK ORDER SECTION */}


{/* ABOUT SECTION */}

<section
  id="about"
  className="max-w-7xl mx-auto px-6 py-28"
>

  <div className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm sm:p-10">
    <motion.div
      initial={{ opacity: 0, y: -18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.55 }}
      className="flex items-center justify-between gap-4 border-b border-slate-100 pb-4"
    >
      <div className="flex items-center gap-3">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-red-50 text-red-600"><BriefcaseBusiness size={17} /></span>
        <h2 className="text-3xl font-black tracking-tight text-slate-950">About Us</h2>
      </div>
      <span className="rounded-full border border-red-200 bg-white px-5 py-2 text-[11px] font-black uppercase tracking-[0.2em] text-red-700">
        ACGC Services
      </span>
    </motion.div>

    <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_1fr]">
      <motion.div
        initial={{ opacity: 0, x: -40 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7 }}
        className="space-y-5"
      >
        <div>
          <p className="text-xs font-black uppercase tracking-[0.28em] text-slate-500">Who We Are</p>
          <p className="mt-3 text-sm leading-8 text-slate-600">
            ACGC Aluminum &amp; Glass Construction provides durable and professional aluminum and glass solutions for residential and commercial spaces. We combine accurate measurements, quality materials, and dependable installation services to help every project feel complete.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15, duration: 0.5 }}
            className="rounded-2xl border border-slate-100 bg-slate-50 p-5"
          >
            <p className="text-[11px] font-black uppercase tracking-[0.26em] text-red-700">Our Mission</p>
            <p className="mt-3 text-sm leading-7 text-slate-600">To deliver clean, dependable, and customer-focused aluminum and glass workmanship.</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.25, duration: 0.5 }}
            className="rounded-2xl border border-slate-100 bg-slate-50 p-5"
          >
            <p className="text-[11px] font-black uppercase tracking-[0.26em] text-red-700">Our Work</p>
            <p className="mt-3 text-sm leading-7 text-slate-600">Windows, doors, partitions, shutters, safety glass, and custom aluminum fabrication.</p>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.35, duration: 0.5 }}
          className="rounded-2xl border border-red-100 bg-red-50 p-5"
        >
          <p className="text-[11px] font-black uppercase tracking-[0.25em] text-red-700">Our Promise</p>
          <p className="mt-3 text-sm leading-7 text-slate-700">Every job is handled with honest guidance, careful project planning, and professional execution.</p>
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: 40 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7 }}
        className="rounded-[24px] bg-slate-950 p-6 text-white"
      >
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <span className="text-[11px] font-black uppercase tracking-[0.26em] text-red-300">Our Process</span>
          <span className="rounded-full border border-white/20 px-4 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-white">01 → 04</span>
        </div>
        <div className="mt-6 space-y-5">
          {[
            ["Consultation", "Learn your project needs and timeline."],
            ["Measurement", "Plan the precise fit and materials."],
            ["Fabrication", "Produce the aluminum and glass elements."],
            ["Installation", "Finish the project with quality workmanship."],
          ].map(([title, description], index) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, x: 18 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.15 + index * 0.12, duration: 0.5 }}
              className="flex items-start gap-3"
            >
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-600 text-[11px] font-black text-white">{String(index + 1).padStart(2, "0")}</span>
              <div className="pt-0.5">
                <p className="text-sm font-black uppercase tracking-[0.16em] text-white">{title}</p>
                <p className="mt-1 text-xs leading-6 text-slate-300">{description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  </div>

</section>

{/* FOOTER */}

<footer className="border-t border-white/10 bg-black/70">

  <div className="max-w-7xl mx-auto px-6 py-14">

    <div className="grid lg:grid-cols-3 gap-14">

      <div>

        <div className="flex items-center gap-4">

          <img
            src={logo}
            alt="logo"
            className="w-20 h-14 object-contain"
          />

          <div>

            <h3 className="font-bold text-xl text-white">

              ACGC Aluminum Services

            </h3>

            <p className="text-gray-300 text-sm">

              Premium Glass & Aluminum Solutions

            </p>

          </div>

        </div>

      </div>

      <div>

        <h4 className="font-bold text-white 500 mb-6">

          Quick Links

        </h4>

        <div className="space-y-4 text-gray-300">

          <p>Home</p>
          <p>Browse Products</p>
          <p>Track Order</p>
          <p>About Us</p>

        </div>

      </div>

      <div>

        <h4 className="font-bold text-white 500 mb-6">

          Contact

        </h4>

        <div className="space-y-4 text-gray-300">

          <p>Email: acgc.services00@email.com</p>

          <p>Phone: +63 900 000 0000</p>

          <p>Philippines</p>

        </div>

      </div>

    </div>

    <div className="border-t border-white/40 mt-12 pt-8 text-center text-white 500 text-sm">

      © 2026 ACGC Aluminum Services — All Rights Reserved.

    </div>

  </div>

</footer>

</div>
  );
}

export default LandingPage;