/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import type { MatrixClient } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

import { MatrixClientPeg } from "../MatrixClientPeg";
import { Action } from "../dispatcher/actions";
import type { MatrixDispatcher } from "../dispatcher/dispatcher";
import type { ActionPayload } from "../dispatcher/payloads";
import type { OnLoggedInPayload } from "../dispatcher/payloads/OnLoggedInPayload";

interface SessionBound {
    invalidate(): void;
}

/** Tracks the Matrix client shared by module API objects. */
export class ClientSession {
    private client: MatrixClient | null = MatrixClientPeg.get();
    private endedClient: MatrixClient | null = null;
    private readonly bound = new Set<SessionBound>();
    private readonly listeners = new Set<(client: MatrixClient | null) => void>();

    /** Listen for login, logout, and client startup actions. */
    public constructor(dispatcher: MatrixDispatcher) {
        dispatcher.register(this.onAction);
    }

    /** The last observed client, without checking MatrixClientPeg for a replacement. */
    public get currentClient(): MatrixClient | null {
        return this.client;
    }

    /** Resolve the active client, reconciling a replacement in MatrixClientPeg if needed. */
    public getClient(): MatrixClient | null {
        const client = MatrixClientPeg.get();
        this.updateClient(client);
        return this.client;
    }

    /** Invalidate objects tied to the previous client before notifying long-lived APIs. */
    public updateClient(client: MatrixClient | null): void {
        // Hard logout unsets the peg later; soft logout leaves the old client there.
        if (client && client === this.endedClient) return;
        if (client === this.client) return;
        this.client = client;
        const bound = Array.from(this.bound);
        this.bound.clear();
        for (const item of bound) {
            try {
                item.invalidate();
            } catch (error) {
                logger.error("Failed to invalidate a module watchable", error);
            }
        }
        for (const listener of this.listeners) {
            try {
                listener(client);
            } catch (error) {
                logger.error("Failed to update a module API after a client change", error);
            }
        }
    }

    /** Track an object until its client is replaced. */
    public track(item: SessionBound): void {
        this.bound.add(item);
    }

    /** Observe client changes from an API object that survives session changes. */
    public onClientChange(listener: (client: MatrixClient | null) => void): void {
        this.listeners.add(listener);
    }

    private readonly onAction = (payload: ActionPayload): void => {
        if (payload.action === Action.OnLoggedOut || payload.action === Action.ClientNotViable) {
            if (this.client) this.endedClient = this.client;
            this.updateClient(null);
        } else if (payload.action === Action.OnLoggedIn) {
            this.endedClient = null;
            this.updateClient((payload as OnLoggedInPayload).client);
        } else if (payload.action === Action.ClientStarted) {
            this.updateClient(MatrixClientPeg.get());
        }
    };
}
