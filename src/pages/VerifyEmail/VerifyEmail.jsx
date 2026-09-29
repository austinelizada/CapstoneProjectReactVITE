import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, LoaderCircle, XCircle } from "lucide-react";
import { verifyEmail } from "@/api/auth";

function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("Verifying your email address...");

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setStatus("error");
      setMessage("This verification link is missing its token.");
      return;
    }

    verifyEmail(token)
      .then((response) => {
        navigate("/login", {
          replace: true,
          state: { message: response.message || "Email verified successfully. You can now log in." },
        });
      })
      .catch((error) => {
        setStatus("error");
        setMessage(error.data?.message || error.message || "Unable to verify your email.");
      });
  }, [navigate, searchParams]);

  const isSuccess = status === "success";

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-8">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-2xl">
        {status === "loading" ? (
          <LoaderCircle size={48} className="mx-auto animate-spin text-red-600" aria-hidden="true" />
        ) : isSuccess ? (
          <CheckCircle2 size={48} className="mx-auto text-green-600" aria-hidden="true" />
        ) : (
          <XCircle size={48} className="mx-auto text-red-600" aria-hidden="true" />
        )}
        <h1 className="mt-5 text-2xl font-black text-slate-900">
          {status === "loading" ? "Verifying email" : isSuccess ? "Email verified" : "Verification failed"}
        </h1>
        <p className="mt-3 text-sm text-slate-600">{message}</p>
        {status !== "loading" ? (
          <Link to="/login" className="mt-6 inline-flex rounded-2xl bg-red-700 px-6 py-3 font-bold text-white hover:bg-red-800">
            Go to login
          </Link>
        ) : null}
      </section>
    </main>
  );
}

export default VerifyEmail;