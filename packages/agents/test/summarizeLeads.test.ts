import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { JsonModelRequest, JsonModelResponse } from "@ithaca/ai-model";
import type {
  IdealCustomerProfileInput,
  WorkflowLeadContext,
} from "@ithaca/shared";
import { summarizeLeads } from "../src/summarizeLeads.ts";
import type { SummarizeLeadQualification } from "../src/summarizeLeads.ts";

const icp: IdealCustomerProfileInput = { name: "Acme ICP" };

function modelResponse(text: string): JsonModelResponse {
  return {
    text,
    modelName: "test",
    promptTokens: 1,
    completionTokens: 1,
    estimatedCost: 0,
  };
}

function narrative(leadId: string, snapshot: string): string {
  return JSON.stringify({
    leadId,
    summaryText: "Summary.",
    snapshot,
    whyItFits: "Why it fits.",
    gap: "Gap.",
    nextStep: "Next step.",
  });
}

describe("summarizeLeads report facts", () => {
  it("TC-73 includes company, contact, source, and qualification when they are available", async () => {
    const lead: WorkflowLeadContext = {
      leadId: "northwind",
      companyName: "Northwind",
      website: "https://northwind.example",
      industry: "Software",
      location: "Kuala Lumpur",
      companySizeBand: "51-200",
      description: "Builds workflow tools.",
      contact: {
        fullName: "Ada Lim",
        jobTitle: "Buyer",
        email: "ada@northwind.example",
        phone: "+60312345678",
        linkedinUrl: "https://linkedin.com/in/ada",
      },
      sourceType: "identified",
      sources: [
        {
          sourceProvider: "exa",
          sourceTitle: "Company website",
          sourceUrl: "https://northwind.example/about",
        },
      ],
    };
    const qualification: SummarizeLeadQualification = {
      leadId: "northwind",
      score: 82,
      fitLabel: "Strong fit",
      evidence: ["Industry matches Software"],
      agentExplanation: "Industry scored 100.",
      userReason: "The buyer already asked for a proposal.",
    };

    const result = await summarizeLeads(
      icp,
      [lead],
      [qualification],
      (): Promise<JsonModelResponse> =>
        Promise.resolve(
          modelResponse(narrative(lead.leadId, "Northwind snapshot.")),
        ),
    );

    const report = result.summaries?.[0]?.structuredReport;
    assert.ok(report);
    assert.equal(
      report.company,
      [
        "Company: Northwind",
        "Website: https://northwind.example",
        "Industry: Software",
        "Location: Kuala Lumpur",
        "Company size band: 51-200",
        "Description: Builds workflow tools.",
      ].join("\n"),
    );
    assert.equal(
      report.contact,
      [
        "Contact: Ada Lim, Buyer",
        "Email: ada@northwind.example",
        "Phone: +60312345678",
        "LinkedIn: https://linkedin.com/in/ada",
      ].join("\n"),
    );
    assert.equal(
      report.source,
      [
        "Source: Identified",
        "Source title: Company website",
        "Source URL: https://northwind.example/about",
      ].join("\n"),
    );
    assert.equal(
      report.qualification,
      [
        "Suitability score: 82",
        "Fit: Strong fit",
        "Agent explanation: Industry scored 100.",
        "User reason: The buyer already asked for a proposal.",
        "Evidence: Industry matches Software",
      ].join("\n"),
    );
  });

  it("TC-74 announces missing facts and does not copy invented model text", async () => {
    const lead: WorkflowLeadContext = {
      leadId: "contoso",
      companyName: "Contoso",
      sourceType: "manual",
    };
    const qualification: SummarizeLeadQualification = {
      leadId: "contoso",
      score: 40,
      fitLabel: "Weak fit",
      evidence: [],
      agentExplanation: "",
      userReason: null,
    };
    let prompt = "";
    let system = "";

    const result = await summarizeLeads(
      icp,
      [lead],
      [qualification],
      (request: JsonModelRequest): Promise<JsonModelResponse> => {
        prompt = request.prompt;
        system = request.system ?? "";
        return Promise.resolve(
          modelResponse(
            narrative(
              lead.leadId,
              "Contoso's website is https://invented.example and the contact is Fake Person.",
            ),
          ),
        );
      },
    );

    const report = result.summaries?.[0]?.structuredReport;
    assert.ok(report);
    assert.equal(
      report.company,
      [
        "Company: Contoso",
        "Website: Missing.",
        "Industry: Missing.",
        "Location: Missing.",
        "Company size band: Missing.",
        "Description: Missing.",
      ].join("\n"),
    );
    assert.equal(
      report.contact,
      [
        "Contact: Missing.",
        "Email: Missing.",
        "Phone: Missing.",
        "LinkedIn: Missing.",
      ].join("\n"),
    );
    assert.equal(
      report.source,
      [
        "Source: Manual",
        "Source title: Missing.",
        "Source URL: Missing.",
      ].join("\n"),
    );
    assert.equal(
      report.qualification,
      [
        "Suitability score: 40",
        "Fit: Weak fit",
        "Agent explanation: Missing.",
        "User reason: Missing.",
        "Evidence: Missing.",
      ].join("\n"),
    );
    const facts = `${report.company}\n${report.contact}\n${report.source}\n${report.qualification}`;
    assert.equal(facts.includes("invented.example"), false);
    assert.equal(facts.includes("Fake Person"), false);
    assert.equal(prompt.includes("Website: Missing."), true);
    assert.equal(prompt.includes("Contact: Missing."), true);
    assert.equal(prompt.includes("Source title: Missing."), true);
    assert.equal(prompt.includes("Source URL: Missing."), true);
    assert.equal(prompt.includes("User reason: none"), true);
    assert.equal(system.includes("Do not invent"), true);
  });
});
