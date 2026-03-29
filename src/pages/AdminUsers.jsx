import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { FiUserPlus, FiUser, FiTrash2, FiEye, FiEyeOff, FiShield, FiRefreshCw, FiSearch } from "react-icons/fi";
import { C, API, GLOBAL_CSS, Modal, Field } from "../ui.jsx";

export default function AdminUsers() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", password: "", role: "user" });
  const [showPass, setShowPass] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [deleteId, setDeleteId] = useState(null);
  const nameRef = useRef(null);

  useEffect(() => {
    if (!user || user.role !== "admin") navigate("/");
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API}/get_users.php`);
      const data = await res.json();
      if (data.status === "success") setUsers(data.users || []);
    } catch {
      setMsg("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  useEffect(() => {
    if (showAdd) setTimeout(() => nameRef.current?.focus(), 100);
  }, [showAdd]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.password.trim()) {
      setMsg("Username and password are required");
      return;
    }
    try {
      setSaving(true);
      setMsg("");
      const res = await fetch(`${API}/add_user.php`, {
        method: "POST",
        body: JSON.stringify({ ...form, createdBy: user?.id || 1 }),
      });
      const data = await res.json();
      if (data.status === "success") {
        setShowAdd(false);
        setForm({ name: "", password: "", role: "user" });
        fetchUsers();
      } else {
        setMsg(data.message || "Failed to create user");
      }
    } catch {
      setMsg("Server not responding");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`${API}/delete_user.php`, {
        method: "POST",
        body: JSON.stringify({ id, updatedBy: user?.id || 1 }),
      });
      const data = await res.json();
      if (data.status === "success") {
        setDeleteId(null);
        fetchUsers();
      } else {
        setMsg(data.message || "Failed to delete user");
      }
    } catch {
      setMsg("Server not responding");
    }
  };

  const filtered = users.filter((u) => {
    if (!q.trim()) return true;
    const qLow = q.trim().toLowerCase();
    return u.name.toLowerCase().includes(qLow) || (u.role || "").toLowerCase().includes(qLow);
  });

  const totalUsers = users.length;
  const adminCount = users.filter((u) => u.role === "admin").length;
  const userCount = totalUsers - adminCount;

  return (
    <div id="g-root" style={{ padding: "20px 26px", background: C.bg, minHeight: "100vh" }}>
      <style>{GLOBAL_CSS}</style>

      {/* KPI */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 14 }}>
        {[
          { label: "Total Users", value: totalUsers, color: C.brand },
          { label: "Admins", value: adminCount, color: C.orange },
          { label: "Regular Users", value: userCount, color: C.green },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: "#fff", borderRadius: 10, border: "1.5px solid #e5e7eb", padding: "12px 16px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.textSub, textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 18, fontWeight: 900, color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14 }}>
        <div style={{ position: "relative", flex: 1, minWidth: 160 }}>
          <FiSearch size={13} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: C.textSub, pointerEvents: "none" }} />
          <input className="g-inp sm" style={{ paddingLeft: 28, width: "100%" }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search username or role…" />
        </div>
        <span style={{ fontSize: 11, color: C.textSub, whiteSpace: "nowrap" }}>{filtered.length} results</span>
        <button className="g-btn ghost sm" onClick={fetchUsers} disabled={loading}><FiRefreshCw size={14} /></button>
        <button className="g-btn primary sm" onClick={() => { setShowAdd(true); setMsg(""); }} style={{ gap: 5 }}>
          <FiUserPlus size={14} /> New User
        </button>
      </div>

      {/* Table */}
      <div className="g-card">
        <div style={{ overflowX: "auto" }}>
          <table className="g-table">
            <thead>
              <tr>
                <th style={{ width: 50 }}>#</th>
                <th>Username</th>
                <th>Role</th>
                <th style={{ width: 80 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} style={{ textAlign: "center", padding: 24, color: C.textSub }}>Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={4} style={{ textAlign: "center", padding: 24, color: C.textSub }}>No users found</td></tr>
              ) : filtered.map((u, i) => (
                <tr key={u.id}>
                  <td style={{ color: C.textSub }}>{i + 1}</td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 7,
                        background: u.role === "admin" ? C.brandLight : C.greenLight,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: u.role === "admin" ? C.brand : C.green, flexShrink: 0,
                      }}>
                        {u.role === "admin" ? <FiShield size={13} /> : <FiUser size={13} />}
                      </div>
                      <span style={{ fontWeight: 600 }}>{u.name}</span>
                    </div>
                  </td>
                  <td>
                    <span style={{
                      padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 700,
                      background: u.role === "admin" ? C.brandLight : C.greenLight,
                      color: u.role === "admin" ? C.brand : C.green,
                    }}>
                      {u.role === "admin" ? "Admin" : "User"}
                    </span>
                  </td>
                  <td>
                    {u.role !== "admin" && (
                      <button className="g-btn danger sm" onClick={() => setDeleteId(u.id)} title="Delete user">
                        <FiTrash2 size={13} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      <Modal show={showAdd} title="Create New User" onClose={() => setShowAdd(false)} width={420} footer={
        <>
          <button className="g-btn ghost" onClick={() => setShowAdd(false)}>Cancel</button>
          <button className="g-btn primary" onClick={handleAdd} disabled={saving}>{saving ? "Creating…" : "Create User"}</button>
        </>
      }>
        <form onSubmit={handleAdd}>
          {msg && (
            <div style={{
              marginBottom: 14, padding: "8px 12px", borderRadius: 8,
              background: C.redLight, border: `1.5px solid #fca5a5`,
              fontSize: 12, fontWeight: 600, color: C.red,
            }}>
              {msg}
            </div>
          )}
          <Field label="Username">
            <input ref={nameRef} className="g-inp" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Enter username" />
          </Field>
          <div style={{ marginTop: 14 }}>
            <Field label="Password">
              <div style={{ position: "relative" }}>
                <input className="g-inp" value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  type={showPass ? "text" : "password"}
                  placeholder="Enter password"
                  style={{ paddingRight: 42 }} />
                <button type="button" onClick={() => setShowPass((p) => !p)}
                  style={{
                    position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", cursor: "pointer", color: C.textSub, padding: 4, display: "flex",
                  }}>
                  {showPass ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                </button>
              </div>
            </Field>
          </div>
          <div style={{ marginTop: 14 }}>
            <Field label="Role">
              <select className="g-sel" value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </Field>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <Modal show={!!deleteId} title="Delete User" onClose={() => setDeleteId(null)} width={380} footer={
        <>
          <button className="g-btn ghost" onClick={() => setDeleteId(null)}>Cancel</button>
          <button className="g-btn danger" onClick={() => handleDelete(deleteId)} style={{ background: `${C.red} !important`, color: "#fff !important" }}>Delete</button>
        </>
      }>
        <p style={{ fontSize: 14, color: C.text, margin: 0 }}>
          Are you sure you want to delete this user? This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
