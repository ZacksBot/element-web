/*
Copyright 2025 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { Room as IRoom } from "@element-hq/element-web-module-api";
import { EventType, type MatrixEvent, RoomEvent, RoomStateEvent, type Room as SdkRoom } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

import type { ClientSession } from "../ClientSession";
import { SessionWatchable } from "../SessionWatchable";

export class Room implements IRoom {
    public name: WatchableName;
    public isEncrypted: WatchableIsEncrypted;
    public constructor(
        session: ClientSession,
        private sdkRoom: SdkRoom,
    ) {
        this.name = new WatchableName(session, sdkRoom);
        this.isEncrypted = new WatchableIsEncrypted(session, sdkRoom);
    }

    public getLastActiveTimestamp(): number {
        return this.sdkRoom.getLastActiveTimestamp();
    }

    public get id(): string {
        return this.sdkRoom.roomId;
    }
}

/**
 * A custom watchable for room name.
 */
class WatchableName extends SessionWatchable<string> {
    public constructor(
        session: ClientSession,
        private sdkRoom: SdkRoom,
    ) {
        super(session, sdkRoom.name, "");
    }

    private onNameUpdate = (): void => {
        this.publish(this.sdkRoom.name);
    };

    protected attachSource(): void {
        this.sdkRoom.on(RoomEvent.Name, this.onNameUpdate);
    }

    protected detachSource(): void {
        this.sdkRoom.off(RoomEvent.Name, this.onNameUpdate);
    }
}

/**
 * A custom watchable for whether the room is encrypted.
 * The value is computed via the crypto API on construction, and recomputed whenever the room's
 * encryption state event changes. The method to check is async, so it return undefined until
 * the method returns.
 */
class WatchableIsEncrypted extends SessionWatchable<boolean | undefined> {
    // Incremented on every check so that a slow, stale result can't overwrite a newer one.
    private checkId = 0;
    public constructor(
        session: ClientSession,
        private sdkRoom: SdkRoom,
    ) {
        super(session, undefined, undefined);
        void this.updateIsEncrypted();
    }

    private async updateIsEncrypted(): Promise<void> {
        if (!this.isActive) return;
        const checkId = ++this.checkId;
        try {
            const isEncrypted = Boolean(
                await this.sdkRoom.client.getCrypto()?.isEncryptionEnabledInRoom(this.sdkRoom.roomId),
            );
            if (checkId === this.checkId) this.publish(isEncrypted);
        } catch (e) {
            logger.error(`Failed to check whether room ${this.sdkRoom.roomId} is encrypted`, e);
        }
    }

    private onStateEvent = (event: MatrixEvent): void => {
        if (event.getType() !== EventType.RoomEncryption) return;
        void this.updateIsEncrypted();
    };

    protected attachSource(): void {
        this.sdkRoom.on(RoomStateEvent.Events, this.onStateEvent);
        void this.updateIsEncrypted();
    }

    protected detachSource(): void {
        // Discard any check still in flight.
        this.checkId++;
        this.sdkRoom.off(RoomStateEvent.Events, this.onStateEvent);
    }
}
