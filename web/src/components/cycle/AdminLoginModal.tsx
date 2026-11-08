import React, { useState } from "react";
import { useAuth } from "../../utils/auth";
import { useLanguage } from "../../language";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function AdminLoginModal({ isOpen, onClose }: Props) {
  const { t } = useLanguage();
  const { login } = useAuth();
  const [secret, setSecret] = useState("");
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const success = login(secret);
    if (success) {
      setSecret("");
      onClose();
    } else {
      setError(t("Incorrect password.", "密码错误，请重新输入。"));
    }
  };

  return (
    <div className="cycle-modal-overlay" onClick={onClose}>
      <div className="cycle-modal-dialog small-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="cycle-modal-header">
          <h3>🔒 {t("Password", "密码验证")}</h3>
          <button type="button" className="cycle-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="cycle-modal-body">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ display: "block", marginBottom: 8, fontWeight: 600, fontSize: 13 }}>
                {t("Password", "输入密码")}
              </label>
              <input
                type="password"
                className="cycle-input"
                placeholder={t("Enter password", "密码")}
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                autoFocus
                required
              />
            </div>

            {error && <div className="login-error-msg" style={{ marginTop: 10 }}>{error}</div>}
          </div>

          <div className="cycle-modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              {t("Cancel", "取消")}
            </button>
            <button type="submit" className="btn-primary">
              {t("Confirm", "确定")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
