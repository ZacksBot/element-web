/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from "vitest";
import { ClientEvent, type MatrixClient, type ReceivedToDeviceMessage } from "matrix-js-sdk/src/matrix";
import { createTestClient, stubClient } from "test-utils";

import { MatrixClientPeg } from "../MatrixClientPeg";
import { ToDeviceApi } from "./ToDeviceApi";

const REQUEST_TYPE = "org.example.request";
const RESPONSE_TYPE = "org.example.response";
const RECIPIENT_USER_ID = "@bot:example.org";

function request(
    overrides: Partial<Parameters<ToDeviceApi["request"]>[0]> = {},
): Parameters<ToDeviceApi["request"]>[0] {
    return {
        recipientUserId: RECIPIENT_USER_ID,
        requestType: REQUEST_TYPE,
        responseType: RESPONSE_TYPE,
        content: { action: "probe" },
        ...overrides,
    };
}

function emitResponse(client: MatrixClient, type: string, sender: string, content: unknown): void {
    client.emit(ClientEvent.ReceivedToDeviceMessage, {
        message: { type, sender, content },
        encryptionInfo: null,
    } as ReceivedToDeviceMessage);
}

describe("ToDeviceApi", () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it("sends a correlated request to all recipient devices without mutating the caller content", async () => {
        const client = stubClient();
        const off = vi.spyOn(client, "off");
        const api = new ToDeviceApi();
        const content = { action: "probe", request_id: "caller-id", requesting_device_id: "caller-device" };

        const response = api.request(request({ content }));
        const [eventType, contentMap, transactionId] = vi.mocked(client.sendToDevice).mock.calls[0]!;
        const sentContent = contentMap.get(RECIPIENT_USER_ID)?.get("*");

        expect(eventType).toBe(REQUEST_TYPE);
        expect(sentContent).toMatchObject({
            action: "probe",
            request_id: transactionId,
            requesting_device_id: "ABCDEFGHI",
        });
        expect(content).toEqual({ action: "probe", request_id: "caller-id", requesting_device_id: "caller-device" });
        expect(client.getAccessToken).not.toHaveBeenCalled();

        emitResponse(client, RESPONSE_TYPE, RECIPIENT_USER_ID, { request_id: transactionId });
        await expect(response).resolves.toMatchObject({ request_id: transactionId });
        expect(off).toHaveBeenCalledWith(ClientEvent.ReceivedToDeviceMessage, expect.any(Function));
    });

    it("registers correlation before sendToDevice can emit an immediate response", async () => {
        const client = stubClient();
        const api = new ToDeviceApi();
        const responseContent = { request_id: "replaced", accepted: true };
        vi.spyOn(client, "sendToDevice").mockImplementation((_type, contentMap, transactionId) => {
            const sentContent = contentMap.get(RECIPIENT_USER_ID)?.get("*");
            responseContent.request_id = transactionId!;
            emitResponse(client, RESPONSE_TYPE, RECIPIENT_USER_ID, { ...sentContent, accepted: true });
            return Promise.resolve({});
        });

        await expect(api.request(request())).resolves.toMatchObject({
            action: "probe",
            requesting_device_id: "ABCDEFGHI",
            ...responseContent,
        });
    });

    it("resolves only for the matching sender, response type, and request ID", async () => {
        const client = stubClient();
        const api = new ToDeviceApi();
        const onResolved = vi.fn();
        const response = api.request(request());
        void response.then(onResolved);
        const requestId = vi.mocked(client.sendToDevice).mock.calls[0]![2]!;

        emitResponse(client, RESPONSE_TYPE, "@other:example.org", { request_id: requestId });
        emitResponse(client, REQUEST_TYPE, RECIPIENT_USER_ID, { request_id: requestId });
        emitResponse(client, RESPONSE_TYPE, RECIPIENT_USER_ID, { request_id: "wrong-id" });
        emitResponse(client, RESPONSE_TYPE, RECIPIENT_USER_ID, []);
        await Promise.resolve();
        expect(onResolved).not.toHaveBeenCalled();

        const content = { request_id: requestId, arbitrary: { untrusted: true } };
        emitResponse(client, RESPONSE_TYPE, RECIPIENT_USER_ID, content);
        emitResponse(client, RESPONSE_TYPE, RECIPIENT_USER_ID, { request_id: requestId, duplicate: true });
        await expect(response).resolves.toBe(content);
    });

    it("keeps simultaneous requests with the same event types independent", async () => {
        const client = stubClient();
        const api = new ToDeviceApi();
        const first = api.request(request({ content: { index: 1 } }));
        const second = api.request(request({ content: { index: 2 } }));
        const firstId = vi.mocked(client.sendToDevice).mock.calls[0]![2]!;
        const secondId = vi.mocked(client.sendToDevice).mock.calls[1]![2]!;

        emitResponse(client, RESPONSE_TYPE, RECIPIENT_USER_ID, { request_id: secondId, index: 2 });
        emitResponse(client, RESPONSE_TYPE, RECIPIENT_USER_ID, { request_id: firstId, index: 1 });

        await expect(first).resolves.toMatchObject({ index: 1 });
        await expect(second).resolves.toMatchObject({ index: 2 });
    });

    it("rejects and cleans up a request after timeout", async () => {
        vi.useFakeTimers();
        const client = stubClient();
        const api = new ToDeviceApi();
        const response = api.request(request({ timeoutMs: 100 }));
        const rejection = response.catch((error: unknown) => error);

        await vi.advanceTimersByTimeAsync(100);
        await expect(rejection).resolves.toMatchObject({ message: "To-device request timed out" });
        emitResponse(client, RESPONSE_TYPE, RECIPIENT_USER_ID, {
            request_id: vi.mocked(client.sendToDevice).mock.calls[0]![2],
        });
        expect(vi.getTimerCount()).toBe(0);
    });

    it("rejects at timeout if the session ended without a response", async () => {
        vi.useFakeTimers();
        const client = stubClient();
        const api = new ToDeviceApi();
        const off = vi.spyOn(client, "off");
        const response = api.request(request({ timeoutMs: 100 }));
        const rejection = response.catch((error: unknown) => error);
        vi.spyOn(MatrixClientPeg, "get").mockReturnValue(null);

        await vi.advanceTimersByTimeAsync(100);

        await expect(rejection).resolves.toMatchObject({ message: "Matrix session ended" });
        expect(off).toHaveBeenCalledWith(ClientEvent.ReceivedToDeviceMessage, expect.any(Function));
        expect(vi.getTimerCount()).toBe(0);
    });

    it("rejects and cleans up when sending fails", async () => {
        vi.useFakeTimers();
        const client = stubClient();
        const api = new ToDeviceApi();
        const off = vi.spyOn(client, "off");
        vi.mocked(client.sendToDevice).mockRejectedValue(new Error("sensitive upstream details"));

        await expect(api.request(request())).rejects.toThrow("Failed to send to-device request");
        expect(off).toHaveBeenCalledWith(ClientEvent.ReceivedToDeviceMessage, expect.any(Function));
        expect(vi.getTimerCount()).toBe(0);
    });

    it.each(["user", "device"] as const)("rejects pending requests when the %s changes", async (changedIdentity) => {
        const client = stubClient();
        const api = new ToDeviceApi();
        const response = api.request(request());
        const rejection = response.catch((error: unknown) => error);
        const requestId = vi.mocked(client.sendToDevice).mock.calls[0]![2]!;

        if (changedIdentity === "user") {
            vi.mocked(client.getUserId).mockReturnValue("@other:example.org");
        } else {
            vi.mocked(client.getDeviceId).mockReturnValue("OTHER_DEVICE");
        }
        emitResponse(client, RESPONSE_TYPE, RECIPIENT_USER_ID, { request_id: requestId });

        await expect(rejection).resolves.toMatchObject({ message: "Matrix session ended" });
    });

    it("rejects old work when the current client changes and sends new requests through the replacement", async () => {
        const oldClient = stubClient();
        const api = new ToDeviceApi();
        const off = vi.spyOn(oldClient, "off");
        const response = api.request(request());
        const rejection = response.catch((error: unknown) => error);

        const newClient = createTestClient();
        const on = vi.spyOn(newClient, "on");
        vi.spyOn(MatrixClientPeg, "get").mockReturnValue(newClient);

        const oldRequestId = vi.mocked(oldClient.sendToDevice).mock.calls[0]![2]!;
        emitResponse(oldClient, RESPONSE_TYPE, RECIPIENT_USER_ID, { request_id: oldRequestId });
        await expect(rejection).resolves.toMatchObject({ message: "Matrix session ended" });
        expect(off).toHaveBeenCalledWith(ClientEvent.ReceivedToDeviceMessage, expect.any(Function));

        const newResponse = api.request(request());
        expect(on).toHaveBeenCalledWith(ClientEvent.ReceivedToDeviceMessage, expect.any(Function));
        const newRequestId = vi.mocked(newClient.sendToDevice).mock.calls[0]![2]!;
        emitResponse(oldClient, RESPONSE_TYPE, RECIPIENT_USER_ID, { request_id: newRequestId, wrongClient: true });
        emitResponse(newClient, RESPONSE_TYPE, RECIPIENT_USER_ID, { request_id: newRequestId, correctClient: true });
        await expect(newResponse).resolves.toMatchObject({ correctClient: true });
    });

    it("validates request inputs before sending", async () => {
        const client = stubClient();
        const api = new ToDeviceApi();
        const invalidRequests = [
            request({ recipientUserId: "not-a-user-id" }),
            request({ requestType: " " }),
            request({ responseType: "x".repeat(256) }),
            request({ content: [] as unknown as Record<string, unknown> }),
            request({ content: new Date() as unknown as Record<string, unknown> }),
            request({ timeoutMs: Number.NaN }),
            request({ timeoutMs: 1.5 }),
            request({ timeoutMs: 0 }),
            request({ timeoutMs: 60_001 }),
        ];

        for (const invalidRequest of invalidRequests) {
            await expect(api.request(invalidRequest)).rejects.toThrow();
        }
        expect(client.sendToDevice).not.toHaveBeenCalled();
    });

    it("rejects requests when no active session is available", async () => {
        stubClient();
        vi.spyOn(MatrixClientPeg, "get").mockReturnValue(null);
        const api = new ToDeviceApi();

        await expect(api.request(request())).rejects.toThrow("No active Matrix session");
    });
});
