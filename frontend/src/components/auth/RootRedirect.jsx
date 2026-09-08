import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { USER_ROLES } from "@/constants";

export default function RootRedirect() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] text-[var(--ink-muted)] text-sm">
        Loading...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  switch (user.role) {
    case USER_ROLES.ADMIN:
      return <Navigate to="/admin/dashboard" replace />;
    case USER_ROLES.EMPLOYEE:
      return <Navigate to="/employee/dashboard" replace />;
    default:
      return <Navigate to="/login" replace />;
  }
}
