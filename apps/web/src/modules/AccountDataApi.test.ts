/*
Copyright 2025 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, vi } from "vitest";
import { ClientEvent } from "matrix-js-sdk/src/matrix";
import { mkEvent, stubClient } from "test-utils";

import { AccountDataApi } from "./AccountDataApi";
import { ClientSession } from "./ClientSession";
import { MatrixDispatcher } from "../dispatcher/dispatcher";
import { Action } from "../dispatcher/actions";

describe("AccountDataApi", () => {
    const makeApi = (): AccountDataApi => new AccountDataApi(new ClientSession(new MatrixDispatcher()));

    describe("AccountDataWatchable", () => {
        it("clears its value and detaches from the old client on logout", () => {
            const cli = stubClient();
            const dispatcher = new MatrixDispatcher();
            const session = new ClientSession(dispatcher);
            const event = mkEvent({
                content: { private: "old session" },
                type: "m.test",
                user: "@a:m.org",
                event: true,
            });
            cli.getAccountData = () => event;
            const api = new AccountDataApi(session);
            const watchable = api.get("m.test");
            const listener = vi.fn();
            const offSpy = vi.spyOn(cli, "off");
            watchable.watch(listener);

            dispatcher.dispatch({ action: Action.OnLoggedOut }, true);

            expect(watchable.value).toBeUndefined();
            expect(listener).toHaveBeenCalledWith(undefined);
            expect(offSpy).toHaveBeenCalledWith(ClientEvent.AccountData, expect.any(Function));

            cli.emit(ClientEvent.AccountData, event);
            expect(watchable.value).toBeUndefined();
            expect(() => api.get("m.test")).toThrow("Matrix client session has ended");

            const newCli = stubClient();
            const newEvent = mkEvent({
                content: { private: "new session" },
                type: "m.test",
                user: "@b:m.org",
                event: true,
            });
            newCli.getAccountData = () => newEvent;
            dispatcher.dispatch({ action: Action.OnLoggedIn, client: newCli }, true);
            expect(api.get("m.test").value).toEqual({ private: "new session" });
        });

        it("should return content of account data event on get()", () => {
            const cli = stubClient();
            const api = makeApi();
            // Mock cli to return a event
            const content = { foo: "bar" };
            const event = mkEvent({ content, type: "m.test", user: "@foobar:matrix.org", event: true });
            cli.getAccountData = () => event;
            expect(api.get("m.test").value).toStrictEqual(content);
        });

        it("should update value on event", () => {
            const cli = stubClient();
            const api = makeApi();
            // Mock cli to return a event
            const content = { foo: "bar" };
            const event = mkEvent({ content, type: "m.test", user: "@foobar:matrix.org", event: true });
            cli.getAccountData = () => event;

            const watchable = api.get("m.test");
            expect(watchable.value).toStrictEqual(content);

            const fn = vi.fn();
            watchable.watch(fn);

            // Let's say that the account data event changed
            const event2 = mkEvent({
                content: { foo: "abc" },
                type: "m.test",
                user: "@foobar:matrix.org",
                event: true,
            });
            cli.emit(ClientEvent.AccountData, event2);
            // Watchable value should have been updated
            expect(watchable.value).toStrictEqual({ foo: "abc" });
            // Watched callbacks should be called
            expect(fn).toHaveBeenCalledTimes(1);

            // Make sure unwatch removed the event listener
            cli.off = vi.fn();
            watchable.unwatch(fn);
            expect(cli.off).toHaveBeenCalledTimes(1);
        });
    });

    it("should set account data via js-sdk on set()", async () => {
        const cli = stubClient();
        const api = makeApi();
        await api.set("m.test", { foo: "bar" });
        expect(cli.setAccountData).toHaveBeenCalledTimes(1);
    });

    it("should delete account data via js-sdk on set()", async () => {
        const cli = stubClient();
        const api = makeApi();
        await api.delete("m.test");
        expect(cli.deleteAccountData).toHaveBeenCalledTimes(1);
    });
});
