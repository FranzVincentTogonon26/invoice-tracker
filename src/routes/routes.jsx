import { createBrowserRouter, Navigate } from "react-router-dom";

import RootRedirect from "@/components/auth/RootRedirect";
import ProtectedShell from "@/components/auth/ProtectedShell";

import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Dashboard from "@/pages/Dashboard";

export const router = createBrowserRouter([
  { path: "/", element: <RootRedirect /> },
  { path: "/login", element: <Login /> },
  { path: "/register", element: <Register /> },
  {
    element: <ProtectedShell />,
    children: [{ path: "/dashboard", element: <Dashboard /> }],
  },
  {
    path: "*",
    element: <Navigate to="/" replace />,
  },
]);
