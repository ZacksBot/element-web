/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, type ReactNode } from "react";
import { fn } from "storybook/test";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMockedViewModel } from "../../viewmodel";
import {
    ImageBodyView,
    ImageBodyViewPlaceholder,
    ImageBodyViewState,
    ImageBodyViewWrapper,
    type ImageBodyViewActions,
    type ImageBodyViewSnapshot,
} from "./ImageBodyView";

const sampleImage = `data:image/svg+xml;utf8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180">
        <defs>
            <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#b3d4ff"/>
                <stop offset="100%" stop-color="#f7c7ff"/>
            </linearGradient>
        </defs>
        <rect width="320" height="180" fill="url(#g)"/>
        <circle cx="82" cy="82" r="34" fill="#fff6"/>
        <path d="M30 150 L130 88 L190 138 L240 102 L320 180 L0 180 Z" fill="#1f3a5f"/>
    </svg>
`)}`;

type WrapperProps = ImageBodyViewSnapshot &
    Partial<ImageBodyViewActions> & {
        className?: string;
        children?: ReactNode;
    };

const ImageBodyViewStoryWrapper = ({ className, children, ...snapshotProps }: WrapperProps): JSX.Element => {
    const vm = useMockedViewModel(snapshotProps, {
        onActivate: snapshotProps.onActivate ?? fn(),
        onRevealMedia: snapshotProps.onRevealMedia ?? fn(),
        onImageError: snapshotProps.onImageError ?? fn(),
        onImageLoad: snapshotProps.onImageLoad ?? fn(),
        onImageMouseEnter: snapshotProps.onImageMouseEnter ?? fn(),
        onImageMouseLeave: snapshotProps.onImageMouseLeave ?? fn(),
        onWrapperFocus: snapshotProps.onWrapperFocus ?? fn(),
        onWrapperBlur: snapshotProps.onWrapperBlur ?? fn(),
    });

    return (
        <ImageBodyView vm={vm} className={className}>
            {children}
        </ImageBodyView>
    );
};

const meta = {
    title: "MessageBody/ImageBodyView",
    component: ImageBodyViewStoryWrapper,
    tags: ["autodocs"],
    args: {
        state: ImageBodyViewState.READY,
        altText: "A scenic mountain lake",
        wrapper: ImageBodyViewWrapper.LINK,
        href: "https://example.com/image.png",
        imageSrc: sampleImage,
        maxWidth: 320,
        maxHeight: 180,
        aspectRatio: "16 / 9",
        showPlaceholder: false,
        placeholder: ImageBodyViewPlaceholder.NONE,
        placeholderAriaLabel: "Loading image",
        showHiddenMediaPlaceholder: false,
        hiddenMediaLabel: "Show image",
        showGifLabel: false,
        gifLabel: "GIF",
        banner: undefined,
        tooltip: undefined,
        tooltipPlacement: "right",
        showLoadingSpacer: false,
        errorLabel: "Error loading image",
    },
} satisfies Meta<typeof ImageBodyViewStoryWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const HiddenMedia: Story = {
    args: {
        showHiddenMediaPlaceholder: true,
    },
};

export const LoadingWithBlurhash: Story = {
    args: {
        showPlaceholder: true,
        placeholder: ImageBodyViewPlaceholder.BLURHASH,
        blurhash: "L5H2EC=PM+yV0g-mq.wG9c010J}I",
        banner: "sunset-over-the-lake.png",
    },
};

export const AnimatedImage: Story = {
    args: {
        showGifLabel: true,
        banner: "sunset-over-the-lake.gif",
    },
};

export const StickerWithTooltip: Story = {
    args: {
        wrapper: ImageBodyViewWrapper.DIV,
        tooltip: "Party parrot",
        banner: undefined,
    },
};

export const Error: Story = {
    args: {
        state: ImageBodyViewState.ERROR,
        imageSrc: undefined,
        href: undefined,
        errorLabel: "Error downloading image",
    },
};
