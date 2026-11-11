/*
Copyright 2025 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/
import type {
    StoresApi as IStoresApi,
    RoomListStoreApi as IRoomListStore,
    Room,
} from "@element-hq/element-web-module-api";
import { Watchable } from "@element-hq/element-web-module-api";
import type { Room as SdkRoom } from "matrix-js-sdk/src/matrix";

import type { RoomListStoreV3Class, RoomListStoreV3Event } from "../stores/room-list-v3/RoomListStoreV3";
import type { ClientSession } from "./ClientSession";
import { Room as ModuleRoom } from "./models/Room";

interface RlsEvents {
    LISTS_LOADED_EVENT: RoomListStoreV3Event.ListsLoaded;
    LISTS_UPDATE_EVENT: RoomListStoreV3Event.ListsUpdate;
}

export class RoomListStoreApi implements IRoomListStore {
    private rls?: RoomListStoreV3Class;
    private roomsWatchable?: RoomsWatchable;
    private LISTS_LOADED_EVENT?: RoomListStoreV3Event.ListsLoaded;
    private LISTS_UPDATE_EVENT?: RoomListStoreV3Event.ListsUpdate;
    public readonly moduleLoadPromise: Promise<void>;

    public constructor(private readonly session: ClientSession) {
        this.moduleLoadPromise = this.init();
    }

    /**
     * Load the RLS through a dynamic import. This is necessary to prevent
     * circular dependency issues.
     */
    private async init(): Promise<void> {
        const module = await import("../stores/room-list-v3/RoomListStoreV3");
        this.rls = module.default.instance;
        this.LISTS_LOADED_EVENT = module.LISTS_LOADED_EVENT;
        this.LISTS_UPDATE_EVENT = module.LISTS_UPDATE_EVENT;
    }

    public getRooms(): RoomsWatchable {
        this.roomsWatchable ??= new RoomsWatchable(this.roomListStore, this.events, this.session);
        return this.roomsWatchable;
    }

    private get events(): RlsEvents {
        if (!this.LISTS_LOADED_EVENT || !this.LISTS_UPDATE_EVENT) {
            throw new Error("Event type was not loaded correctly, did you forget to await waitForReady()?");
        }
        return { LISTS_LOADED_EVENT: this.LISTS_LOADED_EVENT, LISTS_UPDATE_EVENT: this.LISTS_UPDATE_EVENT };
    }

    private get roomListStore(): RoomListStoreV3Class {
        if (!this.rls) {
            throw new Error("rls is undefined, did you forget to await waitForReady()?");
        }
        return this.rls;
    }

    public async waitForReady(): Promise<void> {
        // Wait for the module to load first
        await this.moduleLoadPromise;

        // Check if RLS is already loaded
        if (!this.roomListStore.isLoadingRooms) return;

        // Await a promise that resolves when RLS has loaded
        const { promise, resolve } = Promise.withResolvers<void>();
        const { LISTS_LOADED_EVENT } = this.events;
        this.roomListStore.once(LISTS_LOADED_EVENT, resolve);
        await promise;
    }
}

class RoomsWatchable extends Watchable<Room[]> {
    private readonly rooms = new Map<SdkRoom, ModuleRoom>();

    public constructor(
        private readonly rls: RoomListStoreV3Class,
        private readonly events: RlsEvents,
        private readonly session: ClientSession,
    ) {
        super([]);
        this.refresh();
        session.onClientChange(this.onClientChange);
    }

    private onRlsUpdate = (): void => {
        this.refresh();
    };

    private onClientChange = (): void => {
        this.rooms.clear();
        this.value = [];
    };

    private refresh(): void {
        if (!this.session.currentClient) return;
        this.value = this.rls
            .getSortedRooms()
            .filter((sdkRoom) => sdkRoom.client === this.session.currentClient)
            .map((sdkRoom) => {
                let room = this.rooms.get(sdkRoom);
                if (!room) {
                    room = new ModuleRoom(this.session, sdkRoom);
                    this.rooms.set(sdkRoom, room);
                }
                return room;
            });
    }

    protected onFirstWatch(): void {
        this.rls.on(this.events.LISTS_UPDATE_EVENT, this.onRlsUpdate);
    }

    protected onLastWatch(): void {
        this.rls.off(this.events.LISTS_UPDATE_EVENT, this.onRlsUpdate);
    }
}

export class StoresApi implements IStoresApi {
    private roomListStoreApi?: IRoomListStore;

    public constructor(private readonly session: ClientSession) {}

    public get roomListStore(): IRoomListStore {
        if (!this.roomListStoreApi) {
            this.roomListStoreApi = new RoomListStoreApi(this.session);
        }
        return this.roomListStoreApi;
    }
}
