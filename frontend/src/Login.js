// src/Login.js
import { useState } from "react";
import axios from "axios";

const LOGIN_API = "http://localhost:4000/auth/login";

export default function Login({ onClose, onLoggedIn }) {
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!form.email || !form.password) return alert("Fill both fields");
    setLoading(true);
    try {
      const res = await axios.post(LOGIN_API, form);
      const { token, user } = res.data;
      localStorage.setItem("token", token);
      if (onLoggedIn) onLoggedIn({ token, user });
      if (onClose) onClose();
    } catch (err) {
      alert(err.response?.data?.error || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="d-flex justify-content-center my-4">
      <form onSubmit={submit} className="card p-3 shadow-sm" style={{ maxWidth: 420, width: "100%" }}>
        <h4 className="mb-3 text-center">Login</h4>
        <input
          className="form-control mb-2"
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <input
          className="form-control mb-2"
          type="password"
          placeholder="Password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
        <button className="btn btn-primary w-100" disabled={loading}>
          {loading ? "Logging in…" : "Login"}
        </button>
      </form>
    </div>
  );
}
