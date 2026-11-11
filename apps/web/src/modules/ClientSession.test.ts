/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import { describe, expect, it, vi } from "vitest";
import { logger } from "matrix-js-sdk/src/logger";
import { stubClient } from "test-utils";

import { ClientSession } from "./ClientSession";
import { MatrixClientPeg } from "../MatrixClientPeg";
import { Action } from "../dispatcher/actions";
import { MatrixDispatcher } from "../dispatcher/dispatcher";

describe("ClientSession", () => {
    it("invalidates on soft logout and does not reuse the client left in the peg", () => {
        const client = stubClient();
        const dispatcher = new MatrixDispatcher();
        const session = new ClientSession(dispatcher);
        const watchable = { invalidate: vi.fn() };
        const listener = vi.fn();
        session.track(watchable);
        session.onClientChange(listener);

        dispatcher.dispatch({ action: Action.ClientNotViable }, true);

        expect(session.currentClient).toBeNull();
        expect(watchable.invalidate).toHaveBeenCalledOnce();
        expect(listener).toHaveBeenCalledWith(null);

        expect(session.getClient()).toBeNull();
        dispatcher.dispatch({ action: Action.ClientStarted }, true);
        dispatcher.dispatch({ action: Action.OnLoggedOut }, true);
        expect(session.getClient()).toBeNull();

        expect(session.currentClient).toBeNull();
        expect(watchable.invalidate).toHaveBeenCalledOnce();
        expect(listener).toHaveBeenCalledTimes(1);

        dispatcher.dispatch({ action: Action.OnLoggedIn, client }, true);

        expect(session.currentClient).toBe(client);
        expect(session.getClient()).toBe(client);
        expect(listener).toHaveBeenLastCalledWith(client);
    });

    it("returns null after the client peg is unset", () => {
        stubClient();
        const session = new ClientSession(new MatrixDispatcher());

        vi.spyOn(MatrixClientPeg, "get").mockReturnValue(null);

        expect(session.getClient()).toBeNull();
        expect(session.currentClient).toBeNull();
    });

    it("resolves a replacement client and invalidates objects bound to the old one", () => {
        stubClient();
        const session = new ClientSession(new MatrixDispatcher());
        const watchable = { invalidate: vi.fn() };
        session.track(watchable);

        const replacement = stubClient();

        expect(session.getClient()).toBe(replacement);
        expect(watchable.invalidate).toHaveBeenCalledOnce();
    });

    it("invalidates every watchable when one listener throws", () => {
        stubClient();
        const session = new ClientSession(new MatrixDispatcher());
        const error = new Error("module listener failed");
        const first = vi.fn(() => {
            throw error;
        });
        const second = vi.fn();
        const listener = vi.fn();
        const loggerSpy = vi.spyOn(logger, "error").mockImplementation(() => {});
        session.track({ invalidate: first });
        session.track({ invalidate: second });
        session.onClientChange(listener);

        session.updateClient(null);

        expect(session.currentClient).toBeNull();
        expect(first).toHaveBeenCalledOnce();
        expect(second).toHaveBeenCalledOnce();
        expect(listener).toHaveBeenCalledWith(null);
        expect(loggerSpy).toHaveBeenCalledWith("Failed to invalidate a module watchable", error);
    });
});
