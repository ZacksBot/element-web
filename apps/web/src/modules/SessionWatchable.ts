/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { Watchable } from "@element-hq/element-web-module-api";

import type { ClientSession } from "./ClientSession";

/** A watchable bound to one Matrix client. Invalidation clears its value and detaches its source. */
export abstract class SessionWatchable<T> extends Watchable<T> {
    private invalidated = false;
    private listening = false;

    /** Bind a value and its cleared state to the current client session. */
    protected constructor(
        session: ClientSession,
        initialValue: T,
        private readonly clearedValue: T,
    ) {
        super(initialValue);
        session.track(this);
    }

    /** Whether this watchable still belongs to the active client session. */
    protected get isActive(): boolean {
        return !this.invalidated;
    }

    /** Ignore updates that arrive after this watchable's session ends. */
    protected publish(value: T): void {
        if (this.isActive) super.value = value;
    }

    /** Detach the source and clear the value when the client session ends. */
    public invalidate(): void {
        if (this.invalidated) return;
        this.invalidated = true;
        this.detach();
        super.value = this.clearedValue;
    }

    protected onFirstWatch(): void {
        if (this.isActive) {
            this.attachSource();
            this.listening = true;
        }
    }

    protected onLastWatch(): void {
        this.detach();
    }

    private detach(): void {
        if (!this.listening) return;
        this.detachSource();
        this.listening = false;
    }

    /** Subscribe to source updates while this watchable has listeners. */
    protected abstract attachSource(): void;

    /** Unsubscribe from source updates when listening stops. */
    protected abstract detachSource(): void;
}
