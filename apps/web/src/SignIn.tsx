import { useState } from "react";
import { api } from "./api";
export function SignIn({ onSuccess }: { onSuccess: () => void }) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <main className="signin-screen">
      <a className="brand standalone" href="/">
        thread<span>.</span>
      </a>
      <section className="card">
        <span className="eyebrow">YOUR HOUSEHOLD SPACE</span>
        <h1>A little support, together.</h1>
        <p>Sign in to open your companion and private diary.</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget,
              f = new FormData(form),
              password = f.get("password");
            (form.elements.namedItem("password") as HTMLInputElement).value =
              "";
            setBusy(true);
            setError("");
            try {
              await api("/api/auth/login", { role: f.get("role"), password });
              onSuccess();
            } catch (e: any) {
              setError(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Open as
            <select name="role">
              <option value="patient">Patient companion</option>
              <option value="caregiver">Caregiver portal</option>
            </select>
          </label>
          <label>
            Household password
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              maxLength={256}
            />
          </label>
          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}
          <button className="primary full" disabled={busy}>
            {busy ? "Opening…" : "Open Thread"}
          </button>
        </form>
      </section>
    </main>
  );
}
