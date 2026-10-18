import AccountTreeOutlined from "@mui/icons-material/AccountTreeOutlined";
import DashboardOutlined from "@mui/icons-material/DashboardOutlined";
import LogoutOutlined from "@mui/icons-material/LogoutOutlined";
import PeopleOutlined from "@mui/icons-material/PeopleOutlined";
import PersonSearchOutlined from "@mui/icons-material/PersonSearchOutlined";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Stack from "@mui/material/Stack";
import { alpha, type SxProps, type Theme } from "@mui/material/styles";
import type { SvgIconProps } from "@mui/material/SvgIcon";
import Typography from "@mui/material/Typography";
import type { ComponentType, ReactElement } from "react";
import { Link, useLocation } from "react-router";
import { useAuthStore } from "../stores/authStore";

type NavItem = {
  label: string;
  icon: ComponentType<SvgIconProps>;
  to?: string;
};

const navItems: NavItem[] = [
  { label: "Dashboard", to: "/", icon: DashboardOutlined },
  { label: "Leads", icon: PeopleOutlined },
  { label: "Ideal customer profile", to: "/icp", icon: PersonSearchOutlined },
  { label: "Workflow runs", icon: AccountTreeOutlined },
];

const navItemSx: SxProps<Theme> = {
  borderRadius: 1,
  minHeight: 40,
  px: 1.5,
  color: "text.secondary",
  "&.Mui-selected": {
    color: "primary.main",
    bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
    "&:hover": {
      bgcolor: (theme) => alpha(theme.palette.primary.main, 0.12),
    },
  },
};

function initialsFromName(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((part) => part.length > 0);
  const letters = parts.slice(0, 2).map((part) => part[0] ?? "");
  return letters.join("").toUpperCase();
}

export function AppSidebar(): ReactElement {
  const name = useAuthStore((state) => state.name);
  const signOut = useAuthStore((state) => state.signOut);
  const { pathname } = useLocation();

  return (
    <Box
      component="nav"
      sx={{
        width: 240,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        bgcolor: "background.paper",
        borderRight: 1,
        borderColor: "divider",
        p: 2,
      }}
    >
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
        <Box
          aria-hidden
          sx={{
            width: 32,
            height: 32,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 1,
            bgcolor: "primary.main",
            color: "primary.contrastText",
          }}
        >
          <Typography variant="h6" component="span" sx={{ lineHeight: 1, color: "inherit" }}>
            I
          </Typography>
        </Box>
        <Typography variant="h6">Project Ithaca</Typography>
      </Stack>
      <List
        disablePadding
        sx={{ mt: 2, display: "flex", flexDirection: "column", gap: 0.5 }}
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const selected =
            item.to === "/"
              ? pathname === "/"
              : item.to !== undefined &&
                (pathname === item.to || pathname.startsWith(`${item.to}/`));
          const label = (
            <>
              <ListItemIcon sx={{ minWidth: 32, color: "inherit" }}>
                <Icon fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                slotProps={{
                  primary: {
                    variant: "body2",
                    sx: { fontWeight: selected ? 500 : 400 },
                  },
                }}
              />
            </>
          );

          if (item.to) {
            return (
              <ListItemButton
                key={item.label}
                component={Link}
                to={item.to}
                selected={selected}
                sx={navItemSx}
              >
                {label}
              </ListItemButton>
            );
          }

          return (
            <ListItemButton key={item.label} disabled sx={navItemSx}>
              {label}
            </ListItemButton>
          );
        })}
      </List>
      <Box sx={{ mt: "auto", pt: 2 }}>
        <Divider />
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", pt: 2 }}>
          {name ? (
            <>
              <Avatar
                sx={{
                  width: 32,
                  height: 32,
                  flexShrink: 0,
                  bgcolor: "secondary.main",
                }}
              >
                <Typography variant="caption" color="inherit" sx={{ fontWeight: 500 }}>
                  {initialsFromName(name)}
                </Typography>
              </Avatar>
              <Typography variant="body2" noWrap sx={{ flex: 1, minWidth: 0 }}>
                {name}
              </Typography>
            </>
          ) : null}
          <IconButton aria-label="Log out" onClick={signOut} sx={{ ml: "auto" }}>
            <LogoutOutlined fontSize="small" />
          </IconButton>
        </Stack>
      </Box>
    </Box>
  );
}
