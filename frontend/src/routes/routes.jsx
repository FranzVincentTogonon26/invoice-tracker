import { createBrowserRouter, Navigate } from "react-router-dom";

import RootRedirect from "../components/auth/RootRedirect";
import ProtectedShell from "../components/auth/ProtectedShell";
import RoleGuard from "../components/auth/RoleGuard";

import AdminShell from "../components/layout/AdminShell";
import EmployeeShell from "../components/layout/EmployeeShell";

import Login from "../pages/Login";
import Register from "../pages/Register";

import AdminDashboard from "../pages/admin/AdminDashboard";
import AdminEmployees from "../pages/admin/AdminEmployees";
import AdminBudget from "../pages/admin/AdminBudget";
import AdminProfile from "../pages/admin/AdminProfile";

import EmployeeDashboard from "../pages/employee/EmployeeDashboard";
import EmployeeProfile from "../pages/employee/EmployeeProfile";

import { USER_ROLES } from "../constants";
import AdminTransaction from "../pages/admin/AdminTransaction";
import AdminExpenses from "../pages/admin/AdminExpenses";
import AddExpenses from "../components/layout/admin/expenses/AddExpenses";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <RootRedirect />,
  },
  {
    path: "/login",
    element: <Login />,
  },
  {
    path: "/register",
    element: <Register />,
  },
  {
    element: <ProtectedShell />,
    children: [
      {
        element: <RoleGuard allowedRoles={[USER_ROLES.ADMIN]} />,
        children: [
          {
            path: "/admin",
            element: <AdminShell />,
            children: [
              { path: "dashboard", element: <AdminDashboard /> },
              { path: "budget", element: <AdminBudget /> },
              { path: "transaction", element: <AdminTransaction /> },
              { path: "employees", element: <AdminEmployees /> },
              { path: "expenses", element: <AdminExpenses /> },
              { path: "expenses/add", element: <AddExpenses /> },
              { path: "profile", element: <AdminProfile /> },
            ],
          },
        ],
      },
      {
        element: <RoleGuard allowedRoles={[USER_ROLES.EMPLOYEE]} />,
        children: [
          {
            path: "/employee",
            element: <EmployeeShell />,
            children: [
              {
                path: "dashboard",
                element: <EmployeeDashboard />,
              },
              {
                path: "profile",
                element: <EmployeeProfile />,
              },
            ],
          },
        ],
      },
    ],
  },
  {
    path: "*",
    element: <Navigate to="/" replace />,
  },
]);
