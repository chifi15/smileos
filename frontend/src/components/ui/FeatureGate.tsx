"use client";

import { useClinicFeatures } from "@/hooks/useSettings";
import type { FeatureName } from "@/hooks/useSettings";

interface Props {
  feature: FeatureName;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export default function FeatureGate({ feature, children, fallback = null }: Props) {
  const { data: features, isLoading } = useClinicFeatures();

  if (isLoading) return null;
  if (!features?.includes(feature)) return <>{fallback}</>;
  return <>{children}</>;
}
