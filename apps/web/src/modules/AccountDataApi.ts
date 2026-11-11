/*
Copyright 2025 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { Watchable, AccountDataApi as IAccountDataApi } from "@element-hq/element-web-module-api";
import { ClientEvent, type MatrixEvent, type MatrixClient } from "matrix-js-sdk/src/matrix";

import type { ClientSession } from "./ClientSession";
import { SessionWatchable } from "./SessionWatchable";

export class AccountDataApi implements IAccountDataApi {
    public constructor(private readonly session: ClientSession) {}

    public get(eventType: string): Watchable<unknown> {
        return new AccountDataWatchable(this.session, this.requireClient(), eventType);
    }

    public async set(eventType: string, content: any): Promise<void> {
        const cli = this.requireClient();
        //@ts-expect-error: JS-SDK accepts known event-types, intentionally allow arbitrary types.
        await cli.setAccountData(eventType, content);
    }

    public async delete(eventType: string): Promise<void> {
        const cli = this.requireClient();
        //@ts-expect-error: JS-SDK accepts known event-types, intentionally allow arbitrary types.
        await cli.deleteAccountData(eventType);
    }

    private requireClient(): MatrixClient {
        const client = this.session.getClient();
        if (!client) throw new Error("Matrix client session has ended");
        return client;
    }
}

class AccountDataWatchable extends SessionWatchable<unknown> {
    public constructor(
        session: ClientSession,
        private cli: MatrixClient,
        private eventType: string,
    ) {
        //@ts-expect-error: JS-SDK accepts known event-types, intentionally allow arbitrary types.
        super(session, cli.getAccountData(eventType)?.getContent(), undefined);
    }

    private onAccountData = (event: MatrixEvent): void => {
        if (event.getType() === this.eventType) {
            this.publish(event.getContent());
        }
    };

    protected attachSource(): void {
        this.cli.on(ClientEvent.AccountData, this.onAccountData);
    }

    protected detachSource(): void {
        this.cli.off(ClientEvent.AccountData, this.onAccountData);
    }
}
