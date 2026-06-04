import { useEffect } from "react";
import { useLocation } from "wouter";

export default function Home() {
  const [, navigate] = useLocation();

  useEffect(() => {
    navigate("/dashboard");
  }, [navigate]);

  return null;
}
