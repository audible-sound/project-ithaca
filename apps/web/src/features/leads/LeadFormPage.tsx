import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import FormControl from "@mui/material/FormControl";
import FormHelperText from "@mui/material/FormHelperText";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type { LeadDetail } from "@ithaca/shared";
import { useEffect, useState, type ReactElement, type SubmitEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useAuthStore } from "../../stores/authStore";
import { useLeadStore, type LeadFormValues } from "../../stores/leadStore";
import { companySizeBands, companySizeLabel } from "./leadLabels";

const emptyLead: LeadFormValues = {
  companyName: "",
  website: "",
  industry: "",
  location: "",
  companySizeBand: "",
  description: "",
  companyEmail: "",
  companyPhone: "",
  companyLinkedinUrl: "",
  contactName: "",
  contactJobTitle: "",
  contactEmail: "",
  contactPhone: "",
  contactLinkedinUrl: "",
};

function textOrEmpty(value: string | null): string {
  return value ?? "";
}

function leadToFormValues(lead: LeadDetail): LeadFormValues {
  return {
    companyName: lead.companyName,
    website: textOrEmpty(lead.website),
    industry: textOrEmpty(lead.industry),
    location: textOrEmpty(lead.location),
    companySizeBand: textOrEmpty(lead.companySizeBand),
    description: textOrEmpty(lead.description),
    companyEmail: textOrEmpty(lead.companyEmail),
    companyPhone: textOrEmpty(lead.companyPhone),
    companyLinkedinUrl: textOrEmpty(lead.companyLinkedinUrl),
    contactName: lead.contact?.fullName ?? "",
    contactJobTitle: textOrEmpty(lead.contact?.jobTitle ?? null),
    contactEmail: textOrEmpty(lead.contact?.email ?? null),
    contactPhone: textOrEmpty(lead.contact?.phone ?? null),
    contactLinkedinUrl: textOrEmpty(lead.contact?.linkedinUrl ?? null),
  };
}

const fieldGrid = {
  display: "grid",
  gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
  columnGap: 2,
  rowGap: 3,
} as const;

export function LeadFormPage(): ReactElement {
  const { leadId } = useParams();
  const editing = leadId !== undefined;
  const navigate = useNavigate();
  const userId = useAuthStore((state) => state.userId);
  const formMessage = useLeadStore((state) => state.formMessage);
  const formStatus = useLeadStore((state) => state.formStatus);
  const lead = useLeadStore((state) => state.lead);
  const detailStatus = useLeadStore((state) => state.detailStatus);
  const detailMessage = useLeadStore((state) => state.detailMessage);
  const loadLead = useLeadStore((state) => state.loadLead);
  const createLead = useLeadStore((state) => state.createLead);
  const updateLead = useLeadStore((state) => state.updateLead);
  const clearForm = useLeadStore((state) => state.clearForm);
  const [values, setValues] = useState(emptyLead);
  const [ready, setReady] = useState(!editing);

  const visibleLead = lead && leadId && lead.leadId === leadId ? lead : null;
  const ownsLead =
    visibleLead !== null &&
    visibleLead.ownerId !== null &&
    visibleLead.ownerId === userId;
  const loadFailed = editing && detailStatus === "error";
  const notOwner = editing && ready && visibleLead !== null && !ownsLead;
  const showForm = !editing || (ready && ownsLead);

  useEffect(() => {
    clearForm();
  }, [clearForm, leadId]);

  useEffect(() => {
    if (!leadId) {
      setValues(emptyLead);
      setReady(true);
      return;
    }

    setReady(false);
    void loadLead(leadId);
  }, [leadId, loadLead]);

  useEffect(() => {
    if (!leadId || !visibleLead || ready) {
      return;
    }

    setValues(leadToFormValues(visibleLead));
    setReady(true);
  }, [leadId, ready, visibleLead]);

  function setText(field: keyof LeadFormValues, value: string): void {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (editing && leadId) {
      void updateLead(leadId, values).then((saved) => {
        if (saved) {
          navigate(`/leads/${leadId}`);
        }
      });
      return;
    }

    void createLead(values).then((savedId) => {
      if (savedId) {
        navigate(`/leads/${savedId}`);
      }
    });
  }

  return (
    <Stack spacing={3} sx={{ maxWidth: 720 }}>
      <Box>
        <Typography variant="h1">{editing ? "Edit lead" : "Add lead"}</Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
          Company name is required. Add a contact when you know the person.
        </Typography>
      </Box>
      {loadFailed && detailMessage ? (
        <Alert severity="error">{detailMessage}</Alert>
      ) : null}
      {notOwner ? <Alert severity="error">Lead not found.</Alert> : null}
      {showForm ? (
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
              <Typography variant="h6">Company</Typography>
              <Box sx={fieldGrid}>
                <TextField
                  label="Company name"
                  name="companyName"
                  value={values.companyName}
                  onChange={(event) => {
                    setText("companyName", event.target.value);
                  }}
                  helperText="The organisation this lead is for. Example: Northwind."
                  required
                  sx={{ gridColumn: "1 / -1" }}
                  fullWidth
                />
                <TextField
                  label="Website"
                  name="website"
                  value={values.website}
                  onChange={(event) => {
                    setText("website", event.target.value);
                  }}
                  helperText="Include http:// or https://. Example: https://northwind.example."
                  fullWidth
                />
                <TextField
                  label="Email"
                  name="companyEmail"
                  value={values.companyEmail}
                  onChange={(event) => {
                    setText("companyEmail", event.target.value);
                  }}
                  helperText="Company mailbox. Example: hello@northwind.example."
                  fullWidth
                />
                <TextField
                  label="Phone"
                  name="companyPhone"
                  value={values.companyPhone}
                  onChange={(event) => {
                    setText("companyPhone", event.target.value);
                  }}
                  helperText="Example: +1 555 0100."
                  fullWidth
                />
                <TextField
                  label="LinkedIn"
                  name="companyLinkedinUrl"
                  value={values.companyLinkedinUrl}
                  onChange={(event) => {
                    setText("companyLinkedinUrl", event.target.value);
                  }}
                  helperText="Include http:// or https://."
                  fullWidth
                />
                <TextField
                  label="Industry"
                  name="industry"
                  value={values.industry}
                  onChange={(event) => {
                    setText("industry", event.target.value);
                  }}
                  helperText="Example: Manufacturing."
                  fullWidth
                />
                <TextField
                  label="Location"
                  name="location"
                  value={values.location}
                  onChange={(event) => {
                    setText("location", event.target.value);
                  }}
                  helperText="Example: Penang."
                  fullWidth
                />
                <FormControl fullWidth>
                  <InputLabel id="lead-company-size">Company size</InputLabel>
                  <Select
                    labelId="lead-company-size"
                    id="companySizeBand"
                    name="companySizeBand"
                    label="Company size"
                    value={values.companySizeBand}
                    onChange={(event) => {
                      setText("companySizeBand", event.target.value);
                    }}
                  >
                    <MenuItem value="">Not set</MenuItem>
                    {companySizeBands.map((band) => (
                      <MenuItem key={band} value={band}>
                        {companySizeLabel(band)}
                      </MenuItem>
                    ))}
                  </Select>
                  <FormHelperText>Employee band. Example: 11-50.</FormHelperText>
                </FormControl>
                <TextField
                  label="Description"
                  name="description"
                  value={values.description}
                  onChange={(event) => {
                    setText("description", event.target.value);
                  }}
                  helperText="What the company does. Example: Makes packaging for food brands."
                  sx={{ gridColumn: "1 / -1" }}
                  multiline
                  minRows={2}
                  fullWidth
                />
              </Box>
            </Stack>

            <Stack spacing={2}>
              <Typography variant="h6">Contact</Typography>
              <Box sx={fieldGrid}>
                <TextField
                  label="Name"
                  name="contactName"
                  value={values.contactName}
                  onChange={(event) => {
                    setText("contactName", event.target.value);
                  }}
                  helperText="Required when any other contact field is filled. Example: Ada Lim."
                  sx={{ gridColumn: "1 / -1" }}
                  fullWidth
                />
                <TextField
                  label="Job title"
                  name="contactJobTitle"
                  value={values.contactJobTitle}
                  onChange={(event) => {
                    setText("contactJobTitle", event.target.value);
                  }}
                  helperText="Example: Engineer."
                  fullWidth
                />
                <TextField
                  label="Email"
                  name="contactEmail"
                  value={values.contactEmail}
                  onChange={(event) => {
                    setText("contactEmail", event.target.value);
                  }}
                  helperText="Example: ada@northwind.example."
                  fullWidth
                />
                <TextField
                  label="Phone"
                  name="contactPhone"
                  value={values.contactPhone}
                  onChange={(event) => {
                    setText("contactPhone", event.target.value);
                  }}
                  helperText="Example: +1 555 0101."
                  fullWidth
                />
                <TextField
                  label="LinkedIn"
                  name="contactLinkedinUrl"
                  value={values.contactLinkedinUrl}
                  onChange={(event) => {
                    setText("contactLinkedinUrl", event.target.value);
                  }}
                  helperText="Include http:// or https://."
                  fullWidth
                />
              </Box>
            </Stack>

            {formMessage ? (
              <Alert severity={formStatus === "ready" ? "success" : "error"}>
                {formMessage}
              </Alert>
            ) : null}
            <Stack direction="row" spacing={1}>
              <Button
                type="submit"
                variant="contained"
                disabled={formStatus === "loading"}
              >
                Save lead
              </Button>
              <Button component={Link} to={editing && leadId ? `/leads/${leadId}` : "/leads"}>
                Cancel
              </Button>
            </Stack>
          </Stack>
        </Paper>
      ) : null}
    </Stack>
  );
}
