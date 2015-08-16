// Copyright (c) Microsoft Corporation.  All Rights Reserved. Licensed under the MIT License. See License.txt in the project root for license information.

export declare class AnimatedList {
	constructor(element?: HTMLElement, options?: any);
	children: HTMLElement[];
	childrenInDom: HTMLElement[];
	appendChild(element: HTMLElement): void;
	removeChild(element: HTMLElement): void;
}