import { newUuid } from "@keepcv/core";
import {
  type ContactChannel,
  contactChannelSchema,
  PROBLEM_TYPES,
  type Profile,
  profileSchema,
} from "@keepcv/schema";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { problemOf, withApi } from "../api.harness.js";

const { send } = withApi();

const channelsSchema = z.object({ items: z.array(contactChannelSchema) });

async function profile(): Promise<Profile> {
  return profileSchema.parse(await (await send("GET", "/v1/profile")).json());
}

async function addChannel(sortKey: string, value: string): Promise<ContactChannel> {
  const response = await send("POST", "/v1/contact-channels", {
    id: newUuid(),
    kind: "email",
    label: null,
    value,
    isDefaultVisible: true,
    sortKey,
  });
  expect(response.status).toBe(201);
  return contactChannelSchema.parse(await response.json());
}

async function listChannels(query = ""): Promise<ContactChannel[]> {
  const response = await send("GET", `/v1/contact-channels${query}`);
  return channelsSchema.parse(await response.json()).items;
}

describe("the profile", () => {
  it("starts empty and takes a sparse patch", async () => {
    const before = await profile();
    expect(before.fullName).toBeNull();

    const response = await send("PATCH", "/v1/profile", {
      fullName: "Ada Lovelace",
      expectedUpdatedAt: before.updatedAt,
    });
    expect(response.status).toBe(200);

    const after = profileSchema.parse(await response.json());
    expect(after.fullName).toBe("Ada Lovelace");
    expect(after.headline).toBeNull();
  });

  it("clears a field on an explicit null and leaves an absent one alone", async () => {
    const named = await profile();
    await send("PATCH", "/v1/profile", {
      pronouns: "she/her",
      headline: "Mathematician",
      expectedUpdatedAt: named.updatedAt,
    });

    const withPronouns = await profile();
    const cleared = await send("PATCH", "/v1/profile", {
      pronouns: null,
      expectedUpdatedAt: withPronouns.updatedAt,
    });

    const after = profileSchema.parse(await cleared.json());
    expect(after.pronouns).toBeNull();
    expect(after.headline).toBe("Mathematician");
  });

  // The whole point of the 409: the user sees both sides rather than one of
  // them being dropped by whichever write landed second.
  it("answers a stale write with the state the server actually holds", async () => {
    const before = await profile();
    await send("PATCH", "/v1/profile", { fullName: "first", expectedUpdatedAt: before.updatedAt });

    const response = await send("PATCH", "/v1/profile", {
      fullName: "second",
      expectedUpdatedAt: before.updatedAt,
    });
    expect(response.status).toBe(409);

    const problem = await problemOf(response);
    expect(problem.type).toBe(PROBLEM_TYPES.staleWrite);
    expect(profileSchema.parse(problem.current).fullName).toBe("first");
  });
});

describe("contact channels", () => {
  it("creates, reads and lists in print order", async () => {
    const second = await addChannel("a1", "ada@example.com");
    const first = await addChannel("a0", "+44 20 7946 0000");

    expect((await listChannels()).map((channel) => channel.id)).toEqual([first.id, second.id]);

    const read = await send("GET", `/v1/contact-channels/${first.id}`);
    expect(contactChannelSchema.parse(await read.json())).toEqual(first);
  });

  it("updates one and refuses a patch based on a stale read", async () => {
    const created = await addChannel("a0", "ada@example.com");

    const updated = await send("PATCH", `/v1/contact-channels/${created.id}`, {
      label: "Work",
      expectedUpdatedAt: created.updatedAt,
    });
    expect(contactChannelSchema.parse(await updated.json()).label).toBe("Work");

    const stale = await send("PATCH", `/v1/contact-channels/${created.id}`, {
      label: "Home",
      expectedUpdatedAt: created.updatedAt,
    });
    expect(stale.status).toBe(409);
    expect(contactChannelSchema.parse((await problemOf(stale)).current).label).toBe("Work");
  });

  // Archived is a filter, never a hiding place: the row stays readable by id and
  // a toggle brings it back into the list.
  it("archives, keeps the row reachable, and restores", async () => {
    const created = await addChannel("a0", "ada@example.com");

    const archived = await send("DELETE", `/v1/contact-channels/${created.id}`, {
      expectedUpdatedAt: created.updatedAt,
    });
    expect(contactChannelSchema.parse(await archived.json()).archivedAt).not.toBeNull();

    expect(await listChannels()).toEqual([]);
    expect(await listChannels("?archived=include")).toHaveLength(1);
    expect((await send("GET", `/v1/contact-channels/${created.id}`)).status).toBe(200);

    const current = (await listChannels("?archived=include"))[0];
    const restored = await send("POST", `/v1/contact-channels/${created.id}/restore`, {
      expectedUpdatedAt: current?.updatedAt,
    });
    expect(contactChannelSchema.parse(await restored.json()).archivedAt).toBeNull();
    expect(await listChannels()).toHaveLength(1);
  });

  it("tells an unknown id apart from a stale write", async () => {
    const created = await addChannel("a0", "ada@example.com");

    const missing = await send("PATCH", `/v1/contact-channels/${newUuid()}`, {
      label: "Work",
      expectedUpdatedAt: created.updatedAt,
    });
    expect((await problemOf(missing)).status).toBe(404);
  });

  // Two clients dragging at once collide on a sort key. That is a caller
  // mistake and has to answer as one, not as a server fault.
  it("answers a taken sort key with the constraint that refused it", async () => {
    await addChannel("a0", "ada@example.com");

    const clash = await send("POST", "/v1/contact-channels", {
      id: newUuid(),
      kind: "phone",
      label: null,
      value: "+44 20 7946 0000",
      isDefaultVisible: true,
      sortKey: "a0",
    });

    const problem = await problemOf(clash);
    expect(problem.status).toBe(409);
    expect(problem.type).toBe(PROBLEM_TYPES.constraintViolated);
    expect(problem.constraint).toBe("contact_channel_sort_key_unique");
  });
});
