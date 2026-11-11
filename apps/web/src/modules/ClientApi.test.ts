/*
Copyright 2025 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, vi } from "vitest";
import { mkRoom, stubClient } from "test-utils";

import { ClientApi } from "./ClientApi";
import { ClientSession } from "./ClientSession";
import { Room } from "./models/Room";
import { MatrixDispatcher } from "../dispatcher/dispatcher";
import { Action } from "../dispatcher/actions";

describe("ClientApi", () => {
    const makeClient = (dispatcher = new MatrixDispatcher()): ClientApi =>
        new ClientApi(dispatcher, new ClientSession(dispatcher));

    it("should return module room from getRoom()", () => {
        stubClient();
        const client = makeClient();
        const moduleRoom = client.getRoom("!foo:matrix.org");
        expect(moduleRoom).toBeInstanceOf(Room);
        expect(moduleRoom?.id).toStrictEqual("!foo:matrix.org");
    });

    it("invalidates room watchables on logout", () => {
        const sdkClient = stubClient();
        const sdkRoom = mkRoom(sdkClient, "!foo:matrix.org");
        sdkRoom.name = "Previous session";
        vi.mocked(sdkClient.getRoom).mockReturnValue(sdkRoom);
        const dispatcher = new MatrixDispatcher();
        const client = makeClient(dispatcher);
        const watchable = client.getRoom(sdkRoom.roomId)!.name;
        const listener = vi.fn();
        watchable.watch(listener);
        const offSpy = vi.spyOn(sdkRoom, "off");

        dispatcher.dispatch({ action: Action.OnLoggedOut }, true);

        expect(watchable.value).toBe("");
        expect(listener).toHaveBeenCalledWith("");
        expect(offSpy).toHaveBeenCalledWith(expect.any(String), expect.any(Function));
        expect(client.getRoom(sdkRoom.roomId)).toBeNull();
    });

    it("invalidates room watchables when the Matrix client is replaced", () => {
        const oldClient = stubClient();
        const oldRoom = mkRoom(oldClient, "!foo:matrix.org");
        oldRoom.name = "Previous session";
        vi.mocked(oldClient.getRoom).mockReturnValue(oldRoom);
        const client = makeClient();
        const moduleRoom = client.getRoom(oldRoom.roomId)!;
        expect(client.getRoom(oldRoom.roomId)).toBe(moduleRoom);
        const nameListener = vi.fn();
        moduleRoom.name.watch(nameListener);
        moduleRoom.isEncrypted.watch(vi.fn());

        const newClient = stubClient();
        vi.mocked(newClient.getRoom).mockReturnValue(mkRoom(newClient, oldRoom.roomId));
        const replacementRoom = client.getRoom(oldRoom.roomId);

        expect(replacementRoom).not.toBe(moduleRoom);
        expect(client.getRoom(oldRoom.roomId)).toBe(replacementRoom);
        expect(nameListener).toHaveBeenCalledWith("");
        expect(moduleRoom.name.value).toBe("");
        expect(moduleRoom.isEncrypted.value).toBeUndefined();
    });

    it("invalidates room watchables when a replacement client starts without logout", () => {
        const oldClient = stubClient();
        const oldRoom = mkRoom(oldClient, "!foo:matrix.org");
        vi.mocked(oldClient.getRoom).mockReturnValue(oldRoom);
        const dispatcher = new MatrixDispatcher();
        const client = makeClient(dispatcher);
        const nameWatchable = client.getRoom(oldRoom.roomId)!.name;
        const listener = vi.fn();
        nameWatchable.watch(listener);

        stubClient();
        dispatcher.dispatch({ action: Action.ClientStarted }, true);

        expect(nameWatchable.value).toBe("");
        expect(listener).toHaveBeenCalledWith("");
    });

    describe("waitForClientStarted", () => {
        it("should resolve once the client has started", async () => {
            const dispatcher = new MatrixDispatcher();
            const client = makeClient(dispatcher);
            const onStarted = vi.fn();
            void client.waitForClientStarted().then(onStarted);

            await Promise.resolve();
            expect(onStarted).not.toHaveBeenCalled();

            dispatcher.dispatch({ action: Action.ClientStarted }, true);
            await vi.waitFor(() => expect(onStarted).toHaveBeenCalled());
        });

        it("should resolve immediately if the client has already started", async () => {
            const dispatcher = new MatrixDispatcher();
            const client = makeClient(dispatcher);
            dispatcher.dispatch({ action: Action.ClientStarted }, true);

            await expect(client.waitForClientStarted()).resolves.toBeUndefined();
        });

        it("should wait for the next start after logout", async () => {
            const dispatcher = new MatrixDispatcher();
            const client = makeClient(dispatcher);
            dispatcher.dispatch({ action: Action.ClientStarted }, true);
            dispatcher.dispatch({ action: Action.OnLoggedOut }, true);

            const onStarted = vi.fn();
            void client.waitForClientStarted().then(onStarted);
            await Promise.resolve();
            expect(onStarted).not.toHaveBeenCalled();

            dispatcher.dispatch({ action: Action.ClientStarted }, true);
            await vi.waitFor(() => expect(onStarted).toHaveBeenCalled());
        });

        it("should wait for the next start after soft logout", async () => {
            const dispatcher = new MatrixDispatcher();
            const client = makeClient(dispatcher);
            dispatcher.dispatch({ action: Action.ClientStarted }, true);
            dispatcher.dispatch({ action: Action.ClientNotViable }, true);

            const onStarted = vi.fn();
            void client.waitForClientStarted().then(onStarted);
            await Promise.resolve();
            expect(onStarted).not.toHaveBeenCalled();

            dispatcher.dispatch({ action: Action.ClientStarted }, true);
            await vi.waitFor(() => expect(onStarted).toHaveBeenCalled());
        });
    });
});
