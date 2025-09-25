import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "bootstrap/dist/css/bootstrap.min.css";
import "./index.css"; // optional: create for custom styles

const root = createRoot(document.getElementById("root"));
root.render(<App />);
