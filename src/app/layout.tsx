import type { Metadata } from "next";
import "./globals.css";
import "suneditor/dist/css/suneditor.min.css";
import { ThemeProvider } from "@/components/theme-provider";
import { ActiveThemeProvider } from "@/components/active-theme";
import { cookies } from "next/headers";
import { cn } from "@/lib/utils";
import { fontVariables } from "@/lib/fonts";
import ReduxProvider from "@/providers/redux";
import ClientAuthGuard from "@/components/client-guards";

// export const META_THEME_COLORS = {
//   light: "#ffffff",
//   dark: "#09090b",
// };

export const metadata: Metadata = {
  title: "Ujian Online",
  description:
    "Solusi cerdas untuk mempermudah manajemen dan pemantauan penjualan secara efisien.",
  icons: {
    icon: "/logo-stikes.jpg",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): Promise<React.ReactElement> {
  const cookieStore = await cookies();
  const activeThemeValue = cookieStore.get("active_theme")?.value;
  const isScaled = activeThemeValue?.endsWith("-scaled");
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          "bg-background overscroll-none font-sans antialiased",
          activeThemeValue ? `theme-${activeThemeValue}` : "",
          isScaled ? "theme-scaled" : "",
          fontVariables
        )}
      >
        <ReduxProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <ClientAuthGuard
              excludedRoutes={["/auth", "/auth/login", "/public", "/"]}
              excludedFetchPrefixes={["/api/auth/", "/auth/"]}
              loginPath="/auth/login"
            />
            <ActiveThemeProvider>{children}</ActiveThemeProvider>
          </ThemeProvider>
        </ReduxProvider>
      </body>
    </html>
  );
}
