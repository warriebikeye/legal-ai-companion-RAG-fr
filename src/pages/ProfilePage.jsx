// src/pages/ProfilePage.jsx
import "./ProfilePage.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { readAuthCookie } from "../hooks/useAuthCookie";
import {
  authFetch,
  setStoredToken,
  getCachedUser,
  cacheUserFromMe,
  clearAuth,
  AUTH_EXPIRED_EVENT,
} from "../utils/authToken";
import defaultUserIcon from "../assets/user-icon.png";

const API_BASE_URL = process.env.REACT_APP_BASEURL;
const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5MB, matches backend limit

function ProfilePage() {
  const navigate = useNavigate();
  const avatarInputRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [status, setStatus] = useState(null); // { type: 'success' | 'error', text }

  const [email, setEmail] = useState("");
  const [hasPassword, setHasPassword] = useState(true);

  const [firstname, setFirstname] = useState("");
  const [lastname, setLastname] = useState("");
  const [photo, setPhoto] = useState("");

  const [passwordStep, setPasswordStep] = useState("form"); // "form" | "code"
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [confirmCode, setConfirmCode] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState(null);

  /* ─── Load current user — cookie first for instant paint,
     then confirm against /auth/me (same pattern as HomePage) ─── */
  const loadProfile = useCallback(async () => {
    const cookie = readAuthCookie();
    if (cookie?.email) {
      setEmail(cookie.email);
      setFirstname(cookie.firstname || "");
      setLastname(cookie.lastname || "");
      setPhoto(cookie.photo || "");
      setLoading(false);
    }

    try {
      const res = await authFetch(`${API_BASE_URL}/auth/me`, { method: "GET" });
      if (!res.ok) {
        // Server trouble — keep the cached view if we have one
        if (!cookie?.email) navigate("/");
        return;
      }

      const data = await res.json();
      if (!data?.isAuthenticated) {
        clearAuth();
        navigate("/");
        return;
      }

      setEmail(data.userEmail || "");
      setFirstname(data.firstname || "");
      setLastname(data.lastname || "");
      setPhoto(data.userImage || "");
      setHasPassword(data.hasPassword ?? true);
      setStoredToken(data.token); // only present when migrating off a legacy credential
      cacheUserFromMe(data);
    } catch {
      if (!cookie?.email) navigate("/");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // Session expired mid-visit (any authFetch got a 401) — back to the
  // home page, which shows the login modal.
  useEffect(() => {
    const onExpired = () => navigate("/");
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
  }, [navigate]);

  /** Keep the cached profile in step with edits, so HomePage paints
   *  the new name/avatar instantly next time. */
  function updateCachedUser(fields) {
    const cached = getCachedUser();
    if (!cached) return;
    cacheUserFromMe({
      isAuthenticated: true,
      userEmail: cached.email,
      firstname: fields.firstname ?? cached.firstname,
      lastname: fields.lastname ?? cached.lastname,
      userImage: fields.photo ?? cached.photo,
      subscriptionTier: cached.subscriptionTier,
      subscriptionStatus: cached.subscriptionStatus,
    });
  }

  async function handleSave(e) {
    e.preventDefault();
    if (saving) return;

    if (!firstname.trim()) {
      setStatus({ type: "error", text: "First name cannot be empty." });
      return;
    }

    setSaving(true);
    setStatus(null);

    try {
      const res = await authFetch(`${API_BASE_URL}/auth/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstname: firstname.trim(),
          lastname: lastname.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to update profile.");
      }

      setFirstname(data.firstname || "");
      setLastname(data.lastname || "");
      updateCachedUser({ firstname: data.firstname || "", lastname: data.lastname || "" });

      setStatus({ type: "success", text: "Profile updated." });
    } catch (err) {
      setStatus({ type: "error", text: err.message || "Failed to update profile." });
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setStatus({ type: "error", text: "Please choose an image file." });
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setStatus({ type: "error", text: "Image must be 5MB or smaller." });
      return;
    }

    const previousPhoto = photo;
    const previewUrl = URL.createObjectURL(file);
    setPhoto(previewUrl);
    setUploadingAvatar(true);
    setStatus(null);

    try {
      const formData = new FormData();
      formData.append("avatar", file);

      const res = await authFetch(`${API_BASE_URL}/auth/avatar`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to upload avatar.");
      }

      setPhoto(data.photo || "");
      updateCachedUser({ photo: data.photo || "" });
      setStatus({ type: "success", text: "Avatar updated." });
    } catch (err) {
      setPhoto(previousPhoto);
      setStatus({ type: "error", text: err.message || "Failed to upload avatar." });
    } finally {
      URL.revokeObjectURL(previewUrl);
      setUploadingAvatar(false);
    }
  }

  function resetPasswordFlow() {
    setPasswordStep("form");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setConfirmCode("");
  }

  async function handleRequestPasswordChange(e) {
    e.preventDefault();
    if (changingPassword) return;

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordStatus({ type: "error", text: "Fill in all password fields." });
      return;
    }
    if (newPassword.length < 8 || !/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setPasswordStatus({ type: "error", text: "New password must be at least 8 characters and include letters and numbers." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordStatus({ type: "error", text: "New passwords don't match." });
      return;
    }
    if (newPassword === currentPassword) {
      setPasswordStatus({ type: "error", text: "New password must be different from your current password." });
      return;
    }

    setChangingPassword(true);
    setPasswordStatus(null);

    try {
      const res = await authFetch(`${API_BASE_URL}/auth/password/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to start password change.");
      }

      setPasswordStep("code");
      setPasswordStatus({ type: "success", text: `Enter the code we sent to ${email}.` });
    } catch (err) {
      setPasswordStatus({ type: "error", text: err.message || "Failed to start password change." });
    } finally {
      setChangingPassword(false);
    }
  }

  async function handleConfirmPasswordChange(e) {
    e.preventDefault();
    if (changingPassword) return;

    if (!confirmCode.trim()) {
      setPasswordStatus({ type: "error", text: "Enter the code from your email." });
      return;
    }

    setChangingPassword(true);
    setPasswordStatus(null);

    try {
      const res = await authFetch(`${API_BASE_URL}/auth/password/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: confirmCode.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to confirm password change.");
      }

      resetPasswordFlow();
      setPasswordStatus({ type: "success", text: "Password updated successfully." });
    } catch (err) {
      setPasswordStatus({ type: "error", text: err.message || "Failed to confirm password change." });
    } finally {
      setChangingPassword(false);
    }
  }

  if (loading) {
    return (
      <div className="profilePage">
        <div className="profileContainer">
          <p className="profileLoading">Loading profile…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="profilePage">
      <div className="profileContainer">
        <button className="profileBack" onClick={() => navigate(-1)}>
          ← Back
        </button>

        <div className="profileHeader">
          <button
            type="button"
            className="profileAvatarWrap"
            onClick={() => avatarInputRef.current?.click()}
            disabled={uploadingAvatar}
            title="Change avatar"
          >
            <img
              src={photo || defaultUserIcon}
              alt=""
              className="profileAvatar"
              onError={(e) => { e.currentTarget.src = defaultUserIcon; }}
            />
            <span className="profileAvatarOverlay">
              {uploadingAvatar ? "Uploading…" : "Change"}
            </span>
          </button>
          <input
            type="file"
            accept="image/*"
            ref={avatarInputRef}
            onChange={handleAvatarChange}
            style={{ display: "none" }}
          />
          <div>
            <h1>{[firstname, lastname].filter(Boolean).join(" ") || "Your Profile"}</h1>
            <p className="profileEmail">{email}</p>
          </div>
        </div>

        {status && (
          <div className={`profileStatus ${status.type === "error" ? "profileStatus--error" : "profileStatus--success"}`}>
            {status.text}
          </div>
        )}

        <form className="profileForm" onSubmit={handleSave}>
          <label>
            First name
            <input
              type="text"
              value={firstname}
              onChange={(e) => setFirstname(e.target.value)}
              placeholder="First name"
              required
            />
          </label>

          <label>
            Last name
            <input
              type="text"
              value={lastname}
              onChange={(e) => setLastname(e.target.value)}
              placeholder="Last name"
            />
          </label>

          <label>
            Email
            <input type="email" value={email} disabled />
          </label>

          <button type="submit" className="profileSaveBtn" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </form>

        <h2 className="profileSectionTitle">Password</h2>

        {!hasPassword ? (
          <p className="profileHint">
            Your account signs in with Google and has no password to change.
          </p>
        ) : (
          <>
            {passwordStatus && (
              <div className={`profileStatus ${passwordStatus.type === "error" ? "profileStatus--error" : "profileStatus--success"}`}>
                {passwordStatus.text}
              </div>
            )}

            {passwordStep === "form" ? (
              <form className="profileForm" onSubmit={handleRequestPasswordChange}>
                <label>
                  Current password
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </label>

                <label>
                  New password
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                </label>

                <label>
                  Confirm new password
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                </label>

                <p className="profileHint">
                  At least 8 characters, with letters and numbers.
                </p>

                <button type="submit" className="profileSaveBtn" disabled={changingPassword}>
                  {changingPassword ? "Sending code…" : "Change password"}
                </button>
              </form>
            ) : (
              <form className="profileForm" onSubmit={handleConfirmPasswordChange}>
                <label>
                  Confirmation code
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={confirmCode}
                    onChange={(e) => setConfirmCode(e.target.value)}
                    placeholder="6-digit code"
                    maxLength={6}
                    autoFocus
                    required
                  />
                </label>

                <p className="profileHint">
                  Code expires in 15 minutes.
                </p>

                <button type="submit" className="profileSaveBtn" disabled={changingPassword}>
                  {changingPassword ? "Confirming…" : "Confirm password change"}
                </button>

                <button
                  type="button"
                  className="profileLinkBtn"
                  onClick={resetPasswordFlow}
                  disabled={changingPassword}
                >
                  Start over
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default ProfilePage;
