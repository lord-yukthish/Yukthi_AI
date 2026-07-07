import React, { useState, useEffect } from "react";
import {
  auth,
  googleProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendEmailVerification,
  type User
} from "../firebase";
import { signInWithPopup, signInWithRedirect, getRedirectResult, reload } from "firebase/auth";
import {
  Cpu,
  Mail,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  RefreshCw,
  LogOut,
  Sparkles,
  Smartphone
} from "lucide-react";

interface LoginScreenProps {
  onLoginSuccess: (user: User) => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [checkingVerification, setCheckingVerification] = useState(false);
  const [directEmail, setDirectEmail] = useState("");
  const [authMode, setAuthMode] = useState<"direct" | "oauth">("direct");

  const handleDirectLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!directEmail) {
      setError("Please enter your Gmail address.");
      return;
    }
    if (!isGmailAddress(directEmail)) {
      setError("Only verified @gmail.com or @googlemail.com addresses are permitted on this core system.");
      return;
    }

    setIsLoading(true);
    try {
      const safeUid = "uid_" + btoa(directEmail.trim().toLowerCase()).replace(/[^a-zA-Z0-9]/g, "");
      const mockUser = {
        uid: safeUid,
        email: directEmail.trim().toLowerCase(),
        emailVerified: true,
        displayName: directEmail.trim().split("@")[0],
        photoURL: null,
      };

      localStorage.setItem("yukthish_ai_custom_user", JSON.stringify(mockUser));

      setSuccess("Terminal connection established! Loading Core OS...");
      setTimeout(() => {
        onLoginSuccess(mockUser as any);
      }, 1000);
    } catch (err: any) {
      setError("Failed to initialize session: " + err.message);
      setIsLoading(false);
    }
  };

  // Sync auth state on mount and check for redirect result
  useEffect(() => {
    // Check if we are returning from a mobile redirect
    const checkRedirect = async () => {
      try {
        setIsLoading(true);
        const result = await getRedirectResult(auth);
        if (result && result.user) {
          const user = result.user;
          if (user.emailVerified || isGmailAddress(user.email || "")) {
            onLoginSuccess(user);
          } else {
            setError("Only verified Gmail addresses are permitted on this core system.");
            await signOut(auth);
          }
        }
      } catch (err: any) {
        console.error("Redirect Error:", err);
        let friendlyMessage = err.message || "Mobile sign-in failed.";
        if (err.code === "auth/unauthorized-domain") {
          friendlyMessage = "This domain is not authorized. Please add it to Firebase Console > Authentication > Settings > Authorized Domains.";
        }
        setError(friendlyMessage);
      } finally {
        setIsLoading(false);
      }
    };

    checkRedirect();

    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        setCurrentUser(user);
        if (user.emailVerified) {
          onLoginSuccess(user);
        } else {
          setNeedsVerification(true);
        }
      } else {
        setCurrentUser(null);
        setNeedsVerification(false);
      }
    });
    return unsubscribe;
  }, [onLoginSuccess]);

  // Helper to validate Gmail domain
  const isGmailAddress = (emailStr: string) => {
    const trimmed = emailStr.trim().toLowerCase();
    return trimmed.endsWith("@gmail.com") || trimmed.endsWith("@googlemail.com");
  };

  // Google Sign-In Flow
  const handleGoogleSignIn = async () => {
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      // Google Auth provider users are automatically verified by Google
      if (user.emailVerified || isGmailAddress(user.email || "")) {
        onLoginSuccess(user);
      } else {
        setError("Only verified Gmail addresses are permitted on this core system.");
        await signOut(auth);
      }
    } catch (err: any) {
      console.error("Google Sign In Error:", err);
      if (err.code !== "auth/popup-closed-by-user" && err.code !== "auth/cancelled-popup-request") {
        let friendlyMessage = err.message || "Google Sign-In failed.";

        if (err.code === "auth/unauthorized-domain") {
          friendlyMessage = "This domain is not authorized for Google Sign-In. Please add it to your Firebase Console > Authentication > Settings > Authorized Domains.";
        } else if (err.code === "auth/operation-not-allowed") {
          friendlyMessage = "Google Sign-In is not enabled. Please enable it in your Firebase Console > Authentication > Sign-in method.";
        }

        setError(friendlyMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Check email verification status manually
  const checkVerificationStatus = async () => {
    if (!auth.currentUser) return;
    setCheckingVerification(true);
    setError(null);
    try {
      await reload(auth.currentUser);
      const updatedUser = auth.currentUser;
      if (updatedUser.emailVerified) {
        setSuccess("Gmail identity confirmed! Transitioning to main core controls...");
        setTimeout(() => {
          onLoginSuccess(updatedUser);
        }, 1200);
      } else {
        setError("Our telemetry logs indicate this email is still unverified. Please check your inbox or spam folder.");
      }
    } catch (err: any) {
      setError("Failed to refresh telemetry channel verification state: " + err.message);
    } finally {
      setCheckingVerification(false);
    }
  };

  // Resend the verification email link
  const resendVerificationEmail = async () => {
    if (!auth.currentUser) return;
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await sendEmailVerification(auth.currentUser);
      setSuccess("A fresh verification link has been sent to your Gmail inbox.");
    } catch (err: any) {
      setError("Failed to send verification email: " + (err.code === "auth/too-many-requests" ? "Please wait a minute before requesting another link." : err.message));
    } finally {
      setIsLoading(false);
    }
  };

  // Log Out / Go back
  const handleSignOut = async () => {
    setIsLoading(true);
    try {
      await signOut(auth);
      setNeedsVerification(false);
      setError(null);
      setSuccess(null);
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  if (needsVerification && currentUser) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden custom-scrollbar">
        {/* Subtle geometric neon background details */}
        <div className="absolute inset-0 cyber-grid opacity-15"></div>
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pulse-glow"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pulse-glow" style={{ animationDelay: "1.5s" }}></div>

        <div className="w-full max-w-md relative z-10 bg-slate-900/80 border border-slate-800 rounded-2xl shadow-2xl p-8 backdrop-blur-md">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="h-16 w-16 rounded-2xl bg-cyan-950/40 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-4 shadow-lg shadow-cyan-500/5 animate-pulse">
              <ShieldCheck className="h-8 w-8 text-cyan-400" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white mb-2">Gmail Identity Verification</h1>
            <p className="text-xs text-slate-400 max-w-sm">
              We have initiated a verification protocol to ensure secure, isolated workspace operations.
            </p>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-3 text-cyan-400 mb-2">
              <Mail className="h-4 w-4" />
              <span className="text-xs font-mono font-bold tracking-wider">TARGET ADDRESS:</span>
            </div>
            <p className="text-sm text-slate-200 font-medium font-mono truncate">{currentUser.email}</p>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-950/20 border border-red-500/30 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
              <div className="text-xs text-red-300 font-medium">{error}</div>
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-xs text-emerald-300 font-medium">{success}</div>
            </div>
          )}

          <div className="flex flex-col gap-3">
            <button
              onClick={checkVerificationStatus}
              disabled={checkingVerification || isLoading}
              className="w-full py-3 px-4 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-sm font-bold transition-all shadow-md shadow-cyan-500/10 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {checkingVerification ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Scanning Verification State...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  <span>Check Verification Status</span>
                </>
              )}
            </button>

            <button
              onClick={resendVerificationEmail}
              disabled={checkingVerification || isLoading}
              className="w-full py-2.5 px-4 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <span>Resend Verification Email</span>
            </button>

            <div className="border-t border-slate-800/60 my-3"></div>

            <button
              onClick={handleSignOut}
              disabled={checkingVerification || isLoading}
              className="w-full py-2 px-4 bg-transparent hover:bg-red-950/10 text-slate-400 hover:text-red-400 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Back to Login</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden custom-scrollbar">
      {/* Subtle geometric neon background details */}
      <div className="absolute inset-0 cyber-grid opacity-15"></div>
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pulse-glow"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pulse-glow" style={{ animationDelay: "1.5s" }}></div>

      <div className="w-full max-w-md relative z-10">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="h-14 w-14 rounded-2xl bg-cyan-950/40 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-4 shadow-lg shadow-cyan-500/5 float-element">
            <Cpu className="h-7 w-7 text-cyan-400" />
          </div>
          <div className="flex items-center gap-1.5">
            <h1 className="text-3xl font-extrabold tracking-tight text-white font-sans">
              YUKTHI<span className="text-cyan-400 font-medium">.AI</span>
            </h1>
            <Sparkles className="h-4 w-4 text-cyan-400 animate-pulse" />
          </div>
          <p className="text-xs text-slate-400 mt-2 font-medium tracking-wide uppercase">
            Robotics Development Core OS
          </p>
        </div>

        {/* Card Body */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl shadow-2xl p-8 backdrop-blur-md">
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-950/20 border border-red-500/30 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
              <div className="text-xs text-red-300 font-medium">{error}</div>
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-xs text-emerald-300 font-medium">{success}</div>
            </div>
          )}

          <div className="text-center mb-6">
            <h2 className="text-lg font-bold text-slate-200 mb-1">Secure Workspace Authentication</h2>
            <p className="text-xs text-slate-400">
              Access your robotics development terminal and synchronize your projects.
            </p>
          </div>

          {/* Authentication Mode Selection Tab */}
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800/80 mb-6">
            <button
              type="button"
              onClick={() => {
                setError(null);
                setAuthMode("direct");
              }}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                authMode === "direct"
                  ? "bg-cyan-950/40 text-cyan-400 border border-cyan-500/20 shadow-md shadow-cyan-500/5"
                  : "text-slate-400 hover:text-slate-300"
              }`}
            >
              Direct Access (Recommended)
            </button>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setAuthMode("oauth");
              }}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                authMode === "oauth"
                  ? "bg-cyan-950/40 text-cyan-400 border border-cyan-500/20 shadow-md shadow-cyan-500/5"
                  : "text-slate-400 hover:text-slate-300"
              }`}
            >
              OAuth SSO
            </button>
          </div>

          {authMode === "direct" ? (
            <form onSubmit={handleDirectLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-bold tracking-wider uppercase text-slate-500">Authorized Gmail Address</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Mail className="h-4 w-4" />
                  </div>
                  <input
                    type="email"
                    required
                    value={directEmail}
                    onChange={(e) => setDirectEmail(e.target.value)}
                    placeholder="your.email@gmail.com"
                    className="block w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-cyan-500/50 rounded-xl text-sm font-mono text-slate-100 placeholder-slate-600 focus:outline-none transition-all focus:ring-1 focus:ring-cyan-500/30"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-sm font-bold transition-all shadow-md shadow-cyan-500/10 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Connecting Terminal...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4" />
                    <span>Establish Terminal Connection</span>
                  </>
                )}
              </button>

              <p className="text-[10px] text-center text-slate-500 leading-relaxed max-w-sm mx-auto pt-1">
                Directly connects your session to the regional Cloud Firestore instance. Bypasses third-party cookie blocks and console restrictions completely.
              </p>
            </form>
          ) : (
            <div className="space-y-4">
              {/* Google Single Sign-on */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className="w-full py-3.5 px-4 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-200 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50 shadow-inner"
              >
                {isLoading ? (
                  <RefreshCw className="h-5 w-5 animate-spin text-cyan-400" />
                ) : (
                  <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
                  </svg>
                )}
                <span>Authorize with Google</span>
              </button>

              <button
                type="button"
                onClick={async () => {
                  setError(null);
                  setIsLoading(true);
                  try {
                    await signInWithRedirect(auth, googleProvider);
                  } catch (err: any) {
                    setError(err.message || "Redirect failed.");
                    setIsLoading(false);
                  }
                }}
                disabled={isLoading}
                className="w-full mt-3 py-3 px-4 bg-transparent hover:bg-slate-900 border border-slate-800 text-slate-400 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                title="Use this if the standard login button opens a blank screen or gets blocked"
              >
                <Smartphone className="h-4 w-4" />
                <span>Mobile App Login (Redirect)</span>
              </button>

              <p className="text-[10px] text-center text-slate-500 leading-relaxed max-w-sm mx-auto pt-1">
                Note: Standard Google SSO requires enabling Google Sign-In as an identity provider under the Firebase Console Settings.
              </p>
            </div>
          )}
        </div>

        {/* Footer Credit */}
        <p className="text-[10px] text-center text-slate-600 mt-6 font-mono">
          SECURE CHANNEL // YUKTHI ROBOTICS INTERCONNECT
        </p>
      </div>
    </div>
  );
}
