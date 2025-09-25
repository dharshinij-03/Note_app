import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import Navbar from "./components/Navbar"; // Assuming you have a Navbar component
import Login from "./Login"; // Assuming you have a Login component

const API = "http://localhost:4000/api/notes";
const AUTH_ME = "http://localhost:4000/auth/me";

function App() {
  const [form, setForm] = useState({ title: "", details: "" });
  const [notes, setNotes] = useState([]);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({ title: "", details: "" });
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token") || null);
  const [showLogin, setShowLogin] = useState(false);

  // Set the default Authorization header for all requests if a token exists
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common["Authorization"];
    }
  }, [token]);

  // Wrap loadNotes in useCallback
  const loadNotes = useCallback(async () => {
    if (!token) return;
    try {
      const res = await axios.get(API);
      setNotes(res.data);
    } catch (err) {
      console.error("load notes error:", err);
      // If loading notes fails (e.g., token expired), force logout
      if (err.response?.status === 401) {
        handleLogout();
      }
    }
  }, [token]);

  // Load user details and notes on token change
  useEffect(() => {
    const fetchUser = async () => {
      if (token) {
        try {
          const res = await axios.get(AUTH_ME);
          setUser(res.data.user);
          await loadNotes();
        } catch (err) {
          console.error("auth/me failed:", err);
          handleLogout();
        }
      } else {
        setUser(null);
        setNotes([]);
      }
    };

    fetchUser();
  }, [token, loadNotes]);

  // ====== Handlers ======

  const handleLogout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
    delete axios.defaults.headers.common["Authorization"];
    window.location.href = "/"; // Force page reload or redirect
  };

  // 📝 CREATE NOTE
  async function addNote(e) {
    e.preventDefault();
    if (!form.title || !form.details) return alert("Fill both title and details");
    if (!user) return alert("Please log in to create notes.");

    try {
      const res = await axios.post(API, form);
      // Prepend the new note to the list
      setNotes([res.data, ...notes]); 
      setForm({ title: "", details: "" });
      // Reload user data to update plan info if limit was hit
      // We assume on successful creation, the user state is fine.
    } catch (err) {
      const errorMsg = err.response?.data?.error;
      if (errorMsg === "Free plan limit reached. Upgrade to Pro.") {
        alert(errorMsg);
      } else {
        console.error("Add note failed:", errorMsg || err);
        alert(`Failed to create note: ${errorMsg || 'Server error'}`);
      }
    }
  }

  // ✏️ START EDIT
  function startEdit(note) {
    setEditId(note._id);
    setEditForm({ title: note.title, details: note.details });
  }

  // 💾 UPDATE NOTE
  async function updateNote(e) {
    e.preventDefault();
    if (!editForm.title || !editForm.details) return alert("Fill both fields");

    try {
      const res = await axios.put(`${API}/${editId}`, editForm);
      // Update the notes list with the updated note
      setNotes(notes.map(note => (note._id === editId ? res.data : note)));
      setEditId(null);
    } catch (err) {
      console.error("Update note failed:", err.response?.data?.error || err);
      alert("Failed to update note.");
    }
  }

  // 🗑️ DELETE NOTE
  async function removeNote(id) {
    if (!window.confirm("Are you sure you want to delete this note?")) return;

    try {
      await axios.delete(`${API}/${id}`);
      // Remove the note from the state
      setNotes(notes.filter(note => note._id !== id));
    } catch (err) {
      console.error("Delete note failed:", err.response?.data?.error || err);
      alert("Failed to delete note.");
    }
  }

  // ✨ TENANT UPGRADE (Admin only)
  async function upgradeTenant() {
    if (!user || user.role !== 'admin' || user.plan === 'pro') return;
    if (!window.confirm(`Are you sure you want to upgrade tenant ${user.tenant} to PRO?`)) return;

    try {
      const res = await axios.post(`http://localhost:4000/tenants/${user.tenant}/upgrade`);
      // Update user state with the new plan
      setUser({ ...user, plan: res.data.tenant.plan });
      alert(`${user.tenant} upgraded to PRO!`);
    } catch (err) {
      console.error("Upgrade failed:", err.response?.data?.error || err);
      alert(`Upgrade failed: ${err.response?.data?.error || 'Server error'}`);
    }
  }

  // ====== JSX Render ======

  return (
    <div className="app-bg">
      <Navbar
        user={user}
        onShowLogin={() => setShowLogin(true)}
        onLogout={handleLogout}
      />

      <main className="container py-5">
        {user ? (
          <>
            {/* Display User Info and Upgrade Button */}
            <div className="alert alert-info d-flex justify-content-between align-items-center mb-4">
              <div>
                Logged in as **{user.email}** ({user.role}) for **{user.tenant}** tenant. 
                **Plan: {user.plan.toUpperCase()}**
              </div>
              {user.role === 'admin' && user.plan === 'free' && (
                <button className="btn btn-warning btn-sm" onClick={upgradeTenant}>
                  Upgrade to PRO
                </button>
              )}
            </div>
            
            {/* Note Creation Form */}
            <div className="card p-3 mb-4 shadow-sm">
                <h4>Create New Note</h4>
                <form onSubmit={addNote}>
                    <input 
                        className="form-control mb-2"
                        placeholder="Title"
                        value={form.title}
                        onChange={(e) => setForm({ ...form, title: e.target.value })}
                        required
                    />
                    <textarea
                        className="form-control mb-2"
                        placeholder="Details"
                        value={form.details}
                        onChange={(e) => setForm({ ...form, details: e.target.value })}
                        rows="3"
                        required
                    />
                    <button type="submit" className="btn btn-success">
                        Add Note
                    </button>
                </form>
            </div>

            {/* Notes List */}
            <h3 className="mb-3">Your Notes ({notes.length})</h3>
            <div className="row">
              {notes.length === 0 ? (
                <p className="text-center text-muted">No notes found for your tenant. Start by creating one!</p>
              ) : (
                notes.map((note) => (
                  <div key={note._id} className="col-md-6 col-lg-4 mb-3">
                    <div className="card h-100 shadow-sm">
                      {editId === note._id ? (
                        // Edit Form for the selected note
                        <div className="card-body">
                          <form onSubmit={updateNote}>
                            <input
                              className="form-control mb-2"
                              value={editForm.title}
                              onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                              required
                            />
                            <textarea
                              className="form-control mb-2"
                              value={editForm.details}
                              onChange={(e) => setEditForm({ ...editForm, details: e.target.value })}
                              rows="3"
                              required
                            />
                            <div className="d-flex justify-content-between">
                              <button type="submit" className="btn btn-primary btn-sm">Save</button>
                              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditId(null)}>Cancel</button>
                            </div>
                          </form>
                        </div>
                      ) : (
                        // Display Note
                        <div className="card-body d-flex flex-column">
                          <h5 className="card-title">{note.title}</h5>
                          <p className="card-text flex-grow-1">{note.details}</p>
                          <small className="text-muted">Created: {new Date(note.createdAt).toLocaleDateString()}</small>
                          <div className="mt-2">
                            <button 
                              className="btn btn-info btn-sm me-2" 
                              onClick={() => startEdit(note)}
                            >
                              Edit
                            </button>
                            <button 
                              className="btn btn-danger btn-sm" 
                              onClick={() => removeNote(note._id)}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          <h2 className="text-center">Please Log in to view and manage notes.</h2>
        )}
      </main>

      {showLogin && (
        <div className="container">
          <Login
            onClose={() => setShowLogin(false)}
            onLoggedIn={(data) => {
              setToken(data.token);
              // The useEffect hook handles setting the axios header and loading the user/notes
              setShowLogin(false);
            }}
          />
        </div>
      )}
    </div>
  );
}

export default App;