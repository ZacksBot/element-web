/*
Copyright 2025 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, vi } from "vitest";
import { EventType, RoomEvent, RoomStateEvent } from "matrix-js-sdk/src/matrix";
import { mkEvent, mkRoom, stubClient } from "test-utils";

import { Room } from "./Room";
import { ClientSession } from "../ClientSession";
import { MatrixDispatcher } from "../../dispatcher/dispatcher";

const makeRoom = (sdkRoom: ReturnType<typeof mkRoom>): Room =>
    new Room(new ClientSession(new MatrixDispatcher()), sdkRoom);

describe("Room", () => {
    it("invalidates all active watchables when the session ends", () => {
        const sdkRoom = mkRoom(stubClient(), "!foo:m.org");
        sdkRoom.name = "Old session room";
        const session = new ClientSession(new MatrixDispatcher());
        const room = new Room(session, sdkRoom);
        const onName = vi.fn();
        const onEncryption = vi.fn();
        const offSpy = vi.spyOn(sdkRoom, "off");

        room.name.watch(onName);
        room.isEncrypted.watch(onEncryption);

        session.updateClient(null);

        expect(room.name.value).toBe("");
        expect(room.isEncrypted.value).toBeUndefined();
        expect(onName).toHaveBeenCalledWith("");
        expect(offSpy).toHaveBeenCalledWith(RoomEvent.Name, expect.any(Function));
        expect(offSpy).toHaveBeenCalledWith(RoomStateEvent.Events, expect.any(Function));

        room.name.unwatch(onName);
        room.isEncrypted.unwatch(onEncryption);
    });

    it("does not subscribe or publish a pending encryption check after invalidation", async () => {
        const cli = stubClient();
        const pending = Promise.withResolvers<boolean>();
        vi.mocked(cli.getCrypto).mockReturnValue({
            isEncryptionEnabledInRoom: () => pending.promise,
        } as unknown as NonNullable<ReturnType<typeof cli.getCrypto>>);
        const sdkRoom = mkRoom(cli, "!foo:m.org");
        const session = new ClientSession(new MatrixDispatcher());
        const room = new Room(session, sdkRoom);
        session.updateClient(null);
        const onSpy = vi.spyOn(sdkRoom, "on");

        room.name.watch(vi.fn());
        room.isEncrypted.watch(vi.fn());
        pending.resolve(true);
        await Promise.resolve();

        expect(onSpy).not.toHaveBeenCalled();
        expect(room.isEncrypted.value).toBeUndefined();
    });

    it("should return id from sdk room", () => {
        const cli = stubClient();
        const sdkRoom = mkRoom(cli, "!foo:m.org");
        const room = makeRoom(sdkRoom);
        expect(room.id).toStrictEqual("!foo:m.org");
    });

    it("should return last timestamp from sdk room", () => {
        const cli = stubClient();
        const sdkRoom = mkRoom(cli, "!foo:m.org");
        const room = makeRoom(sdkRoom);
        expect(room.getLastActiveTimestamp()).toStrictEqual(sdkRoom.getLastActiveTimestamp());
    });

    describe("watchableName", () => {
        it("should return name from sdkRoom", () => {
            const cli = stubClient();
            const sdkRoom = mkRoom(cli, "!foo:m.org");
            sdkRoom.name = "Foo Name";
            const room = makeRoom(sdkRoom);
            expect(room.name.value).toStrictEqual("Foo Name");
        });

        it("should add/remove event listener on sdk room", () => {
            const cli = stubClient();
            const sdkRoom = mkRoom(cli, "!foo:m.org");
            sdkRoom.name = "Foo Name";

            const room = makeRoom(sdkRoom);
            const fn = vi.fn();
            const onSpy = vi.spyOn(sdkRoom, "on");
            const offSpy = vi.spyOn(sdkRoom, "off");

            room.name.watch(fn);
            expect(onSpy).toHaveBeenCalledTimes(1);

            room.name.unwatch(fn);
            expect(offSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe("watchableIsEncrypted", () => {
        function setup(): {
            sdkRoom: ReturnType<typeof mkRoom>;
            room: Room;
            isEncryptionEnabledInRoom: ReturnType<typeof vi.fn>;
        } {
            const cli = stubClient();
            const isEncryptionEnabledInRoom = vi.fn().mockResolvedValue(true);
            vi.mocked(cli.getCrypto).mockReturnValue({ isEncryptionEnabledInRoom } as any);
            const sdkRoom = mkRoom(cli, "!foo:m.org");
            return { sdkRoom, room: makeRoom(sdkRoom), isEncryptionEnabledInRoom };
        }

        it("should be undefined until the encryption status is determined", async () => {
            const { room, isEncryptionEnabledInRoom } = setup();

            let resolveFn: (value: boolean) => void;
            const encryptionEnabledPromise = new Promise<boolean>((r) => {
                resolveFn = r;
            });
            isEncryptionEnabledInRoom.mockReturnValue(encryptionEnabledPromise);

            expect(room.isEncrypted.value).toBe(undefined);
            resolveFn!(true);
            await vi.waitFor(() => expect(room.isEncrypted.value).toBe(true));
        });

        it("should use the crypto api once watched", async () => {
            const { room, isEncryptionEnabledInRoom } = setup();
            const fn = vi.fn();
            room.isEncrypted.watch(fn);

            await vi.waitFor(() => expect(fn).toHaveBeenCalledWith(true));
            expect(isEncryptionEnabledInRoom).toHaveBeenCalledWith("!foo:m.org");
            expect(room.isEncrypted.value).toBe(true);
        });

        it("should be false if there is no crypto api", async () => {
            const { sdkRoom, room } = setup();
            vi.mocked(sdkRoom.client.getCrypto).mockReturnValue(undefined);
            room.isEncrypted.watch(vi.fn());
            await Promise.resolve();
            expect(room.isEncrypted.value).toBe(false);
        });

        it("should recheck when the encryption state event changes", async () => {
            const { sdkRoom, room, isEncryptionEnabledInRoom } = setup();
            await vi.waitFor(() => expect(isEncryptionEnabledInRoom).toHaveBeenCalledTimes(1));
            isEncryptionEnabledInRoom.mockResolvedValue(false);
            const fn = vi.fn();
            room.isEncrypted.watch(fn);
            await vi.waitFor(() => expect(isEncryptionEnabledInRoom).toHaveBeenCalledTimes(2));

            // Other state events are ignored
            sdkRoom.emit(
                RoomStateEvent.Events,
                mkEvent({ event: true, type: EventType.RoomTopic, room: "!foo:m.org", user: "@a:m.org", content: {} }),
                sdkRoom.currentState,
                null,
            );
            expect(isEncryptionEnabledInRoom).toHaveBeenCalledTimes(2);

            isEncryptionEnabledInRoom.mockResolvedValue(true);
            sdkRoom.emit(
                RoomStateEvent.Events,
                mkEvent({
                    event: true,
                    type: EventType.RoomEncryption,
                    room: "!foo:m.org",
                    user: "@a:m.org",
                    content: { algorithm: "m.megolm.v1.aes-sha2" },
                    skey: "",
                }),
                sdkRoom.currentState,
                null,
            );
            await vi.waitFor(() => expect(fn).toHaveBeenCalledWith(true));
            expect(isEncryptionEnabledInRoom).toHaveBeenCalledTimes(3);
        });
    });
});
