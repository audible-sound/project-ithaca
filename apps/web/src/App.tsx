import { ThemeProvider } from "@mui/material/styles";
import type { ReactElement } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { RequireAuth } from "./features/auth/RequireAuth";
import { SignInRoute } from "./features/auth/SignInRoute";
import { HomePage } from "./features/home/HomePage";
import { IcpDetailPage } from "./features/icp/IcpDetailPage";
import { IcpFormPage } from "./features/icp/IcpFormPage";
import { IcpPage } from "./features/icp/IcpPage";
import { LeadDetailPage } from "./features/leads/LeadDetailPage";
import { LeadsPage } from "./features/leads/LeadsPage";
import { WorkflowFormPage } from "./features/workflow/WorkflowFormPage";
import { WorkflowPage } from "./features/workflow/WorkflowPage";
import { WorkflowRunPage } from "./features/workflow/WorkflowRunPage";
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
              <Route path="/leads" element={<LeadsPage />} />
              <Route path="/leads/:leadId" element={<LeadDetailPage />} />
              <Route path="/icp" element={<IcpPage />} />
              <Route path="/icp/new" element={<IcpFormPage />} />
              <Route path="/icp/:icpId/edit" element={<IcpFormPage />} />
              <Route path="/icp/:icpId" element={<IcpDetailPage />} />
              <Route path="/workflow" element={<WorkflowPage />} />
              <Route path="/workflow/new" element={<WorkflowFormPage />} />
              <Route path="/workflow/:workflowRunId" element={<WorkflowRunPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
