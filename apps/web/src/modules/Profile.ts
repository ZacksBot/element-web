/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Profile, Watchable } from "@element-hq/element-web-module-api";
import type { MatrixClient } from "matrix-js-sdk/src/matrix";

import { OwnProfileStore } from "../stores/OwnProfileStore.ts";
import { UPDATE_EVENT } from "../stores/AsyncStore.ts";
import type { ClientSession } from "./ClientSession";

export class WatchableProfile extends Watchable<Profile> {
    public constructor(private readonly session: ClientSession) {
        super({});
        this.value = this.getProfile(session.currentClient);

        OwnProfileStore.instance.on(UPDATE_EVENT, this.onProfileChange);
        session.onClientChange(this.onClientChange);
    }

    private getProfile(client: MatrixClient | null): Profile {
        if (!client) return {};
        const profileStore = OwnProfileStore.instance;
        return {
            isGuest: client.isGuest(),
            userId: client.getUserId() ?? undefined,
            deviceId: client.getDeviceId() ?? undefined,
            displayName: profileStore.matrixClient === client ? (profileStore.displayName ?? undefined) : undefined,
        };
    }

    private readonly onProfileChange = (): void => {
        this.value = this.getProfile(this.session.currentClient);
    };

    private readonly onClientChange = (client: MatrixClient | null): void => {
        // Login publishes the client before OwnProfileStore has fetched the profile.
        this.value = this.getProfile(client);
    };
}
