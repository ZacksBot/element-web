/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, {
    type ComponentProps,
    type CSSProperties,
    type FocusEventHandler,
    type HTMLAttributeAnchorTarget,
    type JSX,
    type MouseEventHandler,
    type PropsWithChildren,
    type ReactEventHandler,
    type ReactNode,
    type RefObject,
} from "react";
import classNames from "classnames";
import { Blurhash } from "react-blurhash";
import { InlineSpinner, Tooltip } from "@vector-im/compound-web";
import {
    ImageErrorIcon,
    StickerIcon,
    VisibilityOnIcon,
} from "@vector-im/compound-design-tokens/assets/web/icons";

import { type ViewModel } from "../../viewmodel";
import { useViewModel } from "../../viewmodel/useViewModel";
import styles from "./ImageBodyView.module.css";

export enum ImageBodyViewState {
    ERROR = "ERROR",
    PRELOAD = "PRELOAD",
    READY = "READY",
}

export enum ImageBodyViewWrapper {
    LINK = "LINK",
    DIV = "DIV",
    NONE = "NONE",
}

export enum ImageBodyViewPlaceholder {
    NONE = "NONE",
    SPINNER = "SPINNER",
    BLURHASH = "BLURHASH",
    STICKER = "STICKER",
}

export interface ImageBodyViewSnapshot {
    /**
     * Primary rendering branch for the view.
     */
    state: ImageBodyViewState;
    /**
     * Alternate text for the image element.
     */
    altText: string;
    /**
     * Optional click/focus wrapper to render around the media.
     */
    wrapper?: ImageBodyViewWrapper;
    /**
     * Optional class name for the wrapper element.
     */
    wrapperClassName?: string;
    /**
     * Optional anchor href when `wrapper` is `LINK`.
     */
    href?: string;
    /**
     * Optional anchor target when `wrapper` is `LINK`.
     */
    target?: HTMLAttributeAnchorTarget;
    /**
     * Image source rendered in the ready state.
     */
    imageSrc?: string;
    /**
     * Image source rendered in the preload state.
     */
    preloadSrc?: string;
    /**
     * Maximum width applied to the rendered thumbnail container.
     */
    maxWidth?: number;
    /**
     * Maximum height applied to the rendered thumbnail container.
     */
    maxHeight?: number;
    /**
     * Aspect ratio for the thumbnail container.
     */
    aspectRatio?: string;
    /**
     * Optional explicit width for the image box, used for SVG sizing.
     */
    imageWidth?: number | string;
    /**
     * Controls whether the loading placeholder should be displayed.
     */
    showPlaceholder?: boolean;
    /**
     * Which placeholder variant to render.
     */
    placeholder?: ImageBodyViewPlaceholder;
    /**
     * Blurhash string used by the blurhash placeholder.
     */
    blurhash?: string;
    /**
     * Accessible label for the loading spinner.
     */
    placeholderAriaLabel?: string;
    /**
     * Whether to render the hidden-media preview button instead of the image.
     */
    showHiddenMediaPlaceholder?: boolean;
    /**
     * Button label for the hidden-media placeholder.
     */
    hiddenMediaLabel?: string;
    /**
     * Whether to render the animated-image badge.
     */
    showGifLabel?: boolean;
    /**
     * Animated-image badge text.
     */
    gifLabel?: string;
    /**
     * Optional overlay banner text shown on hover/focus states.
     */
    banner?: string;
    /**
     * Optional tooltip description for the thumbnail.
     */
    tooltip?: string;
    /**
     * Tooltip placement.
     */
    tooltipPlacement?: ComponentProps<typeof Tooltip>["placement"];
    /**
     * Whether to render a spacer while no placeholder is visible and the image is still loading.
     */
    showLoadingSpacer?: boolean;
    /**
     * Error label rendered in the error state.
     */
    errorLabel?: string;
}

export interface ImageBodyViewActions {
    /**
     * Invoked when the wrapper is activated.
     */
    onActivate?: MouseEventHandler<HTMLElement>;
    /**
     * Invoked when hidden media is explicitly revealed by the user.
     */
    onRevealMedia?: MouseEventHandler<HTMLButtonElement>;
    /**
     * Invoked when the image fails to load.
     */
    onImageError?: ReactEventHandler<HTMLImageElement>;
    /**
     * Invoked when the image loads successfully.
     */
    onImageLoad?: ReactEventHandler<HTMLImageElement>;
    /**
     * Invoked when the pointer enters the visible image.
     */
    onImageMouseEnter?: MouseEventHandler<HTMLImageElement>;
    /**
     * Invoked when the pointer leaves the visible image.
     */
    onImageMouseLeave?: MouseEventHandler<HTMLImageElement>;
    /**
     * Invoked when the wrapper receives focus.
     */
    onWrapperFocus?: FocusEventHandler<HTMLElement>;
    /**
     * Invoked when the wrapper loses focus.
     */
    onWrapperBlur?: FocusEventHandler<HTMLElement>;
}

export type ImageBodyViewModel = ViewModel<ImageBodyViewSnapshot, ImageBodyViewActions>;

interface ImageBodyViewProps {
    /**
     * View model driving the media rendering.
     */
    vm: ImageBodyViewModel;
    /**
     * Optional class name for the root element.
     */
    className?: string;
    /**
     * Optional content rendered after the media block, typically the file/info row.
     */
    children?: PropsWithChildren["children"];
    /**
     * Optional ref forwarded to the image element used for preloading or display.
     */
    imageRef?: RefObject<HTMLImageElement | null>;
}

function renderPlaceholder(
    placeholder: ImageBodyViewPlaceholder | undefined,
    blurhash: string | undefined,
    maxWidth: number | undefined,
    maxHeight: number | undefined,
    placeholderAriaLabel: string | undefined,
): ReactNode {
    if (placeholder === ImageBodyViewPlaceholder.NONE) {
        return null;
    }

    if (placeholder === ImageBodyViewPlaceholder.STICKER) {
        return <StickerIcon aria-hidden className={styles.stickerPlaceholderIcon} />;
    }

    if (placeholder === ImageBodyViewPlaceholder.BLURHASH && blurhash && maxWidth && maxHeight) {
        return <Blurhash className="mx_Blurhash" hash={blurhash} width={maxWidth} height={maxHeight} />;
    }

    return <InlineSpinner aria-label={placeholderAriaLabel ?? "Loading"} role="progressbar" />;
}

function renderHiddenMediaButton(
    label: string | undefined,
    onRevealMedia: MouseEventHandler<HTMLButtonElement> | undefined,
): JSX.Element {
    return (
        <button
            type="button"
            className={classNames("mx_HiddenMediaPlaceholder", styles.hiddenMediaPlaceholder)}
            onClick={onRevealMedia}
        >
            <span className={styles.hiddenMediaPlaceholderContent}>
                <VisibilityOnIcon />
                <span>{label}</span>
            </span>
        </button>
    );
}

function wrapContent(
    wrapper: ImageBodyViewWrapper | undefined,
    href: string | undefined,
    target: HTMLAttributeAnchorTarget | undefined,
    wrapperClassName: string | undefined,
    onActivate: MouseEventHandler<HTMLElement> | undefined,
    onWrapperFocus: FocusEventHandler<HTMLElement> | undefined,
    onWrapperBlur: FocusEventHandler<HTMLElement> | undefined,
    content: JSX.Element,
): JSX.Element {
    if (wrapper === ImageBodyViewWrapper.LINK && href) {
        return (
            <a
                href={href}
                target={target}
                className={classNames(styles.interactiveWrapper, wrapperClassName)}
                onClick={onActivate as MouseEventHandler<HTMLAnchorElement> | undefined}
                onFocus={onWrapperFocus as FocusEventHandler<HTMLAnchorElement> | undefined}
                onBlur={onWrapperBlur as FocusEventHandler<HTMLAnchorElement> | undefined}
            >
                {content}
            </a>
        );
    }

    if (wrapper === ImageBodyViewWrapper.DIV) {
        return (
            <div
                className={classNames(styles.interactiveWrapper, wrapperClassName)}
                onClick={onActivate as MouseEventHandler<HTMLDivElement> | undefined}
                onFocus={onWrapperFocus as FocusEventHandler<HTMLDivElement> | undefined}
                onBlur={onWrapperBlur as FocusEventHandler<HTMLDivElement> | undefined}
            >
                {content}
            </div>
        );
    }

    return content;
}

/**
 * Renders the visual content of image-like timeline items from snapshot state.
 */
export function ImageBodyView({ vm, className, children, imageRef }: Readonly<ImageBodyViewProps>): JSX.Element {
    const {
        state,
        altText,
        wrapper,
        wrapperClassName,
        href,
        target,
        imageSrc,
        preloadSrc,
        maxWidth,
        maxHeight,
        aspectRatio,
        imageWidth,
        showPlaceholder,
        placeholder,
        blurhash,
        placeholderAriaLabel,
        showHiddenMediaPlaceholder,
        hiddenMediaLabel,
        showGifLabel,
        gifLabel,
        banner,
        tooltip,
        tooltipPlacement,
        showLoadingSpacer,
        errorLabel,
    } = useViewModel(vm);

    const containerStyle: CSSProperties = {
        maxHeight,
        maxWidth,
        aspectRatio,
    };
    const imageBoxStyle: CSSProperties = {
        maxHeight,
        maxWidth,
        ...(imageWidth !== undefined ? { width: imageWidth } : {}),
    };

    let media: JSX.Element | null = null;

    if (state === ImageBodyViewState.ERROR) {
        media = (
            <span className={styles.error}>
                <ImageErrorIcon className={classNames("mx_MediaProcessingError_Icon", styles.errorIcon)} />
                <span>{errorLabel}</span>
            </span>
        );
    } else if (state === ImageBodyViewState.PRELOAD) {
        if (showHiddenMediaPlaceholder) {
            media = renderHiddenMediaButton(hiddenMediaLabel, vm.onRevealMedia);
        } else if (preloadSrc) {
            media = (
                <img
                    ref={imageRef}
                    className={styles.preloadImage}
                    src={preloadSrc}
                    alt={altText}
                    onError={vm.onImageError}
                    onLoad={vm.onImageLoad}
                />
            );
        }
    } else {
        const placeholderContent = renderPlaceholder(placeholder, blurhash, maxWidth, maxHeight, placeholderAriaLabel);
        const placeholderNode = showPlaceholder && placeholderContent ? (
                <div
                    className={classNames("mx_MImageBody_placeholder", styles.placeholder, {
                        [styles.placeholderBlurhash]: placeholder === ImageBodyViewPlaceholder.BLURHASH,
                    })}
                >
                    {placeholderContent}
                </div>
            ) : null;

        const imageNode = showHiddenMediaPlaceholder ? (
            <div style={{ width: maxWidth, height: maxHeight }}>
                {renderHiddenMediaButton(hiddenMediaLabel, vm.onRevealMedia)}
            </div>
        ) : imageSrc ? (
            <img
                ref={imageRef}
                className={classNames("mx_MImageBody_thumbnail", styles.thumbnail)}
                src={imageSrc}
                alt={altText}
                onError={vm.onImageError}
                onLoad={vm.onImageLoad}
                onMouseEnter={vm.onImageMouseEnter}
                onMouseLeave={vm.onImageMouseLeave}
            />
        ) : null;

        let thumbnail = (
            <div
                className={classNames("mx_MImageBody_thumbnail_container", styles.thumbnailContainer)}
                style={containerStyle}
                tabIndex={tooltip ? 0 : undefined}
            >
                {placeholderNode}

                <div style={imageBoxStyle}>
                    {imageNode}
                    {showGifLabel && <p className={classNames("mx_MImageBody_gifLabel", styles.gifLabel)}>{gifLabel}</p>}
                    {banner && <span className={classNames("mx_MImageBody_banner", styles.banner)}>{banner}</span>}
                </div>

                {showLoadingSpacer && !placeholderNode && (
                    <div className={styles.loadingSpacer} style={{ height: maxHeight, width: maxWidth }} />
                )}
            </div>
        );

        if (tooltip) {
            // Compound requires an interactive trigger for focus-triggered tooltips.
            thumbnail = (
                <Tooltip description={tooltip} placement={tooltipPlacement ?? "right"} isTriggerInteractive={true}>
                    {thumbnail}
                </Tooltip>
            );
        }

        media = showHiddenMediaPlaceholder
            ? thumbnail
            : wrapContent(
                  wrapper,
                  href,
                  target,
                  wrapperClassName,
                  vm.onActivate,
                  vm.onWrapperFocus,
                  vm.onWrapperBlur,
                  thumbnail,
              );
    }

    return <div className={classNames(styles.root, className)}>{media}{children}</div>;
}
