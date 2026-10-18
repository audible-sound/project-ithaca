import { ThemeProvider } from "@mui/material/styles";
import type { ReactElement } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { RequireAuth } from "./features/auth/RequireAuth";
import { SignInRoute } from "./features/auth/SignInRoute";
import { HomePage } from "./features/home/HomePage";
import { IcpFormPage } from "./features/icp/IcpFormPage";
import { IcpPage } from "./features/icp/IcpPage";
import { AppLayout } from "./layouts/AppLayout";
import { theme } from "./theme/theme";

export function App(): ReactElement {
  return (
    <ThemeProvider theme={theme}>
      <BrowserRouter>
        <Routes>
          <Route path="/sign-in" element={<SignInRoute />} />
          <Route element={<RequireAuth />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/icp" element={<IcpPage />} />
              <Route path="/icp/new" element={<IcpFormPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
