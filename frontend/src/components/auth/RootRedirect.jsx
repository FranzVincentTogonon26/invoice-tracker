import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export default function RootRedirect() {
  const { user, loading } = useAuth();

  if (loading) {
    return null; // or <Loading />
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Navigate to="/login" replace />;
}