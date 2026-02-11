import React, { useState, useEffect } from "react";
import { db } from "./firebase";
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy } from "firebase/firestore";
import "./App.css";

function AnimatedCounter({ value, suffix = "" }) {
  const [display, setDisplay] = useState(value);
  useEffect(() => {
    const start = display;
    const end = value;
    const duration = 800;
    const startTime = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(start + (end - start) * eased);
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
    // eslint-disable-next-line
  }, [value]);
  return (
    <span className="counter">
      {display.toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      {suffix}
    </span>
  );
}

function Toast({ message, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);
  return <div className={`toast toast-${type}`}>{message}</div>;
}

function Modal({ title, onClose, children }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function PrintView({ transactions, dateFrom, dateTo, title }) {
  const filtered = transactions.filter((t) => {
    if (t.type !== "expense") return false;
    const d = new Date(t.date);
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    to.setHours(23, 59, 59, 999);
    return d >= from && d <= to;
  });

  const total = filtered.reduce((s, t) => s + t.amount, 0);

  const formatDate = (iso) => new Date(iso).toLocaleDateString("ar-SA", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div id="print-area" style={{ direction: "rtl", fontFamily: "Tajawal, sans-serif", padding: 40, background: "#fff", color: "#000" }}>
      <div style={{ textAlign: "center", marginBottom: 30, borderBottom: "2px solid #000", paddingBottom: 20 }}>
        <h1 style={{ fontSize: 24, margin: 0 }}>كشف المصروفات</h1>
        <p style={{ fontSize: 14, color: "#666", marginTop: 8 }}>{title}</p>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr style={{ background: "#f0f0f0" }}>
            <th style={{ border: "1px solid #ccc", padding: 10, textAlign: "right" }}>#</th>
            <th style={{ border: "1px solid #ccc", padding: 10, textAlign: "right" }}>التاريخ</th>
            <th style={{ border: "1px solid #ccc", padding: 10, textAlign: "right" }}>المبلغ</th>
            <th style={{ border: "1px solid #ccc", padding: 10, textAlign: "right" }}>الملاحظات</th>
            <th style={{ border: "1px solid #ccc", padding: 10, textAlign: "right" }}>بواسطة</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((tx, i) => (
            <tr key={tx.id}>
              <td style={{ border: "1px solid #ccc", padding: 10 }}>{i + 1}</td>
              <td style={{ border: "1px solid #ccc", padding: 10 }}>{formatDate(tx.date)}</td>
              <td style={{ border: "1px solid #ccc", padding: 10 }}>{tx.amount.toLocaleString("ar-SA", { minimumFractionDigits: 2 })} ر.س</td>
              <td style={{ border: "1px solid #ccc", padding: 10 }}>{tx.note || "-"}</td>
              <td style={{ border: "1px solid #ccc", padding: 10 }}>{tx.addedBy}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: 20, padding: 15, background: "#f0f0f0", borderRadius: 8, display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 16 }}>
        <span>إجمالي المصروفات:</span>
        <span>{total.toLocaleString("ar-SA", { minimumFractionDigits: 2 })} ر.س</span>
      </div>

      {filtered.length === 0 && <p style={{ textAlign: "center", padding: 30, color: "#999" }}>لا توجد مصروفات في هذه الفترة</p>}
    </div>
  );
}

function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState("");
  const [admins, setAdmins] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "admins"), (snap) => {
      if (snap.empty) {
        setAdmins(null);
      } else {
        const data = snap.docs[0].data();
        data.docId = snap.docs[0].id;
        setAdmins(data);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleSubmit = async () => {
    setError("");
    if (!username.trim() || !password.trim()) {
      setError("يرجى ملء جميع الحقول");
      return;
    }

    if (isRegistering) {
      if (admins) {
        setError("يوجد مسؤول بالفعل، يرجى تسجيل الدخول");
        return;
      }
      const newAdmin = { username: username.trim(), password: password.trim(), role: "owner", createdAt: new Date().toISOString(), managers: [] };
      await addDoc(collection(db, "admins"), newAdmin);
      onLogin({ username: newAdmin.username, role: "owner" });
    } else {
      if (!admins) {
        setError("لا يوجد حساب، يرجى إنشاء حساب أولاً");
        setIsRegistering(true);
        return;
      }
      if (admins.username === username.trim() && admins.password === password.trim()) {
        onLogin({ username: admins.username, role: "owner" });
      } else {
        const mgr = (admins.managers || []).find((m) => m.username === username.trim() && m.password === password.trim());
        if (mgr) {
          onLogin({ username: mgr.username, role: "manager" });
        } else {
          setError("اسم المستخدم أو كلمة المرور غير صحيحة");
        }
      }
    }
  };

  if (loading) return <div className="login-page"><p style={{ color: "#64748B" }}>جاري التحميل...</p></div>;

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <div className="login-icon">💰</div>
          <h1>إدارة المالية</h1>
          <p>{isRegistering ? "إنشاء حساب المسؤول الرئيسي" : "تسجيل الدخول"}</p>
        </div>
        {error && <div className="error-box">{error}</div>}
        <div className="form-group">
          <label>اسم المستخدم</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSubmit()} placeholder="أدخل اسم المستخدم" />
        </div>
        <div className="form-group">
          <label>كلمة المرور</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSubmit()} placeholder="أدخل كلمة المرور" />
        </div>
        <button className="btn-primary full-width" onClick={handleSubmit}>
          {isRegistering ? "إنشاء الحساب" : "دخول"}
        </button>
        <p className="login-switch">
          {isRegistering ? "لديك حساب؟" : "ليس لديك حساب؟"}{" "}
          <span onClick={() => { setIsRegistering(!isRegistering); setError(""); }}>
            {isRegistering ? "تسجيل الدخول" : "إنشاء حساب"}
          </span>
        </p>
      </div>
    </div>
  );
}

function Dashboard({ user, onLogout }) {
  const [transactions, setTransactions] = useState([]);
  const [admins, setAdmins] = useState(null);
  const [managers, setManagers] = useState([]);
  const [showAddIncome, setShowAddIncome] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showAddManager, setShowAddManager] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showPrint, setShowPrint] = useState(false);
  const [toast, setToast] = useState(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [receipt, setReceipt] = useState(null);
  const [mgrUsername, setMgrUsername] = useState("");
  const [mgrPassword, setMgrPassword] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [printMode, setPrintMode] = useState("today");
  const [printFrom, setPrintFrom] = useState("");
  const [printTo, setPrintTo] = useState("");
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "transactions"), orderBy("date", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setTransactions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "admins"), (snap) => {
      if (!snap.empty) {
        const data = snap.docs[0].data();
        data.docId = snap.docs[0].id;
        setAdmins(data);
        setManagers(data.managers || []);
      }
    });
    return () => unsub();
  }, []);

  const totalIncome = transactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const totalExpense = transactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const balance = totalIncome - totalExpense;

  const resetForm = () => { setAmount(""); setNote(""); setReceipt(null); };

  const addTransaction = async (type) => {
    const val = parseFloat(amount);
    if (!val || val <= 0) { setToast({ message: "يرجى إدخال مبلغ صحيح", type: "error" }); return; }
    await addDoc(collection(db, "transactions"), {
      type, amount: val, note: note.trim(), receipt: receipt ? receipt.name : null,
      addedBy: user.username, date: new Date().toISOString(),
    });
    resetForm(); setShowAddIncome(false); setShowAddExpense(false);
    setToast({ message: type === "income" ? "تم إضافة المدخول بنجاح" : "تم إضافة المصروف بنجاح", type: "success" });
  };

  const deleteTransaction = async (id) => {
    await deleteDoc(doc(db, "transactions", id));
    setToast({ message: "تم حذف العملية", type: "success" });
  };

  const addManager = async () => {
    if (!mgrUsername.trim() || !mgrPassword.trim()) { setToast({ message: "يرجى ملء جميع الحقول", type: "error" }); return; }
    if (!admins) return;
    const currentManagers = admins.managers || [];
    if (admins.username === mgrUsername.trim() || currentManagers.some((m) => m.username === mgrUsername.trim())) {
      setToast({ message: "اسم المستخدم موجود بالفعل", type: "error" }); return;
    }
    const updatedManagers = [...currentManagers, { username: mgrUsername.trim(), password: mgrPassword.trim(), role: "manager", createdAt: new Date().toISOString() }];
    const { updateDoc } = await import("firebase/firestore");
    await updateDoc(doc(db, "admins", admins.docId), { managers: updatedManagers });
    setMgrUsername(""); setMgrPassword(""); setShowAddManager(false);
    setToast({ message: "تم إضافة المدير بنجاح", type: "success" });
  };

  const removeManager = async (username) => {
    if (!admins) return;
    const updatedManagers = (admins.managers || []).filter((m) => m.username !== username);
    const { updateDoc } = await import("firebase/firestore");
    await updateDoc(doc(db, "admins", admins.docId), { managers: updatedManagers });
    setToast({ message: "تم حذف المدير", type: "success" });
  };

  const changeCredentials = async () => {
    if (!admins) return;
    const { updateDoc } = await import("firebase/firestore");
    const updates = {};
    if (newUsername.trim()) updates.username = newUsername.trim();
    if (newPassword.trim()) updates.password = newPassword.trim();
    if (Object.keys(updates).length === 0) {
      setToast({ message: "يرجى إدخال اسم مستخدم أو كلمة مرور جديدة", type: "error" });
      return;
    }
    if (user.role === "owner") {
      await updateDoc(doc(db, "admins", admins.docId), updates);
    } else {
      const updatedManagers = (admins.managers || []).map((m) => {
        if (m.username === user.username) {
          return { ...m, ...updates };
        }
        return m;
      });
      await updateDoc(doc(db, "admins", admins.docId), { managers: updatedManagers });
    }
    setNewUsername(""); setNewPassword(""); setShowSettings(false);
    setToast({ message: "تم تحديث البيانات بنجاح، يرجى تسجيل الدخول مرة أخرى", type: "success" });
    setTimeout(() => onLogout(), 2000);
  };

  const handlePrint = () => {
    let from, to;
    const today = new Date().toISOString().split("T")[0];
    if (printMode === "today") {
      from = today;
      to = today;
    } else {
      if (!printFrom || !printTo) {
        setToast({ message: "يرجى تحديد التاريخ", type: "error" });
        return;
      }
      from = printFrom;
      to = printTo;
    }
    setPrintFrom(from);
    setPrintTo(to);
    setShowPrint(false);
    setShowPrintPreview(true);
  };

  const doPrint = () => {
    const printContent = document.getElementById("print-area").innerHTML;
    const win = window.open("", "_blank");
    win.document.write(`
      <html dir="rtl">
      <head>
        <title>كشف المصروفات</title>
        <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800&display=swap" rel="stylesheet">
        <style>
          body { font-family: Tajawal, sans-serif; direction: rtl; margin: 0; padding: 0; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>${printContent}</body>
      </html>
    `);
    win.document.close();
    win.onload = () => { win.print(); };
  };

  const filteredTx = filterType === "all" ? transactions : transactions.filter((t) => t.type === filterType);

  const formatDate = (iso) => new Date(iso).toLocaleDateString("ar-SA", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="dashboard">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <header className="header">
        <div className="header-right">
          <div className="header-icon">💰</div>
          <div>
            <h1>إدارة المالية</h1>
            <p>مرحباً، {user.username} • {user.role === "owner" ? "المسؤول الرئيسي" : "مدير"}</p>
          </div>
        </div>
        <div className="header-left">
          <button className="btn-secondary btn-sm" onClick={() => setShowPrint(true)}>🖨️ طباعة</button>
          <button className="btn-secondary btn-sm" onClick={() => { setNewUsername(""); setNewPassword(""); setShowSettings(true); }}>⚙️ الإعدادات</button>
          {user.role === "owner" && <button className="btn-secondary btn-sm" onClick={() => setShowAddManager(true)}>👥 إدارة المدراء</button>}
          <button className="btn-secondary btn-sm" onClick={onLogout}>خروج</button>
        </div>
      </header>

      <div className="main-content">
        <div className="cards-grid">
          <div className="card card-income">
            <div className="card-top">
              <div>
                <p className="card-label">إجمالي المدخولات</p>
                <p className="card-value income-color"><AnimatedCounter value={totalIncome} suffix=" ر.س" /></p>
              </div>
              <div className="card-icon income-bg">📈</div>
            </div>
            <button className="btn-primary full-width mt-20" onClick={() => { resetForm(); setShowAddIncome(true); }}>+ إضافة مدخول</button>
          </div>

          <div className="card card-expense">
            <div className="card-top">
              <div>
                <p className="card-label">إجمالي المصروفات</p>
                <p className="card-value expense-color"><AnimatedCounter value={totalExpense} suffix=" ر.س" /></p>
              </div>
              <div className="card-icon expense-bg">📉</div>
            </div>
            <button className="btn-danger full-width mt-20" onClick={() => { resetForm(); setShowAddExpense(true); }}>+ إضافة مصروف</button>
          </div>

          <div className="card" style={{ borderTop: `3px solid ${balance >= 0 ? "#3B82F6" : "#F59E0B"}` }}>
            <div className="card-top">
              <div>
                <p className="card-label">المتبقي</p>
                <p className="card-value" style={{ color: balance >= 0 ? "#3B82F6" : "#F59E0B" }}><AnimatedCounter value={balance} suffix=" ر.س" /></p>
              </div>
              <div className="card-icon" style={{ background: balance >= 0 ? "rgba(59,130,246,0.1)" : "rgba(245,158,11,0.1)" }}>💼</div>
            </div>
            <div className="card-stat">
              <span>عدد العمليات</span>
              <span className="stat-value">{transactions.length}</span>
            </div>
          </div>
        </div>

        <div className="card history-card">
          <div className="history-header">
            <h2>سجل العمليات</h2>
            <div className="filter-buttons">
              {[{ key: "all", label: "الكل" }, { key: "income", label: "مدخولات" }, { key: "expense", label: "مصروفات" }].map((f) => (
                <button key={f.key} className={`filter-btn ${filterType === f.key ? "active" : ""}`} onClick={() => setFilterType(f.key)}>{f.label}</button>
              ))}
            </div>
          </div>

          {filteredTx.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📋</div>
              <p>لا توجد عمليات بعد</p>
            </div>
          ) : (
            <div className="tx-list">
              {filteredTx.map((tx) => (
                <div key={tx.id} className={`tx-item tx-${tx.type}`}>
                  <div className="tx-info">
                    <div className="tx-badges">
                      <span className={`tx-badge badge-${tx.type}`}>{tx.type === "income" ? "مدخول" : "مصروف"}</span>
                      {tx.receipt && <span className="tx-badge badge-receipt">📎 فاتورة</span>}
                    </div>
                    {tx.note && <p className="tx-note">{tx.note}</p>}
                    <p className="tx-meta">{formatDate(tx.date)} • {tx.addedBy}</p>
                  </div>
                  <div className="tx-actions">
                    <span className={`tx-amount ${tx.type === "income" ? "income-color" : "expense-color"}`}>
                      {tx.type === "income" ? "+" : "-"}{tx.amount.toLocaleString("ar-SA", { minimumFractionDigits: 2 })}<small> ر.س</small>
                    </span>
                    {user.role === "owner" && <button className="delete-btn" onClick={() => deleteTransaction(tx.id)}>🗑</button>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showAddIncome && (
        <Modal title="إضافة مدخول" onClose={() => setShowAddIncome(false)}>
          <div className="form-group"><label>المبلغ (ر.س) *</label><input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" /></div>
          <div className="form-group"><label>ملاحظات</label><textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="وصف المدخول..." rows={3} /></div>
          <div className="modal-buttons">
            <button className="btn-primary" onClick={() => addTransaction("income")}>إضافة المدخول</button>
            <button className="btn-secondary" onClick={() => setShowAddIncome(false)}>إلغاء</button>
          </div>
        </Modal>
      )}

      {showAddExpense && (
        <Modal title="إضافة مصروف" onClose={() => setShowAddExpense(false)}>
          <div className="form-group"><label>المبلغ (ر.س) *</label><input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" /></div>
          <div className="form-group"><label>ملاحظات (في ايش تم الصرف) *</label><textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="مثال: شراء مستلزمات مكتبية..." rows={3} /></div>
          <div className="form-group">
            <label>رفع فاتورة (اختياري)</label>
            <label className="file-upload">
              <input type="file" accept="image/*,.pdf" onChange={(e) => setReceipt(e.target.files[0] || null)} />
              {receipt ? <span className="file-selected">📎 {receipt.name}</span> : <span>📤 اضغط لرفع الفاتورة</span>}
            </label>
          </div>
          <div className="modal-buttons">
            <button className="btn-danger" onClick={() => addTransaction("expense")}>إضافة المصروف</button>
            <button className="btn-secondary" onClick={() => setShowAddExpense(false)}>إلغاء</button>
          </div>
        </Modal>
      )}

      {showSettings && (
        <Modal title="تغيير البيانات" onClose={() => setShowSettings(false)}>
          <div className="form-group">
            <label>اسم المستخدم الجديد (اتركه فاضي إذا ما تبي تغيره)</label>
            <input value={newUsername} onChange={(e) => setNewUsername(e.target.value)} placeholder="اسم المستخدم الجديد" />
          </div>
          <div className="form-group">
            <label>كلمة المرور الجديدة (اتركها فاضية إذا ما تبي تغيرها)</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="كلمة المرور الجديدة" />
          </div>
          <div className="modal-buttons">
            <button className="btn-primary" onClick={changeCredentials}>حفظ التغييرات</button>
            <button className="btn-secondary" onClick={() => setShowSettings(false)}>إلغاء</button>
          </div>
        </Modal>
      )}

      {showPrint && (
        <Modal title="طباعة كشف المصروفات" onClose={() => setShowPrint(false)}>
          <div className="form-group">
            <label>اختر نوع الطباعة</label>
            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <button className={`filter-btn ${printMode === "today" ? "active" : ""}`} onClick={() => setPrintMode("today")} style={{ flex: 1, padding: 12 }}>مصروفات اليوم</button>
              <button className={`filter-btn ${printMode === "custom" ? "active" : ""}`} onClick={() => setPrintMode("custom")} style={{ flex: 1, padding: 12 }}>تحديد تاريخ</button>
            </div>
          </div>
          {printMode === "custom" && (
            <>
              <div className="form-group">
                <label>من تاريخ</label>
                <input type="date" value={printFrom} onChange={(e) => setPrintFrom(e.target.value)} />
              </div>
              <div className="form-group">
                <label>إلى تاريخ</label>
                <input type="date" value={printTo} onChange={(e) => setPrintTo(e.target.value)} />
              </div>
            </>
          )}
          <div className="modal-buttons">
            <button className="btn-primary" onClick={handlePrint}>عرض الكشف</button>
            <button className="btn-secondary" onClick={() => setShowPrint(false)}>إلغاء</button>
          </div>
        </Modal>
      )}

      {showPrintPreview && (
        <Modal title="معاينة الكشف" onClose={() => setShowPrintPreview(false)}>
          <PrintView
            transactions={transactions}
            dateFrom={printFrom}
            dateTo={printTo}
            title={printMode === "today" ? "مصروفات اليوم - " + new Date().toLocaleDateString("ar-SA") : `من ${printFrom} إلى ${printTo}`}
          />
          <div className="modal-buttons" style={{ marginTop: 16 }}>
            <button className="btn-primary" onClick={doPrint}>🖨️ طباعة</button>
            <button className="btn-secondary" onClick={() => setShowPrintPreview(false)}>إغلاق</button>
          </div>
        </Modal>
      )}

      {showAddManager && (
        <Modal title="إدارة المدراء" onClose={() => setShowAddManager(false)}>
          <div className="manager-add-section">
            <p className="section-title">إضافة مدير جديد</p>
            <div className="form-group"><input value={mgrUsername} onChange={(e) => setMgrUsername(e.target.value)} placeholder="اسم المستخدم" /></div>
            <div className="form-group"><input type="password" value={mgrPassword} onChange={(e) => setMgrPassword(e.target.value)} placeholder="كلمة المرور" /></div>
            <button className="btn-primary full-width" onClick={addManager}>+ إضافة مدير</button>
          </div>
          {managers.length > 0 && (
            <div>
              <p className="section-title">المدراء الحاليين ({managers.length})</p>
              {managers.map((m) => (
                <div key={m.username} className="manager-item">
                  <div>
                    <p className="manager-name">👤 {m.username}</p>
                    <p className="manager-date">تمت الإضافة: {new Date(m.createdAt).toLocaleDateString("ar-SA")}</p>
                  </div>
                  <button className="btn-delete-sm" onClick={() => removeManager(m.username)}>حذف</button>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  return user ? <Dashboard user={user} onLogout={() => setUser(null)} /> : <LoginScreen onLogin={setUser} />;
}