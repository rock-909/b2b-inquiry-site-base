import {
  readRequiredMessagePath,
  type MessageRecord,
} from "@/lib/i18n/read-message-path";

interface ContactHeaderCopy {
  title: string;
  description: string;
}

interface ContactPanelContactCopy {
  title: string;
  emailLabel: string;
  emailUnavailable: string;
  phoneLabel: string;
}

interface ContactPanelHoursCopy {
  title: string;
  weekdaysLabel: string;
  saturdayLabel: string;
  sundayLabel: string;
  closedLabel: string;
}

interface ContactPanelResponseCopy {
  title: string;
  responseTimeLabel: string;
  responseTimeValue: string;
  bestForLabel: string;
  bestForValue: string;
  prepareLabel: string;
  prepareValue: string;
}

export interface ContactCopyModel {
  header: ContactHeaderCopy;
  panel: {
    contact: ContactPanelContactCopy;
    hours: ContactPanelHoursCopy;
    response: ContactPanelResponseCopy;
  };
}

/**
 * Builds the structured copy model for the contact page from already-loaded
 * messages, reading only the `contact.*` namespace.
 */
export function getContactCopyFromMessages(
  messages: MessageRecord,
): ContactCopyModel {
  return {
    header: {
      title: readRequiredMessagePath(messages, ["contact", "title"]),
      description: readRequiredMessagePath(messages, [
        "contact",
        "description",
      ]),
    },
    panel: {
      contact: {
        title: readRequiredMessagePath(messages, [
          "contact",
          "panel",
          "contactTitle",
        ]),
        emailLabel: readRequiredMessagePath(messages, [
          "contact",
          "panel",
          "email",
        ]),
        emailUnavailable: readRequiredMessagePath(messages, [
          "contact",
          "panel",
          "emailUnavailable",
        ]),
        phoneLabel: readRequiredMessagePath(messages, [
          "contact",
          "panel",
          "phone",
        ]),
      },
      hours: {
        title: readRequiredMessagePath(messages, [
          "contact",
          "panel",
          "hoursTitle",
        ]),
        weekdaysLabel: readRequiredMessagePath(messages, [
          "contact",
          "panel",
          "weekdays",
        ]),
        saturdayLabel: readRequiredMessagePath(messages, [
          "contact",
          "panel",
          "saturday",
        ]),
        sundayLabel: readRequiredMessagePath(messages, [
          "contact",
          "panel",
          "sunday",
        ]),
        closedLabel: readRequiredMessagePath(messages, [
          "contact",
          "panel",
          "closed",
        ]),
      },
      response: {
        title: readRequiredMessagePath(messages, [
          "contact",
          "panel",
          "responseTitle",
        ]),
        responseTimeLabel: readRequiredMessagePath(messages, [
          "contact",
          "panel",
          "responseTimeLabel",
        ]),
        responseTimeValue: readRequiredMessagePath(messages, [
          "contact",
          "panel",
          "responseTimeValue",
        ]),
        bestForLabel: readRequiredMessagePath(messages, [
          "contact",
          "panel",
          "bestForLabel",
        ]),
        bestForValue: readRequiredMessagePath(messages, [
          "contact",
          "panel",
          "bestForValue",
        ]),
        prepareLabel: readRequiredMessagePath(messages, [
          "contact",
          "panel",
          "prepareLabel",
        ]),
        prepareValue: readRequiredMessagePath(messages, [
          "contact",
          "panel",
          "prepareValue",
        ]),
      },
    },
  };
}
