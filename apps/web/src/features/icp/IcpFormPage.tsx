import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormHelperText from "@mui/material/FormHelperText";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useState, type ReactElement, type SubmitEvent } from "react";
import { useIcpStore, type IcpFormValues } from "../../stores/icpStore";

const emptyProfile: IcpFormValues = {
  name: "",
  industriesInclude: "",
  industriesExclude: "",
  country: "",
  region: "",
  city: "",
  companySizeMin: "",
  companySizeMax: "",
  budgetCurrency: "",
  budgetMin: "",
  budgetMax: "",
  budgetNotes: "",
  businessNeedKeywords: "",
  businessNeedDescription: "",
  outreachTone: "",
  messageConstraints: "",
  isActive: true,
};

const fieldGrid = {
  display: "grid",
  gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
  columnGap: 2,
  rowGap: 3,
} as const;

export function IcpFormPage(): ReactElement {
  const message = useIcpStore((state) => state.message);
  const status = useIcpStore((state) => state.status);
  const createProfile = useIcpStore((state) => state.createProfile);
  const [values, setValues] = useState(emptyProfile);

  function setText(field: keyof IcpFormValues, value: string): void {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>): void {
    event.preventDefault();
    void createProfile(values);
  }

  return (
    <Stack spacing={3} sx={{ maxWidth: 720 }}>
      <Box>
        <Typography variant="h1">Ideal Customer Profile</Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
          An empty industry, size, location, budget, or business need means that
          criterion is unrestricted.
        </Typography>
      </Box>
      <Paper
        component="form"
        elevation={0}
        onSubmit={handleSubmit}
        sx={{
          p: 3,
          border: 1,
          borderColor: "divider",
          "& .MuiOutlinedInput-root": {
            bgcolor: "background.paper",
          },
        }}
      >
        <Stack spacing={3}>
          <Stack spacing={2}>
            <Typography variant="h6">Profile</Typography>
            <Box sx={fieldGrid}>
              <TextField
                label="Profile name"
                name="name"
                value={values.name}
                onChange={(event) => {
                  setText("name", event.target.value);
                }}
                helperText="A short name you will recognize later. Example: Malaysia B2B software buyers."
                required
                sx={{ gridColumn: "1 / -1" }}
                fullWidth
              />
              <FormControl sx={{ gridColumn: "1 / -1" }}>
                <FormControlLabel
                  sx={{ mr: 0 }}
                  control={
                    <Checkbox
                      checked={values.isActive}
                      onChange={(event) => {
                        setValues((current) => ({
                          ...current,
                          isActive: event.target.checked,
                        }));
                      }}
                      size="small"
                    />
                  }
                  label="Active"
                />
                <FormHelperText sx={{ mx: 0 }}>
                  When checked, this profile is the one used for lead search.
                </FormHelperText>
              </FormControl>
            </Box>
          </Stack>

          <Stack spacing={2}>
            <Typography variant="h6">Industries</Typography>
            <Box sx={fieldGrid}>
              <TextField
                label="Industries include"
                name="industriesInclude"
                value={values.industriesInclude}
                onChange={(event) => {
                  setText("industriesInclude", event.target.value);
                }}
                helperText="Industries to target, separated by commas. Example: Software, manufacturing."
                fullWidth
              />
              <TextField
                label="Industries exclude"
                name="industriesExclude"
                value={values.industriesExclude}
                onChange={(event) => {
                  setText("industriesExclude", event.target.value);
                }}
                helperText="Industries to leave out, separated by commas. Example: Public sector."
                fullWidth
              />
            </Box>
          </Stack>

          <Stack spacing={2}>
            <Typography variant="h6">Location</Typography>
            <Box sx={fieldGrid}>
              <TextField
                label="Country"
                name="country"
                value={values.country}
                onChange={(event) => {
                  setText("country", event.target.value);
                }}
                helperText="One country name. Example: Malaysia."
                fullWidth
              />
              <TextField
                label="Region"
                name="region"
                value={values.region}
                onChange={(event) => {
                  setText("region", event.target.value);
                }}
                helperText="One state or region. Example: Selangor."
                fullWidth
              />
              <TextField
                label="City"
                name="city"
                value={values.city}
                onChange={(event) => {
                  setText("city", event.target.value);
                }}
                helperText="One city name. Example: Petaling Jaya."
                fullWidth
              />
            </Box>
          </Stack>

          <Stack spacing={2}>
            <Typography variant="h6">Company size</Typography>
            <Box sx={fieldGrid}>
              <TextField
                label="Company size min"
                name="companySizeMin"
                value={values.companySizeMin}
                onChange={(event) => {
                  setText("companySizeMin", event.target.value);
                }}
                helperText="Employee count as a whole number. Leave blank for no minimum. Example: 50."
                fullWidth
              />
              <TextField
                label="Company size max"
                name="companySizeMax"
                value={values.companySizeMax}
                onChange={(event) => {
                  setText("companySizeMax", event.target.value);
                }}
                helperText="Employee count as a whole number. Leave blank for no maximum. Minimum cannot be greater than maximum. Example: 250."
                fullWidth
              />
            </Box>
          </Stack>

          <Stack spacing={2}>
            <Typography variant="h6">Budget</Typography>
            <Box sx={fieldGrid}>
              <TextField
                label="Budget currency"
                name="budgetCurrency"
                value={values.budgetCurrency}
                onChange={(event) => {
                  setText("budgetCurrency", event.target.value);
                }}
                helperText="Currency code. Example: MYR."
                fullWidth
              />
              <TextField
                label="Budget minimum"
                name="budgetMin"
                value={values.budgetMin}
                onChange={(event) => {
                  setText("budgetMin", event.target.value);
                }}
                helperText="Whole number. Leave blank for no minimum. Example: 20000."
                fullWidth
              />
              <TextField
                label="Budget maximum"
                name="budgetMax"
                value={values.budgetMax}
                onChange={(event) => {
                  setText("budgetMax", event.target.value);
                }}
                helperText="Whole number. Leave blank for no maximum. Minimum cannot be greater than maximum. Example: 80000."
                fullWidth
              />
              <TextField
                label="Budget notes"
                name="budgetNotes"
                value={values.budgetNotes}
                onChange={(event) => {
                  setText("budgetNotes", event.target.value);
                }}
                helperText="Extra detail about the budget. Example: Enterprise IT budget."
                sx={{ gridColumn: "1 / -1" }}
                fullWidth
              />
            </Box>
          </Stack>

          <Stack spacing={2}>
            <Typography variant="h6">Business need</Typography>
            <Box sx={fieldGrid}>
              <TextField
                label="Business-need keywords"
                name="businessNeedKeywords"
                value={values.businessNeedKeywords}
                onChange={(event) => {
                  setText("businessNeedKeywords", event.target.value);
                }}
                helperText="Separate keywords with commas. Example: ERP, operations software."
                sx={{ gridColumn: "1 / -1" }}
                fullWidth
              />
              <TextField
                label="Business-need description"
                name="businessNeedDescription"
                value={values.businessNeedDescription}
                onChange={(event) => {
                  setText("businessNeedDescription", event.target.value);
                }}
                helperText="What the customer is trying to solve. Example: Needs operations software to replace an ageing ERP."
                sx={{ gridColumn: "1 / -1" }}
                multiline
                minRows={2}
                fullWidth
              />
            </Box>
          </Stack>

          <Stack spacing={2}>
            <Typography variant="h6">Outreach</Typography>
            <Box sx={fieldGrid}>
              <TextField
                label="Outreach tone"
                name="outreachTone"
                value={values.outreachTone}
                onChange={(event) => {
                  setText("outreachTone", event.target.value);
                }}
                helperText="How messages should sound. Example: Professional."
                sx={{ gridColumn: "1 / -1" }}
                fullWidth
              />
              <TextField
                label="Message constraints"
                name="messageConstraints"
                value={values.messageConstraints}
                onChange={(event) => {
                  setText("messageConstraints", event.target.value);
                }}
                helperText="Rules the draft must follow. Example: Keep under 120 words. Do not mention pricing."
                sx={{ gridColumn: "1 / -1" }}
                multiline
                minRows={2}
                fullWidth
              />
            </Box>
          </Stack>

          {message ? (
            <Alert severity={status === "ready" ? "success" : "error"}>
              {message}
            </Alert>
          ) : null}
          <Button
            type="submit"
            variant="contained"
            disabled={status === "loading"}
            sx={{ alignSelf: "flex-start" }}
          >
            Save profile
          </Button>
        </Stack>
      </Paper>
    </Stack>
  );
}
