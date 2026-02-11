"use client";

import { useState } from "react";
import { setCookie } from "./login-actions";

export default function LoginPage() {
  const [role, setRole] = useState("support");
  const [token, setToken] = useState("");

  async function submit() {
    await setCookie(role, token);
    window.location.href = "/";
  }

  return (
    <main>
      <h1>Control Plane Login</h1>
      <div className="card" style={{ maxWidth: 360 }}>
        <label style={{ display: "block", marginBottom: 12 }}>
          Role
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="support">support</option>
            <option value="ops">ops</option>
            <option value="admin">admin</option>
          </select>
        </label>
        <label style={{ display: "block", marginBottom: 12 }}>
          Token
          <input value={token} onChange={(e) => setToken(e.target.value)} />
        </label>
        <button onClick={submit}>Sign in</button>
      </div>
    </main>
  );
}
