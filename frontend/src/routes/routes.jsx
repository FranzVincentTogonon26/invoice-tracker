import { createBrowserRouter, Navigate } from "react-router-dom";

import RootRedirect from "../components/auth/RootRedirect";
import ProtectedShell from "../components/auth/ProtectedShell";
import RoleGuard from "../components/auth/RoleGuard";

import AdminShell from "../components/layout/AdminShell";
import EmployeeShell from "../components/layout/EmployeeShell";

import { USER_ROLES } from "../constants";

import Login from "../pages/Login";
import Register from "../pages/Register";

import AdminDashboard from "../pages/admin/AdminDashboard";
import AdminEmployees from "../pages/admin/AdminEmployees";
import AdminBudget from "../pages/admin/AdminBudget";
import AdminProfile from "../pages/admin/AdminProfile";
import AdminTransaction from "../pages/admin/AdminTransaction";
import AdminExpenses from "../pages/admin/AdminExpenses";

import AddExpenses from "../components/layout/expenses/AddExpenses";

import EmployeeOverview from "../pages/employee/EmployeeOverview";
import EmployeeBudget from "../pages/employee/EmployeeBudget";
import EmployeeExpenses from "../pages/employee/EmployeeExpenses";
import EmployeeAbono from "../pages/employee/EmployeeAbono";
import EmployeeSetting from "../pages/employee/EmployeeSetting";

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
              { path: "overview", element: <EmployeeOverview /> },
              { path: "budget", element: <EmployeeBudget /> },
              { path: "expenses", element: <EmployeeExpenses /> },
              { path: "expenses/add", element: <AddExpenses /> },
              { path: "abono", element: <EmployeeAbono /> },
              { path: "setting", element: <EmployeeSetting /> },
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
