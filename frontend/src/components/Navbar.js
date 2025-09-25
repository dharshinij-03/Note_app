// src/components/Navbar.js
import React from "react";
import logo from "../assets/notesnest-logo.png"; // create a simple image or adjust path

function Navbar({ user, onShowLogin, onLogout }) {
  const displayName = user?.email || "Guest";

  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-primary shadow-sm px-4 py-2">
      <a className="navbar-brand fw-bold fs-4 d-flex align-items-center" href="/">
        {/* If you don't have logo, remove <img> */}
        <img
          src={logo}
          alt="NotesNest Logo"
          style={{ height: "40px", marginRight: "10px" }}
        />
        NotesNest
      </a>

      <div className="ms-auto d-flex align-items-center">
        {user ? (
          <>
            <span className="text-light me-3">{displayName}</span>
            <button
              className="btn btn-light btn-sm rounded-pill px-3"
              onClick={onLogout}
            >
              Logout
            </button>
          </>
        ) : (
          <button
            className="btn btn-light btn-sm rounded-pill px-3"
            onClick={onShowLogin}
          >
            Login
          </button>
        )}
      </div>
    </nav>
  );
}

export default Navbar;
