import { describe, expect, it } from "vitest";
import {
  CONTACT_CHANNEL_KINDS,
  contactChannelInputSchema,
  contactChannelSchema,
} from "./contact-channel.js";

const channel = {
  id: "019891a4-6ac5-7000-8000-000000000002",
  createdAt: "2026-08-08T12:00:00.000Z",
  updatedAt: "2026-08-08T12:00:00.000Z",
  archivedAt: null,
  kind: "email",
  label: "Work",
  value: "ada@example.com",
  isDefaultVisible: true,
  sortKey: "a0",
};

describe("contactChannelSchema", () => {
  it("accepts every declared kind", () => {
    for (const kind of CONTACT_CHANNEL_KINDS) {
      expect(contactChannelSchema.safeParse({ ...channel, kind }).success).toBe(true);
    }
  });

  it("rejects an undeclared kind", () => {
    expect(contactChannelSchema.safeParse({ ...channel, kind: "mastodon" }).success).toBe(false);
  });

  it("rejects an empty value", () => {
    // A channel with no value is not half-entered data, it is a blank row -
    // the label is what makes it identifiable, and the value is the channel.
    expect(contactChannelSchema.safeParse({ ...channel, value: "" }).success).toBe(false);
  });
});

describe("contactChannelInputSchema", () => {
  it("takes the id from the caller and nothing the store owns", () => {
    expect(Object.keys(contactChannelInputSchema.shape).sort()).toEqual([
      "id",
      "isDefaultVisible",
      "kind",
      "label",
      "sortKey",
      "value",
    ]);
  });
});
