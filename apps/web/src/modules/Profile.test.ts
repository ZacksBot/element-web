/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, vi } from "vitest";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";

import { WatchableProfile } from "./Profile";
import { ClientSession } from "./ClientSession";
import { OwnProfileStore } from "../stores/OwnProfileStore";
import { UPDATE_EVENT } from "../stores/AsyncStore";
import defaultDispatcher, { MatrixDispatcher } from "../dispatcher/dispatcher";
import { Action } from "../dispatcher/actions";

describe("WatchableProfile", () => {
    it("clears the old profile on logout even if the profile store updates afterward", () => {
        const dispatcher = new MatrixDispatcher();
        const profile = new WatchableProfile(new ClientSession(dispatcher));
        const listener = vi.fn();
        profile.watch(listener);
        const client = {
            isGuest: () => false,
            getUserId: () => "@old:server",
            getDeviceId: () => "OLDDEVICE",
        } as unknown as MatrixClient;
        dispatcher.dispatch({ action: Action.OnLoggedIn, client }, true);

        dispatcher.dispatch({ action: Action.OnLoggedOut }, true);
        OwnProfileStore.instance.emit(UPDATE_EVENT);

        expect(profile.value).toEqual({});
        expect(listener).toHaveBeenLastCalledWith({});
    });

    it("should update the profile with the new client on login, before the profile is fetched", () => {
        const profile = new WatchableProfile(new ClientSession(defaultDispatcher));
        const listener = vi.fn();
        profile.watch(listener);

        const client = {
            isGuest: () => true,
            getUserId: () => "@guest-1:server",
            getDeviceId: () => "GUESTDEVICE",
        } as unknown as MatrixClient;
        defaultDispatcher.dispatch({ action: Action.OnLoggedIn, client }, true);

        expect(profile.value).toMatchObject({ isGuest: true, userId: "@guest-1:server", deviceId: "GUESTDEVICE" });
        expect(listener).toHaveBeenCalledWith(profile.value);
    });
});
