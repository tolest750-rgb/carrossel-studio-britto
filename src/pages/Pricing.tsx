import { Navigate } from "react-router-dom";

// Legacy /pricing route — redirect to /account where the checkout lives now.
export default function Pricing() {
  return <Navigate to="/account" replace />;
}
