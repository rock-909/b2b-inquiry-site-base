import { describe, expect, it } from "vitest";
import { getContactCopyFromMessages } from "@/lib/contact/getContactCopy";
import type { MessageRecord } from "@/lib/i18n/read-message-path";

function createCompleteContactMessages(): MessageRecord {
  return {
    contact: {
      title: "Contact",
      description:
        "Fastest route: the RFQ form asks the questions we would ask anyway.",
      panel: {
        contactTitle: "Email & RFQ",
        email: "Email",
        emailUnavailable: "Use the RFQ form if email is unavailable.",
        phone: "Phone",
        hoursTitle: "Time zone",
        weekdays: "China",
        saturday: "Follow-up",
        sunday: "US/EU hours",
        closed: "Closed",
        responseTitle: "What happens next",
        responseTimeLabel: "Reply within",
        responseTimeValue: "12 hours",
        bestForLabel: "Quote when",
        bestForValue: "Details are sufficient",
        prepareLabel: "Fastest route",
        prepareValue:
          "Use the RFQ form; it asks the questions we'd ask anyway.",
      },
    },
  };
}

describe("getContactCopyFromMessages", () => {
  it("reads contact copy from the top-level contact namespace", () => {
    const copy = getContactCopyFromMessages(createCompleteContactMessages());

    expect(copy.header.title).toBe("Contact");
    expect(copy.header.description).toBe(
      "Fastest route: the RFQ form asks the questions we would ask anyway.",
    );
    expect(copy.panel.contact.title).toBe("Email & RFQ");
    expect(copy.panel.response.prepareValue).toBe(
      "Use the RFQ form; it asks the questions we'd ask anyway.",
    );
  });

  it("throws the exact path when contact title is missing", () => {
    const messages = createCompleteContactMessages();
    delete (messages.contact as Record<string, unknown>).title;

    expect(() => getContactCopyFromMessages(messages)).toThrow(
      "Missing required message: contact.title",
    );
  });

  it("does not read legacy underConstruction contact copy", () => {
    expect(() =>
      getContactCopyFromMessages({
        underConstruction: { contact: createCompleteContactMessages().contact },
      }),
    ).toThrow("Missing required message: contact.title");
  });

  it.each([
    {
      missingPath: ["panel", "responseTimeValue"],
      expectedError:
        "Missing required message: contact.panel.responseTimeValue",
    },
  ])(
    "throws the exact nested path when $expectedError",
    ({ missingPath, expectedError }) => {
      const messages = createCompleteContactMessages();
      let current = messages.contact as Record<string, unknown>;
      for (let index = 0; index < missingPath.length - 1; index += 1) {
        current = current[missingPath[index]!] as Record<string, unknown>;
      }
      delete current[missingPath[missingPath.length - 1]!];

      expect(() => getContactCopyFromMessages(messages)).toThrow(expectedError);
    },
  );
});
