/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import {
    ClientEvent,
    type MatrixClient,
    type ReceivedToDeviceMessage,
    type SendToDeviceContentMap,
} from "matrix-js-sdk/src/matrix";
import { type ToDeviceApi as IToDeviceApi, type ToDeviceRequest } from "@element-hq/element-web-module-api";

import { MatrixClientPeg } from "../MatrixClientPeg";

const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_TIMEOUT_MS = 60_000;
const MAX_EVENT_TYPE_LENGTH = 255;

type MatrixSessionIdentity = { readonly userId: string; readonly deviceId: string };

/** Sends correlated to-device requests through the current Matrix client. */
export class ToDeviceApi implements IToDeviceApi {
    /** Send a request and resolve with the matching response content. */
    public request = async (request: ToDeviceRequest): Promise<unknown> => {
        const timeoutMs = this.validateRequest(request);
        const client = MatrixClientPeg.get();
        const session = client && this.getSessionIdentity(client);
        if (!client || !session) {
            throw new Error("No active Matrix session");
        }

        const requestId = globalThis.crypto.randomUUID();
        const content = {
            ...request.content,
            request_id: requestId,
            requesting_device_id: session.deviceId,
        };
        const contentMap: SendToDeviceContentMap = new Map([[request.recipientUserId, new Map([["*", content]])]]);

        return new Promise((resolve, reject) => {
            let settled = false;
            const cleanup = (): void => {
                clearTimeout(timer);
                client.off(ClientEvent.ReceivedToDeviceMessage, onResponse);
            };
            const fail = (error: Error): void => {
                if (settled) return;
                settled = true;
                cleanup();
                reject(error);
            };
            const onResponse = (payload: ReceivedToDeviceMessage): void => {
                if (settled) return;
                if (!this.isCurrentSession(client, session)) {
                    fail(new Error("Matrix session ended"));
                    return;
                }

                const message = payload?.message;
                if (
                    !message ||
                    message.type !== request.responseType ||
                    message.sender !== request.recipientUserId ||
                    !this.isRecord(message.content) ||
                    message.content.request_id !== requestId
                ) {
                    return;
                }

                settled = true;
                cleanup();
                resolve(message.content);
            };
            const timer = setTimeout(() => {
                fail(
                    new Error(
                        this.isCurrentSession(client, session) ? "To-device request timed out" : "Matrix session ended",
                    ),
                );
            }, timeoutMs);

            client.on(ClientEvent.ReceivedToDeviceMessage, onResponse);
            try {
                void client.sendToDevice(request.requestType, contentMap, requestId).catch(() => {
                    fail(new Error("Failed to send to-device request"));
                });
            } catch {
                fail(new Error("Failed to send to-device request"));
            }
        });
    };

    private validateRequest(request: ToDeviceRequest): number {
        if (!request || typeof request !== "object") {
            throw new Error("Invalid to-device request");
        }
        if (typeof request.recipientUserId !== "string" || !/^@[^:\s]+:[^\s]+$/u.test(request.recipientUserId)) {
            throw new Error("Invalid to-device recipient");
        }
        if (!this.isValidEventType(request.requestType) || !this.isValidEventType(request.responseType)) {
            throw new Error("Invalid to-device event type");
        }
        if (!this.isPlainRecord(request.content)) {
            throw new Error("Invalid to-device content");
        }

        const timeoutMs = request.timeoutMs === undefined ? DEFAULT_TIMEOUT_MS : request.timeoutMs;
        if (!Number.isInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > MAX_TIMEOUT_MS) {
            throw new Error("Invalid to-device timeout");
        }
        return timeoutMs;
    }

    private isValidEventType(eventType: unknown): eventType is string {
        return (
            typeof eventType === "string" &&
            eventType.trim() === eventType &&
            eventType.length > 0 &&
            eventType.length <= MAX_EVENT_TYPE_LENGTH
        );
    }

    private isPlainRecord(value: unknown): value is Record<string, unknown> {
        if (!this.isRecord(value)) return false;
        const prototype = Object.getPrototypeOf(value);
        return prototype === Object.prototype || prototype === null;
    }

    private isRecord(value: unknown): value is Record<string, unknown> {
        return typeof value === "object" && value !== null && !Array.isArray(value);
    }

    private getSessionIdentity(client: MatrixClient): MatrixSessionIdentity | null {
        const userId = client.getUserId();
        const deviceId = client.getDeviceId();
        if (!userId || !deviceId) return null;
        return { userId, deviceId };
    }

    private isCurrentSession(client: MatrixClient, session: MatrixSessionIdentity): boolean {
        if (MatrixClientPeg.get() !== client) return false;
        const current = this.getSessionIdentity(client);
        return current?.userId === session.userId && current.deviceId === session.deviceId;
    }
}
