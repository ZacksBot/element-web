/*
Copyright 2025 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/
import type { ClientApi as IClientApi, Room } from "@element-hq/element-web-module-api";
import { Room as ModuleRoom } from "./models/Room";
import { AccountDataApi } from "./AccountDataApi";
import { ClientCreationManagementApi } from "./ClientCreationManagementApi.ts";
import type { ClientSession } from "./ClientSession";
import type { MatrixDispatcher } from "../dispatcher/dispatcher";
import { Action } from "../dispatcher/actions";
import type { ActionPayload } from "../dispatcher/payloads";
import type { Room as SdkRoom } from "matrix-js-sdk/src/matrix";

export class ClientApi implements IClientApi {
    public readonly accountData: AccountDataApi;
    public readonly creationManagement = new ClientCreationManagementApi();

    // Resolves when the client next starts; replaced when a session ends so later callers wait for the next start.
    private clientStarted = Promise.withResolvers<void>();
    private readonly rooms = new Map<SdkRoom, ModuleRoom>();

    public constructor(
        dispatcher: MatrixDispatcher,
        private readonly session: ClientSession,
    ) {
        dispatcher.register(this.onAction);
        this.accountData = new AccountDataApi(session);
        session.onClientChange(() => this.rooms.clear());
    }

    public getRoom(roomId: string): Room | null {
        const sdkRoom = this.session.getClient()?.getRoom(roomId);
        if (!sdkRoom) return null;

        let room = this.rooms.get(sdkRoom);
        if (!room) {
            room = new ModuleRoom(this.session, sdkRoom);
            this.rooms.set(sdkRoom, room);
        }
        return room;
    }

    public waitForClientStarted(): Promise<void> {
        return this.clientStarted.promise;
    }

    private readonly onAction = (payload: ActionPayload): void => {
        if (payload.action === Action.ClientStarted) {
            this.clientStarted.resolve();
        } else if (payload.action === Action.OnLoggedOut || payload.action === Action.ClientNotViable) {
            this.clientStarted = Promise.withResolvers<void>();
        }
    };
}
