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
} from "lucide-react";
import { getProducts } from "../../api/products";
import logo from "../../assets/images/ACGCLOGO1.png";

function LandingPage() {

  const [active, setActive] = useState("home");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [isLoadingFeatured, setIsLoadingFeatured] = useState(false);
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
      try {
        const response = await getProducts();
        const allProducts = response.products || [];
        const activeProducts = allProducts
          .filter((product) => product.is_active !== false)
          .sort((a, b) => {
            const aDate = new Date(a.created_at || a.createdAt || 0).getTime();
            const bDate = new Date(b.created_at || b.createdAt || 0).getTime();
            return bDate - aDate;
          })
          .slice(0, 3);
        setFeaturedProducts(activeProducts);
      } catch (error) {
        console.error("Failed to load featured products", error);
        setFeaturedProducts([]);
      } finally {
        setIsLoadingFeatured(false);
      }
    };

    loadFeaturedProducts();
  }, []);

  const getProductImage = (product) => {
    if (!product) return "";
    if (product.image_url) return product.image_url;
    if (product.image) return product.image;
    if (Array.isArray(product.images) && product.images.length > 0) return product.images[0];
    if (product.images && typeof product.images === "object") {
      const images = Object.values(product.images).flat().filter(Boolean);
      return images[0] || "";
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

          <motion.div
            whileHover={{scale:1.05}}
            className="flex items-center gap-4"
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
              className="w-14 h-14 object-contain"
            />

            <div>

              <h1 className="font-bold text-xl text-red-600">

                ACGC Aluminum Services

              </h1>

              <p className="text-xs text-gray-600 font-medium">

                Aluminum & Glass Management System

              </p>

            </div>

          </motion.div>

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
              className="mt-8 text-5xl lg:text-6xl font-black leading-tight"
            >

              Modern

              <span className="block bg-gradient-to-r from-red-600 via-gray-700 to-gray-400 bg-clip-text text-transparent">

                Aluminum & Glass

              </span>

              Management Platform

            </motion.h1>

            <motion.p
              initial={{opacity:0,y:40}}
              animate={{opacity:1,y:0}}
              transition={{delay:.5,duration:1}}
              className="mt-8 text-gray-600 text-lg leading-8 max-w-xl"
            >

              Premium aluminum fabrication, storefront systems,
              tempered glass installation, project tracking,
              and ordering solutions for residential and
              commercial clients.

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

          {/* RIGHT GLASS CARD */}

          <motion.div
            initial={{opacity:0,scale:.7}}
            animate={{opacity:1,scale:1}}
            transition={{duration:1}}
            className="relative"
          >

            <motion.div
              animate={{
                y:[0,-25,0]
              }}
              transition={{
                duration:6,
                repeat:Infinity
              }}
              className="bg-white/5 border border-white/10 backdrop-blur-3xl rounded-[40px] p-10 shadow-[0_20px_80px_rgba(255,0,0,.18)]"
            >

              <div className="flex justify-between mb-10">

                <div>

                  <h3 className="text-2xl font-bold">

                    Project Analytics

                  </h3>

                  <p className="text-gray-400 mt-2">

                    Real-time order monitoring

                  </p>

                </div>

                <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center shadow-lg">

                  <BriefcaseBusiness size={28} color="black" strokeWidth={2.5} />

                </div>

              </div>

              <div className="space-y-6">

                <div className="bg-white/90 p-5 rounded-2xl border border-gray-200">

                  <div className="flex justify-between">

                    <span>Total Orders</span>

                    <span className="text-red-500 font-bold">
                      245
                    </span>

                  </div>

                </div>

                <div className="bg-white/90 p-5 rounded-2xl border border-gray-200">

                  <div className="flex justify-between">

                    <span>Active Projects</span>

                    <span className="text-green-400 font-bold">
                      89
                    </span>

                  </div>

                </div>

                <div className="bg-white/90 p-5 rounded-2xl border border-gray-200">

                  <div className="flex justify-between">

                    <span>Completed Jobs</span>

                    <span className="text-blue-400 font-bold">
                      156
                    </span>

                  </div>

                </div>

              </div>

            </motion.div>

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

  <div className="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-3 mt-20">
    {isLoadingFeatured ? (
      <div className="col-span-full rounded-3xl bg-white/10 p-10 text-center text-white/80 shadow-lg">
        Loading featured products...
      </div>
    ) : featuredProducts.length === 0 ? (
      <div className="col-span-full rounded-3xl bg-white/10 p-10 text-center text-white/80 shadow-lg">
        No featured products are available right now.
      </div>
    ) : (
      featuredProducts.map((product, index) => {
        const imageUrl = getProductImage(product);
        return (
          <motion.div
            key={product._id || product.id || index}
            initial={{opacity:0,y:80}}
            whileInView={{opacity:1,y:0}}
            viewport={{once:true}}
            transition={{delay:index * 0.2,duration:0.8}}
            whileHover={{
              scale:1.02,
            }}
            className="bg-white rounded-3xl shadow-lg overflow-hidden hover:shadow-2xl transition"
          >
            <div className="h-52 overflow-hidden bg-red-50">
              {imageUrl ? (
                <img src={imageUrl} alt={product.product_name || product.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-red-600/20 to-white/5" />
              )}
            </div>

            <div className="p-6">
              <span className="bg-red-100 text-red-600 px-3 py-1 rounded-full text-xs font-semibold">
                {product.category || product.product_type || "General"}
              </span>

              <h3 className="text-xl font-bold mt-4 text-slate-900">
                {product.product_name || product.name || "Unnamed Product"}
              </h3>

              <p className="text-gray-700 mt-4 leading-7 min-h-[84px]">
                {product.description || "Premium aluminum and glass product crafted for reliability and style."}
              </p>

              <div className="mt-1 flex items-center justify-between gap-4">
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