import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import { AuthenticatedHeader, PublicHeader } from "../components/site-header";
import { ToastProvider } from "../components/toast-provider";
import { currentWorkspace } from "../lib/auth";
import theme from "./theme";

export const metadata = {
  title: "TokenLens — Codebase efficiency profiler",
  description:
    "Observed relationships between repository structure and coding-agent context consumption",
};

export default async function Layout({ children }: { children: React.ReactNode }) {
  const access = await currentWorkspace();
  return (
    <html lang="en">
      <body>
        <AppRouterCacheProvider>
          <ThemeProvider theme={theme}>
            <CssBaseline />
            {access ? (
              <AuthenticatedHeader workspaceRole={access.role} />
            ) : (
              <PublicHeader />
            )}
            <ToastProvider>{children}</ToastProvider>
          </ThemeProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
