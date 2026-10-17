import Box from "@mui/material/Box";
import type { ReactElement } from "react";
import { Outlet } from "react-router";
import { AppSidebar } from "./AppSidebar";

export function AppLayout(): ReactElement {
  return (
    <Box
      sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}
    >
      <AppSidebar />
      <Box component="main" sx={{ flex: 1, p: 3 }}>
        <Outlet />
      </Box>
    </Box>
  );
}
