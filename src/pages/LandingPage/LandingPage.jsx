import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Menu,
  X,
  ArrowRight,
  ShoppingBag,
  Search,
  BriefcaseBusiness,
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
  const location = useLocation();

  useEffect(() => {
    if (location.pathname === "/products") {
      setTimeout(() => {
        document.getElementById("products")?.scrollIntoView({
          behavior: "smooth",
        });
      }, 100);
      setActive("products");
    }
  }, [location.pathname]);

  useEffect(() => {
    const loadFeaturedProducts = async () => {
      setIsLoadingFeatured(true);
      setFeaturedError("");

      try {
        let response = await getProducts({ featured: true });
        let allProducts = response.products || [];

        if (!allProducts.length) {
          const fallbackResponse = await getProducts();
          allProducts = fallbackResponse.products || [];
        }

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
          })
          .slice(0, 3);

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

        <div className="max-w-7xl mx-auto px-6 py-5 flex justify-between items-center">

          {/* LOGO */}

          <div className="flex items-center gap-4">
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
          </div>

          {featuredError && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
              <p className="font-semibold">Backend connection issue</p>
              <p>{featuredError}</p>
            </div>
          )}

                {/* DESKTOP NAV */}

        <nav className="hidden lg:flex items-center gap-10">

        {[
            { name: "Home", id: "home" },
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
                onClick={() => {
                  setActive("home");
                  setMobileMenu(false);
                  document.getElementById("home")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="text-left text-white hover:text-red-400"
              >
                Home
              </button>

              <button
                onClick={() => {
                  setActive("products");
                  setMobileMenu(false);
                  document.getElementById("products")?.scrollIntoView({ behavior: "smooth" });
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

      <section
        id="home"
        className="relative max-w-7xl mx-auto px-6 pt-32 pb-20"
      >

        <div className="grid lg:grid-cols-2 gap-20 items-center">

          {/* LEFT */}

          <div>



            <motion.h1
              initial={{opacity:0,y:50}}
              animate={{opacity:1,y:0}}
              transition={{delay:.3,duration:1}}
              className="mt-8 text-[3rem] sm:text-[4rem] lg:text-[5.2rem] font-black tracking-[-0.06em] leading-[0.9] text-slate-900"
            >
              <span className="block">Modern</span>
              <span className="block bg-gradient-to-r from-red-600 via-red-500 to-slate-500 bg-clip-text text-transparent">
                Aluminum & Glass
              </span>
              <span className="block">Management Platform</span>
            </motion.h1>

            <motion.p
              initial={{opacity:0,y:40}}
              animate={{opacity:1,y:0}}
              transition={{delay:.5,duration:1}}
              className="mt-8 max-w-[620px] text-base sm:text-lg leading-8 text-slate-600/90 tracking-[0.01em]"
            >
              Premium aluminum fabrication, storefront systems, tempered glass installation,
              project tracking, and ordering solutions for residential and commercial clients.
            </motion.p>

            {/* CTA */}

            <motion.div
              initial={{opacity:0,y:40}}
              animate={{opacity:1,y:0}}
              transition={{delay:.7,duration:1}}
              className="mt-12 flex flex-wrap gap-5"
            >

              <Link
                to="/products"
                className="bg-red-600 text-white px-8 py-4 rounded-2xl font-semibold shadow-2xl shadow-red-600/30 flex items-center gap-3 hover:scale-105 transition"
              >

                <ShoppingBag size={20}/>

                Browse Products

                <ArrowRight
                  size={18}
                  className="group-hover:translate-x-2 transition"
                />

              </Link>

              <Link
                to="/track-order"
                className="border border-white/20 bg-white backdrop-blur-xl px-8 py-4 rounded-2xl flex items-center gap-3 hover:border-gray-500 hover:scale-105 transition"
              >

                <Search size={20}/>

                Track Order

              </Link>

            </motion.div>

          </div>

          {/* RIGHT SIDE VISUAL */}
          <motion.div
            initial={{ opacity: 0, x: 60 }}
            animate={{ opacity: 1, x: 0, y: [0, -8, 0] }}
            transition={{ delay: 0.6, duration: 1.2, ease: "easeOut" }}
            className="relative hidden lg:flex items-center justify-center"
          >
            <div className="relative w-full max-w-[700px]">
              <div className="absolute -top-10 -right-8 h-36 w-36 rounded-full bg-red-500/15 blur-3xl" />
              <div className="absolute -bottom-12 -left-10 h-40 w-40 rounded-full bg-slate-300/60 blur-3xl" />

              <div className="relative -rotate-[1.5deg] rounded-[42px] border border-slate-200 bg-white/90 p-4 shadow-[0_38px_90px_rgba(15,23,42,0.16)] backdrop-blur-sm">
                <div className="overflow-hidden rounded-[28px] bg-slate-100">
                  <motion.img
                    key={heroImages[heroImageIndex] || heroVisual}
                    src={heroImages[heroImageIndex] || heroVisual}
                    alt="Modern aluminum and glass installation"
                    initial={{ opacity: 0, scale: 1.02 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.7, ease: "easeInOut" }}
                    className="h-[560px] w-full object-cover object-center"
                  />
                </div>
              </div>

              <div className="absolute -left-6 bottom-12 rounded-2xl border border-red-100 bg-white/95 px-4 py-3 shadow-[0_18px_40px_rgba(15,23,42,0.12)] backdrop-blur-sm">
                <p className="text-[9px] font-black uppercase tracking-[0.22em] text-red-600">Since 2014</p>
                <p className="mt-1 text-lg font-black text-slate-900">Custom Solutions</p>
              </div>

              <div className="absolute -right-4 top-10 rounded-full border border-slate-200 bg-white/90 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-700 shadow-md">
                Premium Build
              </div>
            </div>
          </motion.div>

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

      Featured

      <span className="text-red-500">
        {" "}Products
      </span>

    </h2>

    <p className="text-gray-400 mt-6 max-w-2xl mx-auto">

      Discover premium aluminum and glass solutions
      crafted for modern residential and commercial projects.

    </p>

  </motion.div>

  <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-3">
    {isLoadingFeatured ? (
      <div className="col-span-full rounded-[24px] border border-slate-200 bg-white p-10 text-center text-slate-600 shadow-sm">
        Loading featured products...
      </div>
    ) : featuredProducts.length === 0 ? (
      <div className="col-span-full rounded-[24px] border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-slate-600">
        No featured products are available right now.
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

                <Link
                  to="/products"
                  className="inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700"
                >
                  View
                  <ArrowRight size={14} />
                </Link>
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
  className="max-w-7xl mx-auto px-6 py-32"
>

  <div className="grid lg:grid-cols-2 gap-20 items-center">

    <motion.div
      initial={{opacity:0,x:-80}}
      whileInView={{opacity:1,x:0}}
      viewport={{once:true}}
      transition={{duration:1}}
    >

      <h2 className="text-5xl font-black">

        About

        <span className="text-red-500">
          {" "}ACGC
        </span>

      </h2>

      <p className="text-gray-400 mt-8 leading-9">

        ACGC Aluminum Services specializes in
        aluminum fabrication, glass installation,
        storefront systems, and complete project
        management solutions for residential and
        commercial developments.

      </p>

      <p className="text-gray-500 mt-8 leading-9">

        Combining innovation, precision,
        and premium craftsmanship,
        we deliver high-performance
        aluminum and glass systems.

      </p>

    </motion.div>

    <motion.div
      initial={{opacity:0,x:80}}
      whileInView={{opacity:1,x:0}}
      viewport={{once:true}}
      transition={{duration:1}}
      className="bg-white/5 border border-white/10 rounded-[40px] backdrop-blur-2xl p-12"
    >

      <div className="space-y-8">

        <div>

          <h4 className="text-2xl font-bold text-red-500">

            10+ Years Experience

          </h4>

          <p className="text-gray-400 mt-3">

            Delivering trusted aluminum and glass solutions.

          </p>

        </div>

        <div>

          <h4 className="text-2xl font-bold text-red-500">

            Premium Materials

          </h4>

          <p className="text-gray-400 mt-3">

            High-grade aluminum and tempered glass systems.

          </p>

        </div>

        <div>

          <h4 className="text-2xl font-bold text-red-500">

            Professional Service

          </h4>

          <p className="text-gray-400 mt-3">

            Precision workmanship and customer satisfaction.

          </p>

        </div>

      </div>

    </motion.div>

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