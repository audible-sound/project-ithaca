import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useState, type SubmitEvent } from "react";
import { useAuthStore } from "../../stores/authStore";

export function AuthPage() {
  const message = useAuthStore((state) => state.message);
  const status = useAuthStore((state) => state.status);
  const signIn = useAuthStore((state) => state.signIn);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function handleSubmit(event: SubmitEvent<HTMLFormElement>): void {
    event.preventDefault();
    void signIn(email, password);
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "background.default",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: 3,
      }}
    >
      <Container maxWidth="sm">
        <Typography variant="h1">Project Ithaca</Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mt: 1, mb: 3 }}>
          Multi-agent B2B lead management
        </Typography>
        <Paper
          component="section"
          elevation={0}
          sx={{ p: 3, border: 1, borderColor: "divider" }}
        >
          <Typography variant="h2" sx={{ mb: 3 }}>
            Sign in
          </Typography>
          <Stack component="form" spacing={2} onSubmit={handleSubmit}>
            <TextField
              label="Email"
              name="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
              }}
              autoComplete="username"
              fullWidth
            />
            <TextField
              label="Password"
              name="password"
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
              }}
              autoComplete="current-password"
              fullWidth
            />
            <Button
              type="submit"
              variant="contained"
              disabled={status === "loading"}
            >
              Sign in
            </Button>
            {message ? (
              <Alert severity={status === "ready" ? "success" : "error"}>
                {message}
              </Alert>
            ) : null}
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}
