/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { composeStories } from "@storybook/react-vite";
import { render, screen } from "@test-utils";
import React, { type FocusEventHandler, type MouseEventHandler, type ReactEventHandler } from "react";
import { fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MockViewModel } from "../../viewmodel";
import {
    ImageBodyView,
    ImageBodyViewPlaceholder,
    ImageBodyViewState,
    ImageBodyViewWrapper,
    type ImageBodyViewActions,
    type ImageBodyViewModel,
    type ImageBodyViewSnapshot,
} from "./ImageBodyView";
import * as stories from "./ImageBodyView.stories";

const { Default, HiddenMedia, LoadingWithBlurhash, Error } = composeStories(stories);

describe("ImageBodyView", () => {
    it("renders the default image state", () => {
        const { container } = render(<Default />);
        expect(container).toMatchSnapshot();
    });

    it("renders the hidden-media state", () => {
        const { container } = render(<HiddenMedia />);
        expect(container).toMatchSnapshot();
    });

    it("renders the loading blurhash state", () => {
        const { container } = render(<LoadingWithBlurhash />);
        expect(container).toMatchSnapshot();
    });

    it("renders the error state", () => {
        const { container } = render(<Error />);
        expect(container).toMatchSnapshot();
    });

    it("invokes media actions", async () => {
        const user = userEvent.setup();

        const onActivate = vi.fn();
        const onRevealMedia = vi.fn();
        const onImageError = vi.fn();
        const onImageLoad = vi.fn();
        const onImageMouseEnter = vi.fn();
        const onImageMouseLeave = vi.fn();
        const onWrapperFocus = vi.fn();
        const onWrapperBlur = vi.fn();

        class TestImageBodyViewModel extends MockViewModel<ImageBodyViewSnapshot> implements ImageBodyViewActions {
            public onActivate?: MouseEventHandler<HTMLElement>;
            public onRevealMedia?: MouseEventHandler<HTMLButtonElement>;
            public onImageError?: ReactEventHandler<HTMLImageElement>;
            public onImageLoad?: ReactEventHandler<HTMLImageElement>;
            public onImageMouseEnter?: MouseEventHandler<HTMLImageElement>;
            public onImageMouseLeave?: MouseEventHandler<HTMLImageElement>;
            public onWrapperFocus?: FocusEventHandler<HTMLElement>;
            public onWrapperBlur?: FocusEventHandler<HTMLElement>;

            public constructor(snapshot: ImageBodyViewSnapshot, actions: ImageBodyViewActions) {
                super(snapshot);
                Object.assign(this, actions);
            }
        }

        const vm = new TestImageBodyViewModel(
            {
                state: ImageBodyViewState.READY,
                altText: "A scenic mountain lake",
                wrapper: ImageBodyViewWrapper.LINK,
                href: "https://example.com/image.png",
                imageSrc:
                    "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Crect width='32' height='32' fill='%23abcdef'/%3E%3C/svg%3E",
                maxWidth: 32,
                maxHeight: 32,
                aspectRatio: "1 / 1",
                showPlaceholder: true,
                placeholder: ImageBodyViewPlaceholder.SPINNER,
                showHiddenMediaPlaceholder: false,
                showGifLabel: false,
            },
            {
                onActivate,
                onRevealMedia,
                onImageError,
                onImageLoad,
                onImageMouseEnter,
                onImageMouseLeave,
                onWrapperFocus,
                onWrapperBlur,
            },
        ) as ImageBodyViewModel;

        render(<ImageBodyView vm={vm} className="mx_MImageBody" />);

        const link = screen.getByRole("link");
        const image = screen.getByRole("img", { name: "A scenic mountain lake" });

        await user.click(link);
        link.focus();
        link.blur();
        await user.hover(image);
        await user.unhover(image);

        fireEvent.load(image);
        fireEvent.error(image);

        expect(onActivate).toHaveBeenCalledTimes(1);
        expect(onWrapperFocus).toHaveBeenCalledTimes(1);
        expect(onWrapperBlur).toHaveBeenCalledTimes(1);
        expect(onImageMouseEnter).toHaveBeenCalledTimes(1);
        expect(onImageMouseLeave).toHaveBeenCalledTimes(1);
        expect(onImageLoad).toHaveBeenCalled();
        expect(onImageError).toHaveBeenCalled();

        const hiddenVm = new TestImageBodyViewModel(
            {
                state: ImageBodyViewState.READY,
                altText: "A scenic mountain lake",
                showHiddenMediaPlaceholder: true,
                hiddenMediaLabel: "Show image",
                maxWidth: 32,
                maxHeight: 32,
            },
            { onRevealMedia },
        ) as ImageBodyViewModel;

        render(<ImageBodyView vm={hiddenVm} className="mx_MImageBody" />);
        await user.click(screen.getByRole("button", { name: "Show image" }));

        expect(onRevealMedia).toHaveBeenCalledTimes(1);
    });

    it("applies custom className to the root element", () => {
        const vm = new MockViewModel<ImageBodyViewSnapshot>({
            state: ImageBodyViewState.ERROR,
            altText: "A scenic mountain lake",
            errorLabel: "Error loading image",
        }) as ImageBodyViewModel;

        const { container } = render(<ImageBodyView vm={vm} className="mx_MImageBody custom-class" />);

        expect(container.firstChild).toHaveClass("mx_MImageBody", "custom-class");
    });
});
