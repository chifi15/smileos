"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "react-hot-toast";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/providers/AuthProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,   // datos frescos por 5 min
            gcTime: 30 * 60 * 1000,      // cache en memoria 30 min
            refetchOnWindowFocus: false,  // no recargar al volver de otra pestaña
            retry: 1,
          },
        },
      })
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem={true}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          {children}
        </AuthProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: { fontFamily: "inherit" },
          }}
        />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
