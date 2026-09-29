import React from "react";
import { Navigate } from "react-router-dom";
import { getCurrentUser, hasPermission, isAdmin } from "@/lib/auth";

interface ProtectedRouteProps {
  children: React.ReactElement;
  perm?: string;
  adminOnly?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, perm, adminOnly }) => {
  const user = getCurrentUser();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (adminOnly && !isAdmin()) {
    return <Navigate to="/login" replace />;
  }
  if (perm && !hasPermission(perm)) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

export default ProtectedRoute;
