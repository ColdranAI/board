"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BetaBadge } from "@/components/ui/beta-badge";
import { ProfileDropdown } from "@/components/profile-dropdown";
import { FullPageLoader } from "@/components/ui/loader";
import type { User } from "@/components/note";

interface NavigationProps {
  children?: React.ReactNode;
}

export function Navigation({ children }: NavigationProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const fetchUserData = useCallback(async () => {
    try {
      const response = await fetch("/api/user");
      if (response.status === 401) {
        // Only redirect to signin if we're not already on auth pages
        if (!pathname.startsWith("/auth") && !pathname.startsWith("/login")) {
          router.push("/auth/signin");
        }
        return;
      }

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
    } finally {
      setLoading(false);
    }
  }, [router, pathname]);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  // Don't show navigation on auth pages
  if (pathname.startsWith("/auth") || pathname.startsWith("/login") || pathname === "/") {
    return <>{children}</>;
  }

  if (loading) {
    return <FullPageLoader message="Loading..." />;
  }

  return (
    <div className=" bg-neutral-50 dark:bg-zinc-950">
      {/* Fixed Navigation Header */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-card dark:bg-zinc-900 border-b border-neutral-200 dark:border-zinc-800 shadow-sm">
        <div className="flex justify-between items-center h-16 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center space-x-4 sm:space-x-6">
            <Link href="/dashboard" className="flex-shrink-0">
              <h1 className="text-xl sm:text-2xl font-bold text-neutral-600 dark:text-neutral-400 flex items-center gap-2">
                Coldboard <BetaBadge />
              </h1>
            </Link>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-4">
            <ProfileDropdown user={user} />
          </div>
        </div>
      </nav>

      {/* Main Content with top padding to account for fixed nav */}
      <main className="pt-16">
        {children}
      </main>
    </div>
  );
}

export default Navigation;